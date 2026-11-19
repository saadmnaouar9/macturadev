import {
  Banknote, BarChart3, BriefcaseBusiness, CalendarDays, CircleDollarSign, FileSignature, FileText, FolderKanban, History, Landmark, LayoutDashboard,
  ListChecks, Package, Receipt, Settings, ShieldCheck, ShoppingCart, Truck, UserRound, Users, Wallet, type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: "overdue" | "pendingQuotes" | "lateTasks";
  perm?: Permission;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_TOP: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/produits", label: "Produits & Services", icon: Package },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "ventes",
    label: "Ventes",
    icon: Receipt,
    items: [
      { href: "/prospects", label: "Prospects", icon: BriefcaseBusiness },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/devis", label: "Devis", icon: FileText, countKey: "pendingQuotes" },
      { href: "/factures", label: "Factures", icon: Receipt, countKey: "overdue" },
      { href: "/paiements", label: "Paiements", icon: CircleDollarSign },
      { href: "/contrats", label: "Contrats", icon: FileSignature },
    ],
  },
  {
    id: "achats",
    label: "Achats",
    icon: ShoppingCart,
    items: [
      { href: "/fournisseurs", label: "Fournisseurs", icon: Truck },
      { href: "/achats", label: "Factures d'achat", icon: ShoppingCart },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    items: [
      { href: "/tresorerie", label: "Trésorerie", icon: Landmark },
      { href: "/caisse", label: "Caisse", icon: Banknote },
      { href: "/rapports", label: "Rapports", icon: BarChart3 },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    icon: FolderKanban,
    items: [
      { href: "/projets", label: "Projets", icon: FolderKanban },
      { href: "/taches", label: "Tâches", icon: ListChecks, countKey: "lateTasks" },
      { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
      { href: "/employes", label: "Employés", icon: UserRound, perm: "settings" },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { href: "/journal", label: "Journal d'activité", icon: History },
  { href: "/parametres?tab=equipe", label: "Utilisateurs", icon: ShieldCheck, perm: "members" },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export const ALL_NAV: NavItem[] = [...NAV_TOP, ...NAV_GROUPS.flatMap((g) => g.items), ...NAV_BOTTOM];

export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord", clients: "Clients", devis: "Devis", factures: "Factures", produits: "Produits & Services", parametres: "Paramètres",
  prospects: "Prospects", fournisseurs: "Fournisseurs", achats: "Factures d'achat", paiements: "Paiements", contrats: "Contrats", tresorerie: "Trésorerie",
  caisse: "Caisse", rapports: "Rapports", projets: "Projets", taches: "Tâches", calendrier: "Calendrier", employes: "Employés", journal: "Journal d'activité",
  new: "Nouveau", edit: "Modifier",
};

export { Wallet };
