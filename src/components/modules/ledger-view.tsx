"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark, Pencil, Plus, Scale, Settings2, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTabs, ListState, Pagination, Row, SearchInput, Table, Td, Th, THead } from "@/components/data/list-state";
import { CrudDrawer, toFormValues, type FieldDef } from "@/components/data/crud-form";
import { centsToInput, formatCompactMAD, formatMAD, parseAmountToCents } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
import { deleteCashEntry, saveCashEntry, updateOpeningBalances } from "@/app/(app)/caisse/actions";

export interface LedgerRow {
  id: string;
  date: string;
  account: "CASH" | "BANK";
  direction: "IN" | "OUT";
  amount: number;
  label: string;
  detail: string | null;
  source: "customer" | "supplier" | "manual";
  href: string | null;
  entryId: string | null;
  category: string | null;
  reference: string | null;
  balanceAfter: number;
}

const ease = [0.16, 1, 0.3, 1] as const;
// Recharts (≈100 ko) n'est chargé que sur la page Trésorerie, après l'affichage de la page
const CashflowChart = dynamic(() => import("./cashflow-chart").then((m) => m.CashflowChart), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });
const C_IN = "#4a8df8";
const C_OUT = "#e86533";

export function LedgerView(p: {
  mode: "caisse" | "tresorerie";
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  hasQuery: boolean;
  balances: { cash: number; bank: number; total: number; openingCash: number; openingBank: number };
  month: { inflow: number; outflow: number };
  cashflow?: { month: string; inflow: number; outflow: number }[];
  forecast?: { receivable: number; payable: number };
  canWrite: boolean;
  canDelete: boolean;
  canSettings: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const isCash = p.mode === "caisse";
  const [drawer, setDrawer] = useState<{ open: boolean; row: LedgerRow | null }>({ open: false, row: null });
  const [openingOpen, setOpeningOpen] = useState(false);
  const [opening, setOpening] = useState({ cash: centsToInput(p.balances.openingCash), bank: centsToInput(p.balances.openingBank) });
  const [saving, setSaving] = useState(false);

  const fields: FieldDef[] = useMemo(
    () => [
      { name: "direction", label: "Type", type: "select", required: true, options: [{ value: "IN", label: "Entrée d'argent" }, { value: "OUT", label: "Sortie d'argent" }] },
      ...(isCash ? [] : [{ name: "account", label: "Compte", type: "select" as const, required: true, options: [{ value: "BANK", label: "Banque" }, { value: "CASH", label: "Caisse" }] }]),
      { name: "label", label: "Libellé", type: "text", required: true, span: true, placeholder: "Achat de fournitures, apport de l'associé…" },
      { name: "amount", label: "Montant", type: "money", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "category", label: "Catégorie", type: "text", placeholder: "Frais, apport, retrait…" },
      { name: "reference", label: "Référence", type: "text" },
    ],
    [isCash],
  );
  const initial = toFormValues(fields, drawer.row as unknown as Record<string, unknown> | null, { direction: "IN", account: isCash ? "CASH" : "BANK", date: new Date().toISOString().slice(0, 10) });

  const remove = async (r: LedgerRow) => {
    if (!r.entryId || !(await confirm({ title: "Supprimer cette opération ?", description: r.label, confirmLabel: "Supprimer", danger: true }))) return;
    const res = await deleteCashEntry(r.entryId);
    if (res.ok) { toast.success(res.message); } else toast.error(res.error);
  };

  const saveOpening = async () => {
    const c = parseAmountToCents(opening.cash || "0"), b = parseAmountToCents(opening.bank || "0");
    if (c === null || b === null) return toast.error("Montant invalide");
    setSaving(true);
    const res = await updateOpeningBalances({ openingCash: c, openingBank: b });
    setSaving(false);
    if (res.ok) { toast.success(res.message); setOpeningOpen(false); } else toast.error(res.error);
  };

  // Caisse : résumé du mois (utilisé par la carte principale)
  const net = p.month.inflow - p.month.outflow;
  const flowTotal = p.month.inflow + p.month.outflow;
  const inPct = flowTotal ? (p.month.inflow / flowTotal) * 100 : 50;

  const cards = isCash
    ? [{ label: "Solde de la caisse", value: p.balances.cash, icon: Banknote, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100", big: true }]
    : [
        { label: "Trésorerie totale", value: p.balances.total, icon: Scale, tone: "bg-brand-50 text-brand-700 ring-brand-100", big: true },
        { label: "Banque", value: p.balances.bank, icon: Landmark, tone: "bg-sky-50 text-sky-700 ring-sky-100" },
        { label: "Caisse (espèces)", value: p.balances.cash, icon: Banknote, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
      ];

  return (
    <>
      <PageHeader
        title={isCash ? "Caisse" : "Trésorerie"}
        description={isCash ? "Mouvements d'espèces : encaissements, règlements et opérations de caisse." : "Vue consolidée de la banque et de la caisse : soldes, flux mensuels et prévisions."}
        actions={
          <>
            {p.canSettings && <Button variant="secondary" onClick={() => setOpeningOpen(true)}><Settings2 className="h-4 w-4" /> Soldes d&apos;ouverture</Button>}
            {p.canWrite && <Button onClick={() => setDrawer({ open: true, row: null })}><Plus className="h-4 w-4" /> Nouvelle opération</Button>}
          </>
        }
      />

      {isCash ? (
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="relative mb-4 overflow-hidden rounded-xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
          {/* Solde de la caisse */}
          <div>
            <div className="flex items-center gap-3">
              <Banknote className="h-5 w-5 text-muted" />
              <div>
                <p className="text-[13px] font-medium text-muted">Solde de la caisse</p>
                <p className="text-xs text-faint">Espèces disponibles aujourd&apos;hui</p>
              </div>
            </div>
            <p className={cn("mt-4 text-4xl font-semibold leading-none tracking-[-0.03em] sm:text-5xl", p.balances.cash < 0 ? "text-rose-600" : "text-ink")}><AnimatedNumber value={p.balances.cash} kind="mad" /></p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold", net >= 0 ? "text-muted" : "text-muted")}>
                {net >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {net >= 0 ? "+" : "−"}{formatMAD(Math.abs(net))} ce mois
              </span>
              <span className="rounded-full bg-subtle px-2.5 py-1 font-medium text-muted">Solde d&apos;ouverture : {formatMAD(p.balances.openingCash)}</span>
            </div>
          </div>

          {/* Flux du mois */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <motion.div transition={{ duration: 0.2 }} className="">
                <p className="text-xs font-medium text-muted">Entrées du mois</p>
                <p className="mt-1 text-lg font-semibold tabular text-emerald-700">+{formatMAD(p.month.inflow)}</p>
              </motion.div>
              <motion.div transition={{ duration: 0.2 }} className="">
                <p className="text-xs font-medium text-muted">Sorties du mois</p>
                <p className="mt-1 text-lg font-semibold tabular text-ink">−{formatMAD(p.month.outflow)}</p>
              </motion.div>
            </div>
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label="Répartition entrées / sorties du mois">
                <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${inPct}%` }} transition={{ duration: 0.9, delay: 0.2, ease }} />
                <motion.div className="h-full bg-orange-500" initial={{ width: 0 }} animate={{ width: `${100 - inPct}%` }} transition={{ duration: 0.9, delay: 0.3, ease }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-faint"><span>{flowTotal ? Math.round(inPct) : 0} % entrées</span><span>{flowTotal ? Math.round(100 - inPct) : 0} % sorties</span></div>
            </div>
          </div>
        </div>
      </motion.section>
      ) : (
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.45, ease }} className={cn(c.big && !isCash && "sm:col-span-1")}>
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-[13px] font-medium text-muted">{c.label}</p>
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset", c.tone)}><c.icon className="h-4 w-4" /></span>
              </div>
              <p className={cn("mt-3 text-[26px] font-semibold leading-none tracking-[-0.025em]", c.value < 0 ? "text-rose-600" : "text-ink")}><AnimatedNumber value={c.value} kind="mad" /></p>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      {!isCash && p.cashflow && (
        <div className="mb-4 grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Flux de trésorerie" description="Encaissements et décaissements des 12 derniers mois" />
            <div className="px-2 pb-4 pt-3 sm:px-4">
              <div className="mb-2 flex gap-5 px-3 text-xs text-muted">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C_IN }} />Encaissements</span>
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C_OUT }} />Décaissements</span>
              </div>
              <div className="h-[240px]">
                <CashflowChart data={p.cashflow} />
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Prévision" description="Trésorerie si tout est réglé à l'échéance" />
            <dl className="space-y-3 p-5 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Trésorerie actuelle</dt><dd className="font-semibold tabular text-ink">{formatMAD(p.balances.total)}</dd></div>
              <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-muted"><ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />Créances à encaisser</dt><dd className="tabular text-emerald-700">+{formatMAD(p.forecast?.receivable ?? 0)}</dd></div>
              <div className="flex justify-between"><dt className="flex items-center gap-1.5 text-muted"><ArrowUpRight className="h-3.5 w-3.5 text-accent-600" />Dettes fournisseurs</dt><dd className="tabular text-ink-soft">−{formatMAD(p.forecast?.payable ?? 0)}</dd></div>
              <div className="flex justify-between border-t border-line-soft pt-3 text-[15px] font-semibold"><dt>Position prévisionnelle</dt><dd className="tabular">{formatMAD(p.balances.total + (p.forecast?.receivable ?? 0) - (p.forecast?.payable ?? 0))}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-3 border-t border-line-soft p-5 text-center">
              <div><p className="text-xs text-muted">Entrées du mois</p><p className="mt-0.5 text-sm font-semibold tabular text-emerald-700">+{formatMAD(p.month.inflow)}</p></div>
              <div><p className="text-xs text-muted">Sorties du mois</p><p className="mt-0.5 text-sm font-semibold tabular text-ink">−{formatMAD(p.month.outflow)}</p></div>
            </div>
          </Card>
        </div>
      )}

      <ListState>
        <Card className={cn("overflow-hidden", isCash && "rounded-xl")}>
          <div className={cn("flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between", isCash && "border-b border-line-soft bg-canvas/40")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <FilterTabs param="flow" layoutId="ledger-flow" options={[{ value: "", label: "Tous les mouvements" }, { value: "in", label: "Entrées" }, { value: "out", label: "Sorties" }]} />
              {!isCash && (<><div className="hidden h-5 w-px bg-line sm:block" /><FilterTabs param="account" layoutId="ledger-account" options={[{ value: "", label: "Tous comptes" }, { value: "BANK", label: "Banque" }, { value: "CASH", label: "Caisse" }]} /></>)}
            </div>
            <SearchInput placeholder="Libellé, tiers, référence…" />
          </div>
          {p.rows.length === 0 ? (
            <EmptyState icon={Wallet} title="Aucun mouvement" description={p.hasQuery ? "Modifiez la recherche ou les filtres." : "Les paiements enregistrés et vos opérations manuelles apparaîtront ici."} action={p.canWrite && !p.hasQuery && <Button onClick={() => setDrawer({ open: true, row: null })}><Plus className="h-4 w-4" /> Nouvelle opération</Button>} />
          ) : (
            <>
              <Table>
                <THead>
                  <Th>Date</Th>
                  <Th>Libellé</Th>
                  {!isCash && <Th className="hidden md:table-cell">Compte</Th>}
                  <Th className="hidden lg:table-cell">Catégorie</Th>
                  <Th align="right">Entrée</Th>
                  <Th align="right">Sortie</Th>
                  <Th align="right" className="hidden md:table-cell">Solde</Th>
                  <Th className="w-10" />
                </THead>
                <tbody>
                  {p.rows.map((r, i) => (
                    <Row key={r.id} index={i}>
                      <Td className="whitespace-nowrap text-[13px] text-ink-soft">{formatDate(r.date)}</Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          {isCash && (
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", r.direction === "IN" ? "text-muted" : "text-muted")} aria-hidden>
                              {r.direction === "IN" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="text-[13px] font-medium text-ink">{r.href ? <Link prefetch={false} href={r.href} className="hover:text-brand-700">{r.label}</Link> : r.label}</span>
                            {(r.detail || r.reference) && <span className="block max-w-[300px] truncate text-xs text-muted">{[r.detail, r.reference].filter(Boolean).join(" · ")}</span>}
                          </div>
                        </div>
                      </Td>
                      {!isCash && <Td className="hidden md:table-cell"><Badge tone={r.account === "CASH" ? "success" : "info"} dot={false}>{r.account === "CASH" ? "Caisse" : "Banque"}</Badge></Td>}
                      <Td className="hidden text-[13px] text-ink-soft lg:table-cell">{r.category ?? "—"}</Td>
                      <Td align="right" className="whitespace-nowrap text-[13px] font-semibold tabular text-emerald-700">{r.direction === "IN" ? (isCash ? <span className="inline-block rounded-lg bg-emerald-500/10 px-2 py-1">{`+${formatMAD(r.amount)}`}</span> : `+${formatMAD(r.amount)}`) : ""}</Td>
                      <Td align="right" className="whitespace-nowrap text-[13px] font-semibold tabular text-ink">{r.direction === "OUT" ? (isCash ? <span className="inline-block rounded-lg bg-orange-500/10 px-2 py-1">{`−${formatMAD(r.amount)}`}</span> : `−${formatMAD(r.amount)}`) : ""}</Td>
                      <Td align="right" className={cn("hidden text-[13px] tabular md:table-cell", r.balanceAfter < 0 ? "text-rose-600" : "text-muted")}>{formatMAD(r.balanceAfter)}</Td>
                      <Td>
                        {r.entryId && p.canWrite && (
                          <DropdownMenu>
                            <DropdownTrigger asChild><button className="rounded-md p-1.5 text-faint hover:bg-subtle hover:text-ink" aria-label="Actions"><Pencil className="h-3.5 w-3.5" /></button></DropdownTrigger>
                            <DropdownContent>
                              <DropdownItem onSelect={() => setDrawer({ open: true, row: r })}><Pencil /> Modifier</DropdownItem>
                              {p.canDelete && (<><DropdownSeparator /><DropdownItem danger onSelect={() => remove(r)}><Trash2 /> Supprimer</DropdownItem></>)}
                            </DropdownContent>
                          </DropdownMenu>
                        )}
                      </Td>
                    </Row>
                  ))}
                </tbody>
              </Table>
              <Pagination page={p.page} pageSize={p.pageSize} total={p.total} />
            </>
          )}
        </Card>
      </ListState>

      <CrudDrawer
        open={drawer.open}
        onOpenChange={(o) => setDrawer((d) => ({ ...d, open: o }))}
        title={drawer.row ? "Modifier l'opération" : "Nouvelle opération"}
        description={drawer.row ? undefined : "Frais, apport, retrait, virement interne… Les paiements clients et fournisseurs sont enregistrés depuis les factures et achats."}
        fields={fields}
        initial={initial}
        submitLabel={drawer.row ? "Enregistrer" : "Enregistrer l'opération"}
        onSubmit={(payload) => saveCashEntry(drawer.row?.entryId ?? null, { ...payload, account: isCash ? "CASH" : payload.account })}
        onSaved={() => { setDrawer({ open: false, row: null }); }}
      />

      <Dialog
        open={openingOpen}
        onOpenChange={setOpeningOpen}
        title="Soldes d'ouverture"
        description="Montant présent sur la banque et en caisse avant le premier mouvement enregistré dans Mactura."
        className="sm:max-w-md"
        footer={<><Button variant="secondary" onClick={() => setOpeningOpen(false)}>Annuler</Button><Button onClick={saveOpening} loading={saving}>Enregistrer</Button></>}
      >
        <div className="space-y-4">
          <Field label="Solde bancaire d'ouverture">{(f) => <Input {...f} inputMode="decimal" value={opening.bank} onChange={(e) => setOpening((o) => ({ ...o, bank: e.target.value }))} trailing="DH" className="tabular" />}</Field>
          <Field label="Solde de caisse d'ouverture">{(f) => <Input {...f} inputMode="decimal" value={opening.cash} onChange={(e) => setOpening((o) => ({ ...o, cash: e.target.value }))} trailing="DH" className="tabular" />}</Field>
        </div>
      </Dialog>
    </>
  );
}
