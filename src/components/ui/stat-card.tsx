"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAT_TONES = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-200/70", glow: "bg-brand-500/25" },
  sky: { tile: "bg-brand-50 text-brand-700 ring-brand-200/70", glow: "bg-brand-500/25" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", glow: "bg-emerald-500/25" },
  violet: { tile: "bg-brand-50 text-brand-700 ring-brand-200/70", glow: "bg-brand-500/25" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-200/80", glow: "bg-amber-500/25" },
  rose: { tile: "bg-rose-50 text-rose-700 ring-rose-200/70", glow: "bg-rose-500/25" },
} as const;

export type StatTone = keyof typeof STAT_TONES;

/**
 * Chiffre de synthèse : libellé, valeur, précision. Pas de carte propre : les chiffres sont regroupés dans une seule surface par la page
 * (voir `STAT_STRIP`). Les paramètres `icon`, `index` et `pulse` sont conservés pour compatibilité mais ne sont plus affichés.
 */
export const STAT_STRIP = "mb-5 grid grid-cols-2 gap-x-8 gap-y-5 rounded-xl border border-line-soft bg-surface px-5 py-4";

export function StatCard({ label, sub, tone, children }: {
  label: string; sub?: string; icon?: LucideIcon; tone?: StatTone; index?: number; pulse?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn("mt-1 truncate text-xl font-semibold tracking-tight tabular", tone === "rose" ? "text-rose-700" : "text-ink")}>{children}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-faint">{sub}</p>}
    </div>
  );
}
