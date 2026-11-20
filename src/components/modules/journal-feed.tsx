"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/fast-link";
import { motion, type Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { Row, Table, Td, Th, THead } from "@/components/data/list-state";
import type { Tone } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";

export interface JournalRow {
  id: string;
  createdAt: string; // ISO
  message: string;
  type: string;
  userName: string | null;
  amount: number | null;
  href: string | null;
}

const VIEW_KEY = "mactura.journal.view";
const TZ = "Africa/Casablanca";
const EASE = [0.16, 1, 0.3, 1] as const;

/** Libellé lisible et teinte d'un type d'évènement (la teinte porte un sens : vert = encaissé / accepté, rouge = annulé / refusé). */
const LABELS: [RegExp, string, Tone][] = [
  [/^payment\.created$/, "Paiement reçu", "success"],
  [/^payment\.voided$|^purchase\.payment_voided$/, "Paiement annulé", "danger"],
  [/^purchase\.paid$/, "Paiement fournisseur", "neutral"],
  [/^invoice\.issued$/, "Facture émise", "brand"],
  [/^invoice\.sent$/, "Facture envoyée", "brand"],
  [/^invoice\.(cancelled|voided)$/, "Facture annulée", "danger"],
  [/^invoice\./, "Facture", "brand"],
  [/^quote\.created$/, "Devis créé", "neutral"],
  [/^quote\.sent$/, "Devis envoyé", "neutral"],
  [/^quote\.accepted$/, "Devis accepté", "success"],
  [/^quote\.rejected$/, "Devis refusé", "danger"],
  [/^quote\.converted$/, "Devis converti", "brand"],
  [/^quote\./, "Devis", "neutral"],
  [/^customer\.created$/, "Client ajouté", "neutral"],
  [/^customer\./, "Client", "neutral"],
  [/^purchase\.created$/, "Achat enregistré", "neutral"],
  [/^purchase\.cancelled$/, "Achat annulé", "danger"],
  [/^purchase\./, "Achat", "neutral"],
  [/^supplier\./, "Fournisseur", "neutral"],
  [/^cash\./, "Trésorerie", "neutral"],
  [/^contract\./, "Contrat", "neutral"],
  [/^project\./, "Projet", "neutral"],
  [/^task\./, "Tâche", "neutral"],
  [/^employee\./, "Employé", "neutral"],
  [/^prospect\./, "Prospect", "neutral"],
  [/^product\./, "Produit", "neutral"],
  [/^company\./, "Entreprise", "neutral"],
];
function labelFor(type: string): { label: string; tone: Tone } {
  const hit = LABELS.find(([re]) => re.test(type));
  return hit ? { label: hit[1], tone: hit[2] } : { label: type, tone: "neutral" };
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

function dayTitle(key: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  return formatDate(new Date(`${key}T12:00:00Z`), "long");
}

const group: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const card: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: EASE } },
};

function EventCard({ r }: { r: JournalRow }) {
  const { label, tone } = labelFor(r.type);
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone}>{label}</Badge>
        <span className="text-xs tabular text-faint">{timeOf(r.createdAt)}</span>
      </div>
      <p className="mt-3 text-[13.5px] leading-snug text-ink">{r.message}</p>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        {r.userName ? (
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-ink-soft">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-ink-soft">{initials(r.userName)}</span>
            <span className="truncate">{r.userName}</span>
          </span>
        ) : (
          <span className="text-xs text-faint">Système</span>
        )}
        {r.amount ? <span className="shrink-0 text-[13px] font-semibold tabular text-ink">{formatMAD(r.amount)}</span> : null}
      </div>
    </>
  );
  const cls = "flex h-full flex-col rounded-xl border border-line-soft bg-surface p-4 transition-colors duration-200";
  return (
    <motion.li variants={card}>
      {r.href ? (
        <Link href={r.href} className={cn(cls, "hover:border-brand-400/60 focus-visible:border-brand-400")} aria-label={`${label} : ${r.message}`}>{body}</Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.li>
  );
}

/** Journal d'activité : fil de cartes regroupé par jour (animées à l'apparition), avec bascule vers le tableau d'origine. */
export function JournalFeed({ rows, total }: { rows: JournalRow[]; total: number }) {
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "grid" || v === "table") setView(v); } catch { /* stockage indisponible */ }
  }, []);
  const change = (m: ViewMode) => {
    setView(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* ignoré */ }
  };
  const days = useMemo(() => {
    const map = new Map<string, JournalRow[]>();
    rows.forEach((r) => { const k = dayKey(r.createdAt); map.set(k, [...(map.get(k) ?? []), r]); });
    return [...map.entries()];
  }, [rows]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted"><span className="tabular font-medium text-ink-soft">{total}</span> évènement{total > 1 ? "s" : ""}</p>
        <ViewToggle mode={view} onChange={change} layoutId="journal-view-toggle" />
      </div>

      {view === "grid" ? (
        <div className="space-y-7">
          {days.map(([key, items]) => (
            <section key={`${key}-${items[0]?.id}`} aria-label={dayTitle(key)}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-sm font-semibold text-ink">{dayTitle(key)}</h2>
                <span className="text-xs tabular text-faint">{items.length} évènement{items.length > 1 ? "s" : ""}</span>
              </div>
              <motion.ul variants={group} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((r) => <EventCard key={r.id} r={r} />)}
              </motion.ul>
            </section>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Événement</Th>
              <Th className="hidden md:table-cell">Utilisateur</Th>
              <Th align="right" className="hidden sm:table-cell">Montant</Th>
            </THead>
            <tbody>
              {rows.map((a, i) => (
                <Row key={a.id} index={i} href={a.href ?? undefined}>
                  <Td className="whitespace-nowrap text-[13px] text-ink-soft">
                    {formatDate(a.createdAt)}
                    <span className="ml-2 text-xs text-faint">{timeOf(a.createdAt)}</span>
                  </Td>
                  <Td>
                    <span className="text-[13px] text-ink">{a.href ? <Link href={a.href} className="hover:text-brand-700">{a.message}</Link> : a.message}</span>
                    <span className="block font-mono text-[11px] text-faint">{a.type}</span>
                  </Td>
                  <Td className="hidden md:table-cell">
                    {a.userName ? (
                      <span className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-ink-soft">{initials(a.userName)}</span>
                        {a.userName}
                      </span>
                    ) : <span className="text-faint">Système</span>}
                  </Td>
                  <Td align="right" className="hidden text-[13px] tabular text-ink-soft sm:table-cell">{a.amount ? formatMAD(a.amount) : "—"}</Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
