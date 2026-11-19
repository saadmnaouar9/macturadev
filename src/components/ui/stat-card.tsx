"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAT_TONES = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-200/70", glow: "bg-brand-500/25" },
  sky: { tile: "bg-sky-50 text-sky-700 ring-sky-200/70", glow: "bg-sky-500/25" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", glow: "bg-emerald-500/25" },
  violet: { tile: "bg-violet-50 text-violet-700 ring-violet-200/70", glow: "bg-violet-500/25" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-200/80", glow: "bg-amber-500/25" },
  rose: { tile: "bg-rose-50 text-rose-700 ring-rose-200/70", glow: "bg-rose-500/25" },
} as const;

export type StatTone = keyof typeof STAT_TONES;

/** Carte de synthèse animée (entrée échelonnée, halo coloré, icône qui s'incline au survol). */
export function StatCard({ label, sub, icon: Icon, tone, index = 0, pulse, children }: {
  label: string; sub?: string; icon: LucideIcon; tone: StatTone; index?: number; pulse?: boolean; children: React.ReactNode;
}) {
  const t = STAT_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="glass group relative overflow-hidden rounded-xl p-4 shadow-[var(--shadow-ring),var(--shadow-md)]"
    >
      <span aria-hidden className={cn("pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100", t.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1.5 truncate text-[22px] font-semibold tracking-tight text-ink">{children}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] text-faint">{sub}</p>}
        </div>
        <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", t.tile)}>
          <Icon className="h-5 w-5" />
          {pulse && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-amber-400/80" />}
        </span>
      </div>
    </motion.div>
  );
}
