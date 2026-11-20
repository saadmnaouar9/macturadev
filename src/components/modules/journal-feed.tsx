"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/ui/fast-link";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
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

/** Libellé de la date d'un évènement : « Aujourd'hui », « Hier » ou la date complète. */
const dayLabel = (iso: string) => dayTitle(dayKey(iso));

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 70 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.38, ease: EASE } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -70, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } }),
};

/**
 * Une carte à la fois : grande carte centrée, évènement par évènement, avec flèches, balayage (tactile ou souris), flèches du clavier,
 * compteur et barre de progression. La carte précédente sort et la suivante entre dans le sens du déplacement.
 */
function CardViewer({ rows }: { rows: JournalRow[] }) {
  const [state, setState] = useState({ i: 0, dir: 1 });
  const n = rows.length;
  const go = useCallback((delta: 1 | -1) => {
    setState((s) => {
      const next = s.i + delta;
      return next < 0 || next >= n ? s : { i: next, dir: delta };
    });
  }, [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const r = rows[state.i];
  if (!r) return null;
  const { label, tone } = labelFor(r.type);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };
  const arrow = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-subtle hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <section aria-roledescription="carousel" aria-label="Évènements du journal" className="mx-auto max-w-3xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <button type="button" onClick={() => go(-1)} disabled={state.i === 0} aria-label="Évènement précédent" className={cn(arrow, "order-2 sm:order-1")}>
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="order-1 col-span-3 overflow-hidden sm:order-2 sm:col-span-1" aria-live="polite">
          <AnimatePresence mode="wait" custom={state.dir} initial={false}>
            <motion.article
              key={r.id}
              custom={state.dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={onDragEnd}
              className="cursor-grab rounded-xl border border-line-soft bg-surface p-6 shadow-[var(--shadow-sm)] active:cursor-grabbing sm:p-8"
              aria-label={`${state.i + 1} sur ${n} : ${label}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={tone}>{label}</Badge>
                <p className="text-[13px] text-muted">
                  <span>{dayLabel(r.createdAt)}</span> · <span className="tabular">{timeOf(r.createdAt)}</span>
                </p>
              </div>

              <p className="mt-6 text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">{r.message}</p>

              <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line-soft pt-5">
                <div>
                  <dt className="text-xs text-muted">Auteur</dt>
                  <dd className="mt-1.5 flex items-center gap-2 text-sm text-ink">
                    {r.userName ? (
                      <>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-ink-soft">{initials(r.userName)}</span>
                        {r.userName}
                      </>
                    ) : <span className="text-faint">Système</span>}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted">Montant</dt>
                  <dd className="mt-1 text-xl font-semibold tabular text-ink">{r.amount ? formatMAD(r.amount) : "—"}</dd>
                </div>
              </dl>

              <div className="mt-6 flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-faint">{r.type}</span>
                {r.href && (
                  <Link href={r.href} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-brand-700 transition-colors hover:bg-subtle">
                    Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <button type="button" onClick={() => go(1)} disabled={state.i === n - 1} aria-label="Évènement suivant" className={cn(arrow, "order-3")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <p className="w-16 shrink-0 text-[13px] tabular text-muted"><span className="font-medium text-ink-soft">{state.i + 1}</span> / {n}</p>
        <div className="h-1 flex-1 overflow-hidden rounded-sm bg-subtle" role="progressbar" aria-valuemin={1} aria-valuemax={n} aria-valuenow={state.i + 1}>
          <motion.div className="h-full bg-brand-500" initial={false} animate={{ width: `${((state.i + 1) / n) * 100}%` }} transition={{ duration: 0.4, ease: EASE }} />
        </div>
        <p className="hidden w-24 shrink-0 text-right text-xs text-faint sm:block">← → clavier</p>
      </div>
    </section>
  );
}

/** Journal d'activité : une carte à la fois (flèches, balayage, clavier), avec bascule vers le tableau d'origine. */
export function JournalFeed({ rows, total }: { rows: JournalRow[]; total: number }) {
  const [view, setView] = useState<ViewMode>("grid");
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "grid" || v === "table") setView(v); } catch { /* stockage indisponible */ }
  }, []);
  const change = (m: ViewMode) => {
    setView(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch { /* ignoré */ }
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted"><span className="tabular font-medium text-ink-soft">{total}</span> évènement{total > 1 ? "s" : ""}</p>
        <ViewToggle mode={view} onChange={change} layoutId="journal-view-toggle" />
      </div>

      {view === "grid" ? (
        <CardViewer key={`${rows[0]?.id}-${rows.length}`} rows={rows} />
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
