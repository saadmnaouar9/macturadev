import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PAGE_SIZE, parseListParams } from "@/lib/list-params";
import { PageContainer } from "@/components/ui/page-header";
import { formatMAD } from "@/lib/money";
import { ProjectsView } from "@/components/modules/views";
import { PROJECT_STATUS } from "@/lib/status";

export const metadata: Metadata = { title: "Projets" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const { q, sort, dir, page, status } = parseListParams(sp, ["name", "endDate", "budget", "createdAt"], "createdAt");
  const companyId = auth.company.id;
  const where: Prisma.ProjectWhereInput = { companyId, ...(status in PROJECT_STATUS ? { status: status as never } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {}) };
  const [rows, total, groups, customers] = await Promise.all([
    db.project.findMany({ where, orderBy: { [sort]: dir }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { customer: { select: { name: true } } } }),
    db.project.count({ where }),
    db.project.groupBy({ by: ["status"], where: { companyId }, _count: true, _sum: { budget: true } }),
    db.customer.findMany({ where: { companyId, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const tasks = rows.length ? await db.task.groupBy({ by: ["projectId", "status"], where: { companyId, projectId: { in: rows.map((r) => r.id) } }, _count: true }) : [];
  const progress = (id: string) => { const t = tasks.filter((x) => x.projectId === id); const all = t.reduce((s, x) => s + x._count, 0); const done = t.find((x) => x.status === "DONE")?._count ?? 0; return all ? (done / all) * 100 : 0; };
  const c = (s: string) => groups.find((x) => x.status === s)?._count ?? 0;
  const active = groups.find((x) => x.status === "ACTIVE");
  return (
    <PageContainer>
      <ProjectsView
        customers={customers.map((x) => ({ value: x.id, label: x.name }))}
        rows={rows.map((r) => ({ ...r, budget: Number(r.budget), customerName: r.customer?.name ?? null, progress: progress(r.id), startDate: r.startDate?.toISOString() ?? null, endDate: r.endDate?.toISOString() ?? null, createdAt: undefined, updatedAt: undefined, customer: undefined }))}
        total={total} page={page} pageSize={PAGE_SIZE} hasQuery={!!q || !!status}
        canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")}
        filters={[{ param: "status", layoutId: "project-status", options: [{ value: "", label: "Tous", count: groups.reduce((s, x) => s + x._count, 0) }, ...Object.entries(PROJECT_STATUS).map(([v, s]) => ({ value: v, label: s.label, count: c(v) }))] }]}
        summary={[
          { label: "Projets en cours", value: String(c("ACTIVE")) },
          { label: "Budget en cours", value: formatMAD(active?._sum.budget ?? 0n) },
          { label: "Terminés", value: String(c("DONE")), tone: "good" },
          { label: "En pause", value: String(c("ON_HOLD")), tone: c("ON_HOLD") ? "warn" : "default" },
        ]}
      />
    </PageContainer>
  );
}
