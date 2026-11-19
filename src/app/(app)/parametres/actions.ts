"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { BusinessError, runAction } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { companySchema, documentSettingsSchema, memberSchema, passwordChangeSchema, profileSchema, taxRateSchema } from "@/lib/validation";
import { z } from "zod";

export async function updateCompany(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("settings");
    const data = companySchema.parse(input);
    await db.company.update({ where: { id: auth.company.id }, data });
    await logActivity({ companyId: auth.company.id, userId: auth.user.id, type: "company.updated", entityType: "company", entityId: auth.company.id, message: "Informations de l'entreprise mises à jour" });
    revalidatePath("/", "layout");
    return { ok: true };
  }, "Informations de l'entreprise enregistrées");
}

export async function updateDocumentSettings(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("settings");
    const data = documentSettingsSchema.parse(input);
    const rate = await db.taxRate.findFirst({ where: { companyId: auth.company.id, rate: data.defaultTaxRate } });
    if (!rate) throw new BusinessError("Taux de TVA par défaut invalide.", { defaultTaxRate: "Choisissez un taux configuré" });
    await db.$transaction([
      db.company.update({ where: { id: auth.company.id }, data }),
      db.taxRate.updateMany({ where: { companyId: auth.company.id }, data: { isDefault: false } }),
      db.taxRate.update({ where: { id: rate.id }, data: { isDefault: true } }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true };
  }, "Paramètres des documents enregistrés");
}

export async function saveTaxRate(id: string | null, input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("settings");
    const data = taxRateSchema.parse(input);
    if (id) {
      const res = await db.taxRate.updateMany({ where: { id, companyId: auth.company.id }, data });
      if (res.count === 0) throw new BusinessError("Taux introuvable.");
    } else {
      await db.taxRate.create({ data: { ...data, companyId: auth.company.id } });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  }, id ? "Taux de TVA mis à jour" : "Taux de TVA ajouté");
}

export async function deleteTaxRate(id: string) {
  return runAction(async () => {
    const auth = await assertAuth("settings");
    const rate = await db.taxRate.findFirst({ where: { id, companyId: auth.company.id } });
    if (!rate) throw new BusinessError("Taux introuvable.");
    if (rate.isDefault) throw new BusinessError("Le taux par défaut ne peut pas être supprimé.");
    const count = await db.taxRate.count({ where: { companyId: auth.company.id } });
    if (count <= 1) throw new BusinessError("Conservez au moins un taux de TVA.");
    // Les documents existants conservent leur taux (valeur copiée sur chaque ligne)
    await db.taxRate.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true };
  }, "Taux de TVA supprimé");
}

export async function updateProfile(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth();
    const data = profileSchema.parse(input);
    const taken = await db.user.findFirst({ where: { email: data.email, NOT: { id: auth.user.id } } });
    if (taken) throw new BusinessError("Cette adresse est déjà utilisée.", { email: "Adresse déjà utilisée" });
    await db.user.update({ where: { id: auth.user.id }, data });
    revalidatePath("/", "layout");
    return { ok: true };
  }, "Profil mis à jour");
}

export async function changePassword(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth();
    const data = passwordChangeSchema.parse(input);
    const user = await db.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!(await verifyPassword(data.current, user.passwordHash))) throw new BusinessError("Mot de passe actuel incorrect.", { current: "Mot de passe incorrect" });
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.next) } }),
      // Déconnecte les autres appareils
      db.session.deleteMany({ where: { userId: user.id, NOT: { id: auth.sessionId } } }),
    ]);
    return { ok: true };
  }, "Mot de passe modifié — vos autres sessions ont été déconnectées");
}

export async function addMember(input: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("members");
    const data = memberSchema.parse(input);
    const existing = await db.user.findUnique({ where: { email: data.email }, include: { memberships: true } });
    if (existing?.memberships.some((m) => m.companyId === auth.company.id)) throw new BusinessError("Cette personne fait déjà partie de l'équipe.", { email: "Déjà membre" });
    if (existing) throw new BusinessError("Cette adresse est déjà associée à un autre compte Mactura.", { email: "Adresse déjà utilisée" });
    await db.user.create({
      data: { email: data.email, name: data.name, passwordHash: await hashPassword(data.password), memberships: { create: { companyId: auth.company.id, role: data.role } } },
    });
    revalidatePath("/parametres");
    return { ok: true };
  }, "Membre ajouté à l'équipe");
}

export async function updateMemberRole(membershipId: string, role: unknown) {
  return runAction(async () => {
    const auth = await assertAuth("members");
    const r = z.enum(["ADMIN", "MEMBER", "VIEWER"]).parse(role);
    const m = await db.membership.findFirst({ where: { id: membershipId, companyId: auth.company.id } });
    if (!m) throw new BusinessError("Membre introuvable.");
    if (m.role === "OWNER") throw new BusinessError("Le rôle du propriétaire ne peut pas être modifié.");
    if (m.userId === auth.user.id) throw new BusinessError("Vous ne pouvez pas modifier votre propre rôle.");
    await db.membership.update({ where: { id: m.id }, data: { role: r } });
    revalidatePath("/parametres");
    return { ok: true };
  }, "Rôle mis à jour");
}

export async function removeMember(membershipId: string) {
  return runAction(async () => {
    const auth = await assertAuth("members");
    const m = await db.membership.findFirst({ where: { id: membershipId, companyId: auth.company.id } });
    if (!m) throw new BusinessError("Membre introuvable.");
    if (m.role === "OWNER") throw new BusinessError("Le propriétaire ne peut pas être retiré.");
    if (m.userId === auth.user.id) throw new BusinessError("Vous ne pouvez pas vous retirer vous-même.");
    await db.$transaction([
      db.session.deleteMany({ where: { userId: m.userId, companyId: auth.company.id } }),
      db.membership.delete({ where: { id: m.id } }),
    ]);
    revalidatePath("/parametres");
    return { ok: true };
  }, "Membre retiré de l'équipe");
}
