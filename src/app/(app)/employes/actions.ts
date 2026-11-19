"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { employeeSchema } from "@/lib/validation-modules";
import { parseDateOnly } from "@/lib/utils";

export async function saveEmployee(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("settings"); // données RH : réservées aux administrateurs
    const d = employeeSchema.parse(input);
    const data = { ...d, salary: BigInt(d.salary), hireDate: d.hireDate ? parseDateOnly(d.hireDate) : null };
    if (id) {
      const r = await db.employee.updateMany({ where: { id, companyId: auth.company.id }, data });
      if (r.count === 0) throw new BusinessError("Employé introuvable.");
    } else {
      const e = await db.employee.create({ data: { ...data, companyId: auth.company.id } });
      await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "employee.created", entityType: "employee", entityId: e.id, message: `Employé ${e.firstName} ${e.lastName} ajouté` });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Employé mis à jour" : "Employé ajouté");
}

export async function deleteEmployee(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("settings");
    const r = await db.employee.deleteMany({ where: { id, companyId: auth.company.id } });
    if (r.count === 0) throw new BusinessError("Employé introuvable.");
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Employé supprimé");
}
