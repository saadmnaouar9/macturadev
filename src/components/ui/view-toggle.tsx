"use client";

import { motion } from "framer-motion";
import { LayoutGrid, List, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "table";

/** Bascule Cartes / Tableau. `layoutId` doit être unique par page (animation de la pastille). */
export function ViewToggle({ mode, onChange, layoutId = "view-toggle" }: { mode: ViewMode; onChange: (m: ViewMode) => void; layoutId?: string }) {
  const items: { value: ViewMode; label: string; icon: LucideIcon }[] = [
    { value: "grid", label: "Cartes", icon: LayoutGrid },
    { value: "table", label: "Tableau", icon: List },
  ];
  return (
    <div className="flex shrink-0 self-start rounded-lg bg-subtle p-0.5 ring-1 ring-inset ring-line" role="group" aria-label="Mode d'affichage">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)} aria-pressed={mode === it.value} aria-label={it.label} title={it.label}
          className={cn("relative flex h-9 w-10 items-center justify-center rounded-md transition-colors", mode === it.value ? "text-ink" : "text-muted hover:text-ink")}>
          {mode === it.value && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-md bg-surface shadow-[var(--shadow-ring)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          <it.icon className="relative h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
