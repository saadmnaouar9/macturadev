"use client";

import { BriefcaseBusiness, ChevronDown, FileText, ListChecks, Menu, PackagePlus, Plus, Receipt, Search, ShoppingCart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { Breadcrumbs } from "./breadcrumbs";
import { Notifications, type NotificationItem } from "./notifications";
import { ThemeToggle } from "./theme-toggle";

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
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line-soft bg-canvas px-4 sm:gap-4 sm:px-6">
      <button onClick={onOpenMenu} className="-ml-1.5 rounded-lg p-2 text-muted transition-colors hover:bg-subtle hover:text-ink lg:hidden" aria-label="Ouvrir le menu">
        <Menu className="h-5 w-5" />
      </button>

      {/* Où je suis : fil d'Ariane, la page courante en plus gros */}
      <div className="min-w-0 flex-1 md:w-40 md:flex-none lg:w-72">
        <Breadcrumbs />
      </div>

      {/* Recherche globale : la barre la plus visible, au centre (⌘K) */}
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <button
          onClick={onOpenSearch}
          className="group flex h-10 w-full min-w-0 max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm text-faint transition-colors hover:border-line-strong hover:text-muted focus-visible:border-brand-400"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Rechercher une facture, un client…</span>
          <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onOpenSearch} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink md:hidden" aria-label="Rechercher">
          <Search className="h-[18px] w-[18px]" />
        </button>
        <ThemeToggle />
        <Notifications items={notifications} />
      </div>

      {canWrite && <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />}
      {canWrite && (
        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5 px-3">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Créer</span>
              <ChevronDown className="hidden h-3.5 w-3.5 opacity-70 sm:block" />
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
