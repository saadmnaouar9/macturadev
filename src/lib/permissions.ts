import type { Role } from "@prisma/client";

export type Permission =
  | "read"
  | "write" // créer / modifier clients, produits, devis, factures, paiements
  | "delete" // supprimer des enregistrements
  | "settings" // paramètres de l'entreprise, taxes, numérotation
  | "members"; // gestion de l'équipe

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ["read", "write", "delete", "settings", "members"],
  ADMIN: ["read", "write", "delete", "settings", "members"],
  MEMBER: ["read", "write"],
  VIEWER: ["read"],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}
