import "server-only";
import { db } from "./db";
import type { PaperCompany } from "@/components/documents/document-paper";

/** Données nécessaires à l'éditeur de devis / factures (strictement limitées à l'entreprise). */
export async function getEditorData(companyId: string) {
  const [company, customers, products, taxRates] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId } }),
    db.customer.findMany({
      where: { companyId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true, contactName: true, city: true, address: true, postalCode: true, ice: true, taxId: true, rc: true, email: true, paymentDays: true },
    }),
    db.product.findMany({
      where: { companyId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, type: true, name: true, description: true, sku: true, unit: true, unitPrice: true, taxRate: true },
    }),
    db.taxRate.findMany({ where: { companyId }, orderBy: { rate: "desc" } }),
  ]);
  return {
    company,
    paperCompany: toPaperCompany(company),
    customers,
    products: products.map((p) => ({ ...p, unitPrice: Number(p.unitPrice) })),
    taxRates: taxRates.map((t) => ({ name: t.name, rate: t.rate })),
  };
}

export function toPaperCompany(c: {
  name: string; nameAr: string | null; legalForm: string | null; address: string | null; city: string | null; postalCode: string | null; country: string;
  phone: string | null; email: string | null; website: string | null; ice: string | null; taxId: string | null; rc: string | null; rcCity: string | null;
  patente: string | null; cnss: string | null; capital: string | null; bankName: string | null; rib: string | null; accentColor: string;
}): PaperCompany {
  return {
    name: c.name, nameAr: c.nameAr, legalForm: c.legalForm, address: c.address, city: c.city, postalCode: c.postalCode, country: c.country,
    phone: c.phone, email: c.email, website: c.website, ice: c.ice, taxId: c.taxId, rc: c.rc, rcCity: c.rcCity, patente: c.patente,
    cnss: c.cnss, capital: c.capital, bankName: c.bankName, rib: c.rib, accentColor: c.accentColor,
  };
}

export function serializeItems(items: { productId: string | null; description: string; details: string | null; quantity: number; unit: string; unitPrice: bigint; discountType: "PERCENT" | "AMOUNT"; discount: number; discountAmount: bigint; taxRate: number }[]) {
  return items.map((it) => ({ ...it, unitPrice: Number(it.unitPrice), discountAmount: Number(it.discountAmount) }));
}
