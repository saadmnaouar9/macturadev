"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Banknote, CalendarRange, Download, Filter, Percent, ShoppingCart, TrendingUp, Trophy } from "lucide-react";
import type { ReportsData } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { formatCompactMAD, formatMAD, formatRate } from "@/lib/money";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "synthese", label: "Synthèse" },
  { id: "tva", label: "TVA" },
  { id: "creances", label: "Créances" },
  { id: "achats", label: "Achats" },
];
const ease = [0.16, 1, 0.3, 1] as const;
const SalesChart = dynamic(() => import("./sales-chart").then((m) => m.SalesChart), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

function Table({ head, rows, empty }: { head: { label: string; right?: boolean }[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="px-5 py-10 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-[13px]", head.length <= 3 ? "min-w-[300px]" : "min-w-[480px]")}>
        <thead className="text-[11px] uppercase tracking-[0.07em] text-faint">
          <tr>{head.map((h, i) => <th key={i} className={cn("px-4 py-2.5 font-semibold first:pl-5 last:pr-5", h.right ? "text-right" : "text-left")}>{h.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.035, 0.4), ease }} className="border-t border-line-soft transition-colors hover:bg-brand-500/[0.05]">
              {r.map((c, j) => <td key={j} className={cn("px-4 py-3 first:pl-5 last:pr-5", j > 0 && head[j]?.right && "whitespace-nowrap text-right tabular")}>{c}</td>)}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsView({ data, from, to, today }: { data: ReportsData; from: string; to: string; today: string }) {
  const [tab, setTab] = useState("synthese");
  const [fromV, setFromV] = useState(from);
  const [toV, setToV] = useState(to);
  // Les raccourcis de période changent from/to côté serveur : on resynchronise les sélecteurs
  useEffect(() => { setFromV(from); setToV(to); }, [from, to]);
  const s = data.summary;
  const y = Number(today.slice(0, 4));
  const mo = today.slice(0, 7);
  const q0 = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const presets = [
    { label: "Ce mois", from: `${mo}-01`, to: today },
    { label: "Ce trimestre", from: `${y}-${pad(q0 + 1)}-01`, to: today },
    { label: "Cette année", from: `${y}-01-01`, to: today },
    { label: "Année dernière", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
  const qs = `from=${from}&to=${to}`;
  void lastDay;

  const marginPct = s.revenueHT ? Math.max(0, Math.min(100, (s.grossMargin / s.revenueHT) * 100)) : 0;
  const kpis = [
    { label: "Chiffre d'affaires HT", value: s.revenueHT, sub: `${s.invoiceCount} factures émises`, icon: TrendingUp, accent: "from-brand-500 to-sky-400", iconTone: "bg-brand-500/12 text-brand-600", tone: undefined as string | undefined, bar: undefined as number | undefined },
    { label: "Achats HT", value: s.purchasesHT, sub: `${s.purchaseCount} factures fournisseurs`, icon: ShoppingCart, accent: "from-orange-500 to-amber-400", iconTone: "bg-orange-500/12 text-accent-600", tone: undefined, bar: undefined },
    { label: "Marge brute (HT)", value: s.grossMargin, sub: s.revenueHT ? `${((s.grossMargin / s.revenueHT) * 100).toFixed(1).replace(".", ",")} % du CA` : "—", tone: s.grossMargin < 0 ? "text-rose-600" : "text-emerald-700", icon: Banknote, accent: "from-emerald-500 to-teal-400", iconTone: "bg-emerald-500/12 text-emerald-600", bar: marginPct },
    { label: s.vatDue >= 0 ? "TVA à reverser" : "Crédit de TVA", value: Math.abs(s.vatDue), sub: "collectée − déductible", icon: Percent, accent: "from-violet-500 to-fuchsia-400", iconTone: "bg-violet-500/12 text-violet-600", tone: undefined, bar: undefined },
  ];

  return (
    <>
      <PageHeader title="Rapports" description="Analyse de l'activité sur la période : ventes, TVA, créances et achats." />

      <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="relative mb-5 overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint"><CalendarRange className="h-3.5 w-3.5" /> Période analysée</p>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="w-[190px] text-xs font-medium text-muted">
                <label htmlFor="rep-from">Du</label>
                <input type="hidden" name="from" value={fromV} />
                <div className="mt-1"><DatePicker id="rep-from" value={fromV} onChange={setFromV} className="h-10 rounded-xl bg-canvas/60" /></div>
              </div>
              <div className="w-[190px] text-xs font-medium text-muted">
                <label htmlFor="rep-to">Au</label>
                <input type="hidden" name="to" value={toV} />
                <div className="mt-1"><DatePicker id="rep-to" value={toV} onChange={setToV} className="h-10 rounded-xl bg-canvas/60" /></div>
              </div>
              <Button type="submit" variant="secondary"><Filter className="h-4 w-4" /> Appliquer</Button>
            </form>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-subtle p-1">
              {presets.map((p) => {
                const on = p.from === from && p.to === to;
                return (
                  <Link prefetch={false} key={p.label} href={`/rapports?from=${p.from}&to=${p.to}`} className={cn("relative rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors", on ? "text-white" : "text-muted hover:text-ink")}>
                    {on && <motion.span layoutId="reports-preset" className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 shadow-[0_6px_18px_-6px_rgb(59_110_245/0.6)]" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                    <span className="relative">{p.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-faint">Exporter (CSV) :</span>
              {[["factures", "Factures"], ["achats", "Achats"], ["paiements", "Paiements"], ["clients", "Clients"]].map(([k, l]) => (
                <a key={k} href={`/api/export/${k}?${qs}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-canvas/50 px-2.5 py-1 text-[12.5px] font-medium text-brand-700 transition-all hover:-translate-y-0.5 hover:border-brand-400/50 hover:bg-brand-500/10"><Download className="h-3.5 w-3.5" />{l}</a>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} whileHover={{ y: -4 }} transition={{ delay: 0.08 + i * 0.07, duration: 0.5, ease }} className="group relative overflow-hidden rounded-3xl border border-line-soft bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-lg)] sm:p-5">
            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", k.accent)} />
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted">{k.label}</p>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", k.iconTone)}><k.icon className="h-[18px] w-[18px]" /></span>
            </div>
            <p className={cn("mt-3 text-xl font-semibold tracking-tight sm:text-2xl", k.tone ?? "text-ink")}><AnimatedNumber value={k.value} kind="mad" /></p>
            <p className="mt-1 text-xs text-faint">{k.sub}</p>
            {k.bar !== undefined && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
                <motion.div className={cn("h-full rounded-full bg-gradient-to-r", k.accent)} initial={{ width: 0 }} animate={{ width: `${k.bar}%` }} transition={{ duration: 1, delay: 0.4, ease }} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div role="tablist" className="relative mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-subtle p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("relative shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors", tab === t.id ? "text-ink" : "text-muted hover:text-ink")}>
            {tab === t.id && <motion.span layoutId="reports-tab" className="absolute inset-0 rounded-xl bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}>
        {tab === "synthese" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="rounded-3xl xl:col-span-3">
              <CardHeader title="Ventes et achats par mois" description="Montants HT" />
              <div className="px-2 pb-4 pt-3 sm:px-4">
                <div className="mb-2 flex gap-5 px-3 text-xs text-muted"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4a8df8]" />Ventes</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#e86533]" />Achats</span></div>
                <div className="h-[260px]">
                  <SalesChart data={data.months} />
                </div>
              </div>
            </Card>
            <Card className="rounded-3xl xl:col-span-2">
              <CardHeader title="Meilleurs clients" description="Chiffre d'affaires HT" />
              <Table head={[{ label: "Client" }, { label: "Factures", right: true }, { label: "CA HT", right: true }]} empty="Aucune vente sur la période." rows={data.topCustomers.map((c, i) => [
                <div key="n" className="flex items-center gap-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", i === 0 ? "bg-amber-500/15 text-amber-700" : "bg-subtle text-muted")}>{i === 0 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link prefetch={false} href={`/clients/${c.id}`} className="block truncate font-medium text-ink hover:text-brand-700">{c.name}</Link>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-subtle"><motion.div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" initial={{ width: 0 }} animate={{ width: `${(c.ht / Math.max(1, ...data.topCustomers.map((x) => x.ht))) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease }} /></div>
                  </div>
                </div>,
                c.count,
                formatMAD(c.ht),
              ])} />
            </Card>
            <Card className="rounded-3xl">
              <CardHeader title="Produits & services" description="Meilleures ventes HT" />
              <Table head={[{ label: "Désignation" }, { label: "CA HT", right: true }]} empty="Aucune vente." rows={data.topItems.map((i) => [<span key="n" className="line-clamp-1 font-medium text-ink">{i.name}</span>, formatMAD(i.ht)])} />
            </Card>
          </div>
        )}

        {tab === "tva" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl">
              <CardHeader title="TVA collectée" description="Sur les factures de vente émises" />
              <Table head={[{ label: "Taux" }, { label: "Base HT", right: true }, { label: "TVA", right: true }]} empty="Aucune facture émise." rows={[...data.vat.collected.map((v) => [`${formatRate(v.rate)} %`, formatMAD(v.base), formatMAD(v.amount)]), [<b key="t">Total</b>, formatMAD(data.vat.collected.reduce((a, v) => a + v.base, 0)), <b key="v">{formatMAD(s.tvaCollected)}</b>]].filter((_, i, arr) => data.vat.collected.length > 0 || i < arr.length - 1)} />
            </Card>
            <Card className="rounded-3xl">
              <CardHeader title="TVA déductible" description="Sur les factures d'achat enregistrées" />
              <Table head={[{ label: "Taux" }, { label: "Base HT", right: true }, { label: "TVA", right: true }]} empty="Aucun achat enregistré." rows={[...data.vat.deductible.map((v) => [`${formatRate(v.rate)} %`, formatMAD(v.base), formatMAD(v.amount)]), [<b key="t">Total</b>, formatMAD(data.vat.deductible.reduce((a, v) => a + v.base, 0)), <b key="v">{formatMAD(s.tvaDeductible)}</b>]].filter((_, i, arr) => data.vat.deductible.length > 0 || i < arr.length - 1)} />
            </Card>
            <Card className="rounded-3xl lg:col-span-2">
              <div className="flex flex-col items-start justify-between gap-2 p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-ink">{s.vatDue >= 0 ? "TVA due pour la période" : "Crédit de TVA pour la période"}</p>
                  <p className="text-[13px] text-muted">TVA collectée {formatMAD(s.tvaCollected)} − TVA déductible {formatMAD(s.tvaDeductible)}. Indicatif : la déclaration officielle dépend du régime fiscal de l&apos;entreprise.</p>
                </div>
                <p className={cn("text-2xl font-semibold tracking-tight tabular", s.vatDue >= 0 ? "text-ink" : "text-emerald-700")}>{formatMAD(Math.abs(s.vatDue))}</p>
              </div>
            </Card>
          </div>
        )}

        {tab === "creances" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="rounded-3xl xl:col-span-2">
              <CardHeader title="Balance âgée" description="Factures clients non soldées, par ancienneté d'échéance (à ce jour)" />
              <div className="p-5">
                {(() => {
                  const total = data.aging.reduce((s2, a) => s2 + a.amount, 0);
                  const max = Math.max(1, ...data.aging.map((a) => a.amount));
                  const tones = ["from-emerald-500 to-teal-400", "from-lime-500 to-emerald-400", "from-amber-500 to-yellow-400", "from-orange-500 to-amber-500", "from-rose-500 to-orange-400"];
                  const dots = ["bg-emerald-500", "bg-lime-500", "bg-amber-500", "bg-orange-500", "bg-rose-500"];
                  const tone = (i: number) => tones[Math.min(i, tones.length - 1)];
                  const dot = (i: number) => dots[Math.min(i, dots.length - 1)];
                  return (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-muted">Total des créances</p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight tabular text-ink"><AnimatedNumber value={total} kind="mad" /></p>
                        </div>
                        <p className="text-xs text-faint">{data.aging.reduce((s2, a) => s2 + a.count, 0)} facture(s) non soldée(s)</p>
                      </div>
                      {/* Répartition globale : une barre segmentée proportionnelle au montant de chaque tranche */}
                      <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-subtle" role="img" aria-label="Répartition des créances par ancienneté">
                        {total > 0 && data.aging.map((a, i) => (
                          <motion.div key={a.key} title={`${a.label} : ${formatMAD(a.amount)}`} className={cn("h-full bg-gradient-to-r first:rounded-l-full last:rounded-r-full", tone(i))} initial={{ width: 0 }} animate={{ width: `${(a.amount / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease }} />
                        ))}
                      </div>
                      <ul className="mt-5 space-y-1">
                        {data.aging.map((a, i) => (
                          <motion.li key={a.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 + i * 0.06, ease }} className="group rounded-2xl px-3 py-2.5 transition-colors hover:bg-subtle">
                            <div className="flex items-center justify-between gap-3 text-[13px]">
                              <span className="flex min-w-0 items-center gap-2.5 text-ink-soft">
                                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125", dot(i))} />
                                <span className="truncate font-medium">{a.label}</span>
                                <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[11px] text-faint">{a.count} facture{a.count > 1 ? "s" : ""}</span>
                              </span>
                              <span className="flex shrink-0 items-baseline gap-2">
                                <span className="text-xs tabular text-faint">{total > 0 ? Math.round((a.amount / total) * 100) : 0} %</span>
                                <span className="font-semibold tabular text-ink">{formatMAD(a.amount)}</span>
                              </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle group-hover:bg-surface">
                              <motion.div className={cn("h-full rounded-full bg-gradient-to-r", tone(i))} initial={{ width: 0 }} animate={{ width: `${(a.amount / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease }} />
                            </div>
                          </motion.li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </div>
            </Card>
            <Card className="rounded-3xl">
              <CardHeader title="Plus gros retards" />
              <Table head={[{ label: "Facture" }, { label: "Retard", right: true }, { label: "Reste", right: true }]} empty="Aucun retard de paiement 🎉" rows={data.lateInvoices.map((i) => [<Link prefetch={false} key="n" href={`/factures/${i.id}`} className="block font-medium text-ink hover:text-brand-700"><span className="font-mono text-xs">{i.number}</span><span className="block text-xs font-normal text-muted">{i.customer}</span></Link>, <span key="d" className="text-rose-600">{i.days} j</span>, formatMAD(i.balance)])} />
            </Card>
          </div>
        )}

        {tab === "achats" && (
          <Card className="rounded-3xl">
            <CardHeader title="Achats par fournisseur" description="Sur la période" />
            <Table head={[{ label: "Fournisseur" }, { label: "Factures", right: true }, { label: "Total HT", right: true }, { label: "Total TTC", right: true }, { label: "Payé", right: true }, { label: "Reste", right: true }]} empty="Aucun achat sur la période." rows={data.suppliers.map((x) => [<span key="n" className="font-medium text-ink">{x.name}</span>, x.count, formatMAD(x.ht), formatMAD(x.ttc), formatMAD(x.paid), <span key="r" className={x.ttc - x.paid > 0 ? "text-amber-700" : "text-faint"}>{formatMAD(x.ttc - x.paid)}</span>])} />
          </Card>
        )}
      </motion.div>
    </>
  );
}
