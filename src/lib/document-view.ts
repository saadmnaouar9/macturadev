import "server-only";
import { db } from "./db";
import { computeTotals } from "./calc";
import { storedLineToInput } from "./documents";
import { toPaperCompany } from "./editor-data";
import type { PaperProps } from "@/components/documents/document-paper";

/**
 * Charge un devis ou une facture et produit les props d'affichage.
 * Les totaux sont recalculés depuis les lignes stockées (mêmes règles qu'à l'enregistrement)
 * pour disposer du détail par ligne et par taux de TVA.
 */
async function load(kind: "quote" | "invoice", companyId: string, id: string) {
  const include = { items: { orderBy: { position: "asc" as const } }, customer: true, company: true };
  if (kind === "quote") {
    const q = await db.quote.findFirst({ where: { id, companyId }, include: { ...include, invoice: { select: { id: true, number: true, status: true } } } });
    return q ? { kind, doc: q } : null;
  }
  const inv = await db.invoice.findFirst({
    where: { id, companyId },
    include: { ...include, quote: { select: { id: true, number: true } }, payments: { orderBy: { date: "desc" } } },
  });
  return inv ? { kind, doc: inv } : null;
}

export async function loadDocumentView(kind: "quote" | "invoice", companyId: string, id: string) {
  const r = await load(kind, companyId, id);
  if (!r) return null;
  const d = r.doc;
  const global = { type: d.globalDiscountType, value: d.globalDiscountType === "AMOUNT" ? Number(d.globalDiscountAmount) : d.globalDiscount };
  const inputs = d.items.map(storedLineToInput);
  const totals = computeTotals(inputs, global);
  const c = d.customer;
  const paper: PaperProps = {
    kind,
    number: d.number,
    issueDate: d.issueDate.toISOString(),
    secondDate: ("expiryDate" in d ? d.expiryDate : d.dueDate).toISOString(),
    reference: d.reference,
    paymentTerms: "paymentTerms" in d ? d.paymentTerms : null,
    company: toPaperCompany(d.company),
    customer: { name: c.name, nameAr: c.nameAr, contactName: c.contactName, address: c.address, city: c.city, postalCode: c.postalCode, country: c.country, ice: c.ice, taxId: c.taxId, rc: c.rc, email: c.email, phone: c.phone },
    items: d.items.map((it, i) => ({ description: it.description, details: it.details, quantity: it.quantity, unit: it.unit, unitPrice: inputs[i].unitPrice, discountType: it.discountType, discount: inputs[i].discount, taxRate: it.taxRate })),
    totals,
    globalDiscount: global,
    notes: d.notes,
    terms: d.terms,
    amountPaid: "amountPaid" in d ? Number(d.amountPaid) : undefined,
    watermark: kind === "invoice" && d.status === "DRAFT" ? "Brouillon" : d.status === "CANCELLED" ? "Annulée" : null,
  };
  // Contrôle d'intégrité : le total stocké doit correspondre au recalcul
  if (BigInt(totals.total) !== d.total) console.warn(`[document] écart de total sur ${kind} ${id}: ${d.total} ≠ ${totals.total}`);
  return { ...r, paper };
}

export async function loadActivities(companyId: string, entityId: string) {
  const rows = await db.activity.findMany({
    where: { companyId, entityId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, message: true, createdAt: true, user: { select: { name: true } } },
  });
  return rows.map((a) => ({ id: a.id, type: a.type, message: a.message, createdAt: a.createdAt.toISOString(), userName: a.user?.name ?? null }));
}
