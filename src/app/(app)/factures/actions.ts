"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { invoiceSchema, paymentSchema } from "@/lib/validation";
import { assertDocumentRefs, buildDocument, dateOrThrow, lockInvoice } from "@/lib/documents";
import { cancelInvoiceService, issueInvoiceService, markInvoiceSentService, recordPaymentService, voidPaymentService } from "@/lib/invoice-service";
import { addDays, todayUTC } from "@/lib/utils";

// Cycle de vie (status)        : DRAFT → ISSUED → SENT, ou CANCELLED
// Règlement (paymentStatus)    : UNPAID → PARTIAL → PAID — dérivé des paiements actifs
// Ces deux dimensions évoluent indépendamment : émettre, envoyer et encaisser sont des événements distincts.

export async function saveInvoice(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const data = invoiceSchema.parse(input);
    const customer = await assertDocumentRefs(companyId, data.customerId, data.items);
    const built = buildDocument(data.items, data.globalDiscountType, data.globalDiscount);
    const issueDate = dateOrThrow(data.issueDate, "issueDate");
    const dueDate = dateOrThrow(data.dueDate, "dueDate");
    const common = {
      customerId: data.customerId, issueDate, dueDate, reference: data.reference, paymentTerms: data.paymentTerms,
      ...built.global, notes: data.notes, terms: data.terms, ...built.totals,
    };

    if (id) {
      const updated = await db.$transaction(async (tx) => {
        const inv = await lockInvoice(tx, id, companyId);
        if (inv.status === "CANCELLED") throw new BusinessError("Une facture annulée ne peut plus être modifiée.");
        if (inv.paymentStatus !== "UNPAID" || inv.amountPaid > 0n) throw new BusinessError("Cette facture a déjà reçu des paiements : elle ne peut plus être modifiée.");
        if (inv.number && inv.issueDate.getUTCFullYear() !== issueDate.getUTCFullYear()) {
          throw new BusinessError("L'année d'émission ne peut pas changer après numérotation.", { issueDate: "Même année que le numéro attribué" });
        }
        if (built.totals.total <= 0n && inv.status !== "DRAFT") throw new BusinessError("Le montant d'une facture émise doit être supérieur à zéro.");
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        const r = await tx.invoice.update({ where: { id }, data: { ...common, items: { create: built.items } } });
        await logActivity({ companyId, userId: auth.user.id, type: "invoice.updated", entityType: "invoice", entityId: id, message: `Facture ${r.number ?? "brouillon"} modifiée`, amount: built.total }, tx);
        return r;
      });
      revalidatePath("/", "layout");
      return { id: updated.id };
    }

    const inv = await db.$transaction(async (tx) => {
      const created = await tx.invoice.create({ data: { ...common, companyId, status: "DRAFT", paymentStatus: "UNPAID", items: { create: built.items } } });
      await logActivity({ companyId, userId: auth.user.id, type: "invoice.created", entityType: "invoice", entityId: created.id, message: `Facture brouillon créée pour ${customer.name}`, amount: built.total }, tx);
      return created;
    });
    revalidatePath("/", "layout");
    return { id: inv.id };
  }, id ? "Facture mise à jour" : "Facture brouillon créée");
}

/** Émission : DRAFT → ISSUED (numéro définitif). */
export async function issueInvoice(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const r = await issueInvoiceService({ companyId: auth.company.id, userId: auth.user.id }, id);
    revalidatePath("/", "layout");
    return { id: r.id, number: r.number };
  }, "Facture émise");
}

/** Envoi : ISSUED → SENT (sans effet sur le règlement). */
export async function markInvoiceSent(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    await markInvoiceSentService({ companyId: auth.company.id, userId: auth.user.id }, id);
    revalidatePath("/", "layout");
    return { id };
  }, "Facture marquée comme envoyée");
}

export async function cancelInvoice(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    await cancelInvoiceService({ companyId: auth.company.id, userId: auth.user.id }, id);
    revalidatePath("/", "layout");
    return { id };
  }, "Facture annulée");
}

export async function deleteInvoice(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const inv = await db.invoice.findFirst({ where: { id, companyId: auth.company.id } });
    if (!inv) throw new BusinessError("Facture introuvable.");
    if (inv.status !== "DRAFT") throw new BusinessError("Seuls les brouillons peuvent être supprimés. Annulez la facture à la place.");
    await db.invoice.delete({ where: { id } });
    await db.activity.deleteMany({ where: { companyId: auth.company.id, entityId: id } });
    revalidatePath("/", "layout");
    return { id };
  }, "Brouillon supprimé");
}

export async function duplicateInvoice(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const inv = await db.invoice.findFirst({ where: { id, companyId }, include: { items: { orderBy: { position: "asc" } }, customer: { select: { paymentDays: true } } } });
    if (!inv) throw new BusinessError("Facture introuvable.");
    const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { defaultPaymentDays: true } });
    const issueDate = todayUTC();
    const copy = await db.invoice.create({
      data: {
        companyId, customerId: inv.customerId, status: "DRAFT", paymentStatus: "UNPAID", issueDate, dueDate: addDays(issueDate, inv.customer.paymentDays ?? company.defaultPaymentDays),
        paymentTerms: inv.paymentTerms, reference: inv.reference, globalDiscountType: inv.globalDiscountType, globalDiscount: inv.globalDiscount, globalDiscountAmount: inv.globalDiscountAmount, notes: inv.notes, terms: inv.terms,
        subtotal: inv.subtotal, discountTotal: inv.discountTotal, taxableTotal: inv.taxableTotal, taxTotal: inv.taxTotal, total: inv.total,
        items: { create: inv.items.map(({ id: _i, invoiceId: _v, ...it }) => it) },
      },
    });
    revalidatePath("/", "layout");
    return { id: copy.id };
  }, "Facture dupliquée en brouillon");
}

const addPaymentSchema = paymentSchema.extend({ idempotencyKey: z.string().uuid("Clé de soumission invalide") });

export async function addPayment(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const data = addPaymentSchema.parse(input);
    const res = await recordPaymentService(
      { companyId: auth.company.id, userId: auth.user.id },
      { ...data, date: dateOrThrow(data.date, "date") },
    );
    revalidatePath("/", "layout");
    return res;
  }, "Paiement enregistré");
}

/** Annule un paiement erroné : il reste visible dans l'historique, le solde est recalculé. */
export async function voidPayment(paymentId: string, reason: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    await voidPaymentService({ companyId: auth.company.id, userId: auth.user.id }, paymentId, reason);
    revalidatePath("/", "layout");
    return { id: paymentId };
  }, "Paiement annulé — le solde a été recalculé");
}
