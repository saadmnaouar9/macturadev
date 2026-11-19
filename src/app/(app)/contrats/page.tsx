import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { formatMAD } from "@/lib/money";
import { ContractsView } from "@/components/modules/views";
import { CONTRACT_STATUS, FREQUENCY_LABELS, contractDisplayStatus } from "@/lib/status";
import { formatDate, todayUTC } from "@/lib/utils";

export const metadata: Metadata = { title: "Contrats" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["title", "amount", "endDate", "createdAt"], "createdAt");
  const companyId = auth.company.id;
  const today = todayUTC();
  const soon = new Date(today.getTime() + 30 * 86400_000);
  const statusWhere: Prisma.ContractWhereInput =
    status === "EXPIRED" ? { status: "ACTIVE", endDate: { lt: today } }
    : status === "EXPIRING" ? { status: "ACTIVE", endDate: { gte: today, lte: soon } }
    : status === "ACTIVE" ? { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: soon } }] }
    : status === "DRAFT" || status === "TERMINATED" ? { status } : {};
  const search: Prisma.ContractWhereInput = q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {};
  const where: Prisma.ContractWhereInput = { companyId, AND: [statusWhere, search] };
  const [rows, total, customers, ...counts] = await Promise.all([
    db.contract.findMany({ where, orderBy: { [sort]: dir }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { customer: { select: { name: true } } } }),
    db.contract.count({ where }),
    db.customer.findMany({ where: { companyId, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ...["", "ACTIVE", "EXPIRING", "EXPIRED", "DRAFT", "TERMINATED"].map((s) => db.contract.count({ where: { companyId, AND: [s === "EXPIRED" ? { status: "ACTIVE", endDate: { lt: today } } : s === "EXPIRING" ? { status: "ACTIVE", endDate: { gte: today, lte: soon } } : s === "ACTIVE" ? { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: soon } }] } : s ? { status: s as never } : {}] } })),
  ]);
  const recurring = await db.contract.findMany({ where: { companyId, status: "ACTIVE", frequency: { not: "ONE_TIME" } }, select: { amount: true, frequency: true } });
  const mrr = recurring.reduce((s, c) => s + Number(c.amount) / ({ MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 } as Record<string, number>)[c.frequency], 0);
  return (
    <PageContainer>
      <ContractsView
        customers={customers.map((x) => ({ value: x.id, label: x.name }))}
        rows={rows.map((r) => ({ id: r.id, reference: r.reference, title: r.title, status: r.status, displayStatus: contractDisplayStatus(r), customerId: r.customerId, subtitle: `${r.reference} · ${r.customer.name}`, amount: Number(r.amount), frequency: r.frequency, frequencyLabel: FREQUENCY_LABELS[r.frequency], autoRenew: r.autoRenew, notes: r.notes, startDate: r.startDate.toISOString(), endDate: r.endDate?.toISOString() ?? null }))}
        stats={{ activeCount: counts[1] + counts[2], mrr: Math.round(mrr), expiringCount: counts[2], expiredCount: counts[3] }}
        total={total} page={page} pageSize={PAGE_SIZE} hasQuery={!!q || !!status}
        canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")}
        filters={[{ param: "status", layoutId: "contract-status", options: [{ value: "", label: "Tous", count: counts[0] }, ...["ACTIVE", "EXPIRING", "EXPIRED", "DRAFT", "TERMINATED"].map((v, i) => ({ value: v, label: CONTRACT_STATUS[v].label, count: counts[i + 1] }))] }]}
        summary={[
          { label: "Contrats actifs", value: String(counts[1] + counts[2]) },
          { label: "Revenu récurrent mensuel", value: formatMAD(Math.round(mrr)), sub: "HT, contrats actifs" },
          { label: "Expirent sous 30 jours", value: String(counts[2]), tone: counts[2] ? "warn" : "default" },
          { label: "Expirés", value: String(counts[3]), tone: counts[3] ? "bad" : "default", sub: formatDate(today) },
        ]}
      />
    </PageContainer>
  );
}
