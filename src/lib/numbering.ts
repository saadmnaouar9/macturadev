import "server-only";
import type { DocumentKind, Prisma } from "@prisma/client";

/**
 * Attribue le prochain numéro de document (ex. FAC-2026-0042) de façon atomique.
 * Doit être appelé dans une transaction : l'UPDATE … RETURNING verrouille la ligne du compteur,
 * ce qui garantit une séquence continue et sans doublon même en cas d'accès concurrents.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  kind: DocumentKind,
  prefix: string,
  date: Date,
) {
  const year = date.getUTCFullYear();
  const counter = await tx.counter.upsert({
    where: { companyId_kind_year: { companyId, kind, year } },
    create: { companyId, kind, year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(counter.value).padStart(4, "0")}`;
}
