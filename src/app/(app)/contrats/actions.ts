"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { contractSchema } from "@/lib/validation-modules";
import { buildDocument } from "@/lib/documents";
import { FREQUENCY_LABELS } from "@/lib/status";
import { addDays, formatDate, parseDateOnly, todayUTC } from "@/lib/utils";

export async function saveContract(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const d = contractSchema.parse(input);
    const customer = await db.customer.findFirst({ where: { id: d.customerId, companyId }, select: { name: true } });
    if (!customer) throw new BusinessError("Client introuvable.", { customerId: "Sélectionnez un client valide" });
    const data = { ...d, amount: BigInt(d.amount), startDate: parseDateOnly(d.startDate)!, endDate: d.endDate ? parseDateOnly(d.endDate) : null };
    if (id) {
      const r = await db.contract.updateMany({ where: { id, companyId }, data });
      if (r.count === 0) throw new BusinessError("Contrat introuvable.");
    } else {
      const c = await db.contract.create({ data: { ...data, companyId } });
      await logActivity({ companyId, userId: auth.user.id, type: "contract.created", entityType: "contract", entityId: c.id, message: `Contrat ${c.reference} créé pour ${customer.name}` });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Contrat mis à jour" : "Contrat créé");
}

export async function deleteContract(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const r = await db.contract.deleteMany({ where: { id, companyId: auth.company.id } });
    if (r.count === 0) throw new BusinessError("Contrat introuvable.");
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Contrat supprimé");
}

/** Génère une facture brouillon (une ligne) pour la période de facturation du contrat. */
export async function createInvoiceFromContract(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const c = await db.contract.findFirst({ where: { id, companyId }, include: { customer: { select: { name: true, paymentDays: true } } } });
    if (!c) throw new BusinessError("Contrat introuvable.");
    if (c.status !== "ACTIVE") throw new BusinessError("Seul un contrat actif peut être facturé.");
    if (c.amount <= 0n) throw new BusinessError("Renseignez le montant du contrat avant de facturer.");
    const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { defaultTaxRate: true, defaultPaymentDays: true, invoiceNotes: true, invoiceTerms: true } });
    const built = buildDocument([{ productId: null, description: `${c.title} — contrat ${c.reference}`, details: `${FREQUENCY_LABELS[c.frequency]} · à compter du ${formatDate(c.startDate, "numeric")}`, quantity: 1000, unit: "forfait", unitPrice: Number(c.amount), discountType: "PERCENT", discount: 0, taxRate: company.defaultTaxRate }], "PERCENT", 0);
    const issueDate = todayUTC();
    const days = c.customer.paymentDays ?? company.defaultPaymentDays;
    const inv = await db.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: { companyId, customerId: c.customerId, status: "DRAFT", paymentStatus: "UNPAID", issueDate, dueDate: addDays(issueDate, days), paymentTerms: days === 0 ? "Paiement à réception" : `${days} jours`, reference: `Contrat ${c.reference}`, notes: company.invoiceNotes, terms: company.invoiceTerms, ...built.global, ...built.totals, items: { create: built.items } },
      });
      await logActivity({ companyId, userId: auth.user.id, type: "contract.invoiced", entityType: "invoice", entityId: created.id, message: `Facture brouillon générée depuis le contrat ${c.reference} (${c.customer.name})`, amount: built.total }, tx);
      return created;
    });
    revalidatePath("/", "layout");
    return { invoiceId: inv.id };
  }, "Facture brouillon créée à partir du contrat");
}
