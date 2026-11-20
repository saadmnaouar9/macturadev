"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Banknote, CalendarClock, CheckCircle2, ShoppingCart, Wallet } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import type { CardApi } from "@/components/data/resource-view";
import type { InvoiceDisplayStatus } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface PurchaseStats {
  total: number; // achats TTC hors annulés
  paid: number;
  due: number; // reste à payer
  overdue: number; // dont en retard
}

const pct = (n: number, d: number) => (d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0);

function Tile({ icon: Icon, label, sub, tone, index, children }: { icon: typeof Wallet; label: string; sub: string; tone: string; index: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 + index * 0.06, ease: EASE }} whileHover={{ y: -3 }} className="group flex items-center gap-3.5 rounded-3xl border border-line-soft bg-surface p-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", tone)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tracking-tight tabular text-ink">{children}</p>
        <p className="truncate text-[11px] text-faint">{sub}</p>
      </div>
    </motion.div>
  );
}

/** Synthèse des achats : dette restante, répartition payé / à venir / en retard et indicateurs */
export function PurchaseStatsPanel({ stats }: { stats: PurchaseStats }) {
  const upcoming = Math.max(0, stats.due - stats.overdue);
  const paidPct = pct(stats.paid, stats.total);
  const overduePct = pct(stats.overdue, stats.total);
  const upcomingPct = pct(upcoming, stats.total);
  return (
    <div className="mb-4 space-y-3">
      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="relative overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-60 w-60 rounded-full bg-orange-500/12 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 right-10 h-56 w-56 rounded-full bg-brand-500/12 blur-3xl" />
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-400 text-white shadow-[0_8px_20px_-6px_rgb(249_115_22/0.6)]"><ShoppingCart className="h-5 w-5" /></span>
              <div>
                <p className="text-[13px] font-medium text-muted">Reste à payer aux fournisseurs</p>
                <p className="text-xs text-faint">Achats TTC non soldés, hors factures annulées</p>
              </div>
            </div>
            <p className={cn("mt-4 text-4xl font-semibold leading-none tracking-[-0.03em] sm:text-[44px]", stats.due > 0 ? "text-ink" : "text-emerald-700")}><AnimatedNumber value={stats.due} kind="mad" /></p>
            <p className="mt-3 text-xs text-muted">sur <span className="font-semibold text-ink-soft tabular">{formatMAD(stats.total)}</span> d&apos;achats</p>
          </div>

          <div>
            <div className="flex h-3.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label="Répartition des achats : payé, à venir, en retard">
              <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" initial={{ width: 0 }} animate={{ width: `${paidPct}%` }} transition={{ duration: 0.9, delay: 0.15, ease: EASE }} />
              <motion.div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400" initial={{ width: 0 }} animate={{ width: `${upcomingPct}%` }} transition={{ duration: 0.9, delay: 0.25, ease: EASE }} />
              <motion.div className="h-full bg-gradient-to-r from-rose-500 to-orange-400" initial={{ width: 0 }} animate={{ width: `${overduePct}%` }} transition={{ duration: 0.9, delay: 0.35, ease: EASE }} />
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {[
                { l: "Payé", v: stats.paid, p: paidPct, dot: "bg-emerald-500", c: "text-emerald-700" },
                { l: "À venir", v: upcoming, p: upcomingPct, dot: "bg-amber-500", c: "text-amber-700" },
                { l: "En retard", v: stats.overdue, p: overduePct, dot: "bg-rose-500", c: "text-rose-600" },
              ].map((x) => (
                <li key={x.l} className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-inset ring-line-soft">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><span className={cn("h-2 w-2 rounded-full", x.dot)} />{x.l}</span>
                  <span className={cn("mt-1 block truncate text-[15px] font-semibold tabular", x.c)}>{formatMAD(x.v)}</span>
                  <span className="text-[11px] tabular text-faint">{Math.round(x.p)} %</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile index={0} icon={Banknote} tone="bg-brand-500/12 text-brand-600" label="Achats TTC" sub="hors annulés"><AnimatedNumber value={stats.total} kind="mad" /></Tile>
        <Tile index={1} icon={CheckCircle2} tone="bg-emerald-500/12 text-emerald-600" label="Déjà payé" sub={`${Math.round(paidPct)} % réglé`}><AnimatedNumber value={stats.paid} kind="mad" /></Tile>
        <Tile index={2} icon={CalendarClock} tone="bg-amber-500/12 text-amber-600" label="À venir" sub="échéances à respecter"><AnimatedNumber value={upcoming} kind="mad" /></Tile>
        <Tile index={3} icon={AlertTriangle} tone="bg-rose-500/12 text-rose-600" label="En retard de paiement" sub={stats.overdue > 0 ? "à régler en priorité" : "aucun retard"}><AnimatedNumber value={stats.overdue} kind="mad" /></Tile>
      </div>
    </div>
  );
}

type Row = { id: string } & Record<string, unknown>;

const ACCENT: Record<string, string> = {
  PAID: "from-emerald-500 to-teal-400",
  PARTIAL: "from-sky-500 to-cyan-400",
  UNPAID: "from-amber-500 to-yellow-400",
  OVERDUE: "from-rose-500 to-orange-400",
  CANCELLED: "from-slate-400 to-slate-300",
};

const DAY = 86400000;
function dueLabel(due: string, settled: boolean) {
  if (settled) return null;
  const d = Math.round((Date.parse(due.slice(0, 10)) - Date.parse(new Date().toISOString().slice(0, 10))) / DAY);
  if (d === 0) return { text: "Échéance aujourd'hui", late: false };
  if (d > 0) return { text: `Dans ${d} j`, late: false };
  return { text: `${-d} j de retard`, late: true };
}

/** Carte d'une facture d'achat (affichage « Cartes » de la liste) */
export function PurchaseCard({ row, api }: { row: Row; api: CardApi }) {
  const status = String(row.status ?? "UNPAID") as InvoiceDisplayStatus;
  const supplier = String(row.supplierName ?? "");
  const reference = String(row.reference ?? "");
  const category = row.category ? String(row.category) : null;
  const total = Number(row.total ?? 0);
  const balance = Number(row.balance ?? 0);
  const paid = Math.max(0, total - balance);
  const cancelled = !!row.cancelled;
  const settled = status === "PAID" || cancelled;
  const due = dueLabel(String(row.dueDate ?? ""), settled);
  const payBtn = api.extras.find((a) => a.onSelect);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: cancelled ? 0.7 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(api.index, 14) * 0.035, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("group relative flex flex-col overflow-hidden rounded-3xl border border-line-soft bg-surface p-4 shadow-[var(--shadow-xs)] transition-shadow duration-300 hover:shadow-[var(--shadow-lg)]", api.editable && "cursor-pointer")}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", ACCENT[status] ?? ACCENT.UNPAID)} />
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-brand-500/15 text-sm font-semibold text-accent-600 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">{initials(supplier || "?")}</span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left font-mono text-[13.5px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline disabled:cursor-default" onClick={api.open} disabled={!api.editable}>{reference}</button>
          <p className="truncate text-xs text-muted">{supplier}</p>
        </div>
        {api.menu}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <InvoiceStatusBadge status={status} />
        {category && <span className="rounded-full bg-subtle px-2 py-0.5 text-[11.5px] font-medium text-muted">{category}</span>}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted">Montant TTC</p>
          <p className="text-lg font-semibold tabular tracking-tight text-ink">{formatMAD(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted">Reste à payer</p>
          <p className={cn("text-[15px] font-semibold tabular", cancelled ? "text-faint" : balance > 0 ? (due?.late ? "text-rose-600" : "text-accent-600") : "text-emerald-700")}>{cancelled ? "—" : balance > 0 ? formatMAD(balance) : "Soldé"}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label={`${Math.round(pct(paid, total))} % payé`}>
        <motion.div className={cn("h-full rounded-full bg-gradient-to-r", ACCENT[status] ?? ACCENT.UNPAID)} initial={{ width: 0 }} animate={{ width: `${cancelled ? 0 : pct(paid, total)}%` }} transition={{ duration: 0.8, delay: 0.15 + Math.min(api.index, 10) * 0.04, ease: EASE }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11.5px] text-muted">
        <span>Émise le {formatDate(String(row.issueDate))}</span>
        <span className={cn("inline-flex items-center gap-1 font-medium", due?.late ? "text-rose-600" : "text-ink-soft")}>
          {due ? due.text : `Éch. ${formatDate(String(row.dueDate))}`}
        </span>
      </div>

      {payBtn && (
        <button type="button" data-no-row-click onClick={() => payBtn.onSelect?.()} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-line-soft bg-canvas/60 px-3 py-2 text-[12.5px] font-medium text-brand-700 transition-colors hover:border-brand-400/50 hover:bg-brand-500/10">
          <Wallet className="h-3.5 w-3.5" /> Paiements <ArrowUpRight className="h-3 w-3 opacity-60" />
        </button>
      )}
    </motion.div>
  );
}
