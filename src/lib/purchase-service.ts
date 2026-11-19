import "server-only";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { db } from "./db";
import { BusinessError } from "./action";
import { logActivity } from "./activity";
import { computeTotals } from "./calc";
import { paymentStatusFor } from "./documents";
import { formatMAD } from "./money";
import { PAYMENT_METHODS } from "./status";
import { addDays, todayUTC } from "./utils";
import type { ServiceContext } from "./invoice-service";

/** Totaux d'une facture fournisseur : HT saisi, TVA et TTC calculées en arithmétique entière. */
export function purchaseTotals(subtotalCents: number, taxRate: number) {
  const t = computeTotals([{ quantity: 1000, unitPrice: subtotalCents, discount: 0, taxRate }]);
  return { subtotal: BigInt(t.subtotal), taxTotal: BigInt(t.taxTotal), total: BigInt(t.total) };
}

async function lockPurchase(tx: Prisma.TransactionClient, id: string, companyId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Purchase" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
  if (rows.length === 0) throw new BusinessError("Facture fournisseur introuvable.");
  return tx.purchase.findUniqueOrThrow({ where: { id }, include: { supplier: { select: { name: true } } } });
}

/** Recalcule montant payé et situation de règlement depuis les paiements actifs uniquement. */
export async function syncPurchasePayments(tx: Prisma.TransactionClient, purchaseId: string) {
  const p = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId }, select: { total: true } });
  const agg = await tx.purchasePayment.aggregate({ where: { purchaseId, voidedAt: null }, _sum: { amount: true } });
  const paid = agg._sum.amount ?? 0n;
  return tx.purchase.update({ where: { id: purchaseId }, data: { amountPaid: paid, paymentStatus: paymentStatusFor(p.total, paid) } });
}

export interface PurchasePaymentInput {
  purchaseId: string;
  amount: number;
  date: Date;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}

async function resultFor(paymentId: string, duplicate: boolean) {
  const p = await db.purchasePayment.findUniqueOrThrow({ where: { id: paymentId }, include: { purchase: { select: { paymentStatus: true, total: true, amountPaid: true } } } });
  return { paymentId: p.id, paymentStatus: p.purchase.paymentStatus, amountPaid: Number(p.purchase.amountPaid), balance: Number(p.purchase.total - p.purchase.amountPaid), duplicate };
}

export async function recordPurchasePaymentService(ctx: ServiceContext, input: PurchasePaymentInput) {
  const existing = await db.purchasePayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.companyId !== ctx.companyId || existing.purchaseId !== input.purchaseId) throw new BusinessError("Soumission invalide.");
    return resultFor(existing.id, true);
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new BusinessError("Le montant doit être supérieur à zéro.", { amount: "Montant invalide" });
  try {
    const id = await db.$transaction(async (tx) => {
      const p = await lockPurchase(tx, input.purchaseId, ctx.companyId);
      if (p.cancelledAt) throw new BusinessError("Impossible de régler une facture fournisseur annulée.");
      const agg = await tx.purchasePayment.aggregate({ where: { purchaseId: p.id, voidedAt: null }, _sum: { amount: true } });
      const balance = p.total - (agg._sum.amount ?? 0n);
      const amount = BigInt(input.amount);
      if (balance <= 0n) throw new BusinessError("Cette facture fournisseur est déjà entièrement réglée.");
      if (amount > balance) throw new BusinessError("Le montant dépasse le reste à payer.", { amount: `Maximum : ${formatMAD(balance)}` });
      if (input.date < p.issueDate) throw new BusinessError("Date de paiement antérieure à la facture.", { date: "Doit suivre la date de facture" });
      if (input.date > addDays(todayUTC(), 1)) throw new BusinessError("La date de paiement ne peut pas être dans le futur.", { date: "Date future non autorisée" });
      const pay = await tx.purchasePayment.create({
        data: { companyId: ctx.companyId, purchaseId: p.id, amount, date: input.date, method: input.method, reference: input.reference ?? null, notes: input.notes ?? null, idempotencyKey: input.idempotencyKey, createdById: ctx.userId },
      });
      const u = await syncPurchasePayments(tx, p.id);
      const left = u.total - u.amountPaid;
      await logActivity({
        companyId: ctx.companyId, userId: ctx.userId, type: "purchase.paid", entityType: "purchase", entityId: p.id, amount,
        message: `Paiement de ${formatMAD(amount)} à ${p.supplier.name} (${p.reference}, ${PAYMENT_METHODS[input.method].toLowerCase()})${left > 0n ? ` — reste ${formatMAD(left)}` : " — facture soldée"}`,
      }, tx);
      return pay.id;
    });
    return resultFor(id, false);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const p = await db.purchasePayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (p) return resultFor(p.id, true);
    }
    throw err;
  }
}

export async function voidPurchasePaymentService(ctx: ServiceContext, paymentId: string, reason: string) {
  const why = reason.trim();
  if (why.length < 3) throw new BusinessError("Indiquez le motif de l'annulation.", { reason: "3 caractères minimum" });
  return db.$transaction(async (tx) => {
    const payment = await tx.purchasePayment.findFirst({ where: { id: paymentId, companyId: ctx.companyId } });
    if (!payment) throw new BusinessError("Paiement introuvable.");
    const p = await lockPurchase(tx, payment.purchaseId, ctx.companyId);
    const fresh = await tx.purchasePayment.findUniqueOrThrow({ where: { id: paymentId } });
    if (fresh.voidedAt) throw new BusinessError("Ce paiement est déjà annulé.");
    await tx.purchasePayment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: why.slice(0, 300) } });
    const u = await syncPurchasePayments(tx, p.id);
    await logActivity({ companyId: ctx.companyId, userId: ctx.userId, type: "purchase.payment_voided", entityType: "purchase", entityId: p.id, amount: payment.amount, message: `Paiement de ${formatMAD(payment.amount)} à ${p.supplier.name} annulé (${p.reference}) — motif : ${why}` }, tx);
    return u;
  });
}
