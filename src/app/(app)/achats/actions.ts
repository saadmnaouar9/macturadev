"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { purchaseSchema, purchasePaymentSchema } from "@/lib/validation-modules";
import { dateOrThrow } from "@/lib/documents";
import { purchaseTotals, recordPurchasePaymentService, voidPurchasePaymentService } from "@/lib/purchase-service";
import { formatMAD } from "@/lib/money";

export async function savePurchase(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const d = purchaseSchema.parse(input);
    const supplier = await db.supplier.findFirst({ where: { id: d.supplierId, companyId }, select: { name: true } });
    if (!supplier) throw new BusinessError("Fournisseur introuvable.", { supplierId: "Sélectionnez un fournisseur valide" });
    const totals = purchaseTotals(d.subtotal, d.taxRate);
    const data = { supplierId: d.supplierId, reference: d.reference, issueDate: dateOrThrow(d.issueDate, "issueDate"), dueDate: dateOrThrow(d.dueDate, "dueDate"), category: d.category, taxRate: d.taxRate, notes: d.notes, ...totals };
    if (id) {
      await db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Purchase" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
        if (!rows.length) throw new BusinessError("Facture fournisseur introuvable.");
        const p = await tx.purchase.findUniqueOrThrow({ where: { id } });
        if (p.cancelledAt) throw new BusinessError("Une facture annulée ne peut plus être modifiée.");
        const active = await tx.purchasePayment.count({ where: { purchaseId: id, voidedAt: null } });
        if (active > 0) throw new BusinessError("Cette facture a déjà reçu des paiements : annulez-les avant de la modifier.");
        await tx.purchase.update({ where: { id }, data });
        await logActivity({ companyId, userId: auth.user.id, type: "purchase.updated", entityType: "purchase", entityId: id, message: `Achat ${d.reference} modifié (${supplier.name})`, amount: totals.total }, tx);
      });
    } else {
      await db.$transaction(async (tx) => {
        const p = await tx.purchase.create({ data: { ...data, companyId } });
        await logActivity({ companyId, userId: auth.user.id, type: "purchase.created", entityType: "purchase", entityId: p.id, message: `Achat ${d.reference} enregistré — ${supplier.name} (${formatMAD(totals.total)} TTC)`, amount: totals.total }, tx);
      });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Achat mis à jour" : "Achat enregistré");
}

export async function cancelPurchase(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Purchase" WHERE id = ${id} AND "companyId" = ${auth.company.id} FOR UPDATE`;
      if (!rows.length) throw new BusinessError("Facture fournisseur introuvable.");
      const p = await tx.purchase.findUniqueOrThrow({ where: { id } });
      if (p.cancelledAt) throw new BusinessError("Cette facture est déjà annulée.");
      if ((await tx.purchasePayment.count({ where: { purchaseId: id, voidedAt: null } })) > 0) throw new BusinessError("Annulez d'abord les paiements enregistrés.");
      await tx.purchase.update({ where: { id }, data: { cancelledAt: new Date() } });
      await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "purchase.cancelled", entityType: "purchase", entityId: id, message: `Achat ${p.reference} annulé`, amount: p.total }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Facture fournisseur annulée");
}

export async function deletePurchase(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const p = await db.purchase.findFirst({ where: { id, companyId: auth.company.id }, include: { _count: { select: { payments: true } } } });
    if (!p) throw new BusinessError("Facture fournisseur introuvable.");
    if (p._count.payments > 0) throw new BusinessError("Cette facture a un historique de paiements : annulez-la plutôt que de la supprimer.");
    await db.purchase.delete({ where: { id } });
    await db.activity.deleteMany({ where: { companyId: auth.company.id, entityId: id } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Achat supprimé");
}

export async function addPurchasePayment(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const d = purchasePaymentSchema.parse(input);
    const r = await recordPurchasePaymentService({ companyId: auth.company.id, userId: auth.user.id }, { ...d, date: dateOrThrow(d.date, "date") });
    revalidatePath("/", "layout");
    return r;
  }, "Paiement enregistré");
}

export async function voidPurchasePayment(paymentId: string, reason: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    await voidPurchasePaymentService({ companyId: auth.company.id, userId: auth.user.id }, paymentId, reason);
    revalidatePath("/", "layout");
    return { id: paymentId };
  }, "Paiement annulé — le solde a été recalculé");
}
