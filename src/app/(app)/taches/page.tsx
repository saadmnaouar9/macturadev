import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PageContainer } from "@/components/ui/page-header";
import { TasksBoard } from "@/components/modules/tasks-board";
import { todayUTC } from "@/lib/utils";

export const metadata: Metadata = { title: "Tâches" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requireAuth();
  const sp = await searchParams;
  const companyId = auth.company.id;
  const today = todayUTC();
  const q = (sp.q ?? "").trim().slice(0, 100);
  const project = sp.project ?? "";
  const scope = sp.scope ?? "";
  const base: Prisma.TaskWhereInput = { companyId, ...(project ? { projectId: project } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}) };
  const scopeWhere: Prisma.TaskWhereInput = scope === "mine" ? { assigneeId: auth.user.id } : scope === "late" ? { status: { not: "DONE" }, dueDate: { lt: today } } : {};
  const [tasks, projects, members, all, mine, late] = await Promise.all([
    db.task.findMany({ where: { ...base, ...scopeWhere }, orderBy: [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 300, include: { project: { select: { name: true } }, assignee: { select: { name: true } } } }),
    db.project.findMany({ where: { companyId, status: { not: "CANCELLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.membership.findMany({ where: { companyId }, include: { user: { select: { id: true, name: true } } } }),
    db.task.count({ where: base }),
    db.task.count({ where: { ...base, assigneeId: auth.user.id } }),
    db.task.count({ where: { ...base, status: { not: "DONE" }, dueDate: { lt: today } } }),
  ]);
  return (
    <PageContainer className="max-w-[1500px]">
      <TasksBoard
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, dueDate: t.dueDate?.toISOString() ?? null, projectId: t.projectId, projectName: t.project?.name ?? null, assigneeId: t.assigneeId, assigneeName: t.assignee?.name ?? null }))}
        projects={projects.map((p) => ({ value: p.id, label: p.name }))}
        members={members.map((m) => ({ value: m.user.id, label: m.user.name }))}
        canWrite={can(auth.role, "write")} canDelete={can(auth.role, "delete")}
        counts={{ all, mine, late }}
        defaultProject={projects.some((p) => p.id === project) ? project : ""}
      />
    </PageContainer>
  );
}
