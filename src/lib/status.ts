import type { InvoiceStatus, PaymentStatus, Prisma, QuoteStatus } from "@prisma/client";
import { todayUTC } from "./utils";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "violet";

// ─── Factures ───────────────────────────────────────────────────────────────
// Deux dimensions indépendantes stockées en base :
//   • status        → cycle de vie du document : DRAFT → ISSUED → SENT (ou CANCELLED)
//   • paymentStatus → règlement : UNPAID → PARTIAL → PAID (dérivé des paiements actifs)
// « En retard » n'est jamais stocké : facture émise/envoyée, non soldée, échéance dépassée.

export const LIFECYCLE: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  ISSUED: { label: "Émise", tone: "brand" },
  SENT: { label: "Envoyée", tone: "info" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<PaymentStatus | "OVERDUE", { label: string; tone: Tone }> = {
  UNPAID: { label: "Non payée", tone: "warning" },
  PARTIAL: { label: "Partiellement payée", tone: "violet" },
  PAID: { label: "Payée", tone: "success" },
  OVERDUE: { label: "En retard", tone: "danger" },
};

/** Statut synthétique pour l'affichage (badge principal, filtres). */
export type InvoiceDisplayStatus = "DRAFT" | "CANCELLED" | "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

export const INVOICE_STATUS: Record<InvoiceDisplayStatus, { label: string; tone: Tone }> = {
  DRAFT: LIFECYCLE.DRAFT,
  CANCELLED: LIFECYCLE.CANCELLED,
  UNPAID: PAYMENT_STATUS.UNPAID,
  PARTIAL: PAYMENT_STATUS.PARTIAL,
  PAID: PAYMENT_STATUS.PAID,
  OVERDUE: PAYMENT_STATUS.OVERDUE,
};

export const ACTIVE_LIFECYCLE: InvoiceStatus[] = ["ISSUED", "SENT"];

export function isOverdue(inv: { status: InvoiceStatus; paymentStatus: PaymentStatus; dueDate: Date | string }) {
  return ACTIVE_LIFECYCLE.includes(inv.status) && inv.paymentStatus !== "PAID" && new Date(inv.dueDate) < todayUTC();
}

export function invoiceDisplayStatus(inv: { status: InvoiceStatus; paymentStatus: PaymentStatus; dueDate: Date | string }): InvoiceDisplayStatus {
  if (inv.status === "DRAFT" || inv.status === "CANCELLED") return inv.status;
  if (inv.paymentStatus === "PAID") return "PAID";
  if (isOverdue(inv)) return "OVERDUE";
  return inv.paymentStatus;
}

/** Factures émises restant à encaisser (non brouillon, non annulées, non soldées). */
export const outstandingWhere: Prisma.InvoiceWhereInput = { status: { in: ACTIVE_LIFECYCLE }, paymentStatus: { not: "PAID" } };
/** Factures « comptables » (émises ou envoyées), hors brouillons et annulations. */
export const issuedWhere: Prisma.InvoiceWhereInput = { status: { in: ACTIVE_LIFECYCLE } };

// ─── Devis ──────────────────────────────────────────────────────────────────
export type QuoteDisplayStatus = QuoteStatus;

export const QUOTE_STATUS: Record<QuoteDisplayStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  SENT: { label: "Envoyé", tone: "info" },
  ACCEPTED: { label: "Accepté", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  EXPIRED: { label: "Expiré", tone: "warning" },
};

/** Un devis brouillon/envoyé dont la validité est dépassée est « Expiré ». */
export function quoteDisplayStatus(q: { status: QuoteStatus; expiryDate: Date | string }): QuoteDisplayStatus {
  if ((q.status === "DRAFT" || q.status === "SENT") && new Date(q.expiryDate) < todayUTC()) return "EXPIRED";
  return q.status;
}

export const PAYMENT_METHODS = {
  BANK_TRANSFER: "Virement bancaire",
  CASH: "Espèces",
  CHECK: "Chèque",
  CARD: "Carte bancaire",
  LCN: "Effet (LCN)",
  OTHER: "Autre",
} as const;

export const ROLE_LABELS = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
  VIEWER: "Lecture seule",
} as const;

// ─── Achats, prospects, projets, tâches, contrats ───────────────────────────
export function purchaseDisplayStatus(p: { cancelledAt: Date | string | null; paymentStatus: PaymentStatus; dueDate: Date | string }): InvoiceDisplayStatus {
  if (p.cancelledAt) return "CANCELLED";
  if (p.paymentStatus === "PAID") return "PAID";
  if (new Date(p.dueDate) < todayUTC()) return "OVERDUE";
  return p.paymentStatus;
}

export const PROSPECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "Nouveau", tone: "info" },
  CONTACTED: { label: "Contacté", tone: "brand" },
  QUALIFIED: { label: "Qualifié", tone: "violet" },
  PROPOSAL: { label: "Proposition", tone: "warning" },
  WON: { label: "Gagné", tone: "success" },
  LOST: { label: "Perdu", tone: "neutral" },
};
export const PROJECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PLANNED: { label: "Planifié", tone: "neutral" },
  ACTIVE: { label: "En cours", tone: "brand" },
  ON_HOLD: { label: "En pause", tone: "warning" },
  DONE: { label: "Terminé", tone: "success" },
  CANCELLED: { label: "Annulé", tone: "danger" },
};
export const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  TODO: { label: "À faire", tone: "neutral" },
  IN_PROGRESS: { label: "En cours", tone: "brand" },
  DONE: { label: "Terminée", tone: "success" },
};
export const TASK_PRIORITY: Record<string, { label: string; tone: Tone }> = {
  LOW: { label: "Basse", tone: "neutral" },
  MEDIUM: { label: "Moyenne", tone: "info" },
  HIGH: { label: "Haute", tone: "danger" },
};
export const CONTRACT_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  ACTIVE: { label: "Actif", tone: "success" },
  EXPIRING: { label: "Expire bientôt", tone: "warning" },
  EXPIRED: { label: "Expiré", tone: "danger" },
  TERMINATED: { label: "Résilié", tone: "neutral" },
};
export const FREQUENCY_LABELS: Record<string, string> = { ONE_TIME: "Ponctuel", MONTHLY: "Mensuel", QUARTERLY: "Trimestriel", YEARLY: "Annuel" };

/** Un contrat actif dont la fin est dépassée est « Expiré », à moins de 30 jours « Expire bientôt ». */
export function contractDisplayStatus(c: { status: string; endDate: Date | string | null }) {
  if (c.status !== "ACTIVE" || !c.endDate) return c.status;
  const end = new Date(c.endDate).getTime();
  const today = todayUTC().getTime();
  if (end < today) return "EXPIRED";
  if (end - today <= 30 * 86400_000) return "EXPIRING";
  return "ACTIVE";
}
