"use client";

import { BriefcaseBusiness, FileText, ListChecks, Menu, PackagePlus, Plus, Receipt, Search, ShoppingCart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { Breadcrumbs } from "./breadcrumbs";
import { Notifications, type NotificationItem } from "./notifications";

export function Topbar({
  onOpenMenu,
  onOpenSearch,
  notifications,
  canWrite,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  notifications: NotificationItem[];
  canWrite: boolean;
}) {
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/[0.05] bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
      <button onClick={onOpenMenu} className="-ml-1.5 rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink lg:hidden" aria-label="Ouvrir le menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <button
        onClick={onOpenSearch}
        className="group hidden h-8 w-64 items-center gap-2 rounded-lg bg-surface px-2.5 text-[13px] text-faint shadow-[0_0_0_1px_var(--color-line),var(--shadow-xs)] transition-shadow hover:shadow-[0_0_0_1px_#d6d8e2,var(--shadow-sm)] md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="rounded border border-line bg-subtle px-1.5 font-sans text-[11px] font-medium text-muted">⌘K</kbd>
      </button>
      <button onClick={onOpenSearch} className="rounded-md p-2 text-muted hover:bg-subtle hover:text-ink md:hidden" aria-label="Rechercher">
        <Search className="h-[18px] w-[18px]" />
      </button>

      <Notifications items={notifications} />

      {canWrite && (
        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button size="sm" className="gap-1.5 px-2.5 sm:px-3">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Créer</span>
            </Button>
          </DropdownTrigger>
          <DropdownContent className="w-56">
            <DropdownLabel>Actions rapides</DropdownLabel>
            <DropdownItem href="/factures/new" shortcut="F">
              <Receipt /> Nouvelle facture
            </DropdownItem>
            <DropdownItem href="/devis/new" shortcut="D">
              <FileText /> Nouveau devis
            </DropdownItem>
            <DropdownItem href="/clients/new" shortcut="C">
              <UserPlus /> Nouveau client
            </DropdownItem>
            <DropdownItem href="/produits?new=1" shortcut="P">
              <PackagePlus /> Nouveau produit
            </DropdownItem>
            <DropdownItem href="/prospects?new=1">
              <BriefcaseBusiness /> Nouveau prospect
            </DropdownItem>
            <DropdownItem href="/achats?new=1">
              <ShoppingCart /> Facture d&apos;achat
            </DropdownItem>
            <DropdownItem href="/taches?new=1">
              <ListChecks /> Nouvelle tâche
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      )}
    </header>
  );
}
