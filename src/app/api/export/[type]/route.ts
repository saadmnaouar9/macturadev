import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePeriod } from "@/lib/reports";
import { INVOICE_STATUS, PAYMENT_METHODS, invoiceDisplayStatus, purchaseDisplayStatus } from "@/lib/status";
import { centsToInput } from "@/lib/money";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise l'injection de formules dans Excel (=, +, -, @) et protège les séparateurs
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s.replace(",", "."))) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "");
const m = (x: bigint | number) => centsToInput(x);

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { type } = await params;
  const companyId = auth.company.id;
  const period = parsePeriod(req.nextUrl.searchParams.get("from") ?? undefined, req.nextUrl.searchParams.get("to") ?? undefined);
  const range = { gte: period.from, lt: period.to };
  let header: string[] = [];
  let rows: unknown[][] = [];

  if (type === "factures") {
    const inv = await db.invoice.findMany({ where: { companyId, status: { not: "DRAFT" }, issueDate: range }, include: { customer: { select: { name: true, ice: true } } }, orderBy: { issueDate: "asc" } });
    header = ["Numéro", "Date", "Échéance", "Client", "ICE client", "Total HT", "TVA", "Total TTC", "Encaissé", "Reste à payer", "Statut"];
    rows = inv.map((i) => [i.number, d(i.issueDate), d(i.dueDate), i.customer.name, i.customer.ice, m(i.taxableTotal), m(i.taxTotal), m(i.total), m(i.amountPaid), m(i.total - i.amountPaid), INVOICE_STATUS[invoiceDisplayStatus(i)].label]);
  } else if (type === "achats") {
    const p = await db.purchase.findMany({ where: { companyId, issueDate: range }, include: { supplier: { select: { name: true, ice: true } } }, orderBy: { issueDate: "asc" } });
    header = ["Référence", "Date", "Échéance", "Fournisseur", "ICE fournisseur", "Catégorie", "Total HT", "TVA", "Total TTC", "Payé", "Reste à payer", "Statut"];
    rows = p.map((x) => [x.reference, d(x.issueDate), d(x.dueDate), x.supplier.name, x.supplier.ice, x.category, m(x.subtotal), m(x.taxTotal), m(x.total), m(x.amountPaid), m(x.total - x.amountPaid), INVOICE_STATUS[purchaseDisplayStatus(x)].label]);
  } else if (type === "paiements") {
    const [pin, pout] = await Promise.all([
      db.payment.findMany({ where: { companyId, date: range }, include: { invoice: { select: { number: true, customer: { select: { name: true } } } } }, orderBy: { date: "asc" } }),
      db.purchasePayment.findMany({ where: { companyId, date: range }, include: { purchase: { select: { reference: true, supplier: { select: { name: true } } } } }, orderBy: { date: "asc" } }),
    ]);
    header = ["Date", "Sens", "Document", "Tiers", "Mode", "Référence", "Montant", "Statut", "Motif d'annulation"];
    rows = [
      ...pin.map((p) => [d(p.date), "Encaissement", p.invoice.number, p.invoice.customer.name, PAYMENT_METHODS[p.method], p.reference, m(p.amount), p.voidedAt ? "Annulé" : "Actif", p.voidReason]),
      ...pout.map((p) => [d(p.date), "Décaissement", p.purchase.reference, p.purchase.supplier.name, PAYMENT_METHODS[p.method], p.reference, m(p.amount), p.voidedAt ? "Annulé" : "Actif", p.voidReason]),
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  } else if (type === "clients") {
    const c = await db.customer.findMany({ where: { companyId }, orderBy: { name: "asc" } });
    header = ["Nom", "Type", "ICE", "IF", "RC", "E-mail", "Téléphone", "Adresse", "Ville"];
    rows = c.map((x) => [x.name, x.type === "COMPANY" ? "Entreprise" : "Particulier", x.ice, x.taxId, x.rc, x.email, x.phone ?? x.mobile, x.address, x.city]);
  } else {
    return NextResponse.json({ error: "Export inconnu" }, { status: 404 });
  }

  const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mactura-${type}-${period.fromStr}_${period.toStr}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
