"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/ui/fast-link";
import { motion, type PanInfo } from "framer-motion";
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

/** Largeur du plateau : sert à dimensionner la carte centrale et l'écart des cartes voisines (mobile compris). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Pose d'une carte selon son écart `d` avec la carte active : x, échelle, inclinaison en perspective, opacité et profondeur. */
function pose(d: number, cardW: number) {
  const a = Math.abs(d);
  const side = Math.sign(d);
  if (a === 0) return { x: 0, scale: 1, rotateY: 0, opacity: 1, dim: 0, z: 30 };
  if (a === 1) return { x: side * cardW * 0.72, scale: 0.88, rotateY: -side * 40, opacity: 1, dim: 0.4, z: 20 };
  if (a === 2) return { x: side * cardW * 1.2, scale: 0.76, rotateY: -side * 48, opacity: 1, dim: 0.62, z: 10 };
  return { x: side * cardW * 1.4, scale: 0.66, rotateY: -side * 52, opacity: 0, dim: 0.8, z: 0 };
}

/** Face d'une carte : complète au centre, résumée sur les côtés. */
function CardFace({ r, active }: { r: JournalRow; active: boolean }) {
  const { label, tone } = labelFor(r.type);
  return (
    <div className="flex h-full flex-col p-4 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={tone}>{label}</Badge>
        <p className="text-[13px] text-muted">
          <span>{dayLabel(r.createdAt)}</span> · <span className="tabular">{timeOf(r.createdAt)}</span>
        </p>
      </div>
      <p className={cn("mt-5 font-semibold leading-snug tracking-tight text-ink", active ? "line-clamp-4 text-xl sm:text-2xl" : "line-clamp-3 text-lg")}>{r.message}</p>
      <div className="mt-auto">
        {active ? (
          <>
            <dl className="grid grid-cols-2 gap-6 border-t border-line-soft pt-4">
              <div>
                <dt className="text-xs text-muted">Auteur</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm text-ink">
                  {r.userName ? (
                    <>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-ink-soft">{initials(r.userName)}</span>
                      <span className="truncate">{r.userName}</span>
                    </>
                  ) : <span className="text-faint">Système</span>}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted">Montant</dt>
                <dd className="mt-1 whitespace-nowrap text-lg font-semibold tabular text-ink sm:text-xl">{r.amount ? formatMAD(r.amount) : "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-faint">{r.type}</span>
              {r.href && (
                <Link href={r.href} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-brand-700 transition-colors hover:bg-subtle">
                  Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </>
        ) : (
          <p className="border-t border-line-soft pt-3 text-right text-base font-semibold tabular text-ink-soft">{r.amount ? formatMAD(r.amount) : ""}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Une carte à la fois, en « coverflow » : la carte active est au centre, de face ; les voisines, inclinées en perspective et partiellement
 * cachées derrière, s'estompent avec la distance. Un clic sur une voisine l'amène au centre. Flèches, balayage (tactile ou souris),
 * flèches du clavier, compteur et barre de progression.
 */
function CardViewer({ rows }: { rows: JournalRow[] }) {
  const [i, setI] = useState(0);
  const [stage, width] = useWidth();
  const n = rows.length;
  const go = useCallback((delta: number) => setI((cur) => Math.min(n - 1, Math.max(0, cur + delta))), [n]);

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

  if (n === 0) return null;
  // Petits écrans : la carte centrale occupe l'essentiel de la largeur, les voisines n'apparaissent que sur les côtés
  const cardW = width < 600 ? width * 0.8 : Math.max(240, Math.min(430, width * 0.46));
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };
  const arrow = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-subtle hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";
  const window3 = rows.map((r, idx) => ({ r, idx })).filter(({ idx }) => Math.abs(idx - i) <= 3);

  return (
    <section aria-roledescription="carousel" aria-label="Évènements du journal" className="mx-auto max-w-4xl">
      <div className="relative">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Évènement précédent" className={cn(arrow, "absolute left-1 top-1/2 z-40 hidden -translate-y-1/2 bg-popover sm:flex")}>
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div ref={stage} className="relative h-[370px] min-w-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_9%,#000_91%,transparent)] sm:h-[360px]" aria-live="polite">
          <motion.div className="absolute inset-0" style={{ perspective: 1300 }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} dragSnapToOrigin onDragEnd={onDragEnd}>
            {window3.map(({ r, idx }) => {
              const d = idx - i;
              const t = pose(d, cardW);
              const active = d === 0;
              return (
                <motion.div
                  key={r.id}
                  initial={false}
                  animate={{ x: t.x, scale: t.scale, rotateY: t.rotateY, opacity: t.opacity }}
                  transition={{ type: "spring", stiffness: 170, damping: 24, mass: 0.9 }}
                  style={{ width: cardW, marginLeft: -cardW / 2, zIndex: t.z, left: "50%", top: 14, bottom: 14, pointerEvents: Math.abs(d) > 2 ? "none" : "auto" }}
                  onTap={() => { if (!active) go(d); }}
                  className={cn("absolute overflow-hidden rounded-xl border border-line-soft bg-popover", active ? "shadow-[var(--shadow-lg)]" : "cursor-pointer shadow-[var(--shadow-md)]")}
                  aria-hidden={!active}
                  role={active ? "group" : undefined}
                  aria-label={active ? `${i + 1} sur ${n}` : undefined}
                >
                  <CardFace r={r} active={active} />
                  <motion.div initial={false} animate={{ opacity: t.dim }} transition={{ duration: 0.4 }} className="pointer-events-none absolute inset-0 bg-canvas" aria-hidden />
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <button type="button" onClick={() => go(1)} disabled={i === n - 1} aria-label="Évènement suivant" className={cn(arrow, "absolute right-1 top-1/2 z-40 hidden -translate-y-1/2 bg-popover sm:flex")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3 sm:gap-4">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Évènement précédent" className={cn(arrow, "sm:hidden")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="w-14 shrink-0 text-[13px] tabular text-muted"><span className="font-medium text-ink-soft">{i + 1}</span> / {n}</p>
        <div className="h-1 flex-1 overflow-hidden rounded-sm bg-subtle" role="progressbar" aria-valuemin={1} aria-valuemax={n} aria-valuenow={i + 1}>
          <motion.div className="h-full bg-brand-500" initial={false} animate={{ width: `${((i + 1) / n) * 100}%` }} transition={{ duration: 0.4, ease: EASE }} />
        </div>
        <p className="hidden w-24 shrink-0 text-right text-xs text-faint sm:block">← → clavier</p>
        <button type="button" onClick={() => go(1)} disabled={i === n - 1} aria-label="Évènement suivant" className={cn(arrow, "sm:hidden")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

/** Journal d'activité : une carte à la fois en coverflow (flèches, balayage, clavier), avec bascule vers le tableau d'origine. */
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
