"use client";

import Link from "next/link";
import { CheckCircle2, Copy, Download, Eye, FilePlus2, FileText, MoreHorizontal, Pencil, Receipt, Send, Trash2, XCircle } from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import type { QuoteDisplayStatus } from "@/lib/status";
import { Card } from "@/components/ui/card";
import { Badge, QuoteStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { FilterTabs, ListState, Pagination, Row, SearchInput, SortHeader, Table, Td, Th, THead } from "@/components/data/list-state";
import { useServerAction } from "@/hooks/use-action";
import { formatMAD } from "@/lib/money";
import { formatDate } from "@/lib/utils";
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

export function QuotesTable({
  rows, total, sum, page, pageSize, hasQuery, counts, canWrite, canDelete,
}: {
  rows: QuoteRow[]; total: number; sum: number; page: number; pageSize: number; hasQuery: boolean; counts: Record<string, number>; canWrite: boolean; canDelete: boolean;
}) {
  return (
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
          <SearchInput placeholder="Numéro, client, référence…" />
        </div>
        {rows.length === 0 ? (
          hasQuery ? (
            <EmptyState icon={FileText} title="Aucun devis trouvé" description="Modifiez la recherche ou les filtres." />
          ) : (
            <EmptyState icon={FileText} title="Aucun devis pour le moment" description="Créez votre premier devis et convertissez-le en facture dès son acceptation." action={canWrite && <ButtonLink href="/devis/new"><FilePlus2 className="h-4 w-4" /> Créer un devis</ButtonLink>} />
          )
        ) : (
          <>
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
            <div className="flex justify-end border-t border-line-soft px-5 py-2.5 text-[13px] text-muted">
              Total de la sélection : <span className="ml-1.5 font-semibold tabular text-ink">{formatMAD(sum)}</span>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Card>
    </ListState>
  );
}
