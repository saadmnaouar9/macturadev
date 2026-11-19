"use server";

import { revalidatePath } from "next/cache";
import type { QuoteStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";
import { quoteSchema } from "@/lib/validation";
import { assertDocumentRefs, buildDocument, dateOrThrow } from "@/lib/documents";
import { formatMAD } from "@/lib/money";
import { addDays, todayUTC } from "@/lib/utils";

const EDITABLE: QuoteStatus[] = ["DRAFT", "SENT"];

export async function saveQuote(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const data = quoteSchema.parse(input);
    const customer = await assertDocumentRefs(companyId, data.customerId, data.items);
    const built = buildDocument(data.items, data.globalDiscountType, data.globalDiscount);
    const issueDate = dateOrThrow(data.issueDate, "issueDate");
    const expiryDate = dateOrThrow(data.expiryDate, "expiryDate");
    const common = {
      customerId: data.customerId, issueDate, expiryDate, reference: data.reference, ...built.global,
      notes: data.notes, terms: data.terms, ...built.totals,
    };

    if (id) {
      const existing = await db.quote.findFirst({ where: { id, companyId }, include: { invoice: { select: { id: true } } } });
      if (!existing) throw new BusinessError("Devis introuvable.");
      if (existing.invoice) throw new BusinessError("Ce devis a déjà été converti en facture et ne peut plus être modifié.");
      if (!EDITABLE.includes(existing.status)) throw new BusinessError("Seuls les devis en brouillon ou envoyés peuvent être modifiés.");
      await db.$transaction(async (tx) => {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quote.update({ where: { id }, data: { ...common, items: { create: built.items } } });
        await logActivity({ companyId, userId: auth.user.id, type: "quote.updated", entityType: "quote", entityId: id, message: `Devis ${existing.number} modifié`, amount: built.total }, tx);
      });
      revalidatePath("/", "layout");
      return { id };
    }

    const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { quotePrefix: true } });
    const quote = await db.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, companyId, "QUOTE", company.quotePrefix, issueDate);
      const q = await tx.quote.create({ data: { ...common, companyId, number, items: { create: built.items } } });
      await logActivity({ companyId, userId: auth.user.id, type: "quote.created", entityType: "quote", entityId: q.id, message: `Devis ${number} créé pour ${customer.name}`, amount: built.total }, tx);
      return q;
    });
    revalidatePath("/", "layout");
    return { id: quote.id };
  }, id ? "Devis mis à jour" : "Devis créé");
}

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "ACCEPTED", "REJECTED"],
  SENT: ["ACCEPTED", "REJECTED", "DRAFT"],
  ACCEPTED: ["SENT"],
  REJECTED: ["SENT"],
  EXPIRED: ["SENT", "ACCEPTED", "REJECTED"],
};

const STATUS_MESSAGES: Record<QuoteStatus, string> = {
  DRAFT: "Devis repassé en brouillon",
  SENT: "Devis marqué comme envoyé",
  ACCEPTED: "Devis accepté par le client",
  REJECTED: "Devis marqué comme refusé",
  EXPIRED: "Devis expiré",
};

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const q = await db.quote.findFirst({ where: { id, companyId }, include: { customer: { select: { name: true } }, invoice: { select: { id: true } } } });
    if (!q) throw new BusinessError("Devis introuvable.");
    if (q.invoice) throw new BusinessError("Ce devis a été converti en facture : son statut est figé.");
    if (!TRANSITIONS[q.status].includes(status)) throw new BusinessError("Ce changement de statut n'est pas autorisé.");
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: {
          status,
          sentAt: status === "SENT" ? (q.sentAt ?? now) : status === "DRAFT" ? null : q.sentAt ?? now,
          acceptedAt: status === "ACCEPTED" ? now : null,
          rejectedAt: status === "REJECTED" ? now : null,
        },
      });
      const msg =
        status === "ACCEPTED" ? `${q.customer.name} a accepté le devis ${q.number}` :
        status === "REJECTED" ? `${q.customer.name} a refusé le devis ${q.number}` :
        status === "SENT" ? `Devis ${q.number} envoyé à ${q.customer.name}` : `Devis ${q.number} repassé en brouillon`;
      await logActivity({ companyId, userId: auth.user.id, type: `quote.${status.toLowerCase()}`, entityType: "quote", entityId: id, message: msg, amount: q.total }, tx);
    });
    revalidatePath("/", "layout");
    return { id };
  }, STATUS_MESSAGES[status]);
}

export async function deleteQuote(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const q = await db.quote.findFirst({ where: { id, companyId: auth.company.id }, include: { invoice: { select: { id: true } } } });
    if (!q) throw new BusinessError("Devis introuvable.");
    if (q.invoice) throw new BusinessError("Ce devis est lié à une facture et ne peut pas être supprimé.");
    await db.quote.delete({ where: { id } });
    await db.activity.deleteMany({ where: { companyId: auth.company.id, entityId: id } });
    revalidatePath("/", "layout");
    return { id };
  }, "Devis supprimé");
}

export async function duplicateQuote(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const q = await db.quote.findFirst({ where: { id, companyId }, include: { items: { orderBy: { position: "asc" } } } });
    if (!q) throw new BusinessError("Devis introuvable.");
    const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { quotePrefix: true, quoteValidityDays: true } });
    const issueDate = todayUTC();
    const copy = await db.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, companyId, "QUOTE", company.quotePrefix, issueDate);
      const created = await tx.quote.create({
        data: {
          companyId, customerId: q.customerId, number, issueDate, expiryDate: addDays(issueDate, company.quoteValidityDays),
          reference: q.reference, globalDiscountType: q.globalDiscountType, globalDiscount: q.globalDiscount, globalDiscountAmount: q.globalDiscountAmount, notes: q.notes, terms: q.terms,
          subtotal: q.subtotal, discountTotal: q.discountTotal, taxableTotal: q.taxableTotal, taxTotal: q.taxTotal, total: q.total,
          items: { create: q.items.map(({ id: _i, quoteId: _q, ...it }) => it) },
        },
      });
      await logActivity({ companyId, userId: auth.user.id, type: "quote.created", entityType: "quote", entityId: created.id, message: `Devis ${number} créé (copie de ${q.number})`, amount: q.total }, tx);
      return created;
    });
    revalidatePath("/", "layout");
    return { id: copy.id };
  }, "Devis dupliqué");
}

/**
 * Convertit un devis accepté en facture brouillon : client, lignes, quantités, prix, remises
 * et TVA sont copiés à l'identique. Le lien devis ↔ facture est unique (pas de double conversion).
 */
export async function convertQuoteToInvoice(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const result = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Quote" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
      if (!locked.length) throw new BusinessError("Devis introuvable.");
      const q = await tx.quote.findUniqueOrThrow({
        where: { id },
        include: { items: { orderBy: { position: "asc" } }, invoice: { select: { id: true } }, customer: { select: { name: true, paymentDays: true } } },
      });
      if (q.invoice) throw new BusinessError("Ce devis a déjà été converti en facture.");
      if (q.status !== "ACCEPTED") throw new BusinessError("Seul un devis accepté peut être converti en facture.");
      const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { defaultPaymentDays: true, invoiceNotes: true, invoiceTerms: true } });
      const issueDate = todayUTC();
      const days = q.customer.paymentDays ?? company.defaultPaymentDays;
      const invoice = await tx.invoice.create({
        data: {
          companyId, customerId: q.customerId, quoteId: q.id, status: "DRAFT", issueDate, dueDate: addDays(issueDate, days),
          paymentTerms: days === 0 ? "Paiement à réception" : `${days} jours`,
          reference: q.reference ?? `Devis ${q.number}`, globalDiscountType: q.globalDiscountType, globalDiscount: q.globalDiscount, globalDiscountAmount: q.globalDiscountAmount,
          notes: company.invoiceNotes ?? q.notes, terms: company.invoiceTerms ?? q.terms,
          subtotal: q.subtotal, discountTotal: q.discountTotal, taxableTotal: q.taxableTotal, taxTotal: q.taxTotal, total: q.total,
          items: { create: q.items.map(({ id: _i, quoteId: _q, ...it }) => it) },
        },
      });
      await logActivity({ companyId, userId: auth.user.id, type: "quote.converted", entityType: "invoice", entityId: invoice.id, message: `Devis ${q.number} converti en facture (${formatMAD(q.total)})`, amount: q.total }, tx);
      return invoice;
    });
    revalidatePath("/", "layout");
    return { invoiceId: result.id };
  }, "Facture créée à partir du devis");
}
