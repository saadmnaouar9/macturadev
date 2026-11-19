import "server-only";
import { db } from "./db";
import { addDays, todayUTC } from "./utils";
import { getBalances } from "./treasury";
import { invoiceDisplayStatus, issuedWhere, outstandingWhere } from "./status";

export type Period = "30d" | "ytd" | "12m";

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function periodRange(period: Period, today: Date) {
  const end = addDays(today, 1); // exclusif
  let start: Date;
  if (period === "30d") start = addDays(today, -29);
  else if (period === "ytd") start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  else start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  const length = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - length);
  return { start, end, prevStart, prevEnd: start };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export async function getDashboard(companyId: string, period: Period) {
  const today = todayUTC();
  const { start, end, prevStart, prevEnd } = periodRange(period, today);
  const chartStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  const earliest = prevStart < chartStart ? prevStart : chartStart;

  const [invoices, payments, quotes, outstanding, customerCount, newCustomers, prevNewCustomers, recentPayments, activities] = await Promise.all([
    db.invoice.findMany({
      where: { companyId, ...issuedWhere, issueDate: { gte: earliest, lt: end } },
      select: { id: true, issueDate: true, total: true, status: true, paymentStatus: true, customerId: true, paidAt: true, dueDate: true },
    }),
    // Paiements actifs uniquement (les paiements annulés restent en historique mais ne comptent pas)
    db.payment.findMany({ where: { companyId, voidedAt: null, date: { gte: earliest, lt: end } }, select: { amount: true, date: true } }),
    db.quote.findMany({
      where: { companyId, status: { not: "DRAFT" }, issueDate: { gte: earliest, lt: end } },
      select: { issueDate: true, total: true, status: true, expiryDate: true },
    }),
    db.invoice.findMany({
      where: { companyId, ...outstandingWhere },
      select: { total: true, amountPaid: true, dueDate: true, status: true },
    }),
    db.customer.count({ where: { companyId, archived: false } }),
    db.customer.count({ where: { companyId, createdAt: { gte: start, lt: end } } }),
    db.customer.count({ where: { companyId, createdAt: { gte: prevStart, lt: prevEnd } } }),
    db.payment.findMany({
      where: { companyId, voidedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, amount: true, date: true, method: true, invoice: { select: { id: true, number: true, customer: { select: { id: true, name: true } } } } },
    }),
    db.activity.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, type: true, message: true, createdAt: true, entityType: true, entityId: true, amount: true, user: { select: { name: true } } },
    }),
  ]);

  const inRange = (d: Date, a: Date, b: Date) => d >= a && d < b;
  const sum = (xs: bigint[]) => Number(xs.reduce((s, x) => s + x, 0n));

  const curInvoices = invoices.filter((i) => inRange(i.issueDate, start, end));
  const prevInvoices = invoices.filter((i) => inRange(i.issueDate, prevStart, prevEnd));
  const collected = sum(payments.filter((p) => inRange(p.date, start, end)).map((p) => p.amount));
  const prevCollected = sum(payments.filter((p) => inRange(p.date, prevStart, prevEnd)).map((p) => p.amount));
  const invoiced = sum(curInvoices.map((i) => i.total));
  const prevInvoiced = sum(prevInvoices.map((i) => i.total));
  const paidInvoices = curInvoices.filter((i) => i.paymentStatus === "PAID");
  const prevPaid = prevInvoices.filter((i) => i.paymentStatus === "PAID");

  const outstandingTotal = sum(outstanding.map((i) => i.total - i.amountPaid));
  const overdueList = outstanding.filter((i) => i.dueDate < today);
  const overdueTotal = sum(overdueList.map((i) => i.total - i.amountPaid));

  // Graphique : 12 derniers mois
  const months = Array.from({ length: 12 }, (_, k) => {
    const s = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11 + k, 1));
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
    return { s, e, label: `${MONTHS_FR[s.getUTCMonth()]}${s.getUTCMonth() === 0 || k === 0 ? ` ${String(s.getUTCFullYear()).slice(2)}` : ""}` };
  });
  const revenueSeries = months.map(({ s, e, label }) => ({
    month: label,
    invoiced: sum(invoices.filter((i) => inRange(i.issueDate, s, e)).map((i) => i.total)),
    collected: sum(payments.filter((p) => inRange(p.date, s, e)).map((p) => p.amount)),
  }));
  const quoteSeries = months.slice(-6).map(({ s, e, label }) => {
    const qs = quotes.filter((q) => inRange(q.issueDate, s, e));
    const accepted = qs.filter((q) => q.status === "ACCEPTED");
    return {
      month: label,
      sent: sum(qs.map((q) => q.total)),
      accepted: sum(accepted.map((q) => q.total)),
      count: qs.length,
      acceptedCount: accepted.length,
    };
  });

  // Répartition des factures de la période par statut affiché
  const statusBuckets = { PAID: 0, PARTIAL: 0, PENDING: 0, OVERDUE: 0 };
  for (const i of curInvoices) {
    const st = invoiceDisplayStatus(i);
    const amount = Number(i.total);
    if (st === "PAID") statusBuckets.PAID += amount;
    else if (st === "PARTIAL") statusBuckets.PARTIAL += amount;
    else if (st === "OVERDUE") statusBuckets.OVERDUE += amount;
    else statusBuckets.PENDING += amount;
  }

  // Top clients
  const byCustomer = new Map<string, number>();
  for (const i of curInvoices) byCustomer.set(i.customerId, (byCustomer.get(i.customerId) ?? 0) + Number(i.total));
  const topIds = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCustomers = topIds.length
    ? await db.customer.findMany({ where: { id: { in: topIds.map(([id]) => id) }, companyId }, select: { id: true, name: true, city: true } })
    : [];
  const top = topIds.map(([id, amount]) => ({ ...topCustomers.find((c) => c.id === id)!, amount })).filter((c) => c.name);

  // Indicateurs
  const periodQuotes = quotes.filter((q) => inRange(q.issueDate, start, end));
  const decided = periodQuotes.filter((q) => q.status === "ACCEPTED" || q.status === "REJECTED");
  // Ratios exprimés en points de base (10000 = 100 %)
  const conversion = decided.length ? Math.round((periodQuotes.filter((q) => q.status === "ACCEPTED").length / decided.length) * 10000) : null;
  const paidWithDates = paidInvoices.filter((i) => i.paidAt);
  const avgDelay = paidWithDates.length
    ? Math.round(paidWithDates.reduce((s, i) => s + (i.paidAt!.getTime() - i.issueDate.getTime()) / 86400000, 0) / paidWithDates.length)
    : null;
  const avgInvoice = curInvoices.length ? Math.round(invoiced / curInvoices.length) : 0;
  const recovery = invoiced > 0 ? Math.min(10000, Math.round((collected / invoiced) * 10000)) : null;

  const [balances, payables, payableOverdue, lateTasks, openTasks] = await Promise.all([
    getBalances(companyId),
    db.purchase.aggregate({ where: { companyId, cancelledAt: null, paymentStatus: { not: "PAID" } }, _sum: { total: true, amountPaid: true }, _count: true }),
    db.purchase.count({ where: { companyId, cancelledAt: null, paymentStatus: { not: "PAID" }, dueDate: { lt: today } } }),
    db.task.count({ where: { companyId, status: { not: "DONE" }, dueDate: { lt: today } } }),
    db.task.count({ where: { companyId, status: { not: "DONE" } } }),
  ]);

  return {
    period,
    extra: {
      cash: balances.cash, bank: balances.bank, treasury: balances.total,
      payable: Number((payables._sum.total ?? 0n) - (payables._sum.amountPaid ?? 0n)), payableCount: payables._count, payableOverdue,
      lateTasks, openTasks,
    },
    kpis: {
      collected: { value: collected, change: pctChange(collected, prevCollected) },
      invoiced: { value: invoiced, change: pctChange(invoiced, prevInvoiced), count: curInvoices.length },
      paid: { value: sum(paidInvoices.map((i) => i.total)), count: paidInvoices.length, change: pctChange(paidInvoices.length, prevPaid.length) },
      unpaid: { value: outstandingTotal, count: outstanding.length },
      overdue: { value: overdueTotal, count: overdueList.length },
      customers: { value: customerCount, newCount: newCustomers, change: pctChange(newCustomers, prevNewCustomers) },
    },
    revenueSeries,
    quoteSeries,
    statusBreakdown: [
      { key: "PAID", label: "Payées", value: statusBuckets.PAID },
      { key: "PARTIAL", label: "Partiellement payées", value: statusBuckets.PARTIAL },
      { key: "PENDING", label: "En attente", value: statusBuckets.PENDING },
      { key: "OVERDUE", label: "En retard", value: statusBuckets.OVERDUE },
    ],
    topCustomers: top,
    indicators: { conversion, avgDelay, avgInvoice, recovery },
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      date: p.date.toISOString(),
      method: p.method,
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.number,
      customerName: p.invoice.customer.name,
    })),
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      href: a.entityType === "invoice" ? `/factures/${a.entityId}` : a.entityType === "quote" ? `/devis/${a.entityId}` : a.entityType === "customer" ? `/clients/${a.entityId}` : a.entityType === "product" ? "/produits" : null,
      userName: a.user?.name ?? null,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
