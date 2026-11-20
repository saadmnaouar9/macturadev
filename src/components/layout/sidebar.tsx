"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen, Settings, UserRound } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/status";
import { logoutAction } from "@/app/(auth)/actions";
import { can } from "@/lib/permissions";
import { NAV_BOTTOM, NAV_GROUPS, NAV_TOP, type NavGroup, type NavItem } from "./nav";
import type { ShellUser } from "./app-shell";

const ease = [0.16, 1, 0.3, 1] as const;

function NavLink({ item, collapsed, active, count, onNavigate, layoutId }: { item: NavItem; collapsed: boolean; active: boolean; count?: number; onNavigate?: () => void; layoutId: string }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors duration-150",
        active ? "text-ink" : "text-muted hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="nav-active-pill absolute inset-0 rounded-lg bg-brand-500/25"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      {!active && <span className="absolute inset-0 rounded-lg bg-white/[0.035] opacity-0 transition-opacity group-hover:opacity-100" />}
      <Icon className={cn("relative h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-brand-700" : "text-faint group-hover:text-ink-soft")} strokeWidth={active ? 2.2 : 1.9} />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="relative flex-1 truncate">
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!!count && !collapsed && (
        <span
          className={cn(
            "relative rounded-full px-1.5 py-px text-[11px] font-semibold tabular",
            item.countKey === "overdue" ? "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200/70" : "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70",
          )}
        >
          {count}
        </span>
      )}
      {!!count && collapsed && <span className={cn("absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full", item.countKey === "overdue" ? "bg-rose-500" : "bg-brand-500")} />}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarContent({
  user,
  collapsed,
  onToggle,
  counts,
  onNavigate,
  mobile,
}: {
  user: ShellUser;
  collapsed: boolean;
  onToggle?: () => void;
  counts: { overdue: number; pendingQuotes: number; lateTasks: number };
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const layoutId = mobile ? "nav-active-mobile" : "nav-active";
  const allowed = (i: NavItem) => !i.perm || can(user.role, i.perm);
  const groups = useMemo(() => NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter((g) => g.items.length), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.role]);
  const top = NAV_TOP.filter(allowed);
  const bottom = NAV_BOTTOM.filter(allowed);

  const isActive = (item: NavItem) => {
    const path = item.href.split("?")[0];
    if (path === "/parametres") {
      if (pathname !== "/parametres") return false;
      return item.href.includes("tab=equipe") ? tab === "equipe" : tab !== "equipe";
    }
    return pathname === path || pathname.startsWith(path + "/");
  };
  const activeGroup = groups.find((g) => g.items.some(isActive))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeGroup ? { [activeGroup]: true } : { ventes: true }));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mactura:nav-open") ?? "{}");
      setOpen((o) => ({ ...saved, ...o }));
    } catch { /* stockage indisponible */ }
  }, []);
  useEffect(() => {
    if (activeGroup) setOpen((o) => (o[activeGroup] ? o : { ...o, [activeGroup]: true }));
  }, [activeGroup]);
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = { ...o, [id]: !o[id] };
      try { localStorage.setItem("mactura:nav-open", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const link = (item: NavItem) => (
    <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item)} count={item.countKey ? counts[item.countKey] : undefined} onNavigate={onNavigate} layoutId={layoutId} />
  );

  const renderGroup = (g: NavGroup & { items: NavItem[] }) => {
    if (collapsed) return <div key={g.id} className="space-y-0.5 border-t border-white/[0.05] pt-2">{g.items.map(link)}</div>;
    const isOpen = !!open[g.id];
    const hasActive = g.id === activeGroup;
    return (
      <div key={g.id}>
        <button
          onClick={() => toggle(g.id)}
          aria-expanded={isOpen}
          className={cn("group flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors hover:bg-white/[0.035]", hasActive ? "text-ink" : "text-muted hover:text-ink")}
        >
          <g.icon className={cn("h-[18px] w-[18px] shrink-0", hasActive ? "text-brand-700" : "text-faint group-hover:text-ink-soft")} strokeWidth={1.9} />
          <span className="flex-1 text-left">{g.label}</span>
          <ChevronDown className={cn("h-4 w-4 text-faint transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
              <div className="ml-[18px] space-y-0.5 border-l border-white/[0.07] py-0.5 pl-2">{g.items.map(link)}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center px-4", collapsed ? "justify-center px-0" : "justify-between")}>
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center" aria-label="Mactura — tableau de bord">
          <AnimatePresence mode="wait" initial={false}>
            {collapsed ? (
              <motion.span key="mark" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                <LogoMark adaptive />
              </motion.span>
            ) : (
              <motion.span key="logo" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}>
                <Logo adaptive className="h-[22px]" />
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        {onToggle && !collapsed && (
          <button onClick={onToggle} className="rounded-md p-1.5 text-faint transition-colors hover:bg-white/[0.04] hover:text-ink" aria-label="Replier la barre latérale">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn("px-3 pb-3 pt-1", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-2.5 py-2 ring-1 ring-inset ring-white/[0.04]", collapsed && "justify-center px-0")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-[11px] font-bold text-white shadow-sm">
            {initials(user.companyName)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{user.companyName}</p>
              <p className="truncate text-[11px] text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
        </div>
      </div>

      <nav className={cn("scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-2", collapsed && "space-y-2 px-2")} aria-label="Navigation principale">
        <div className="space-y-0.5">{top.map(link)}</div>
        {groups.map(renderGroup)}
        <div className={cn("space-y-0.5 border-t border-white/[0.05] pt-2", !collapsed && "mt-2")}>{bottom.map(link)}</div>
      </nav>

      {onToggle && collapsed && (
        <div className="flex justify-center pb-2">
          <Tooltip content="Déplier" side="right">
            <button onClick={onToggle} className="rounded-md p-2 text-faint transition-colors hover:bg-white/[0.04] hover:text-ink" aria-label="Déplier la barre latérale">
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      )}

      <div className={cn("border-t border-white/[0.05] p-3", collapsed && "p-2")}>
        <DropdownMenu>
          <DropdownTrigger asChild>
            <button className={cn("flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-white/[0.04] data-[state=open]:bg-white/[0.04]", collapsed && "justify-center")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-600">
                {initials(user.name)}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
                    <span className="block truncate text-[11px] text-muted">{user.email}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" />
                </>
              )}
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="w-60">
            <DropdownLabel>{user.email}</DropdownLabel>
            <DropdownItem href="/parametres?tab=profil" onSelect={onNavigate}>
              <UserRound /> Mon profil
            </DropdownItem>
            <DropdownItem href="/parametres" onSelect={onNavigate}>
              <Settings /> Paramètres
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => logoutAction()}>
              <LogOut /> Se déconnecter
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
