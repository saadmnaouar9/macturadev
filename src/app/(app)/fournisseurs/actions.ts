"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { supplierSchema } from "@/lib/validation-modules";

export async function saveSupplier(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const data = supplierSchema.parse(input);
    if (id) {
      const r = await db.supplier.updateMany({ where: { id, companyId: auth.company.id }, data });
      if (r.count === 0) throw new BusinessError("Fournisseur introuvable.");
    } else {
      const s = await db.supplier.create({ data: { ...data, companyId: auth.company.id } });
      await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "supplier.created", entityType: "supplier", entityId: s.id, message: `Fournisseur ${s.name} ajouté` });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Fournisseur mis à jour" : "Fournisseur ajouté");
}

export async function deleteSupplier(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const s = await db.supplier.findFirst({ where: { id, companyId: auth.company.id }, include: { _count: { select: { purchases: true } } } });
    if (!s) throw new BusinessError("Fournisseur introuvable.");
    if (s._count.purchases > 0) throw new BusinessError("Ce fournisseur possède des factures d'achat : il ne peut pas être supprimé.");
    await db.supplier.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Fournisseur supprimé");
}
