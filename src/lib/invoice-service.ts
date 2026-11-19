import "server-only";
import { Prisma, type InvoiceStatus, type PaymentMethod } from "@prisma/client";
import { db } from "./db";
import { BusinessError } from "./action";
import { logActivity } from "./activity";
import { nextDocumentNumber } from "./numbering";
import { lockInvoice, syncInvoicePayments } from "./documents";
import { formatMAD } from "./money";
import { PAYMENT_METHODS } from "./status";
import { addDays, todayUTC } from "./utils";

/**
 * Service métier des factures — indépendant de la couche HTTP (testable directement).
 *
 * Deux dimensions stockées séparément :
 *   status (cycle de vie)      DRAFT ──émettre──▶ ISSUED ──envoyer──▶ SENT
 *                                                  └──────annuler────▶ CANCELLED ◀── SENT
 *   paymentStatus (règlement)  UNPAID ▶ PARTIAL ▶ PAID — toujours recalculé depuis les paiements actifs
 *
 * Toutes les opérations financières s'exécutent dans une transaction avec verrou de ligne
 * (SELECT … FOR UPDATE) sur la facture, et laissent une trace dans le journal d'activité.
 */

export interface ServiceContext {
  companyId: string;
  userId: string | null;
}

export const LIFECYCLE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["ISSUED"],
  ISSUED: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
  CANCELLED: [],
};

const TRANSITION_ERRORS: Partial<Record<`${InvoiceStatus}>${InvoiceStatus}`, string>> = {
  "ISSUED>ISSUED": "Cette facture est déjà émise.",
  "SENT>ISSUED": "Cette facture est déjà émise.",
  "CANCELLED>ISSUED": "Cette facture est annulée.",
  "DRAFT>SENT": "Émettez la facture avant de l'envoyer.",
  "SENT>SENT": "Cette facture est déjà marquée comme envoyée.",
  "CANCELLED>SENT": "Cette facture est annulée.",
  "DRAFT>CANCELLED": "Un brouillon se supprime, il ne s'annule pas.",
  "CANCELLED>CANCELLED": "Cette facture est déjà annulée.",
};

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus) {
  if (!LIFECYCLE_TRANSITIONS[from].includes(to)) {
    throw new BusinessError(TRANSITION_ERRORS[`${from}>${to}`] ?? "Ce changement de statut n'est pas autorisé.");
  }
}

/** Émission : attribution du numéro définitif (séquence continue par année). */
export async function issueInvoiceService(ctx: ServiceContext, id: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { invoicePrefix: true } });
  return db.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, id, ctx.companyId);
    assertTransition(inv.status, "ISSUED");
    if (inv.total <= 0n) throw new BusinessError("Le montant de la facture doit être supérieur à zéro.");
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: inv.customerId }, select: { name: true } });
    const number = await nextDocumentNumber(tx, ctx.companyId, "INVOICE", company.invoicePrefix, inv.issueDate);
    const r = await tx.invoice.update({ where: { id }, data: { number, status: "ISSUED", issuedAt: new Date() } });
    await logActivity({ companyId: ctx.companyId, userId: ctx.userId, type: "invoice.issued", entityType: "invoice", entityId: id, message: `Facture ${number} émise pour ${customer.name}`, amount: inv.total }, tx);
    return r;
  });
}

/** Envoi : ISSUED → SENT. N'a aucun effet sur la situation de règlement. */
export async function markInvoiceSentService(ctx: ServiceContext, id: string) {
  return db.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, id, ctx.companyId);
    assertTransition(inv.status, "SENT");
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: inv.customerId }, select: { name: true } });
    const r = await tx.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    await logActivity({ companyId: ctx.companyId, userId: ctx.userId, type: "invoice.sent", entityType: "invoice", entityId: id, message: `Facture ${inv.number} envoyée à ${customer.name}`, amount: inv.total }, tx);
    return r;
  });
}

/** Annulation : possible uniquement sans paiement actif. Le numéro reste attribué. */
export async function cancelInvoiceService(ctx: ServiceContext, id: string) {
  return db.$transaction(async (tx) => {
    const inv = await lockInvoice(tx, id, ctx.companyId);
    assertTransition(inv.status, "CANCELLED");
    const active = await tx.payment.count({ where: { invoiceId: id, voidedAt: null } });
    if (active > 0) throw new BusinessError("Annulez d'abord les paiements enregistrés sur cette facture.");
    const r = await tx.invoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await logActivity({ companyId: ctx.companyId, userId: ctx.userId, type: "invoice.cancelled", entityType: "invoice", entityId: id, message: `Facture ${inv.number} annulée`, amount: inv.total }, tx);
    return r;
  });
}

export interface PaymentInput {
  invoiceId: string;
  amount: number; // centimes
  date: Date;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}

export interface PaymentResult {
  paymentId: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  amountPaid: number;
  balance: number;
  duplicate: boolean;
}

async function resultFor(paymentId: string, duplicate: boolean): Promise<PaymentResult> {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: { select: { paymentStatus: true, total: true, amountPaid: true } } } });
  return { paymentId: p.id, paymentStatus: p.invoice.paymentStatus, amountPaid: Number(p.invoice.amountPaid), balance: Number(p.invoice.total - p.invoice.amountPaid), duplicate };
}

/**
 * Enregistre un paiement partiel ou total.
 *  - facture verrouillée pendant la transaction ;
 *  - interdit sur un brouillon ou une facture annulée ;
 *  - montant strictement positif et ≤ reste à payer (calculé sur les paiements actifs) ;
 *  - idempotence garantie par l'index unique `Payment.idempotencyKey` en base.
 */
export async function recordPaymentService(ctx: ServiceContext, input: PaymentInput): Promise<PaymentResult> {
  const existing = await db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.companyId !== ctx.companyId || existing.invoiceId !== input.invoiceId) throw new BusinessError("Soumission invalide.");
    return resultFor(existing.id, true);
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new BusinessError("Le montant doit être supérieur à zéro.", { amount: "Montant invalide" });

  try {
    const paymentId = await db.$transaction(async (tx) => {
      const inv = await lockInvoice(tx, input.invoiceId, ctx.companyId);
      if (inv.status === "DRAFT") throw new BusinessError("Émettez la facture avant d'enregistrer un paiement.");
      if (inv.status === "CANCELLED") throw new BusinessError("Impossible d'encaisser une facture annulée.");
      // Reste à payer recalculé depuis les paiements actifs (source de vérité), pas depuis le cache
      const agg = await tx.payment.aggregate({ where: { invoiceId: inv.id, voidedAt: null }, _sum: { amount: true } });
      const balance = inv.total - (agg._sum.amount ?? 0n);
      const amount = BigInt(input.amount);
      if (balance <= 0n) throw new BusinessError("Cette facture est déjà entièrement réglée.");
      if (amount > balance) throw new BusinessError("Le montant dépasse le reste à payer.", { amount: `Maximum : ${formatMAD(balance)}` });
      if (input.date < inv.issueDate) throw new BusinessError("Date de paiement antérieure à la facture.", { date: "Doit suivre la date d'émission" });
      if (input.date > addDays(todayUTC(), 1)) throw new BusinessError("La date de paiement ne peut pas être dans le futur.", { date: "Date future non autorisée" });

      const payment = await tx.payment.create({
        data: {
          companyId: ctx.companyId, invoiceId: inv.id, amount, date: input.date, method: input.method,
          reference: input.reference ?? null, notes: input.notes ?? null, idempotencyKey: input.idempotencyKey, createdById: ctx.userId,
        },
      });
      const updated = await syncInvoicePayments(tx, inv.id);
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: inv.customerId }, select: { name: true } });
      const left = updated.total - updated.amountPaid;
      await logActivity({
        companyId: ctx.companyId, userId: ctx.userId, type: "payment.created", entityType: "invoice", entityId: inv.id, amount,
        message: `Paiement de ${formatMAD(amount)} reçu de ${customer.name} (${inv.number}, ${PAYMENT_METHODS[input.method].toLowerCase()})${left > 0n ? ` — reste ${formatMAD(left)}` : " — facture soldée"}`,
      }, tx);
      return payment.id;
    });
    return resultFor(paymentId, false);
  } catch (err) {
    // Soumissions simultanées avec la même clé : l'index unique rejette la seconde
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const p = await db.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (p) return resultFor(p.id, true);
    }
    throw err;
  }
}

/** Annule un paiement : il reste dans l'historique ; solde et situation de règlement recalculés. */
export async function voidPaymentService(ctx: ServiceContext, paymentId: string, reason: string) {
  const why = reason.trim();
  if (why.length < 3) throw new BusinessError("Indiquez le motif de l'annulation.", { reason: "3 caractères minimum" });
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, companyId: ctx.companyId } });
    if (!payment) throw new BusinessError("Paiement introuvable.");
    const inv = await lockInvoice(tx, payment.invoiceId, ctx.companyId);
    // Relecture sous verrou : évite une double annulation concurrente
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (fresh.voidedAt) throw new BusinessError("Ce paiement est déjà annulé.");
    await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: why.slice(0, 300) } });
    const updated = await syncInvoicePayments(tx, inv.id);
    await logActivity({ companyId: ctx.companyId, userId: ctx.userId, type: "payment.voided", entityType: "invoice", entityId: inv.id, amount: payment.amount, message: `Paiement de ${formatMAD(payment.amount)} annulé (${inv.number}) — motif : ${why}` }, tx);
    return updated;
  });
}
