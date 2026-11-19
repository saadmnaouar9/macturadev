import "server-only";
import type { CashAccount } from "@prisma/client";
import { getBalances, getCashflow, getMovements } from "./treasury";
import { db } from "./db";
import { outstandingWhere } from "./status";
import { todayUTC } from "./utils";

export const LEDGER_PAGE_SIZE = 20;

/** Prépare les données de la caisse (CASH) ou de la trésorerie consolidée (tous comptes). */
export async function loadLedger(companyId: string, sp: Record<string, string | undefined>, fixed?: CashAccount) {
  const account = fixed ?? (sp.account === "CASH" || sp.account === "BANK" ? sp.account : undefined);
  const flow = sp.flow === "in" ? "IN" : sp.flow === "out" ? "OUT" : undefined;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [balances, all] = await Promise.all([getBalances(companyId), getMovements(companyId, { account })]);
  // Solde cumulé après chaque mouvement (en partant du solde d'ouverture du périmètre)
  const opening = account === "CASH" ? balances.openingCash : account === "BANK" ? balances.openingBank : balances.openingCash + balances.openingBank;
  let running = opening;
  const withBalance = [...all].reverse().map((m) => {
    running += m.direction === "IN" ? m.amount : -m.amount;
    return { ...m, balanceAfter: running };
  }).reverse();
  const filtered = withBalance.filter((m) => (!flow || m.direction === flow) && (!q || `${m.label} ${m.detail ?? ""} ${m.reference ?? ""} ${m.category ?? ""}`.toLowerCase().includes(q)));
  const rows = filtered.slice((page - 1) * LEDGER_PAGE_SIZE, page * LEDGER_PAGE_SIZE).map(({ createdAt: _c, ...m }) => m);

  const today = todayUTC();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString();
  const thisMonth = all.filter((m) => m.date >= monthStart);
  const month = { inflow: thisMonth.filter((m) => m.direction === "IN").reduce((s, m) => s + m.amount, 0), outflow: thisMonth.filter((m) => m.direction === "OUT").reduce((s, m) => s + m.amount, 0) };

  let cashflow, forecast;
  if (!fixed) {
    const [cf, rec, pay] = await Promise.all([
      getCashflow(companyId),
      db.invoice.aggregate({ where: { companyId, ...outstandingWhere }, _sum: { total: true, amountPaid: true } }),
      db.purchase.aggregate({ where: { companyId, cancelledAt: null, paymentStatus: { not: "PAID" } }, _sum: { total: true, amountPaid: true } }),
    ]);
    cashflow = cf;
    forecast = { receivable: Number((rec._sum.total ?? 0n) - (rec._sum.amountPaid ?? 0n)), payable: Number((pay._sum.total ?? 0n) - (pay._sum.amountPaid ?? 0n)) };
  }
  return { rows, total: filtered.length, page, balances, month, cashflow, forecast, hasQuery: !!q || !!flow || !!(!fixed && account) };
}
