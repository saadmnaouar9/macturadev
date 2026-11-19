import "server-only";
import { db } from "./db";
import { formatMAD } from "./money";
import { addDays, formatDate, todayUTC } from "./utils";
import { outstandingWhere } from "./status";
import type { NotificationItem } from "@/components/layout/notifications";

export async function getShellData(companyId: string, seenAt: Date) {
  const today = todayUTC();
  const [overdue, expiring, pendingQuotes, activities, lateTasks] = await Promise.all([
    db.invoice.findMany({
      where: { companyId, ...outstandingWhere, dueDate: { lt: today } },
      select: { id: true, number: true, total: true, amountPaid: true, dueDate: true, customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    db.quote.findMany({
      where: { companyId, status: "SENT", expiryDate: { gte: today, lte: addDays(today, 7) } },
      select: { id: true, number: true, expiryDate: true, updatedAt: true, customer: { select: { name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 10,
    }),
    db.quote.count({ where: { companyId, status: "SENT", expiryDate: { gte: today } } }),
    db.activity.findMany({
      where: { companyId, type: { in: ["payment.created", "payment.voided", "quote.accepted", "quote.rejected"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.task.count({ where: { companyId, status: { not: "DONE" }, dueDate: { lt: today } } }),
  ]);

  const items: NotificationItem[] = [
    ...overdue.slice(0, 8).map((i) => ({
      id: `o-${i.id}`,
      kind: "overdue" as const,
      title: `${i.number} en retard`,
      description: `${i.customer.name} · reste ${formatMAD(i.total - i.amountPaid)} · échue le ${formatDate(i.dueDate)}`,
      href: `/factures/${i.id}`,
      date: i.dueDate.toISOString(),
      unread: i.dueDate > seenAt,
    })),
    ...expiring.map((q) => ({
      id: `e-${q.id}`,
      kind: "expiring" as const,
      title: `Devis ${q.number} bientôt expiré`,
      description: `${q.customer.name} · valable jusqu'au ${formatDate(q.expiryDate)}`,
      href: `/devis/${q.id}`,
      date: q.updatedAt.toISOString(),
      unread: q.updatedAt > seenAt,
    })),
    ...activities.map((a) => ({
      id: `a-${a.id}`,
      kind: a.type === "payment.created" ? ("payment" as const) : a.type === "quote.accepted" ? ("accepted" as const) : ("activity" as const),
      title: a.type === "payment.created" ? "Paiement enregistré" : a.type === "payment.voided" ? "Paiement annulé" : a.type === "quote.accepted" ? "Devis accepté" : "Devis refusé",
      description: a.message,
      href: a.entityType === "invoice" || a.entityType === "payment" ? `/factures/${a.entityId}` : `/devis/${a.entityId}`,
      date: a.createdAt.toISOString(),
      unread: a.createdAt > seenAt,
    })),
  ].sort((a, b) => Number(b.unread) - Number(a.unread) || b.date.localeCompare(a.date));

  return { counts: { overdue: overdue.length, pendingQuotes, lateTasks }, notifications: items.slice(0, 20) };
}
