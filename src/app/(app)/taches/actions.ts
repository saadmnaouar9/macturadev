"use server";

import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { taskSchema } from "@/lib/validation-modules";
import { parseDateOnly } from "@/lib/utils";

export async function saveTask(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const d = taskSchema.parse(input);
    if (d.projectId && !(await db.project.findFirst({ where: { id: d.projectId, companyId }, select: { id: true } }))) throw new BusinessError("Projet introuvable.", { projectId: "Projet invalide" });
    if (d.assigneeId && !(await db.membership.findFirst({ where: { userId: d.assigneeId, companyId }, select: { id: true } }))) throw new BusinessError("Membre introuvable.", { assigneeId: "Ce membre ne fait pas partie de l'équipe" });
    const data = { ...d, dueDate: d.dueDate ? parseDateOnly(d.dueDate) : null };
    if (id) {
      const prev = await db.task.findFirst({ where: { id, companyId } });
      if (!prev) throw new BusinessError("Tâche introuvable.");
      await db.task.update({ where: { id }, data: { ...data, completedAt: d.status === "DONE" ? (prev.completedAt ?? new Date()) : null } });
    } else {
      const t = await db.task.create({ data: { ...data, companyId, completedAt: d.status === "DONE" ? new Date() : null } });
      await logActivity({ companyId, userId: auth.user.id, type: "task.created", entityType: "task", entityId: t.id, message: `Tâche « ${t.title} » créée` });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Tâche mise à jour" : "Tâche créée");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const t = await db.task.findFirst({ where: { id, companyId: auth.company.id } });
    if (!t) throw new BusinessError("Tâche introuvable.");
    await db.task.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
    if (status === "DONE") await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "task.done", entityType: "task", entityId: id, message: `Tâche « ${t.title} » terminée` });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

export async function deleteTask(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const r = await db.task.deleteMany({ where: { id, companyId: auth.company.id } });
    if (r.count === 0) throw new BusinessError("Tâche introuvable.");
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Tâche supprimée");
}
