"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Filter } from "lucide-react";
import type { ReportsData } from "@/lib/reports";
import { Button } from "@/components/ui/button";
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

function Table({ head, rows, empty }: { head: { label: string; right?: boolean }[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="px-5 py-10 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[13px]">
        <thead className="border-y border-line-soft bg-canvas/70 text-xs text-muted">
          <tr>{head.map((h, i) => <th key={i} className={cn("px-4 py-2 font-medium first:pl-5 last:pr-5", h.right ? "text-right" : "text-left")}>{h.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line-soft last:border-0">
              {r.map((c, j) => <td key={j} className={cn("px-4 py-2.5 first:pl-5 last:pr-5", j > 0 && head[j]?.right && "text-right tabular")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsView({ data, from, to, today }: { data: ReportsData; from: string; to: string; today: string }) {
  const [tab, setTab] = useState("synthese");
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

  const kpis = [
    { label: "Chiffre d'affaires HT", value: s.revenueHT, sub: `${s.invoiceCount} factures émises` },
    { label: "Achats HT", value: s.purchasesHT, sub: `${s.purchaseCount} factures fournisseurs` },
    { label: "Marge brute (HT)", value: s.grossMargin, sub: s.revenueHT ? `${((s.grossMargin / s.revenueHT) * 100).toFixed(1).replace(".", ",")} % du CA` : "—", tone: s.grossMargin < 0 ? "text-rose-600" : "text-emerald-700" },
    { label: s.vatDue >= 0 ? "TVA à reverser" : "Crédit de TVA", value: Math.abs(s.vatDue), sub: "collectée − déductible" },
  ];

  return (
    <>
      <PageHeader title="Rapports" description="Analyse de l'activité sur la période : ventes, TVA, créances et achats." />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-muted">Du<input type="date" name="from" defaultValue={from} className="mt-1 block h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:border-brand-400 focus:outline-none focus:shadow-[var(--shadow-focus)]" /></label>
            <label className="text-xs font-medium text-muted">Au<input type="date" name="to" defaultValue={to} className="mt-1 block h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:border-brand-400 focus:outline-none focus:shadow-[var(--shadow-focus)]" /></label>
            <Button type="submit" variant="secondary"><Filter className="h-4 w-4" /> Appliquer</Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Link key={p.label} href={`/rapports?from=${p.from}&to=${p.to}`} className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors", p.from === from && p.to === to ? "bg-brand-50 text-brand-700 ring-brand-200" : "text-muted ring-line hover:bg-subtle hover:text-ink")}>{p.label}</Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft bg-canvas/50 px-4 py-2.5">
          <span className="text-xs font-medium text-muted">Exporter (CSV pour Excel) :</span>
          {[["factures", "Factures"], ["achats", "Achats"], ["paiements", "Paiements"], ["clients", "Clients"]].map(([k, l]) => (
            <a key={k} href={`/api/export/${k}?${qs}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-brand-50"><Download className="h-3.5 w-3.5" />{l}</a>
          ))}
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.45, ease }}>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">{k.label}</p>
              <p className={cn("mt-2 text-lg font-semibold tracking-tight sm:text-xl", k.tone ?? "text-ink")}><AnimatedNumber value={k.value} kind="mad" /></p>
              <p className="mt-1 text-xs text-faint">{k.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("relative shrink-0 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors", tab === t.id ? "text-ink" : "text-muted hover:text-ink")}>
            {t.label}
            {tab === t.id && <motion.span layoutId="reports-tab" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-brand-700" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}>
        {tab === "synthese" && (
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-3">
              <CardHeader title="Ventes et achats par mois" description="Montants HT" />
              <div className="px-2 pb-4 pt-3 sm:px-4">
                <div className="mb-2 flex gap-5 px-3 text-xs text-muted"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4f43ad]" />Ventes</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ee6136]" />Achats</span></div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="26%">
                      <CartesianGrid vertical={false} stroke="#eceef3" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#9a9fb3", fontSize: 11 }} dy={8} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9a9fb3", fontSize: 11 }} tickFormatter={(v) => formatCompactMAD(v)} width={56} />
                      <Tooltip cursor={{ fill: "rgb(79 67 173 / 0.05)" }} content={({ active, payload, label }) => active && payload?.length ? (
                        <div className="min-w-[190px] rounded-lg bg-surface px-3 py-2.5 shadow-[var(--shadow-ring),var(--shadow-lg)]">
                          <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
                          {payload.map((x) => <div key={String(x.dataKey)} className="flex justify-between gap-4 py-0.5 text-[13px]"><span className="flex items-center gap-2 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: x.color }} />{x.dataKey === "sales" ? "Ventes" : "Achats"}</span><span className="font-semibold tabular">{formatMAD(Number(x.value))}</span></div>)}
                        </div>) : null} />
                      <Bar dataKey="sales" fill="#4f43ad" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900} />
                      <Bar dataKey="purchases" fill="#ee6136" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900} animationBegin={120} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Meilleurs clients" description="Chiffre d'affaires HT" />
              <Table head={[{ label: "Client" }, { label: "Factures", right: true }, { label: "CA HT", right: true }]} empty="Aucune vente sur la période." rows={data.topCustomers.map((c) => [<Link key="n" href={`/clients/${c.id}`} className="font-medium text-ink hover:text-brand-700">{c.name}</Link>, c.count, formatMAD(c.ht)])} />
            </Card>
            <Card>
              <CardHeader title="Produits & services" description="Meilleures ventes HT" />
              <Table head={[{ label: "Désignation" }, { label: "CA HT", right: true }]} empty="Aucune vente." rows={data.topItems.map((i) => [<span key="n" className="line-clamp-1 font-medium text-ink">{i.name}</span>, formatMAD(i.ht)])} />
            </Card>
          </div>
        )}

        {tab === "tva" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="TVA collectée" description="Sur les factures de vente émises" />
              <Table head={[{ label: "Taux" }, { label: "Base HT", right: true }, { label: "TVA", right: true }]} empty="Aucune facture émise." rows={[...data.vat.collected.map((v) => [`${formatRate(v.rate)} %`, formatMAD(v.base), formatMAD(v.amount)]), [<b key="t">Total</b>, formatMAD(data.vat.collected.reduce((a, v) => a + v.base, 0)), <b key="v">{formatMAD(s.tvaCollected)}</b>]].filter((_, i, arr) => data.vat.collected.length > 0 || i < arr.length - 1)} />
            </Card>
            <Card>
              <CardHeader title="TVA déductible" description="Sur les factures d'achat enregistrées" />
              <Table head={[{ label: "Taux" }, { label: "Base HT", right: true }, { label: "TVA", right: true }]} empty="Aucun achat enregistré." rows={[...data.vat.deductible.map((v) => [`${formatRate(v.rate)} %`, formatMAD(v.base), formatMAD(v.amount)]), [<b key="t">Total</b>, formatMAD(data.vat.deductible.reduce((a, v) => a + v.base, 0)), <b key="v">{formatMAD(s.tvaDeductible)}</b>]].filter((_, i, arr) => data.vat.deductible.length > 0 || i < arr.length - 1)} />
            </Card>
            <Card className="lg:col-span-2">
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
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Balance âgée" description="Factures clients non soldées, par ancienneté d'échéance (à ce jour)" />
              <div className="space-y-3 p-5">
                {(() => {
                  const max = Math.max(1, ...data.aging.map((a) => a.amount));
                  return data.aging.map((a, i) => (
                    <div key={a.key}>
                      <div className="flex items-baseline justify-between text-[13px]"><span className="text-ink-soft">{a.label} <span className="text-xs text-faint">· {a.count} facture{a.count > 1 ? "s" : ""}</span></span><span className="font-semibold tabular text-ink">{formatMAD(a.amount)}</span></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle"><motion.div className={cn("h-full rounded-full", i === 0 ? "bg-emerald-500" : i < 3 ? "bg-amber-500" : "bg-rose-500")} initial={{ width: 0 }} animate={{ width: `${(a.amount / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.05 * i, ease }} /></div>
                    </div>
                  ));
                })()}
                <p className="border-t border-line-soft pt-3 text-right text-[13px] text-muted">Total des créances : <b className="tabular text-ink">{formatMAD(data.aging.reduce((s2, a) => s2 + a.amount, 0))}</b></p>
              </div>
            </Card>
            <Card>
              <CardHeader title="Plus gros retards" />
              <Table head={[{ label: "Facture" }, { label: "Retard", right: true }, { label: "Reste", right: true }]} empty="Aucun retard de paiement 🎉" rows={data.lateInvoices.map((i) => [<Link key="n" href={`/factures/${i.id}`} className="block font-medium text-ink hover:text-brand-700"><span className="font-mono text-xs">{i.number}</span><span className="block text-xs font-normal text-muted">{i.customer}</span></Link>, <span key="d" className="text-rose-600">{i.days} j</span>, formatMAD(i.balance)])} />
            </Card>
          </div>
        )}

        {tab === "achats" && (
          <Card>
            <CardHeader title="Achats par fournisseur" description="Sur la période" />
            <Table head={[{ label: "Fournisseur" }, { label: "Factures", right: true }, { label: "Total HT", right: true }, { label: "Total TTC", right: true }, { label: "Payé", right: true }, { label: "Reste", right: true }]} empty="Aucun achat sur la période." rows={data.suppliers.map((x) => [<span key="n" className="font-medium text-ink">{x.name}</span>, x.count, formatMAD(x.ht), formatMAD(x.ttc), formatMAD(x.paid), <span key="r" className={x.ttc - x.paid > 0 ? "text-amber-700" : "text-faint"}>{formatMAD(x.ttc - x.paid)}</span>])} />
          </Card>
        )}
      </motion.div>
    </>
  );
}
