"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Ban, CalendarClock, CircleDollarSign, Copy, Download, Eye, FilePlus2, MoreHorizontal, Pencil, Receipt, Send, Trash2, TrendingUp, Wallet } from "lucide-react";
import type { InvoiceStatus, PaymentStatus } from "@prisma/client";
import type { InvoiceDisplayStatus } from "@/lib/status";
import { Card } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { INVOICE_STATUS, LIFECYCLE } from "@/lib/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { StatCard } from "@/components/ui/stat-card";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { startNavProgress } from "@/components/layout/top-progress";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead } from "@/components/data/list-state";
import { useServerAction } from "@/hooks/use-action";
import { formatMAD } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
import { cancelInvoice, deleteInvoice, duplicateInvoice, issueInvoice, markInvoiceSent } from "@/app/(app)/factures/actions";

interface InvoiceRow {
  id: string;
  number: string | null;
  status: InvoiceDisplayStatus;
  lifecycle: InvoiceStatus;
  paymentStatus: PaymentStatus;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  reference: string | null;
  customer: { id: string; name: string };
  quoteNumber: string | null;
}

function InvoiceRowActions({ inv, canWrite, canDelete }: { inv: InvoiceRow; canWrite: boolean; canDelete: boolean }) {
  const { run } = useServerAction();
  const confirm = useConfirm();
  const draft = inv.lifecycle === "DRAFT";
  const active = inv.lifecycle === "ISSUED" || inv.lifecycle === "SENT";
  const editable = inv.lifecycle !== "CANCELLED" && inv.paymentStatus === "UNPAID" && inv.amountPaid === 0;
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button className="rounded-md p-1.5 text-faint opacity-60 transition-all hover:bg-subtle hover:text-ink group-hover:opacity-100 data-[state=open]:bg-subtle data-[state=open]:opacity-100" aria-label={`Actions pour la facture ${inv.number ?? "brouillon"}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-60">
        <DropdownItem href={`/factures/${inv.id}`}><Eye /> Ouvrir</DropdownItem>
        <DropdownItem onSelect={() => window.open(`/api/pdf/invoice/${inv.id}?download=1`, "_blank")}><Download /> Télécharger le PDF</DropdownItem>
        {canWrite && (
          <>
            {editable && <DropdownItem href={`/factures/${inv.id}/edit`}><Pencil /> Modifier</DropdownItem>}
            <DropdownItem onSelect={() => run("dup", () => duplicateInvoice(inv.id), { redirect: (d) => `/factures/${d.id}` })}><Copy /> Dupliquer</DropdownItem>
            <DropdownSeparator />
            {draft && <DropdownItem onSelect={() => run("issue", () => issueInvoice(inv.id))}><Receipt /> Émettre la facture</DropdownItem>}
            {inv.lifecycle === "ISSUED" && <DropdownItem onSelect={() => run("send", () => markInvoiceSent(inv.id))}><Send /> Marquer comme envoyée</DropdownItem>}
            {active && inv.paymentStatus !== "PAID" && <DropdownItem href={`/factures/${inv.id}?pay=1`}><CircleDollarSign /> Enregistrer un paiement</DropdownItem>}
          </>
        )}
        {canDelete && draft && (
          <>
            <DropdownSeparator />
            <DropdownItem danger onSelect={async () => { if (await confirm({ title: "Supprimer ce brouillon ?", description: "Le brouillon sera définitivement supprimé.", confirmLabel: "Supprimer", danger: true })) run("del", () => deleteInvoice(inv.id)); }}><Trash2 /> Supprimer le brouillon</DropdownItem>
          </>
        )}
        {canDelete && active && inv.amountPaid === 0 && (
          <>
            <DropdownSeparator />
            <DropdownItem danger onSelect={async () => { if (await confirm({ title: `Annuler la facture ${inv.number} ?`, description: "La facture restera dans l'historique avec le statut « Annulée » et son numéro sera conservé.", confirmLabel: "Annuler la facture", danger: true })) run("cancel", () => cancelInvoice(inv.id)); }}><Ban /> Annuler la facture</DropdownItem>
          </>
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}

const VIEW_KEY = "mactura.invoices.view";
const EASE = [0.16, 1, 0.3, 1] as const;
const LINE: Record<string, string> = {
  neutral: "bg-faint", info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500", brand: "bg-brand-500", violet: "bg-violet-500",
};

function InvoiceCard({ inv, index, canWrite, canDelete }: { inv: InvoiceRow; index: number; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const tone = INVOICE_STATUS[inv.status]?.tone ?? "neutral";
  const active = inv.lifecycle === "ISSUED" || inv.lifecycle === "SENT";
  const balance = inv.total - inv.amountPaid;
  const pct = inv.total > 0 ? Math.min(100, (inv.amountPaid / inv.total) * 100) : 0;
  const overdue = inv.status === "OVERDUE";
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: inv.lifecycle === "CANCELLED" ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(index, 14) * 0.035, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      onMouseMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - b.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - b.top}px`);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        startNavProgress();
        router.push(`/factures/${inv.id}`);
      }}
      className="glass group relative flex cursor-pointer flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgb(91 155 255 / 0.16), transparent 70%)" }} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", LINE[tone])} />

      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <Receipt className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Link prefetch={false} href={`/factures/${inv.id}`} className={cn("block truncate font-mono text-[15px] font-semibold outline-none transition-colors group-hover:text-brand-700 focus-visible:underline", inv.number ? "text-ink" : "italic text-muted")}>{inv.number ?? "Brouillon"}</Link>
          <Link prefetch={false} href={`/clients/${inv.customer.id}`} className="mt-0.5 block truncate text-xs text-muted transition-colors hover:text-brand-700">{inv.customer.name}</Link>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0"><InvoiceRowActions inv={inv} canWrite={canWrite} canDelete={canDelete} /></div>
      </div>

      <div className="relative mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
        <InvoiceStatusBadge status={inv.status} />
        {active && <span className="rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">{LIFECYCLE[inv.lifecycle].label}</span>}
        {(inv.quoteNumber || inv.reference) && <span className="max-w-[150px] truncate rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">{inv.quoteNumber ? `Devis ${inv.quoteNumber}` : inv.reference}</span>}
      </div>

      <div className="relative mt-4 border-t border-line-soft pt-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Montant TTC</p>
            <p className="whitespace-nowrap text-lg font-semibold tabular tracking-tight text-ink">{formatMAD(inv.total)}</p>
          </div>
          <div className="text-right text-xs">
            <p className="whitespace-nowrap text-muted">Émise le {formatDate(inv.issueDate)}</p>
            <p className={cn("mt-0.5 inline-flex items-center gap-1.5 whitespace-nowrap", overdue ? "font-medium text-rose-600" : "text-muted")}>
              {overdue ? <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" /><span className="relative h-2 w-2 rounded-full bg-rose-500" /></span> : <CalendarClock className="h-3.5 w-3.5" />}
              {overdue ? "En retard · " : "Échéance "}{formatDate(inv.dueDate)}
            </p>
          </div>
        </div>
        {inv.lifecycle !== "CANCELLED" && inv.lifecycle !== "DRAFT" && (
          <div className="mt-3">
            <span className="block h-1.5 overflow-hidden rounded-full bg-subtle">
              <motion.span className={cn("block h-full rounded-full", inv.paymentStatus === "PAID" ? "bg-emerald-500" : "bg-violet-500")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.25 + Math.min(index, 14) * 0.03, ease: EASE }} />
            </span>
            <p className="mt-1.5 flex justify-between gap-2 text-[11px] tabular">
              <span className="text-muted">Encaissé {formatMAD(inv.amountPaid)}</span>
              <span className={balance > 0 ? "font-medium text-amber-700" : "text-emerald-700"}>{balance > 0 ? `Reste ${formatMAD(balance)}` : "Soldée"}</span>
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function InvoicesTable({
  rows, summary, total, page, pageSize, hasQuery, counts, canWrite, canDelete,
}: {
  rows: InvoiceRow[]; summary: { invoiced: number; paid: number; balance: number }; total: number; page: number; pageSize: number; hasQuery: boolean;
  counts: Record<string, number>; canWrite: boolean; canDelete: boolean;
}) {
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "grid" || v === "table") setView(v); } catch { /* stockage indisponible */ }
  }, []);
  const changeView = (m: ViewMode) => {
    setView(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* ignoré */ }
  };
  return (
    <ListState>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} tone="brand" icon={TrendingUp} label="Facturé" sub="sélection en cours"><AnimatedNumber value={summary.invoiced} kind="mad" duration={0.7} /></StatCard>
        <StatCard index={1} tone="emerald" icon={CircleDollarSign} label="Encaissé" sub="paiements reçus"><AnimatedNumber value={summary.paid} kind="mad" duration={0.7} /></StatCard>
        <StatCard index={2} tone="amber" icon={Wallet} label="Reste à encaisser" sub="factures non soldées" pulse={summary.balance > 0}><AnimatedNumber value={summary.balance} kind="mad" duration={0.7} /></StatCard>
        <StatCard index={3} tone="rose" icon={AlertTriangle} label="En retard" sub="échéance dépassée"><AnimatedNumber value={counts.OVERDUE ?? 0} /></StatCard>
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
          <FilterTabs
            layoutId="invoice-status"
            options={[
              { value: "", label: "Toutes", count: counts.all },
              { value: "DRAFT", label: "Brouillons", count: counts.DRAFT },
              { value: "ISSUED", label: "Émises", count: counts.ISSUED },
              { value: "SENT", label: "Envoyées", count: counts.SENT },
              { value: "OUTSTANDING", label: "À encaisser", count: counts.OUTSTANDING },
              { value: "UNPAID", label: "Non payées", count: counts.UNPAID },
              { value: "PARTIAL", label: "Partielles", count: counts.PARTIAL },
              { value: "OVERDUE", label: "En retard", count: counts.OVERDUE },
              { value: "PAID", label: "Payées", count: counts.PAID },
              { value: "CANCELLED", label: "Annulées", count: counts.CANCELLED },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput placeholder="Numéro, client, référence…" />
            <ViewToggle mode={view} onChange={changeView} layoutId="invoice-view-toggle" />
          </div>
        </div>
        {rows.length === 0 ? (
          hasQuery ? (
            <EmptyState icon={Receipt} title="Aucune facture trouvée" description="Modifiez la recherche ou les filtres." />
          ) : (
            <EmptyState icon={Receipt} title="Aucune facture pour le moment" description="Créez votre première facture ou convertissez un devis accepté." action={canWrite && <ButtonLink href="/factures/new"><FilePlus2 className="h-4 w-4" /> Créer une facture</ButtonLink>} />
          )
        ) : (
          <>
            {view === "grid" ? (
              <div className="grid gap-4 p-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((inv, i) => <InvoiceCard key={inv.id} inv={inv} index={i} canWrite={canWrite} canDelete={canDelete} />)}
              </div>
            ) : (
            <Table>
              <THead>
                <SortHeader field="number">Numéro</SortHeader>
                <Th>Client</Th>
                <SortHeader field="issueDate" className="hidden md:table-cell">Émission</SortHeader>
                <SortHeader field="dueDate" className="hidden lg:table-cell">Échéance</SortHeader>
                <SortHeader field="total" align="right">Montant TTC</SortHeader>
                <Th align="right" className="hidden sm:table-cell">Reste dû</Th>
                <Th>Statut</Th>
                <Th className="w-10" />
              </THead>
              <tbody>
                {rows.map((inv, i) => {
                  const balance = inv.total - inv.amountPaid;
                  const pct = inv.total > 0 ? Math.min(100, (inv.amountPaid / inv.total) * 100) : 0;
                  return (
                    <Row key={inv.id} href={`/factures/${inv.id}`} index={i}>
                      <Td>
                        <span className={cn("font-mono text-[13px] font-medium group-hover:text-brand-700", inv.number ? "text-ink" : "italic text-muted")}>{inv.number ?? "Brouillon"}</span>
                        {(inv.reference || inv.quoteNumber) && <span className="block max-w-[170px] truncate text-xs text-muted">{inv.quoteNumber ? `Devis ${inv.quoteNumber}` : inv.reference}</span>}
                      </Td>
                      <Td><Link prefetch={false} href={`/clients/${inv.customer.id}`} className="text-[13px] font-medium text-ink-soft hover:text-brand-700">{inv.customer.name}</Link></Td>
                      <Td className="hidden text-[13px] text-ink-soft md:table-cell">{formatDate(inv.issueDate)}</Td>
                      <Td className={cn("hidden text-[13px] lg:table-cell", inv.status === "OVERDUE" ? "font-medium text-rose-600" : "text-ink-soft")}>{formatDate(inv.dueDate)}</Td>
                      <Td align="right" className="text-[13px] font-semibold tabular text-ink">{formatMAD(inv.total)}</Td>
                      <Td align="right" className="hidden sm:table-cell">
                        <span className={cn("text-[13px] font-medium tabular", balance > 0 && (inv.lifecycle === "ISSUED" || inv.lifecycle === "SENT") ? "text-amber-700" : "text-faint")}>
                          {inv.lifecycle === "CANCELLED" ? "—" : formatMAD(balance)}
                        </span>
                        {inv.paymentStatus === "PARTIAL" && (
                          <span className="mt-1 ml-auto block h-1 w-20 overflow-hidden rounded-full bg-subtle">
                            <motion.span className="block h-full rounded-full bg-violet-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.02 }} />
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="flex flex-col items-start gap-1">
                          <InvoiceStatusBadge status={inv.status} />
                          {(inv.lifecycle === "ISSUED" || inv.lifecycle === "SENT") && <span className="pl-1 text-[11px] text-faint">{LIFECYCLE[inv.lifecycle].label}</span>}
                        </span>
                      </Td>
                      <Td><InvoiceRowActions inv={inv} canWrite={canWrite} canDelete={canDelete} /></Td>
                    </Row>
                  );
                })}
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
