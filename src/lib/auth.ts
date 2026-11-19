import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { can, type Permission } from "./permissions";

export const SESSION_COOKIE = "mactura_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** remember = true : session de 30 jours ; sinon session de 12 h, cookie supprimé à la fermeture du navigateur. */
export async function createSession(userId: string, companyId: string, remember = true) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS * 86400_000 : 12 * 3600_000));
  const h = await headers();
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, companyId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 255) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { expires: expiresAt } : {}),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export interface AuthContext {
  sessionId: string;
  user: { id: string; email: string; name: string };
  company: { id: string; name: string };
  role: Role;
  membershipId: string;
  notificationsSeenAt: Date;
}

/** Session courante (mise en cache pour la durée de la requête). */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, userId: true, companyId: true, expiresAt: true } });
  if (!session || session.expiresAt < new Date()) return null;
  // Appartenance + utilisateur + entreprise en une seule requête imbriquée (au lieu de trois requêtes séparées)
  const membership = await db.membership.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId: session.companyId } },
    select: { id: true, role: true, notificationsSeenAt: true, user: { select: { id: true, email: true, name: true } }, company: { select: { id: true, name: true } } },
  });
  if (!membership) return null;
  return {
    sessionId: session.id,
    user: membership.user,
    company: membership.company,
    role: membership.role,
    membershipId: membership.id,
    notificationsSeenAt: membership.notificationsSeenAt,
  };
});

/** Pour les pages : redirige vers la connexion si non authentifié. */
export async function requireAuth(permission: Permission = "read"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!can(auth.role, permission)) redirect("/dashboard?forbidden=1");
  return auth;
}

export class AuthError extends Error {}

/** Pour les server actions / routes : lève une erreur au lieu de rediriger. */
export async function assertAuth(permission: Permission = "read"): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new AuthError("Session expirée. Veuillez vous reconnecter.");
  if (!can(auth.role, permission)) throw new AuthError("Vous n'avez pas l'autorisation d'effectuer cette action.");
  return auth;
}
