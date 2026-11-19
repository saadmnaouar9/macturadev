"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { BusinessError, runAction, type ActionResult } from "@/lib/action";
import { loginSchema, registerSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

const DEFAULT_TAX_RATES = [
  { name: "TVA 20 %", rate: 2000, isDefault: true },
  { name: "TVA 14 %", rate: 1400 },
  { name: "TVA 10 %", rate: 1000 },
  { name: "TVA 7 %", rate: 700 },
  { name: "Exonéré", rate: 0 },
];

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function registerAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = registerSchema.parse(input);
    const ip = (await headers()).get("x-forwarded-for") ?? "local";
    if (!rateLimit(`register:${ip}`, 10, 60 * 60_000)) throw new BusinessError("Trop de tentatives. Réessayez plus tard.");

    const exists = await db.user.findUnique({ where: { email: data.email } });
    if (exists) throw new BusinessError("Un compte existe déjà avec cette adresse.", { email: "Cette adresse est déjà utilisée" });

    const passwordHash = await hashPassword(data.password);
    const { user, company } = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          city: data.city,
          ice: data.ice,
          email: data.email,
          taxRates: { create: DEFAULT_TAX_RATES },
        },
      });
      const user = await tx.user.create({
        data: { email: data.email, name: data.name, passwordHash, memberships: { create: { companyId: company.id, role: "OWNER" } } },
      });
      await tx.activity.create({
        data: { companyId: company.id, userId: user.id, type: "company.created", entityType: "company", entityId: company.id, message: `Espace ${company.name} créé` },
      });
      return { user, company };
    });
    await createSession(user.id, company.id);
    return { redirectTo: "/dashboard?welcome=1" };
  });
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = loginSchema.parse(input);
    const ip = (await headers()).get("x-forwarded-for") ?? "local";
    if (!rateLimit(`login:${ip}:${data.email}`, 8, 10 * 60_000)) {
      throw new BusinessError("Trop de tentatives de connexion. Patientez quelques minutes.");
    }
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    // Comparaison systématique pour ne pas révéler l'existence du compte par le temps de réponse
    const ok = await verifyPassword(data.password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    if (!user || !ok) throw new BusinessError("E-mail ou mot de passe incorrect.");
    const membership = user.memberships[0];
    if (!membership) throw new BusinessError("Ce compte n'est rattaché à aucune entreprise.");
    await createSession(user.id, membership.companyId, data.remember);
    return { redirectTo: safeNext(next) };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
