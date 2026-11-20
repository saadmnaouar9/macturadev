"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Banknote, CalendarDays, CircleDollarSign, CreditCard, Hash, Landmark, ReceiptText, Sigma, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard, STAT_STRIP } from "@/components/ui/stat-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { startNavProgress } from "@/components/layout/top-progress";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead } from "@/components/data/list-state";
import { PAYMENT_METHODS } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

export interface PaymentRowData {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  doc: string;
  party: string;
  href: string;
  partyHref: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface MethodStat { method: PaymentMethod; amount: number; count: number }

const VIEW_KEY = "mactura.payments.view";
const EASE = [0.16, 1, 0.3, 1] as const;

const METHOD_META: Record<string, { icon: LucideIcon; bar: string; tile: string }> = {
  BANK_TRANSFER: { icon: Landmark, bar: "bg-brand-500", tile: "bg-brand-50 text-brand-700 ring-brand-100" },
  CASH: { icon: Banknote, bar: "bg-emerald-500", tile: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  CHECK: { icon: ReceiptText, bar: "bg-amber-500", tile: "bg-amber-50 text-amber-700 ring-amber-100" },
  CARD: { icon: CreditCard, bar: "bg-brand-500", tile: "bg-brand-50 text-brand-700 ring-brand-100" },
  LCN: { icon: Wallet, bar: "bg-brand-500", tile: "bg-brand-50 text-brand-700 ring-brand-100" },
  OTHER: { icon: CircleDollarSign, bar: "bg-faint", tile: "bg-subtle text-ink-soft ring-line" },
};

function MethodBreakdown({ stats, total }: { stats: MethodStat[]; total: number }) {
  if (stats.length === 0 || total <= 0) return null;
  const sorted = [...stats].sort((a, b) => b.amount - a.amount);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.26, ease: EASE }}
      className="glass mb-5 rounded-xl p-4 shadow-[var(--shadow-ring),var(--shadow-md)]"
    >
      <h2 className="mb-3 text-[13px] font-semibold text-ink">Répartition par mode de paiement</h2>
      <span className="mb-4 flex h-2 overflow-hidden rounded-full bg-subtle">
        {sorted.map((m, i) => (
          <motion.span key={m.method} title={`${PAYMENT_METHODS[m.method]} · ${formatMAD(m.amount)}`} className={cn("h-full", METHOD_META[m.method]?.bar)}
            initial={{ width: 0 }} animate={{ width: `${(m.amount / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.4 + i * 0.08, ease: EASE }} />
        ))}
      </span>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {sorted.map((m, i) => {
          const meta = METHOD_META[m.method] ?? METHOD_META.OTHER;
          return (
            <motion.div key={m.method} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4 + i * 0.05, ease: EASE }}
              className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-inset ring-line">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", meta.tile)}><meta.icon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs text-muted">{PAYMENT_METHODS[m.method]} · {Math.round((m.amount / total) * 100)} %</span>
                <span className="block truncate whitespace-nowrap text-[13px] font-semibold tabular text-ink">{formatMAD(m.amount)}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PaymentCard({ r, kind, index }: { r: PaymentRowData; kind: "in" | "out"; index: number }) {
  const router = useRouter();
  const meta = METHOD_META[r.method] ?? METHOD_META.OTHER;
  const voided = !!r.voidedAt;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: voided ? 0.7 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index, 14) * 0.035, ease: EASE }}
      onMouseMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - b.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - b.top}px`);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a,[data-no-row-click]")) return;
        startNavProgress();
        router.push(r.href);
      }}
      className="glass group relative flex cursor-pointer flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgb(91 155 255 / 0.16), transparent 70%)" }} />

      <div className="relative flex items-start gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ", meta.tile)}>
          <meta.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{PAYMENT_METHODS[r.method]}</p>
          <p className={cn("whitespace-nowrap text-lg font-semibold tabular tracking-tight", voided ? "text-faint line-through" : kind === "in" ? "text-emerald-700" : "text-ink")}>
            {kind === "in" ? "+" : "−"}{formatMAD(r.amount)}
          </p>
        </div>
        {voided && <Badge dot={false}>Annulé</Badge>}
      </div>

      <div className="relative mt-3 space-y-1.5 text-xs">
        <p className="flex items-center gap-2 text-muted"><Hash className="h-3.5 w-3.5 shrink-0" /><Link prefetch={false} href={r.href} className="truncate font-mono font-medium text-ink transition-colors hover:text-brand-700">{r.doc}</Link></p>
        <p className="flex items-center gap-2 text-muted"><Wallet className="h-3.5 w-3.5 shrink-0" /><Link prefetch={false} href={r.partyHref} className="truncate font-medium text-ink-soft transition-colors hover:text-brand-700">{r.party}</Link></p>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-line-soft pt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CalendarDays className="h-3.5 w-3.5" />{formatDate(r.date)}</span>
        <span className="min-w-0 truncate text-faint">{voided ? (r.voidReason ?? "Annulé") : r.reference ? `Réf. ${r.reference}` : ""}</span>
      </div>
    </motion.div>
  );
}

export function PaymentsView({ rows, kind, state, total, sum, page, pageSize, inCount, outCount, methods }: {
  rows: PaymentRowData[]; kind: "in" | "out"; state: "active" | "voided"; total: number; sum: number; page: number; pageSize: number;
  inCount: number; outCount: number; methods: MethodStat[];
}) {
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "grid" || v === "table") setView(v); } catch { /* stockage indisponible */ }
  }, []);
  const changeView = (m: ViewMode) => {
    setView(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* ignoré */ }
  };
  const label = `${kind === "in" ? "Total encaissé" : "Total décaissé"} ${state === "voided" ? "(annulés)" : "(actifs)"}`;
  const methodsTotal = methods.reduce((s, m) => s + m.amount, 0);

  return (
    <ListState>
      <div className={`${STAT_STRIP} lg:grid-cols-3`}>
        <StatCard index={0} tone={kind === "in" ? "emerald" : "brand"} icon={CircleDollarSign} label={label} sub="selon les filtres"><AnimatedNumber value={sum} kind="mad" /></StatCard>
        <StatCard index={1} tone="violet" icon={Hash} label="Nombre de paiements" sub={`${inCount} encaissement${inCount > 1 ? "s" : ""} · ${outCount} décaissement${outCount > 1 ? "s" : ""}`}><AnimatedNumber value={total} /></StatCard>
        <div className="col-span-2 lg:col-span-1">
          <StatCard index={2} tone="amber" icon={Sigma} label="Montant moyen" sub="par paiement"><AnimatedNumber value={total > 0 ? Math.round(sum / total) : 0} kind="mad" /></StatCard>
        </div>
      </div>
      {state === "active" && <MethodBreakdown stats={methods} total={methodsTotal} />}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <FilterTabs param="type" layoutId="pay-type" options={[{ value: "", label: "Encaissements", count: inCount }, { value: "out", label: "Décaissements", count: outCount }]} />
            <div className="hidden h-5 w-px bg-line lg:block" />
            <FilterTabs param="state" layoutId="pay-state" options={[{ value: "", label: "Actifs" }, { value: "voided", label: "Annulés" }]} />
            <div className="hidden h-5 w-px bg-line lg:block" />
            <FilterTabs param="method" layoutId="pay-method" options={[{ value: "", label: "Tous modes" }, { value: "BANK_TRANSFER", label: "Virement" }, { value: "CASH", label: "Espèces" }, { value: "CHECK", label: "Chèque" }, { value: "CARD", label: "Carte" }]} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput placeholder="Référence, document, tiers…" />
            <ViewToggle mode={view} onChange={changeView} layoutId="payment-view-toggle" />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={CircleDollarSign} title="Aucun paiement" description="Les paiements apparaîtront ici dès leur enregistrement sur une facture ou un achat." />
        ) : (
          <>
            {view === "grid" ? (
              <div className="grid gap-4 p-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((r, i) => <PaymentCard key={r.id} r={r} kind={kind} index={i} />)}
              </div>
            ) : (
              <Table>
                <THead>
                  <SortHeader field="date">Date</SortHeader>
                  <Th>Document</Th>
                  <Th>{kind === "in" ? "Client" : "Fournisseur"}</Th>
                  <Th className="hidden md:table-cell">Mode</Th>
                  <Th className="hidden lg:table-cell">Référence</Th>
                  <SortHeader field="amount" align="right">Montant</SortHeader>
                </THead>
                <tbody>
                  {rows.map((r, i) => (
                    <Row key={r.id} index={i} href={r.href}>
                      <Td className="text-[13px] text-ink-soft">{formatDate(r.date)}</Td>
                      <Td><span className="font-mono text-[13px] font-medium text-ink">{r.doc}</span></Td>
                      <Td><Link prefetch={false} href={r.partyHref} className="text-[13px] font-medium text-ink-soft hover:text-brand-700">{r.party}</Link></Td>
                      <Td className="hidden text-[13px] text-ink-soft md:table-cell">{PAYMENT_METHODS[r.method]}</Td>
                      <Td className="hidden text-xs text-muted lg:table-cell">{r.reference ?? "—"}</Td>
                      <Td align="right">
                        <span className={cn("whitespace-nowrap text-[13px] font-semibold tabular", r.voidedAt ? "text-faint line-through" : kind === "in" ? "text-emerald-700" : "text-ink")}>{kind === "in" ? "+" : "−"}{formatMAD(r.amount)}</span>
                        {r.voidedAt && <span className="mt-0.5 block"><Badge dot={false}>Annulé</Badge><span className="ml-1.5 text-[11px] text-muted">{r.voidReason}</span></span>}
                      </Td>
                    </Row>
                  ))}
                </tbody>
              </Table>
            )}
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Card>
    </ListState>
  );
}
