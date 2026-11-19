"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Copy, Download, Mail, MoreHorizontal, Pencil, Printer, Receipt, RotateCcw, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import type { QuoteDisplayStatus } from "@/lib/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuoteStatusBadge } from "@/components/ui/badge";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { useServerAction } from "@/hooks/use-action";
import { formatMAD } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { convertQuoteToInvoice, deleteQuote, duplicateQuote, setQuoteStatus } from "@/app/(app)/devis/actions";
import { DocumentPaper, type PaperProps } from "./document-paper";
import { DocTimeline, WorkflowStepper } from "./doc-parts";

const ease = [0.16, 1, 0.3, 1] as const;

export function QuoteDetail({
  quote: q, paper, activities, canWrite, canDelete, lockedNotice,
}: {
  quote: {
    id: string; number: string; status: QuoteDisplayStatus; rawStatus: QuoteStatus; total: number; issueDate: string; expiryDate: string;
    sentAt: string | null; acceptedAt: string | null; rejectedAt: string | null;
    customer: { id: string; name: string; email: string | null; city: string | null };
    invoice: { id: string; number: string | null; status: string } | null;
  };
  paper: PaperProps;
  activities: { id: string; type: string; message: string; createdAt: string; userName: string | null }[];
  canWrite: boolean;
  canDelete: boolean;
  lockedNotice: boolean;
}) {
  const { run, pending } = useServerAction();
  const confirm = useConfirm();
  const converted = !!q.invoice;
  const editable = !converted && (q.rawStatus === "DRAFT" || q.rawStatus === "SENT");

  useEffect(() => {
    if (lockedNotice) toast.info("Ce devis ne peut plus être modifié", { description: "Seuls les devis en brouillon ou envoyés, non convertis, sont modifiables." });
  }, [lockedNotice]);

  const current = converted ? 3 : q.rawStatus === "ACCEPTED" ? 2 : q.rawStatus === "SENT" || q.rawStatus === "REJECTED" ? (q.rawStatus === "REJECTED" ? 2 : 1) : 0;
  const steps = [
    { label: "Brouillon", date: q.issueDate },
    { label: "Envoyé", date: q.sentAt },
    { label: "Accepté", date: q.acceptedAt ?? q.rejectedAt },
    { label: "Facturé", date: null },
  ];

  const mailto = q.customer.email
    ? `mailto:${q.customer.email}?subject=${encodeURIComponent(`Devis ${q.number} — ${paper.company.name}`)}&body=${encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint notre devis ${q.number} d'un montant de ${formatMAD(q.total)} TTC, valable jusqu'au ${formatDate(q.expiryDate, "long")}.\n\nCordialement,\n${paper.company.name}`)}`
    : null;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-[22px] font-semibold tracking-tight text-ink">{q.number}</h1>
            <QuoteStatusBadge status={q.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Devis pour <Link prefetch={false} href={`/clients/${q.customer.id}`} className="font-medium text-ink-soft hover:text-brand-700">{q.customer.name}</Link> · {formatMAD(q.total)} TTC · valable jusqu&apos;au {formatDate(q.expiryDate, "long")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.open(`/api/pdf/quote/${q.id}`, "_blank")}><Printer className="h-4 w-4" /> Imprimer</Button>
          <ButtonLink variant="secondary" href={`/api/pdf/quote/${q.id}?download=1`}><Download className="h-4 w-4" /> PDF</ButtonLink>
          {canWrite && editable && <ButtonLink variant="secondary" href={`/devis/${q.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</ButtonLink>}
          {canWrite && q.rawStatus === "DRAFT" && !converted && (
            <Button onClick={() => run("send", () => setQuoteStatus(q.id, "SENT"))} loading={pending === "send"}><Send className="h-4 w-4" /> Marquer comme envoyé</Button>
          )}
          {canWrite && (
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Plus d'actions"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownTrigger>
              <DropdownContent className="w-60">
                {mailto && <DropdownItem onSelect={() => (window.location.href = mailto)}><Mail /> Envoyer par e-mail</DropdownItem>}
                <DropdownItem onSelect={() => run("dup", () => duplicateQuote(q.id), { redirect: (d) => `/devis/${d.id}` })}><Copy /> Dupliquer</DropdownItem>
                {!converted && q.rawStatus !== "DRAFT" && q.rawStatus !== "SENT" && (
                  <DropdownItem onSelect={() => run("reopen", () => setQuoteStatus(q.id, "SENT"))}><RotateCcw /> Rouvrir (envoyé)</DropdownItem>
                )}
                {!converted && q.rawStatus === "SENT" && <DropdownItem onSelect={() => run("draft", () => setQuoteStatus(q.id, "DRAFT"))}><RotateCcw /> Repasser en brouillon</DropdownItem>}
                {canDelete && !converted && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem
                      danger
                      onSelect={async () => {
                        if (await confirm({ title: `Supprimer le devis ${q.number} ?`, description: "Cette action est définitive.", confirmLabel: "Supprimer", danger: true })) {
                          run("del", () => deleteQuote(q.id), { redirect: () => "/devis" });
                        }
                      }}
                    >
                      <Trash2 /> Supprimer
                    </DropdownItem>
                  </>
                )}
              </DropdownContent>
            </DropdownMenu>
          )}
        </div>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05, ease }}>
            <Card className="px-4 py-5 sm:px-8">
              <WorkflowStepper steps={steps} current={current} failed={q.rawStatus === "REJECTED" ? { at: 2, label: "Refusé" } : undefined} />
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1, ease }} className="rounded-2xl bg-stage p-3 sm:p-8">
            <DocumentPaper {...paper} />
          </motion.div>
        </div>

        <div className="space-y-5">
          <AnimatePresence mode="wait">
            {canWrite && !converted && (q.rawStatus === "SENT" || q.rawStatus === "DRAFT") && (
              <motion.div key="decide" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease }}>
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">Réponse du client</p>
                  <p className="mt-1 text-[13px] text-muted">Enregistrez la décision de {q.customer.name} pour suivre votre taux de conversion.</p>
                  {q.status === "EXPIRED" && <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">La date de validité est dépassée.</p>}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="success" onClick={() => run("acc", () => setQuoteStatus(q.id, "ACCEPTED"))} loading={pending === "acc"}><CheckCircle2 className="h-4 w-4" /> Accepté</Button>
                    <Button variant="secondary" onClick={() => run("rej", () => setQuoteStatus(q.id, "REJECTED"))} loading={pending === "rej"}><XCircle className="h-4 w-4 text-rose-500" /> Refusé</Button>
                  </div>
                </Card>
              </motion.div>
            )}
            {canWrite && !converted && q.rawStatus === "ACCEPTED" && (
              <motion.div key="convert" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease }}>
                <Card className="relative overflow-hidden p-5">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-100/60 blur-2xl" />
                  <div className="relative">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"><Sparkles className="h-3 w-3" /> Devis accepté</span>
                    <p className="mt-3 text-sm font-semibold text-ink">Prêt à facturer</p>
                    <p className="mt-1 text-[13px] text-muted">Créez la facture en un clic : client, lignes, quantités, prix, remises et TVA sont repris à l&apos;identique.</p>
                    <Button className="group mt-4 w-full" onClick={() => run("conv", () => convertQuoteToInvoice(q.id), { redirect: (d) => `/factures/${d.invoiceId}` })} loading={pending === "conv"}>
                      <Receipt className="h-4 w-4" /> Convertir en facture <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
            {converted && q.invoice && (
              <motion.div key="invoiced" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">Facture associée</p>
                  <Link prefetch={false} href={`/factures/${q.invoice.id}`} className="mt-3 flex items-center justify-between rounded-lg bg-canvas px-3.5 py-3 ring-1 ring-inset ring-line-soft transition-colors hover:bg-brand-50 hover:ring-brand-200">
                    <span className="flex items-center gap-2.5">
                      <Receipt className="h-4 w-4 text-brand-600" />
                      <span className="font-mono text-[13px] font-medium text-ink">{q.invoice.number ?? "Brouillon"}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-faint" />
                  </Link>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Montants</p>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Total HT net</dt><dd className="tabular font-medium">{formatMAD(paper.totals.taxableTotal)}</dd></div>
              {paper.totals.discountTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Remises accordées</dt><dd className="tabular text-emerald-600">−{formatMAD(paper.totals.discountTotal)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">TVA</dt><dd className="tabular">{formatMAD(paper.totals.taxTotal)}</dd></div>
              <div className="flex justify-between border-t border-line-soft pt-2 text-[15px] font-semibold"><dt>Total TTC</dt><dd className="tabular">{formatMAD(paper.totals.total)}</dd></div>
            </dl>
          </Card>

          <DocTimeline items={activities} />
        </div>
      </div>
    </div>
  );
}
