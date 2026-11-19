import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { isDemoMode } from "./demo/mode";
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

/**
 * Mode Démo : la session est un jeton signé (HMAC) qui ne dépend d'aucune table, car chaque instance serveur
 * possède sa propre base embarquée. Le jeton ne contient que l'e-mail et l'expiration.
 */
function demoSign(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "mactura-demo-session").update(payload).digest("base64url");
}
function demoToken(email: string, expiresAt: Date) {
  const payload = Buffer.from(JSON.stringify({ e: email, x: expiresAt.getTime() })).toString("base64url");
  return `${payload}.${demoSign(payload)}`;
}
function demoEmailFromToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(demoSign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e: string; x: number };
    return typeof e === "string" && x > Date.now() ? e : null;
  } catch {
    return null;
  }
}

/** remember = true : session de 30 jours ; sinon session de 12 h, cookie supprimé à la fermeture du navigateur. */
export async function createSession(userId: string, companyId: string, remember = true) {
  let token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? SESSION_DAYS * 86400_000 : 12 * 3600_000));
  if (isDemoMode()) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    token = demoToken(u?.email ?? "", expiresAt);
  } else {
    const h = await headers();
    await db.session.create({
      data: { tokenHash: hashToken(token), userId, companyId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 255) },
    });
  }
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
  if (token && !isDemoMode()) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
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
  if (isDemoMode()) {
    const email = demoEmailFromToken(token);
    if (!email) return null;
    const m = await db.membership.findFirst({
      where: { user: { email } },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, notificationsSeenAt: true, user: { select: { id: true, email: true, name: true } }, company: { select: { id: true, name: true } } },
    });
    if (!m) return null;
    return { sessionId: "demo", user: m.user, company: m.company, role: m.role, membershipId: m.id, notificationsSeenAt: m.notificationsSeenAt };
  }
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
