"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Archive, ArchiveRestore, Building2, CircleDollarSign, Clock, FileText, Hash, Mail, MapPin, MoreHorizontal, Pencil, Phone, Receipt, Smartphone, StickyNote, Trash2, UserRound,
} from "lucide-react";
import type { InvoiceDisplayStatus, QuoteDisplayStatus } from "@/lib/status";
import { PAYMENT_METHODS } from "@/lib/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, InvoiceStatusBadge, QuoteStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/confirm";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { deleteCustomer, setCustomerArchived } from "@/app/(app)/clients/actions";
import { CustomerAvatar } from "./customers-table";

const ease = [0.16, 1, 0.3, 1] as const;

interface Props {
  customer: {
    id: string; type: "COMPANY" | "INDIVIDUAL"; name: string; nameAr: string | null; contactName: string | null; email: string | null; phone: string | null; mobile: string | null;
    ice: string | null; taxId: string | null; rc: string | null; address: string | null; city: string | null; postalCode: string | null; country: string;
    paymentDays: number | null; notes: string | null; archived: boolean; createdAt: string;
  };
  stats: { invoiced: number; collected: number; outstanding: number; overdue: number; quotes: number; accepted: number };
  invoices: { id: string; number: string | null; status: InvoiceDisplayStatus; issueDate: string; dueDate: string; total: number; balance: number }[];
  quotes: { id: string; number: string; status: QuoteDisplayStatus; issueDate: string; expiryDate: string; total: number; invoiceId: string | null }[];
  payments: { id: string; amount: number; date: string; method: keyof typeof PAYMENT_METHODS; invoiceId: string; invoiceNumber: string | null }[];
  activities: { id: string; type: string; message: string; createdAt: string; href: string | null; userName: string | null }[];
  canWrite: boolean;
  canDelete: boolean;
}

type Tab = "overview" | "invoices" | "quotes" | "history";

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <div className="mt-0.5 break-words text-[13px] font-medium text-ink">{children || <span className="font-normal text-faint">Non renseigné</span>}</div>
      </div>
    </div>
  );
}

export function CustomerDetail({ customer: c, stats, invoices, quotes, payments, activities, canWrite, canDelete }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("overview");
  const hasDocs = invoices.length + quotes.length > 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Aperçu" },
    { id: "invoices", label: "Factures", count: invoices.length },
    { id: "quotes", label: "Devis", count: quotes.length },
    { id: "history", label: "Historique", count: activities.length },
  ];

  const archive = async () => {
    const res = await setCustomerArchived(c.id, !c.archived);
    if (res.ok) { toast.success(res.message); } else toast.error(res.error);
  };
  const remove = async () => {
    const ok = await confirm({ title: `Supprimer ${c.name} ?`, description: "Cette action est définitive.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    const res = await deleteCustomer(c.id);
    if (res.ok) { toast.success(res.message); router.push("/clients"); } else toast.error(res.error);
  };

  return (
    <div>
      {/* En-tête */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <CustomerAvatar name={c.name} type={c.type} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-[-0.022em] text-ink">{c.name}</h1>
              <Badge tone={c.type === "COMPANY" ? "brand" : "neutral"} dot={false}>
                {c.type === "COMPANY" ? <Building2 className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                {c.type === "COMPANY" ? "Entreprise" : "Particulier"}
              </Badge>
              {c.archived && <Badge>Archivé</Badge>}
            </div>
            {c.nameAr && <p dir="rtl" lang="ar" className="mt-0.5 text-sm text-muted">{c.nameAr}</p>}
            <p className="mt-0.5 text-[13px] text-muted">
              {[c.city, c.contactName, `Client depuis le ${formatDate(c.createdAt, "long")}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/devis/new?customer=${c.id}`} variant="secondary"><FileText className="h-4 w-4" /> Nouveau devis</ButtonLink>
            <ButtonLink href={`/factures/new?customer=${c.id}`}><Receipt className="h-4 w-4" /> Nouvelle facture</ButtonLink>
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Plus d'actions"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownItem href={`/clients/${c.id}/edit`}><Pencil /> Modifier</DropdownItem>
                <DropdownItem onSelect={archive}>{c.archived ? <><ArchiveRestore /> Restaurer</> : <><Archive /> Archiver</>}</DropdownItem>
                {canDelete && !hasDocs && (<><DropdownSeparator /><DropdownItem danger onSelect={remove}><Trash2 /> Supprimer</DropdownItem></>)}
              </DropdownContent>
            </DropdownMenu>
          </div>
        )}
      </motion.div>

      {/* Statistiques */}
      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total facturé", value: stats.invoiced, kind: "mad" as const, sub: `${invoices.filter((i) => i.status !== "DRAFT").length} factures` },
          { label: "Total encaissé", value: stats.collected, kind: "mad" as const, sub: `${payments.length} paiements` },
          { label: "Reste à encaisser", value: stats.outstanding, kind: "mad" as const, sub: stats.overdue ? `${stats.overdue} en retard` : "Aucun retard", warn: stats.overdue > 0 },
          { label: "Devis", value: stats.quotes, kind: "int" as const, sub: `${stats.accepted} acceptés` },
        ].map((s) => (
          <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">{s.label}</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-ink sm:text-xl"><AnimatedNumber value={s.value} kind={s.kind} /></p>
              <p className={cn("mt-1 text-xs", s.warn ? "font-medium text-rose-600" : "text-faint")}>{s.sub}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Onglets */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors", tab === t.id ? "text-ink" : "text-muted hover:text-ink")}>
            {t.label}
            {t.count !== undefined && <span className="rounded bg-subtle px-1.5 text-[11px] tabular text-muted">{t.count}</span>}
            {tab === t.id && <motion.span layoutId="customer-tab" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-brand-500" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease }}>
          {tab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title="Coordonnées" />
                <div className="divide-y divide-line-soft px-5 pb-3 pt-2">
                  <InfoRow icon={Mail} label="E-mail">{c.email && <a href={`mailto:${c.email}`} className="hover:text-brand-700">{c.email}</a>}</InfoRow>
                  <InfoRow icon={Phone} label="Téléphone">{c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}</InfoRow>
                  <InfoRow icon={Smartphone} label="Mobile">{c.mobile && <a href={`tel:${c.mobile}`}>{c.mobile}</a>}</InfoRow>
                  <InfoRow icon={MapPin} label="Adresse">{[c.address, [c.postalCode, c.city].filter(Boolean).join(" "), c.country].filter(Boolean).join(", ")}</InfoRow>
                </div>
              </Card>
              <Card>
                <CardHeader title="Informations légales" />
                <div className="divide-y divide-line-soft px-5 pb-3 pt-2">
                  <InfoRow icon={Hash} label="ICE">{c.ice && <span className="font-mono tracking-wide">{c.ice}</span>}</InfoRow>
                  <InfoRow icon={Hash} label="Identifiant fiscal (IF)">{c.taxId && <span className="font-mono">{c.taxId}</span>}</InfoRow>
                  <InfoRow icon={Hash} label="Registre de commerce (RC)">{c.rc && <span className="font-mono">{c.rc}</span>}</InfoRow>
                  <InfoRow icon={Clock} label="Délai de paiement">{c.paymentDays !== null ? `${c.paymentDays} jours` : "Délai par défaut de l'entreprise"}</InfoRow>
                </div>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader title="Notes" />
                  <div className="px-5 pb-5 pt-3">
                    {c.notes ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{c.notes}</p> : (
                      <p className="flex items-center gap-2 text-[13px] text-faint"><StickyNote className="h-4 w-4" /> Aucune note</p>
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Derniers paiements" />
                  {payments.length === 0 ? <p className="px-5 pb-5 pt-3 text-[13px] text-faint">Aucun paiement reçu</p> : (
                    <ul className="mt-2 divide-y divide-line-soft">
                      {payments.slice(0, 4).map((p) => (
                        <li key={p.id}>
                          <Link prefetch={false} href={`/factures/${p.invoiceId}`} className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-canvas">
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-ink">{p.invoiceNumber}</span>
                              <span className="block text-xs text-muted">{formatDate(p.date)} · {PAYMENT_METHODS[p.method]}</span>
                            </span>
                            <span className="text-[13px] font-semibold tabular text-emerald-700">+{formatMAD(p.amount)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          )}

          {tab === "invoices" && (
            <Card className="overflow-hidden">
              {invoices.length === 0 ? (
                <EmptyState icon={Receipt} title="Aucune facture" description="Les factures de ce client apparaîtront ici." action={canWrite && <ButtonLink href={`/factures/new?customer=${c.id}`}>Créer une facture</ButtonLink>} />
              ) : (
                <DocTable
                  rows={invoices.map((i) => ({ id: i.id, href: `/factures/${i.id}`, number: i.number ?? "Brouillon", date: i.issueDate, second: i.dueDate, total: i.total, extra: i.balance, badge: <InvoiceStatusBadge status={i.status} /> }))}
                  secondLabel="Échéance"
                  extraLabel="Reste dû"
                />
              )}
            </Card>
          )}

          {tab === "quotes" && (
            <Card className="overflow-hidden">
              {quotes.length === 0 ? (
                <EmptyState icon={FileText} title="Aucun devis" description="Les devis de ce client apparaîtront ici." action={canWrite && <ButtonLink href={`/devis/new?customer=${c.id}`}>Créer un devis</ButtonLink>} />
              ) : (
                <DocTable
                  rows={quotes.map((q) => ({ id: q.id, href: `/devis/${q.id}`, number: q.number, date: q.issueDate, second: q.expiryDate, total: q.total, badge: <span className="flex items-center gap-2"><QuoteStatusBadge status={q.status} />{q.invoiceId && <Badge tone="violet" dot={false}>Facturé</Badge>}</span> }))}
                  secondLabel="Validité"
                />
              )}
            </Card>
          )}

          {tab === "history" && (
            <Card>
              {activities.length === 0 ? <EmptyState icon={Clock} title="Aucun historique" description="Les événements liés à ce client apparaîtront ici." /> : (
                <ol className="relative p-5 sm:p-6">
                  <span className="absolute bottom-10 left-[39px] top-10 w-px bg-line sm:left-[43px]" aria-hidden />
                  {activities.map((a, i) => {
                    const Icon = a.type.startsWith("payment") ? CircleDollarSign : a.type.startsWith("invoice") ? Receipt : a.type.startsWith("quote") ? FileText : UserRound;
                    const tone = a.type.startsWith("payment") ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : a.type === "quote.accepted" ? "bg-brand-50 text-brand-600 ring-brand-100" : a.type === "quote.rejected" ? "bg-rose-50 text-rose-600 ring-rose-100" : "bg-subtle text-muted ring-line";
                    const content = (
                      <>
                        <span className={cn("relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset", tone)}><Icon className="h-3.5 w-3.5" /></span>
                        <span className="pt-1">
                          <span className="block text-[13px] text-ink-soft group-hover:text-ink">{a.message}</span>
                          <span className="block text-[11px] text-faint">{formatDate(a.createdAt, "long")} · {formatRelative(a.createdAt)}{a.userName ? ` · ${a.userName}` : ""}</span>
                        </span>
                      </>
                    );
                    return (
                      <motion.li key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }} className="mb-4 last:mb-0">
                        {a.href ? <Link prefetch={false} href={a.href} className="group flex gap-3">{content}</Link> : <div className="flex gap-3">{content}</div>}
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DocTable({ rows, secondLabel, extraLabel }: { rows: { id: string; href: string; number: string; date: string; second: string; total: number; extra?: number; badge: React.ReactNode }[]; secondLabel: string; extraLabel?: string }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="border-b border-line-soft bg-canvas/70 text-left text-xs text-muted">
          <tr>
            <th className="px-5 py-2.5 font-medium">Numéro</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">{secondLabel}</th>
            <th className="px-4 py-2.5 font-medium">Statut</th>
            <th className="px-4 py-2.5 text-right font-medium">Montant TTC</th>
            {extraLabel && <th className="px-5 py-2.5 text-right font-medium">{extraLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} onClick={() => router.push(r.href)} className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-white/[0.04]">
              <td className="px-5 py-3 font-medium text-ink">{r.number}</td>
              <td className="px-4 py-3 text-[13px] text-ink-soft">{formatDate(r.date)}</td>
              <td className="px-4 py-3 text-[13px] text-ink-soft">{formatDate(r.second)}</td>
              <td className="px-4 py-3">{r.badge}</td>
              <td className="px-4 py-3 text-right text-[13px] font-medium tabular">{formatMAD(r.total)}</td>
              {extraLabel && <td className={cn("px-5 py-3 text-right text-[13px] font-medium tabular", r.extra ? "text-amber-700" : "text-faint")}>{formatMAD(r.extra ?? 0)}</td>}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
