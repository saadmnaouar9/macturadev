"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card } from "@/components/ui/card";
import { formatMAD } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface PurchaseStats {
  total: number; // achats TTC hors annulés
  paid: number;
  due: number; // reste à payer
  overdue: number; // dont en retard
}

const pct = (n: number, d: number) => (d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0);

/**
 * Synthèse des achats : ce que l'on doit encore aux fournisseurs, et ce qui est en retard.
 * Un seul bloc : le chiffre principal, une barre de répartition et sa légende. Les couleurs ont un sens (réglé / à venir / en retard).
 */
export function PurchaseStatsPanel({ stats }: { stats: PurchaseStats }) {
  const upcoming = Math.max(0, stats.due - stats.overdue);
  const parts = [
    { key: "paid", label: "Payé", value: stats.paid, bar: "bg-emerald-600", dot: "bg-emerald-600" },
    { key: "upcoming", label: "À venir", value: upcoming, bar: "bg-amber-500", dot: "bg-amber-500" },
    { key: "overdue", label: "En retard", value: stats.overdue, bar: "bg-rose-600", dot: "bg-rose-600" },
  ];
  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-sm text-muted">Reste à payer aux fournisseurs</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular text-ink">
            <AnimatedNumber value={stats.due} kind="mad" />
          </p>
        </div>
        <p className="text-sm text-muted">
          sur <span className="font-medium tabular text-ink-soft">{formatMAD(stats.total)}</span> d&apos;achats TTC
        </p>
      </div>

      <div className="mt-5 flex h-2 gap-px overflow-hidden rounded-sm bg-subtle" role="img" aria-label="Répartition des achats : payé, à venir, en retard">
        {parts.map((p, i) => (
          <motion.div key={p.key} className={cn("h-full", p.bar)} initial={{ width: 0 }} animate={{ width: `${pct(p.value, stats.total)}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        {parts.map((p) => (
          <div key={p.key}>
            <dt className="flex items-center gap-2 text-muted">
              <span className={cn("h-2 w-2 rounded-full", p.dot)} aria-hidden />
              {p.label}
              <span className="tabular text-faint">{Math.round(pct(p.value, stats.total))} %</span>
            </dt>
            <dd className={cn("mt-0.5 font-medium tabular", p.key === "overdue" && p.value > 0 ? "text-rose-700" : "text-ink")}>
              {formatMAD(p.value)}
              {p.key === "overdue" && p.value > 0 && (
                <Link prefetch={false} href="/achats?status=OVERDUE" className="ml-2 text-[13px] font-normal text-brand-700 hover:underline">
                  Voir les factures en retard
                </Link>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
