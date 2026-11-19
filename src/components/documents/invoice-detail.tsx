"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Ban, CircleDollarSign, Copy, Download, FileText, Mail, MoreHorizontal, Pencil, Printer, Receipt, Send, Trash2 } from "lucide-react";
import type { InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import type { InvoiceDisplayStatus } from "@/lib/status";
import { LIFECYCLE, PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, InvoiceStatusBadge } from "@/components/ui/badge";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useServerAction } from "@/hooks/use-action";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, todayUTC } from "@/lib/utils";
import { addPayment, cancelInvoice, deleteInvoice, duplicateInvoice, issueInvoice, markInvoiceSent, voidPayment } from "@/app/(app)/factures/actions";
import { DocumentPaper, type PaperProps } from "./document-paper";
import { DocTimeline, WorkflowStepper } from "./doc-parts";
import { PaymentDialog, VoidPaymentDialog } from "./payment-dialog";

const ease = [0.16, 1, 0.3, 1] as const;

interface Props {
  invoice: {
    id: string; number: string | null; status: InvoiceDisplayStatus; lifecycle: InvoiceStatus; paymentStatus: PaymentStatus; total: number; amountPaid: number;
    issueDate: string; dueDate: string; issuedAt: string | null; sentAt: string | null; paidAt: string | null; cancelledAt: string | null;
    customer: { id: string; name: string; email: string | null };
    quote: { id: string; number: string } | null;
    payments: { id: string; amount: number; date: string; method: PaymentMethod; reference: string | null; notes: string | null; voidedAt: string | null; voidReason: string | null }[];
  };
  paper: PaperProps;
  activities: { id: string; type: string; message: string; createdAt: string; userName: string | null }[];
  canWrite: boolean;
  canDelete: boolean;
  lockedNotice: boolean;
  openPayment: boolean;
}

export function InvoiceDetail({ invoice: inv, paper, activities, canWrite, canDelete, lockedNotice, openPayment }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { run, pending } = useServerAction();
  const confirm = useConfirm();
  const [payOpen, setPayOpen] = useState(false);
  const [voiding, setVoiding] = useState<{ id: string; amount: number } | null>(null);
  const draft = inv.lifecycle === "DRAFT";
  const cancelled = inv.lifecycle === "CANCELLED";
  const active = inv.lifecycle === "ISSUED" || inv.lifecycle === "SENT";
  const balance = inv.total - inv.amountPaid;
  const canPay = canWrite && active && inv.paymentStatus !== "PAID" && balance > 0;
  const editable = canWrite && !cancelled && inv.paymentStatus === "UNPAID" && inv.amountPaid === 0;
  const activePayments = inv.payments.filter((p) => !p.voidedAt);
  const pct = inv.total > 0 ? Math.min(100, (inv.amountPaid / inv.total) * 100) : 0;
  const daysLate = inv.status === "OVERDUE" ? Math.round((todayUTC().getTime() - new Date(inv.dueDate).getTime()) / 86400000) : 0;

  useEffect(() => {
    if (lockedNotice) toast.info("Cette facture ne peut plus être modifiée", { description: "Les factures payées, annulées ou ayant reçu un paiement sont figées." });
    if (openPayment && canPay) {
      setPayOpen(true);
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Étapes du cycle de vie uniquement — le règlement est suivi séparément
  const current = draft ? 0 : inv.lifecycle === "ISSUED" ? 1 : inv.lifecycle === "SENT" ? 2 : inv.sentAt ? 2 : 1;
  const steps = [
    { label: "Brouillon", date: inv.issueDate },
    { label: "Émise", date: inv.issuedAt },
    { label: "Envoyée", date: inv.sentAt },
  ];

  const mailto = inv.customer.email && inv.number
    ? `mailto:${inv.customer.email}?subject=${encodeURIComponent(`Facture ${inv.number} — ${paper.company.name}`)}&body=${encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint notre facture ${inv.number} d'un montant de ${formatMAD(inv.total)} TTC, payable avant le ${formatDate(inv.dueDate, "long")}.${balance > 0 && balance < inv.total ? `\nReste à payer : ${formatMAD(balance)}.` : ""}\n\nCordialement,\n${paper.company.name}`)}`
    : null;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className={cn("font-mono text-[22px] font-semibold tracking-tight", inv.number ? "text-ink" : "italic text-muted")}>{inv.number ?? "Facture brouillon"}</h1>
            <InvoiceStatusBadge status={inv.status} />
            {active && <Badge tone={LIFECYCLE[inv.lifecycle].tone} dot={false}>{LIFECYCLE[inv.lifecycle].label}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            <Link prefetch={false} href={`/clients/${inv.customer.id}`} className="font-medium text-ink-soft hover:text-brand-700">{inv.customer.name}</Link> · {formatMAD(inv.total)} TTC · échéance le {formatDate(inv.dueDate, "long")}
            {inv.quote && <> · issue du devis <Link prefetch={false} href={`/devis/${inv.quote.id}`} className="font-mono text-ink-soft hover:text-brand-700">{inv.quote.number}</Link></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.open(`/api/pdf/invoice/${inv.id}`, "_blank")}><Printer className="h-4 w-4" /> Imprimer</Button>
          <ButtonLink variant="secondary" href={`/api/pdf/invoice/${inv.id}?download=1`}><Download className="h-4 w-4" /> PDF</ButtonLink>
          {editable && <ButtonLink variant="secondary" href={`/factures/${inv.id}/edit`}><Pencil className="h-4 w-4" /> Modifier</ButtonLink>}
          {canWrite && draft && <Button onClick={() => run("issue", () => issueInvoice(inv.id))} loading={pending === "issue"}><Receipt className="h-4 w-4" /> Émettre la facture</Button>}
          {canPay && <Button variant="success" onClick={() => setPayOpen(true)}><CircleDollarSign className="h-4 w-4" /> Enregistrer un paiement</Button>}
          {canWrite && (
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Plus d'actions"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownTrigger>
              <DropdownContent className="w-60">
                {inv.lifecycle === "ISSUED" && <DropdownItem onSelect={() => run("sent", () => markInvoiceSent(inv.id))}><Send /> Marquer comme envoyée</DropdownItem>}
                {mailto && <DropdownItem onSelect={() => (window.location.href = mailto)}><Mail /> Envoyer par e-mail</DropdownItem>}
                <DropdownItem onSelect={() => run("dup", () => duplicateInvoice(inv.id), { redirect: (d) => `/factures/${d.id}` })}><Copy /> Dupliquer en brouillon</DropdownItem>
                {canDelete && draft && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem danger onSelect={async () => { if (await confirm({ title: "Supprimer ce brouillon ?", description: "Cette action est définitive.", confirmLabel: "Supprimer", danger: true })) run("del", () => deleteInvoice(inv.id), { redirect: () => "/factures" }); }}><Trash2 /> Supprimer le brouillon</DropdownItem>
                  </>
                )}
                {canDelete && active && activePayments.length === 0 && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem danger onSelect={async () => { if (await confirm({ title: `Annuler la facture ${inv.number} ?`, description: "Elle restera dans l'historique avec le statut « Annulée ». Son numéro reste attribué.", confirmLabel: "Annuler la facture", danger: true })) run("cancel", () => cancelInvoice(inv.id)); }}><Ban /> Annuler la facture</DropdownItem>
                  </>
                )}
              </DropdownContent>
            </DropdownMenu>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {inv.status === "OVERDUE" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-5 flex flex-col gap-3 rounded-xl bg-rose-50 px-4 py-3 ring-1 ring-inset ring-rose-200 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-rose-800"><span className="font-semibold">En retard de {daysLate} jour{daysLate > 1 ? "s" : ""}.</span> Reste à encaisser : {formatMAD(balance)}.</p>
              {mailto && <Button size="sm" variant="secondary" onClick={() => (window.location.href = mailto)}><Mail className="h-4 w-4" /> Relancer le client</Button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card className="px-4 py-5 sm:px-8">
            <WorkflowStepper steps={steps} current={current} failed={cancelled ? { at: inv.sentAt ? 2 : 1, label: "Annulée" } : undefined} />
          </Card>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1, ease }} className="rounded-2xl bg-stage p-3 sm:p-8">
            <DocumentPaper {...paper} />
          </motion.div>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Suivi du règlement</p>
                {active && <Badge tone={inv.status === "OVERDUE" ? "danger" : PAYMENT_STATUS[inv.paymentStatus].tone}>{inv.status === "OVERDUE" ? `${PAYMENT_STATUS[inv.paymentStatus].label} · en retard` : PAYMENT_STATUS[inv.paymentStatus].label}</Badge>}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted">Encaissé</p>
                  <p className="text-xl font-semibold tracking-tight text-emerald-700"><AnimatedNumber value={inv.amountPaid} kind="mad" duration={0.8} /></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Reste à payer</p>
                  <p className={cn("text-[15px] font-semibold tabular", balance > 0 && !cancelled ? "text-amber-700" : "text-faint")}>{cancelled ? "—" : formatMAD(balance)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Pourcentage réglé">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease }} />
              </div>
              <p className="mt-1.5 text-right text-[11px] tabular text-faint">{pct.toFixed(0)} % réglé sur {formatMAD(inv.total)}</p>
              {draft && <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-xs text-muted">Émettez la facture pour pouvoir enregistrer des paiements.</p>}
              {canPay && <Button variant="success" className="mt-4 w-full" onClick={() => setPayOpen(true)}><CircleDollarSign className="h-4 w-4" /> Enregistrer un paiement</Button>}
            </div>
            {inv.payments.length > 0 && (
              <div className="border-t border-line-soft">
                <p className="px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Historique des paiements · {activePayments.length} actif{activePayments.length > 1 ? "s" : ""}{inv.payments.length > activePayments.length ? ` · ${inv.payments.length - activePayments.length} annulé${inv.payments.length - activePayments.length > 1 ? "s" : ""}` : ""}
                </p>
                <ul className="divide-y divide-line-soft">
                  <AnimatePresence initial={false}>
                    {inv.payments.map((p) => {
                      const voided = !!p.voidedAt;
                      return (
                        <motion.li key={p.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="group flex items-start gap-3 px-5 py-3">
                          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", voided ? "bg-subtle text-faint ring-line" : "bg-emerald-50 text-emerald-600 ring-emerald-100")}>
                            {voided ? <Ban className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className={cn("text-[13px] font-semibold tabular", voided ? "text-faint line-through" : "text-ink")}>{formatMAD(p.amount)}</span>
                              {voided && <Badge tone="neutral" dot={false}>Annulé</Badge>}
                            </span>
                            <span className="block truncate text-xs text-muted">{formatDate(p.date)} · {PAYMENT_METHODS[p.method]}{p.reference ? ` · ${p.reference}` : ""}</span>
                            {voided && <span className="mt-0.5 block text-xs text-rose-600/90">Annulé le {formatDate(p.voidedAt!)} — {p.voidReason}</span>}
                          </span>
                          {canDelete && !voided && (
                            <button
                              onClick={() => setVoiding({ id: p.id, amount: p.amount })}
                              className="rounded-md p-1.5 text-faint opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                              aria-label={`Annuler le paiement de ${formatMAD(p.amount)}`}
                              title="Annuler ce paiement"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Informations" />
            <dl className="space-y-2 px-5 pb-5 pt-3 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Émission</dt><dd>{formatDate(inv.issueDate, "long")}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Échéance</dt><dd className={cn(inv.status === "OVERDUE" && "font-medium text-rose-600")}>{formatDate(inv.dueDate, "long")}</dd></div>
              {paper.paymentTerms && <div className="flex justify-between gap-4"><dt className="text-muted">Conditions</dt><dd className="text-right">{paper.paymentTerms}</dd></div>}
              {inv.quote && <div className="flex justify-between"><dt className="text-muted">Devis d&apos;origine</dt><dd><Link prefetch={false} href={`/devis/${inv.quote.id}`} className="inline-flex items-center gap-1 font-mono text-brand-700 hover:underline"><FileText className="h-3.5 w-3.5" />{inv.quote.number}</Link></dd></div>}
              <div className="flex justify-between border-t border-line-soft pt-2"><dt className="text-muted">Total HT net</dt><dd className="tabular">{formatMAD(paper.totals.taxableTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">TVA</dt><dd className="tabular">{formatMAD(paper.totals.taxTotal)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total TTC</dt><dd className="tabular">{formatMAD(paper.totals.total)}</dd></div>
            </dl>
          </Card>

          <DocTimeline items={activities} />
        </div>
      </div>

      <VoidPaymentDialog action={voidPayment} payment={voiding} onOpenChange={(o) => !o && setVoiding(null)} onDone={() => { setVoiding(null); }} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} submit={(d) => addPayment({ invoiceId: inv.id, ...d })} balance={balance} issueDate={inv.issueDate} onDone={() => { setPayOpen(false); }} />
    </div>
  );
}
