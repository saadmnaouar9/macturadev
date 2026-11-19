"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Ban, CircleDollarSign, Copy, Download, Eye, FilePlus2, MoreHorizontal, Pencil, Receipt, Send, Trash2 } from "lucide-react";
import type { InvoiceStatus, PaymentStatus } from "@prisma/client";
import type { InvoiceDisplayStatus } from "@/lib/status";
import { Card } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { LIFECYCLE } from "@/lib/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
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

export function InvoicesTable({
  rows, summary, total, page, pageSize, hasQuery, counts, canWrite, canDelete,
}: {
  rows: InvoiceRow[]; summary: { invoiced: number; paid: number; balance: number }; total: number; page: number; pageSize: number; hasQuery: boolean;
  counts: Record<string, number>; canWrite: boolean; canDelete: boolean;
}) {
  return (
    <ListState>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Facturé (sélection)", value: summary.invoiced, cls: "text-ink" },
          { label: "Encaissé", value: summary.paid, cls: "text-emerald-700" },
          { label: "Reste à encaisser", value: summary.balance, cls: summary.balance > 0 ? "text-amber-700" : "text-ink" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}>
            <Card className="px-4 py-3.5">
              <p className="text-xs text-muted">{s.label}</p>
              <p className={cn("mt-1 truncate text-[15px] font-semibold tracking-tight sm:text-lg", s.cls)}><AnimatedNumber value={s.value} kind="mad" duration={0.7} /></p>
            </Card>
          </motion.div>
        ))}
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
          <SearchInput placeholder="Numéro, client, référence…" />
        </div>
        {rows.length === 0 ? (
          hasQuery ? (
            <EmptyState icon={Receipt} title="Aucune facture trouvée" description="Modifiez la recherche ou les filtres." />
          ) : (
            <EmptyState icon={Receipt} title="Aucune facture pour le moment" description="Créez votre première facture ou convertissez un devis accepté." action={canWrite && <ButtonLink href="/factures/new"><FilePlus2 className="h-4 w-4" /> Créer une facture</ButtonLink>} />
          )
        ) : (
          <>
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
            <Pagination page={page} pageSize={pageSize} total={total} />
          </>
        )}
      </Card>
    </ListState>
  );
}
