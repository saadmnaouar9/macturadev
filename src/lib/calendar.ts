import "server-only";
import { db } from "./db";
import { formatMAD } from "./money";
import { issuedWhere } from "./status";

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  detail?: string;
  kind: "invoice" | "purchase" | "quote" | "task" | "contract" | "project" | "prospect";
  href: string;
  late?: boolean;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Échéances et rappels de tous les modules sur [start, end[ — données réelles, aucune saisie séparée. */
export async function getCalendarEvents(companyId: string, start: Date, end: Date): Promise<CalendarEvent[]> {
  const range = { gte: start, lt: end };
  const [invoices, purchases, quotes, tasks, contracts, projects, prospects] = await Promise.all([
    db.invoice.findMany({ where: { companyId, ...issuedWhere, paymentStatus: { not: "PAID" }, dueDate: range }, select: { id: true, number: true, dueDate: true, total: true, amountPaid: true, customer: { select: { name: true } } } }),
    db.purchase.findMany({ where: { companyId, cancelledAt: null, paymentStatus: { not: "PAID" }, dueDate: range }, select: { id: true, reference: true, dueDate: true, total: true, amountPaid: true, supplier: { select: { name: true } } } }),
    db.quote.findMany({ where: { companyId, status: "SENT", expiryDate: range }, select: { id: true, number: true, expiryDate: true, customer: { select: { name: true } } } }),
    db.task.findMany({ where: { companyId, status: { not: "DONE" }, dueDate: range }, select: { id: true, title: true, dueDate: true, priority: true, project: { select: { name: true } } } }),
    db.contract.findMany({ where: { companyId, status: "ACTIVE", endDate: range }, select: { id: true, title: true, endDate: true, customer: { select: { name: true } } } }),
    db.project.findMany({ where: { companyId, status: { in: ["PLANNED", "ACTIVE", "ON_HOLD"] }, endDate: range }, select: { id: true, name: true, endDate: true } }),
    db.prospect.findMany({ where: { companyId, status: { notIn: ["WON", "LOST"] }, nextActionDate: range }, select: { id: true, name: true, nextActionDate: true } }),
  ]);
  const now = new Date();
  const ev: CalendarEvent[] = [
    ...invoices.map((i) => ({ id: `i${i.id}`, date: day(i.dueDate), title: `Échéance ${i.number}`, detail: `${i.customer.name} · ${formatMAD(i.total - i.amountPaid)}`, kind: "invoice" as const, href: `/factures/${i.id}`, late: i.dueDate < now })),
    ...purchases.map((p) => ({ id: `p${p.id}`, date: day(p.dueDate), title: `À payer ${p.reference}`, detail: `${p.supplier.name} · ${formatMAD(p.total - p.amountPaid)}`, kind: "purchase" as const, href: `/achats?q=${encodeURIComponent(p.reference)}`, late: p.dueDate < now })),
    ...quotes.map((q) => ({ id: `q${q.id}`, date: day(q.expiryDate), title: `Expiration ${q.number}`, detail: q.customer.name, kind: "quote" as const, href: `/devis/${q.id}` })),
    ...tasks.map((t) => ({ id: `t${t.id}`, date: day(t.dueDate!), title: t.title, detail: t.project?.name, kind: "task" as const, href: `/taches?edit=${t.id}`, late: t.dueDate! < now })),
    ...contracts.map((c) => ({ id: `c${c.id}`, date: day(c.endDate!), title: `Fin du contrat ${c.title}`, detail: c.customer.name, kind: "contract" as const, href: `/contrats?edit=${c.id}` })),
    ...projects.map((p) => ({ id: `j${p.id}`, date: day(p.endDate!), title: `Fin du projet ${p.name}`, kind: "project" as const, href: `/projets?edit=${p.id}` })),
    ...prospects.map((p) => ({ id: `r${p.id}`, date: day(p.nextActionDate!), title: `Relance ${p.name}`, kind: "prospect" as const, href: `/prospects?edit=${p.id}` })),
  ];
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}
