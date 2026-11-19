"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CalendarClock, FileSignature, Hourglass, Repeat, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import type { CardApi } from "@/components/data/resource-view";
import { CONTRACT_STATUS } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface ContractStats {
  activeCount: number;
  mrr: number;
  expiringCount: number;
  expiredCount: number;
}

const LINE: Record<string, string> = {
  neutral: "bg-faint", info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500", brand: "bg-brand-500", violet: "bg-violet-500",
};

export function ContractStatsPanel({ stats }: { stats: ContractStats }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard index={0} tone="emerald" icon={FileSignature} label="Contrats actifs" sub="en cours de validité"><AnimatedNumber value={stats.activeCount} /></StatCard>
      <StatCard index={1} tone="brand" icon={TrendingUp} label="Revenu récurrent mensuel" sub="HT, contrats actifs"><AnimatedNumber value={stats.mrr} kind="mad" /></StatCard>
      <StatCard index={2} tone="amber" icon={Hourglass} label="Expirent sous 30 jours" sub="à renouveler" pulse={stats.expiringCount > 0}><AnimatedNumber value={stats.expiringCount} /></StatCard>
      <StatCard index={3} tone="rose" icon={AlertTriangle} label="Expirés" sub="échéance dépassée"><AnimatedNumber value={stats.expiredCount} /></StatCard>
    </div>
  );
}

type Row = { id: string } & Record<string, unknown>;

export function ContractCard({ row, api }: { row: Row; api: CardApi }) {
  const display = String(row.displayStatus ?? row.status ?? "DRAFT");
  const meta = CONTRACT_STATUS[display];
  const tone = meta?.tone ?? "neutral";
  const start = row.startDate ? String(row.startDate) : null;
  const end = row.endDate ? String(row.endDate) : null;
  const amount = Number(row.amount ?? 0);
  const [reference, customer] = String(row.subtitle ?? "").split(" · ");
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : now;
  const endMs = end ? new Date(end).getTime() : null;
  const pct = endMs && endMs > startMs ? Math.max(0, Math.min(100, ((now - startMs) / (endMs - startMs)) * 100)) : 0;
  const daysLeft = endMs ? Math.ceil((endMs - now) / 86400000) : null;
  const expired = display === "EXPIRED";
  const expiring = display === "EXPIRING";
  const primary = api.extras[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: display === "TERMINATED" ? 0.65 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(api.index, 14) * 0.035, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      onMouseMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - b.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - b.top}px`);
      }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("glass group relative flex flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60", api.editable && "cursor-pointer")}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgb(91 155 255 / 0.16), transparent 70%)" }} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", LINE[tone])} />

      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <FileSignature className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-[15px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline" onClick={api.open} disabled={!api.editable}>{String(row.title ?? "")}</button>
          <p className="mt-0.5 truncate text-xs text-muted"><span className="font-mono">{reference}</span>{customer ? ` · ${customer}` : ""}</p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0">{api.menu}</div>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
        <span className="inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-xs text-muted"><Repeat className="h-3 w-3" />{String(row.frequencyLabel ?? "")}</span>
        {row.autoRenew ? <span className="rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">Reconduction tacite</span> : null}
      </div>

      <div className="relative mt-4 border-t border-line-soft pt-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Montant HT / période</p>
            <p className="whitespace-nowrap text-lg font-semibold tabular tracking-tight text-ink">{amount > 0 ? formatMAD(amount) : "—"}</p>
          </div>
          {primary && (
            <button data-no-row-click onClick={() => primary.onSelect?.()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200/70 transition-colors hover:bg-brand-100 [&_svg]:h-3.5 [&_svg]:w-3.5">
              {primary.icon}{primary.label}
            </button>
          )}
        </div>
        <div className="mt-3">
          {end ? (
            <span className="block h-1.5 overflow-hidden rounded-full bg-subtle">
              <motion.span className={cn("block h-full rounded-full", expired ? "bg-rose-500" : expiring ? "bg-amber-500" : "bg-emerald-500")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.25 + Math.min(api.index, 14) * 0.03, ease: EASE }} />
            </span>
          ) : null}
          <p className={cn("mt-1.5 flex items-center justify-between gap-2 text-[11px]", expired ? "font-medium text-rose-600" : expiring ? "font-medium text-amber-700" : "text-muted")}>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CalendarClock className="h-3.5 w-3.5" />{start ? formatDate(start) : "—"} → {end ? formatDate(end) : "Sans échéance"}</span>
            {daysLeft !== null && display !== "TERMINATED" && display !== "DRAFT" && <span className="whitespace-nowrap">{daysLeft < 0 ? `Expiré depuis ${-daysLeft} j` : daysLeft === 0 ? "Expire aujourd'hui" : `${daysLeft} j restants`}</span>}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
