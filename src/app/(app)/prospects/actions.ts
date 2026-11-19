"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { prospectSchema } from "@/lib/validation-modules";
import { formatMAD } from "@/lib/money";
import { parseDateOnly } from "@/lib/utils";

export async function saveProspect(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const d = prospectSchema.parse(input);
    const data = { ...d, value: BigInt(d.value), nextActionDate: d.nextActionDate ? parseDateOnly(d.nextActionDate) : null };
    if (id) {
      const r = await db.prospect.updateMany({ where: { id, companyId: auth.company.id }, data });
      if (r.count === 0) throw new BusinessError("Prospect introuvable.");
    } else {
      const p = await db.prospect.create({ data: { ...data, companyId: auth.company.id } });
      await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "prospect.created", entityType: "prospect", entityId: p.id, message: `Prospect ${p.name} ajouté${d.value ? ` (${formatMAD(d.value)})` : ""}` });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Prospect mis à jour" : "Prospect ajouté");
}

export async function deleteProspect(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const r = await db.prospect.deleteMany({ where: { id, companyId: auth.company.id } });
    if (r.count === 0) throw new BusinessError("Prospect introuvable.");
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Prospect supprimé");
}

/** Transforme un prospect en client (CRM) et le marque comme gagné. */
export async function convertProspect(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const companyId = auth.company.id;
    const customer = await db.$transaction(async (tx) => {
      const p = await tx.prospect.findFirst({ where: { id, companyId } });
      if (!p) throw new BusinessError("Prospect introuvable.");
      if (p.convertedCustomerId) throw new BusinessError("Ce prospect a déjà été converti en client.");
      const c = await tx.customer.create({ data: { companyId, type: "COMPANY", name: p.name, contactName: p.contactName, email: p.email, phone: p.phone, notes: p.notes } });
      await tx.prospect.update({ where: { id }, data: { status: "WON", convertedCustomerId: c.id, nextActionDate: null } });
      await logActivity({ companyId, userId: auth.user.id, type: "prospect.converted", entityType: "customer", entityId: c.id, message: `Prospect ${p.name} converti en client` }, tx);
      return c;
    });
    revalidatePath("/", "layout");
    return { customerId: customer.id };
  }, "Prospect converti en client");
}
