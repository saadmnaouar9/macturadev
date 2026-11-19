import "server-only";
import { db } from "./db";
import { computeTotals } from "./calc";
import { storedLineToInput } from "./documents";
import { issuedWhere, outstandingWhere } from "./status";
import { todayUTC } from "./utils";

export interface Period {
  from: Date;
  to: Date; // exclusif
  fromStr: string;
  toStr: string; // inclusif (affichage)
}

export function parsePeriod(fromRaw?: string, toRaw?: string): Period {
  const today = todayUTC();
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);
  const from = ok(fromRaw) ?? new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const toIncl = ok(toRaw) ?? today;
  const to = new Date(toIncl.getTime() + 86400_000);
  return { from, to, fromStr: from.toISOString().slice(0, 10), toStr: toIncl.toISOString().slice(0, 10) };
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export async function getReports(companyId: string, period: Period) {
  const today = todayUTC();
  const [invoices, purchases, outstanding] = await Promise.all([
    db.invoice.findMany({ where: { companyId, ...issuedWhere, issueDate: { gte: period.from, lt: period.to } }, include: { items: true, customer: { select: { id: true, name: true } } } }),
    db.purchase.findMany({ where: { companyId, cancelledAt: null, issueDate: { gte: period.from, lt: period.to } }, include: { supplier: { select: { id: true, name: true } } } }),
    db.invoice.findMany({ where: { companyId, ...outstandingWhere }, select: { id: true, number: true, dueDate: true, total: true, amountPaid: true, customer: { select: { id: true, name: true } } } }),
  ]);

  // Ventes — recalcul ligne par ligne (remises, TVA par taux) avec le moteur financier
  const byMonth = new Map<string, { ht: number; tva: number; ttc: number }>();
  const byCustomer = new Map<string, { id: string; name: string; ht: number; ttc: number; count: number }>();
  const byItem = new Map<string, { name: string; ht: number; qty: number }>();
  const vatCollected = new Map<number, { base: number; amount: number }>();
  let revenueHT = 0, tvaCollected = 0, revenueTTC = 0;
  for (const inv of invoices) {
    const t = computeTotals(inv.items.map(storedLineToInput), { type: inv.globalDiscountType, value: inv.globalDiscountType === "AMOUNT" ? Number(inv.globalDiscountAmount) : inv.globalDiscount });
    revenueHT += t.taxableTotal; tvaCollected += t.taxTotal; revenueTTC += t.total;
    const key = inv.issueDate.toISOString().slice(0, 7);
    const m = byMonth.get(key) ?? { ht: 0, tva: 0, ttc: 0 };
    m.ht += t.taxableTotal; m.tva += t.taxTotal; m.ttc += t.total; byMonth.set(key, m);
    const c = byCustomer.get(inv.customerId) ?? { id: inv.customer.id, name: inv.customer.name, ht: 0, ttc: 0, count: 0 };
    c.ht += t.taxableTotal; c.ttc += t.total; c.count += 1; byCustomer.set(inv.customerId, c);
    t.taxes.forEach((x) => { const v = vatCollected.get(x.rate) ?? { base: 0, amount: 0 }; v.base += x.base; v.amount += x.amount; vatCollected.set(x.rate, v); });
    inv.items.forEach((it, i) => { const k = it.description; const r = byItem.get(k) ?? { name: k, ht: 0, qty: 0 }; r.ht += t.lines[i].taxable; r.qty += it.quantity; byItem.set(k, r); });
  }

  const vatDeductible = new Map<number, { base: number; amount: number }>();
  const bySupplier = new Map<string, { id: string; name: string; ht: number; ttc: number; paid: number; count: number }>();
  let purchasesHT = 0, tvaDeductible = 0, purchasesTTC = 0;
  for (const p of purchases) {
    purchasesHT += Number(p.subtotal); tvaDeductible += Number(p.taxTotal); purchasesTTC += Number(p.total);
    const v = vatDeductible.get(p.taxRate) ?? { base: 0, amount: 0 }; v.base += Number(p.subtotal); v.amount += Number(p.taxTotal); vatDeductible.set(p.taxRate, v);
    const s = bySupplier.get(p.supplierId) ?? { id: p.supplier.id, name: p.supplier.name, ht: 0, ttc: 0, paid: 0, count: 0 };
    s.ht += Number(p.subtotal); s.ttc += Number(p.total); s.paid += Number(p.amountPaid); s.count += 1; bySupplier.set(p.supplierId, s);
  }

  // Mensuel sur la période (jusqu'à 24 mois)
  const months: { month: string; sales: number; purchases: number }[] = [];
  for (let d = new Date(Date.UTC(period.from.getUTCFullYear(), period.from.getUTCMonth(), 1)); d < period.to && months.length < 24; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const key = d.toISOString().slice(0, 7);
    months.push({
      month: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      sales: byMonth.get(key)?.ht ?? 0,
      purchases: purchases.filter((p) => p.issueDate.toISOString().slice(0, 7) === key).reduce((s, p) => s + Number(p.subtotal), 0),
    });
  }

  // Balance âgée des créances (à date du jour)
  const buckets = [
    { key: "current", label: "Non échu", min: -Infinity, max: 0, amount: 0, count: 0 },
    { key: "d30", label: "1–30 jours", min: 1, max: 30, amount: 0, count: 0 },
    { key: "d60", label: "31–60 jours", min: 31, max: 60, amount: 0, count: 0 },
    { key: "d90", label: "61–90 jours", min: 61, max: 90, amount: 0, count: 0 },
    { key: "d90p", label: "Plus de 90 jours", min: 91, max: Infinity, amount: 0, count: 0 },
  ];
  const late: { id: string; number: string | null; customer: string; days: number; balance: number }[] = [];
  for (const i of outstanding) {
    const balance = Number(i.total - i.amountPaid);
    const days = Math.floor((today.getTime() - i.dueDate.getTime()) / 86400000);
    const b = buckets.find((x) => days >= x.min && days <= x.max)!;
    b.amount += balance; b.count += 1;
    if (days > 0) late.push({ id: i.id, number: i.number, customer: i.customer.name, days, balance });
  }

  return {
    summary: {
      revenueHT, revenueTTC, tvaCollected, purchasesHT, purchasesTTC, tvaDeductible,
      vatDue: tvaCollected - tvaDeductible,
      grossMargin: revenueHT - purchasesHT,
      invoiceCount: invoices.length, purchaseCount: purchases.length,
    },
    months,
    topCustomers: [...byCustomer.values()].sort((a, b) => b.ht - a.ht).slice(0, 10),
    topItems: [...byItem.values()].sort((a, b) => b.ht - a.ht).slice(0, 10),
    suppliers: [...bySupplier.values()].sort((a, b) => b.ttc - a.ttc).slice(0, 10),
    vat: {
      collected: [...vatCollected.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({ rate, ...v })),
      deductible: [...vatDeductible.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({ rate, ...v })),
    },
    aging: buckets.map(({ key, label, amount, count }) => ({ key, label, amount, count })),
    lateInvoices: late.sort((a, b) => b.days - a.days).slice(0, 10),
  };
}

export type ReportsData = Awaited<ReturnType<typeof getReports>>;
