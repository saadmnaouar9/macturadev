import "server-only";
import type { CashAccount, PaymentMethod } from "@prisma/client";
import { db } from "./db";
import { todayUTC } from "./utils";

export interface Movement {
  id: string;
  date: string; // ISO
  createdAt: number;
  account: CashAccount;
  direction: "IN" | "OUT";
  amount: number; // centimes, positif
  label: string;
  detail: string | null;
  source: "customer" | "supplier" | "manual";
  href: string | null;
  entryId: string | null; // présent pour les opérations manuelles (modifiables)
  category: string | null;
  reference: string | null;
}

/** Les règlements en espèces transitent par la caisse, tous les autres par la banque. */
export const accountOfMethod = (m: PaymentMethod): CashAccount => (m === "CASH" ? "CASH" : "BANK");

export async function getMovements(companyId: string, opts: { account?: CashAccount; from?: Date; to?: Date } = {}): Promise<Movement[]> {
  const date = opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } : {};
  const method = opts.account === "CASH" ? { method: "CASH" as const } : opts.account === "BANK" ? { method: { not: "CASH" as const } } : {};
  const [pay, ppay, entries] = await Promise.all([
    db.payment.findMany({ where: { companyId, voidedAt: null, ...date, ...method }, select: { id: true, amount: true, date: true, method: true, reference: true, createdAt: true, invoice: { select: { id: true, number: true, customer: { select: { name: true } } } } } }),
    db.purchasePayment.findMany({ where: { companyId, voidedAt: null, ...date, ...method }, select: { id: true, amount: true, date: true, method: true, reference: true, createdAt: true, purchase: { select: { id: true, reference: true, supplier: { select: { name: true } } } } } }),
    db.cashEntry.findMany({ where: { companyId, ...date, ...(opts.account ? { account: opts.account } : {}) } }),
  ]);
  const out: Movement[] = [
    ...pay.map((p) => ({ id: `p-${p.id}`, date: p.date.toISOString(), createdAt: p.createdAt.getTime(), account: accountOfMethod(p.method), direction: "IN" as const, amount: Number(p.amount), label: `Encaissement ${p.invoice.number ?? ""}`.trim(), detail: p.invoice.customer.name, source: "customer" as const, href: `/factures/${p.invoice.id}`, entryId: null, category: "Ventes", reference: p.reference })),
    ...ppay.map((p) => ({ id: `s-${p.id}`, date: p.date.toISOString(), createdAt: p.createdAt.getTime(), account: accountOfMethod(p.method), direction: "OUT" as const, amount: Number(p.amount), label: `Règlement ${p.purchase.reference}`, detail: p.purchase.supplier.name, source: "supplier" as const, href: `/achats?q=${encodeURIComponent(p.purchase.reference)}`, entryId: null, category: "Achats", reference: p.reference })),
    ...entries.map((e) => ({ id: `e-${e.id}`, date: e.date.toISOString(), createdAt: e.createdAt.getTime(), account: e.account, direction: e.direction, amount: Number(e.amount), label: e.label, detail: null, source: "manual" as const, href: null, entryId: e.id, category: e.category, reference: e.reference })),
  ];
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/** Soldes = solde d'ouverture + encaissements − décaissements (paiements actifs et opérations manuelles). */
export async function getBalances(companyId: string) {
  const [co, pay, ppay, entries] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId }, select: { openingCash: true, openingBank: true } }),
    db.payment.groupBy({ by: ["method"], where: { companyId, voidedAt: null }, _sum: { amount: true } }),
    db.purchasePayment.groupBy({ by: ["method"], where: { companyId, voidedAt: null }, _sum: { amount: true } }),
    db.cashEntry.groupBy({ by: ["account", "direction"], where: { companyId }, _sum: { amount: true } }),
  ]);
  const sumBy = (rows: { method: PaymentMethod; _sum: { amount: bigint | null } }[], acc: CashAccount) =>
    rows.filter((r) => accountOfMethod(r.method) === acc).reduce((s, r) => s + (r._sum.amount ?? 0n), 0n);
  const entry = (acc: CashAccount, dir: "IN" | "OUT") => entries.find((e) => e.account === acc && e.direction === dir)?._sum.amount ?? 0n;
  const cash = co.openingCash + sumBy(pay, "CASH") - sumBy(ppay, "CASH") + entry("CASH", "IN") - entry("CASH", "OUT");
  const bank = co.openingBank + sumBy(pay, "BANK") - sumBy(ppay, "BANK") + entry("BANK", "IN") - entry("BANK", "OUT");
  return { cash: Number(cash), bank: Number(bank), total: Number(cash + bank), openingCash: Number(co.openingCash), openingBank: Number(co.openingBank) };
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export async function getCashflow(companyId: string, months = 12) {
  const today = todayUTC();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1));
  const moves = await getMovements(companyId, { from: start });
  return Array.from({ length: months }, (_, k) => {
    const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1));
    const key = s.toISOString().slice(0, 7);
    const inMonth = moves.filter((m) => m.date.slice(0, 7) === key);
    const inflow = inMonth.filter((m) => m.direction === "IN").reduce((a, m) => a + m.amount, 0);
    const outflow = inMonth.filter((m) => m.direction === "OUT").reduce((a, m) => a + m.amount, 0);
    return { month: `${MONTHS[s.getUTCMonth()]}${s.getUTCMonth() === 0 || k === 0 ? ` ${String(s.getUTCFullYear()).slice(2)}` : ""}`, inflow, outflow, net: inflow - outflow };
  });
}
