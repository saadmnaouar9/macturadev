"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { projectSchema } from "@/lib/validation-modules";
import { parseDateOnly } from "@/lib/utils";

export async function saveProject(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const d = projectSchema.parse(input);
    if (d.customerId && !(await db.customer.findFirst({ where: { id: d.customerId, companyId }, select: { id: true } }))) throw new BusinessError("Client introuvable.", { customerId: "Client invalide" });
    const data = { ...d, budget: BigInt(d.budget), startDate: d.startDate ? parseDateOnly(d.startDate) : null, endDate: d.endDate ? parseDateOnly(d.endDate) : null };
    if (id) {
      const r = await db.project.updateMany({ where: { id, companyId }, data });
      if (r.count === 0) throw new BusinessError("Projet introuvable.");
    } else {
      const p = await db.project.create({ data: { ...data, companyId } });
      await logActivity({ companyId, userId: auth.user.id, type: "project.created", entityType: "project", entityId: p.id, message: `Projet « ${p.name} » créé` });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Projet mis à jour" : "Projet créé");
}

export async function deleteProject(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const r = await db.project.deleteMany({ where: { id, companyId: auth.company.id } });
    if (r.count === 0) throw new BusinessError("Projet introuvable.");
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Projet supprimé (ses tâches sont conservées sans projet)");
}
