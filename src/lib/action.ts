import "server-only";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError } from "./auth";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class BusinessError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Exécute une action serveur et normalise les erreurs pour l'interface. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, error: "Veuillez corriger les champs en erreur.", fieldErrors: zodFieldErrors(err) };
    }
    if (err instanceof AuthError || err instanceof BusinessError) {
      return { ok: false, error: err.message, fieldErrors: err instanceof BusinessError ? err.fieldErrors : undefined };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { ok: false, error: "Cet enregistrement existe déjà (valeur en double)." };
      if (err.code === "P2025") return { ok: false, error: "Enregistrement introuvable." };
      if (err.code === "P2003") return { ok: false, error: "Cet enregistrement est utilisé ailleurs et ne peut pas être supprimé." };
    }
    // Les redirections Next.js doivent être propagées
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw err;
    }
    console.error("[action]", err);
    return { ok: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." };
  }
}
