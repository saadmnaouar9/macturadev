"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CardApi } from "@/components/data/resource-view";
import type { InvoiceDisplayStatus } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";

export interface PurchaseStats {
  total: number; // achats TTC hors annulés
  paid: number;
  due: number; // reste à payer
  overdue: number; // dont en retard
}

const EASE = [0.16, 1, 0.3, 1] as const;
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

type Row = { id: string } & Record<string, unknown>;

const DAY = 86400000;
function dueLabel(due: string, settled: boolean) {
  if (settled) return null;
  const d = Math.round((Date.parse(due.slice(0, 10)) - Date.parse(new Date().toISOString().slice(0, 10))) / DAY);
  if (d === 0) return { text: "Échéance aujourd'hui", late: false };
  if (d > 0) return { text: `Dans ${d} j`, late: false };
  return { text: `${-d} j de retard`, late: true };
}

/** Carte d'une facture d'achat (affichage « Cartes » de la liste) : référence, fournisseur, état, montants et échéance. */
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
  const pay = api.extras.find((a) => a.onSelect);
  const barColor = status === "PAID" ? "bg-emerald-600" : status === "OVERDUE" ? "bg-rose-600" : "bg-brand-500";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: cancelled ? 0.65 : 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(api.index, 14) * 0.03, ease: EASE }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("flex flex-col rounded-xl border border-line-soft bg-surface p-4 transition-colors hover:border-line", api.editable && "cursor-pointer")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-[13px] font-semibold text-ink-soft">{initials(supplier || "?")}</span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left font-mono text-[13.5px] font-semibold text-ink outline-none hover:text-brand-700 focus-visible:underline disabled:cursor-default disabled:hover:text-ink" onClick={api.open} disabled={!api.editable}>{reference}</button>
          <p className="truncate text-xs text-muted">{supplier}</p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0">{api.menu}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <InvoiceStatusBadge status={status} />
        {category && <span className="text-xs text-muted">{category}</span>}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Montant TTC</p>
          <p className="text-lg font-semibold tracking-tight tabular text-ink">{formatMAD(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Reste à payer</p>
          <p className={cn("text-[15px] font-semibold tabular", cancelled ? "text-faint" : balance <= 0 ? "text-emerald-700" : due?.late ? "text-rose-700" : "text-ink")}>{cancelled ? "—" : balance > 0 ? formatMAD(balance) : "Soldé"}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-subtle" role="img" aria-label={`${Math.round(pct(paid, total))} % payé`}>
        <div className={cn("h-full", barColor)} style={{ width: `${cancelled ? 0 : pct(paid, total)}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
        <span>Émise le {formatDate(String(row.issueDate))}</span>
        <span className={cn(due?.late && "font-medium text-rose-700")}>{due ? due.text : `Éch. ${formatDate(String(row.dueDate))}`}</span>
      </div>

      {pay && (
        <button type="button" data-no-row-click onClick={() => pay.onSelect?.()} className="mt-3 self-start rounded-md px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-subtle">
          Paiements
        </button>
      )}
    </motion.div>
  );
}
