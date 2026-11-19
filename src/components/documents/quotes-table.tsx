"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Copy, Download, Eye, FilePlus2, FileText, MoreHorizontal, Pencil, Percent, Receipt, Send, Trash2, Hourglass, XCircle } from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import { QUOTE_STATUS, type QuoteDisplayStatus } from "@/lib/status";
import { Card } from "@/components/ui/card";
import { Badge, QuoteStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { StatCard } from "@/components/ui/stat-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { startNavProgress } from "@/components/layout/top-progress";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead } from "@/components/data/list-state";
import { useServerAction } from "@/hooks/use-action";
import { formatMAD } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
import { convertQuoteToInvoice, deleteQuote, duplicateQuote, setQuoteStatus } from "@/app/(app)/devis/actions";

interface QuoteRow {
  id: string;
  number: string;
  status: QuoteDisplayStatus;
  rawStatus: QuoteStatus;
  issueDate: string;
  expiryDate: string;
  total: number;
  reference: string | null;
  customer: { id: string; name: string };
  invoice: { id: string; number: string | null } | null;
}

export function QuoteActions({ q, canWrite, canDelete }: { q: QuoteRow; canWrite: boolean; canDelete: boolean }) {
  const { run } = useServerAction();
  const confirm = useConfirm();
  const locked = !!q.invoice;
  const editable = !locked && (q.rawStatus === "DRAFT" || q.rawStatus === "SENT");
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button className="rounded-md p-1.5 text-faint opacity-60 transition-all hover:bg-subtle hover:text-ink group-hover:opacity-100 data-[state=open]:bg-subtle data-[state=open]:opacity-100" aria-label={`Actions pour le devis ${q.number}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-60">
        <DropdownItem href={`/devis/${q.id}`}><Eye /> Ouvrir</DropdownItem>
        <DropdownItem onSelect={() => window.open(`/api/pdf/quote/${q.id}?download=1`, "_blank")}><Download /> Télécharger le PDF</DropdownItem>
        {canWrite && (
          <>
            {editable && <DropdownItem href={`/devis/${q.id}/edit`}><Pencil /> Modifier</DropdownItem>}
            <DropdownItem onSelect={() => run("dup", () => duplicateQuote(q.id), { redirect: (d) => `/devis/${d.id}` })}><Copy /> Dupliquer</DropdownItem>
            {!locked && (
              <>
                <DropdownSeparator />
                {(q.rawStatus === "DRAFT" || q.rawStatus === "REJECTED" || q.rawStatus === "ACCEPTED") && (
                  <DropdownItem onSelect={() => run("sent", () => setQuoteStatus(q.id, "SENT"))}><Send /> Marquer comme envoyé</DropdownItem>
                )}
                {q.rawStatus !== "ACCEPTED" && <DropdownItem onSelect={() => run("acc", () => setQuoteStatus(q.id, "ACCEPTED"))}><CheckCircle2 /> Marquer comme accepté</DropdownItem>}
                {q.rawStatus !== "REJECTED" && q.rawStatus !== "ACCEPTED" && <DropdownItem onSelect={() => run("rej", () => setQuoteStatus(q.id, "REJECTED"))}><XCircle /> Marquer comme refusé</DropdownItem>}
                {q.rawStatus === "ACCEPTED" && (
                  <DropdownItem onSelect={() => run("conv", () => convertQuoteToInvoice(q.id), { redirect: (d) => `/factures/${d.invoiceId}` })}><Receipt /> Convertir en facture</DropdownItem>
                )}
              </>
            )}
          </>
        )}
        {q.invoice && <DropdownItem href={`/factures/${q.invoice.id}`}><Receipt /> Voir la facture</DropdownItem>}
        {canDelete && !locked && (
          <>
            <DropdownSeparator />
            <DropdownItem
              danger
              onSelect={async () => {
                if (await confirm({ title: `Supprimer le devis ${q.number} ?`, description: "Le devis et ses lignes seront définitivement supprimés.", confirmLabel: "Supprimer", danger: true })) {
                  run("del", () => deleteQuote(q.id));
                }
              }}
            >
              <Trash2 /> Supprimer
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}

const VIEW_KEY = "mactura.quotes.view";
const EASE = [0.16, 1, 0.3, 1] as const;
const LINE: Record<string, string> = {
  neutral: "bg-faint", info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500", brand: "bg-brand-500", violet: "bg-violet-500",
};

export interface QuoteStats {
  all: number; sentCount: number; sentValue: number; acceptedCount: number; acceptedValue: number; acceptanceBp: number | null;
}

function QuoteCard({ q, index, canWrite, canDelete }: { q: QuoteRow; index: number; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const tone = QUOTE_STATUS[q.status]?.tone ?? "neutral";
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.ceil((new Date(q.expiryDate.slice(0, 10)).getTime() - new Date(today).getTime()) / 86400000);
  const open = q.status === "SENT" || q.status === "DRAFT";
  const soon = open && days >= 0 && days <= 7;
  const expired = q.status === "EXPIRED";
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
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
        router.push(`/devis/${q.id}`);
      }}
      className="glass group relative flex cursor-pointer flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgb(91 155 255 / 0.16), transparent 70%)" }} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", LINE[tone])} />

      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Link prefetch={false} href={`/devis/${q.id}`} className="block truncate font-mono text-[15px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline">{q.number}</Link>
          <Link prefetch={false} href={`/clients/${q.customer.id}`} className="mt-0.5 block truncate text-xs text-muted transition-colors hover:text-brand-700">{q.customer.name}</Link>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0"><QuoteActions q={q} canWrite={canWrite} canDelete={canDelete} /></div>
      </div>

      <div className="relative mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
        <QuoteStatusBadge status={q.status} />
        {q.invoice && <Badge tone="violet" dot={false}>Facturé</Badge>}
        {q.reference && <span className="max-w-[160px] truncate rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">{q.reference}</span>}
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">Montant TTC</p>
          <p className="whitespace-nowrap text-lg font-semibold tabular tracking-tight text-ink">{formatMAD(q.total)}</p>
        </div>
        <div className="text-right text-xs">
          <p className="whitespace-nowrap text-muted">Émis le {formatDate(q.issueDate)}</p>
          <p className={cn("mt-0.5 inline-flex items-center gap-1.5 whitespace-nowrap", expired ? "font-medium text-rose-600" : soon ? "font-medium text-amber-700" : "text-muted")}>
            {(soon || expired) && <span className="relative flex h-2 w-2"><span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full", expired ? "bg-rose-400/70" : "bg-amber-400/70")} /><span className={cn("relative h-2 w-2 rounded-full", expired ? "bg-rose-500" : "bg-amber-500")} /></span>}
            {!soon && !expired && <CalendarClock className="h-3.5 w-3.5" />}
            {expired ? `Expiré le ${formatDate(q.expiryDate)}` : soon ? (days === 0 ? "Expire aujourd'hui" : `Expire dans ${days} j`) : `Valide jusqu'au ${formatDate(q.expiryDate)}`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function QuotesTable({
  rows, total, sum, page, pageSize, hasQuery, counts, stats, canWrite, canDelete,
}: {
  rows: QuoteRow[]; total: number; sum: number; page: number; pageSize: number; hasQuery: boolean; counts: Record<string, number>; stats: QuoteStats; canWrite: boolean; canDelete: boolean;
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
    <>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard index={0} tone="brand" icon={FileText} label="Devis" sub="tous statuts confondus"><AnimatedNumber value={stats.all} /></StatCard>
      <StatCard index={1} tone="sky" icon={Hourglass} label="En attente" sub={`${stats.sentCount} devis envoyé${stats.sentCount > 1 ? "s" : ""}`}><AnimatedNumber value={stats.sentValue} kind="mad" /></StatCard>
      <StatCard index={2} tone="emerald" icon={CheckCircle2} label="Acceptés" sub={`${stats.acceptedCount} devis`}><AnimatedNumber value={stats.acceptedValue} kind="mad" /></StatCard>
      <StatCard index={3} tone="violet" icon={Percent} label="Taux d'acceptation" sub="acceptés / clôturés">{stats.acceptanceBp === null ? "—" : <AnimatedNumber value={stats.acceptanceBp} kind="percent" />}</StatCard>
    </div>
    <ListState>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            layoutId="quote-status"
            options={[
              { value: "", label: "Tous", count: counts.all },
              { value: "DRAFT", label: "Brouillons", count: counts.DRAFT },
              { value: "SENT", label: "Envoyés", count: counts.SENT },
              { value: "ACCEPTED", label: "Acceptés", count: counts.ACCEPTED },
              { value: "REJECTED", label: "Refusés", count: counts.REJECTED },
              { value: "EXPIRED", label: "Expirés", count: counts.EXPIRED },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput placeholder="Numéro, client, référence…" />
            <ViewToggle mode={view} onChange={changeView} layoutId="quote-view-toggle" />
          </div>
        </div>
        {rows.length === 0 ? (
          hasQuery ? (
            <EmptyState icon={FileText} title="Aucun devis trouvé" description="Modifiez la recherche ou les filtres." />
          ) : (
            <EmptyState icon={FileText} title="Aucun devis pour le moment" description="Créez votre premier devis et convertissez-le en facture dès son acceptation." action={canWrite && <ButtonLink href="/devis/new"><FilePlus2 className="h-4 w-4" /> Créer un devis</ButtonLink>} />
          )
        ) : (
          <>
            {view === "grid" ? (
              <div className="grid gap-4 p-4 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((q, i) => <QuoteCard key={q.id} q={q} index={i} canWrite={canWrite} canDelete={canDelete} />)}
              </div>
            ) : (
            <Table>
              <THead>
                <SortHeader field="number">Numéro</SortHeader>
                <Th>Client</Th>
                <SortHeader field="issueDate" className="hidden md:table-cell">Date</SortHeader>
                <SortHeader field="expiryDate" className="hidden lg:table-cell">Validité</SortHeader>
                <SortHeader field="total" align="right">Montant TTC</SortHeader>
                <Th>Statut</Th>
                <Th className="w-10" />
              </THead>
              <tbody>
                {rows.map((q, i) => (
                  <Row key={q.id} href={`/devis/${q.id}`} index={i}>
                    <Td>
                      <span className="font-mono text-[13px] font-medium text-ink group-hover:text-brand-700">{q.number}</span>
                      {q.reference && <span className="block max-w-[160px] truncate text-xs text-muted">{q.reference}</span>}
                    </Td>
                    <Td><Link prefetch={false} href={`/clients/${q.customer.id}`} className="text-[13px] font-medium text-ink-soft hover:text-brand-700">{q.customer.name}</Link></Td>
                    <Td className="hidden text-[13px] text-ink-soft md:table-cell">{formatDate(q.issueDate)}</Td>
                    <Td className="hidden text-[13px] text-ink-soft lg:table-cell">{formatDate(q.expiryDate)}</Td>
                    <Td align="right" className="text-[13px] font-semibold tabular text-ink">{formatMAD(q.total)}</Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <QuoteStatusBadge status={q.status} />
                        {q.invoice && <Badge tone="violet" dot={false}>Facturé</Badge>}
                      </span>
                    </Td>
                    <Td><QuoteActions q={q} canWrite={canWrite} canDelete={canDelete} /></Td>
                  </Row>
                ))}
              </tbody>
            </Table>
            )}
            <div className="flex justify-end border-t border-line-soft px-5 py-2.5 text-[13px] text-muted">
              Total de la sélection : <span className="ml-1.5 font-semibold tabular text-ink">{formatMAD(sum)}</span>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Card>
    </ListState>
    </>
  );
}
