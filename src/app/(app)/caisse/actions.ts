"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { cashEntrySchema, openingBalancesSchema } from "@/lib/validation-modules";
import { dateOrThrow } from "@/lib/documents";
import { formatMAD } from "@/lib/money";

export async function saveCashEntry(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("write");
    const d = cashEntrySchema.parse(input);
    const data = { ...d, amount: BigInt(d.amount), date: dateOrThrow(d.date, "date") };
    if (id) {
      const r = await db.cashEntry.updateMany({ where: { id, companyId: auth.company.id }, data });
      if (r.count === 0) throw new BusinessError("Opération introuvable.");
    } else {
      const e = await db.cashEntry.create({ data: { ...data, companyId: auth.company.id, createdById: auth.user.id } });
      await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "cash.created", entityType: "cash", entityId: e.id, message: `${d.direction === "IN" ? "Entrée" : "Sortie"} ${d.account === "CASH" ? "caisse" : "banque"} : ${d.label} (${formatMAD(d.amount)})`, amount: e.amount });
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, id ? "Opération mise à jour" : "Opération enregistrée");
}

export async function deleteCashEntry(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("delete");
    const r = await db.cashEntry.deleteMany({ where: { id, companyId: auth.company.id } });
    if (r.count === 0) throw new BusinessError("Opération introuvable.");
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Opération supprimée");
}

export async function updateOpeningBalances(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("settings");
    const d = openingBalancesSchema.parse(input);
    await db.company.update({ where: { id: auth.company.id }, data: { openingCash: BigInt(d.openingCash), openingBank: BigInt(d.openingBank) } });
    await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "company.updated", entityType: "company", entityId: auth.company.id, message: "Soldes d'ouverture de trésorerie mis à jour" });
    revalidatePath("/", "layout");
    return { ok: true as const };
  }, "Soldes d'ouverture enregistrés");
}
