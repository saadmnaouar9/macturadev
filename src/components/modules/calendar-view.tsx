"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { AlertTriangle, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, LayoutGrid, ListTodo } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export interface CalEvent {
  id: string;
  date: string;
  title: string;
  detail?: string;
  kind: "invoice" | "purchase" | "quote" | "task" | "contract" | "project" | "prospect";
  href: string;
  late?: boolean;
}

/** bar : liseré + fond de l'événement · dot : pastille · chip : pastille de filtre actif */
const KINDS: Record<CalEvent["kind"], { label: string; bar: string; dot: string; chip: string }> = {
  invoice: { label: "Échéances clients", bar: "border-l-emerald-500 bg-emerald-500/10 text-emerald-800", dot: "bg-emerald-500", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800" },
  purchase: { label: "À payer (fournisseurs)", bar: "border-l-orange-500 bg-orange-500/10 text-accent-600", dot: "bg-orange-500", chip: "border-orange-500/40 bg-orange-500/10 text-accent-600" },
  quote: { label: "Expirations de devis", bar: "border-l-amber-500 bg-amber-500/10 text-amber-800", dot: "bg-amber-500", chip: "border-amber-500/40 bg-amber-500/10 text-amber-800" },
  task: { label: "Tâches", bar: "border-l-blue-500 bg-blue-500/10 text-brand-700", dot: "bg-blue-500", chip: "border-blue-500/40 bg-blue-500/10 text-brand-700" },
  contract: { label: "Fins de contrat", bar: "border-l-violet-500 bg-violet-500/10 text-violet-700", dot: "bg-violet-500", chip: "border-violet-500/40 bg-violet-500/10 text-violet-700" },
  project: { label: "Fins de projet", bar: "border-l-sky-500 bg-sky-500/10 text-sky-700", dot: "bg-sky-500", chip: "border-sky-500/40 bg-sky-500/10 text-sky-700" },
  prospect: { label: "Relances prospects", bar: "border-l-rose-500 bg-rose-500/10 text-rose-700", dot: "bg-rose-500", chip: "border-rose-500/40 bg-rose-500/10 text-rose-700" },
};
const WEEK = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const yearFmt = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
const monthLongFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const ease = [0.16, 1, 0.3, 1] as const;

function shift(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

const slide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 36, filter: "blur(4px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.4, ease } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36, filter: "blur(4px)", transition: { duration: 0.2 } }),
};

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CalendarDays; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-surface px-4 py-3 shadow-[var(--shadow-xs)]">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}><Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p key={value} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.25 }} className="text-xl font-semibold leading-none tabular text-ink">{value}</motion.p>
        </AnimatePresence>
        <p className="mt-1 truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

export function CalendarView({ month, events, today }: { month: string; events: CalEvent[]; today: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [selected, setSelected] = useState<string | null>(today.startsWith(month) ? today : `${month}-01`);
  const prevMonth = useRef(month);
  const dir = month >= prevMonth.current ? 1 : -1;
  useEffect(() => {
    prevMonth.current = month;
    setSelected(today.startsWith(month) ? today : `${month}-01`);
  }, [month, today]);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - offset + i)));
  const rows = days[35].getUTCMonth() === m - 1 ? 6 : 5;
  const visible = useMemo(() => events.filter((e) => !hidden.has(e.kind)), [events, hidden]);
  const byDay = useMemo(() => { const map = new Map<string, CalEvent[]>(); visible.forEach((e) => map.set(e.date, [...(map.get(e.date) ?? []), e])); return map; }, [visible]);
  const inThisMonth = useMemo(() => visible.filter((e) => e.date.startsWith(month)), [visible, month]);
  const lateCount = inThisMonth.filter((e) => e.late).length;
  const todayCount = byDay.get(today)?.length ?? 0;
  const selEvents = selected ? byDay.get(selected) ?? [] : [];
  const agendaDays = useMemo(() => [...new Set(inThisMonth.map((e) => e.date))].sort(), [inThisMonth]);
  const selDate = selected ? new Date(`${selected}T00:00:00Z`) : null;

  return (
    <>
      <PageHeader title="Calendrier" description="Échéances, relances et rendez-vous de tous vos modules, au même endroit." />

      {/* Résumé du mois */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={CalendarDays} label={`Événements en ${monthFmt.format(first)}`} value={inThisMonth.length} tone="bg-brand-500/12 text-brand-600" />
        <Stat icon={AlertTriangle} label="En retard" value={lateCount} tone="bg-rose-500/12 text-rose-600" />
        <Stat icon={CalendarCheck2} label="Aujourd'hui" value={todayCount} tone="bg-emerald-500/12 text-emerald-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
          {/* En-tête : mois animé, bascule de vue, navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
            <div className="flex items-baseline gap-2 overflow-hidden">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.h2 key={month} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" className="text-2xl font-semibold capitalize tracking-tight text-ink">
                  {monthFmt.format(first)} <span className="font-normal text-faint">{yearFmt.format(first)}</span>
                </motion.h2>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="Affichage" className="relative flex rounded-xl bg-subtle p-0.5">
                {([["month", "Mois", LayoutGrid], ["agenda", "Agenda", ListTodo]] as const).map(([k, label, Icon]) => (
                  <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cn("relative z-10 flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors", mode === k ? "text-ink" : "text-muted hover:text-ink")}>
                    {mode === k && <motion.span layoutId="cal-mode" className="absolute inset-0 -z-10 rounded-[10px] bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line-soft" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5 rounded-xl bg-subtle p-0.5">
                <Link prefetch={false} href={`/calendrier?m=${shift(month, -1)}`} className="rounded-[10px] p-1.5 text-muted transition-all hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-xs)] active:scale-90" aria-label="Mois précédent"><ChevronLeft className="h-4 w-4" /></Link>
                <Link prefetch={false} href={`/calendrier?m=${today.slice(0, 7)}`} className="rounded-[10px] px-2.5 py-1 text-[13px] font-medium text-ink-soft transition-all hover:bg-surface hover:shadow-[var(--shadow-xs)]">Aujourd&apos;hui</Link>
                <Link prefetch={false} href={`/calendrier?m=${shift(month, 1)}`} className="rounded-[10px] p-1.5 text-muted transition-all hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-xs)] active:scale-90" aria-label="Mois suivant"><ChevronRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {mode === "month" ? (
              <motion.div key="grid" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985 }} transition={{ duration: 0.22 }} className="px-3 pb-4">
                <div className="grid grid-cols-7 gap-1.5 px-0.5 pb-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {WEEK.map((d) => <div key={d}>{d}</div>)}
                </div>
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div key={month} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" className="grid grid-cols-7 gap-1.5">
                    {days.slice(0, rows * 7).map((d, i) => {
                      const iso = d.toISOString().slice(0, 10);
                      const inMonth = d.getUTCMonth() === m - 1;
                      const evs = byDay.get(iso) ?? [];
                      const isToday = iso === today;
                      const isSel = iso === selected;
                      const hasLate = evs.some((e) => e.late);
                      return (
                        <motion.button
                          key={iso}
                          type="button"
                          onClick={() => setSelected(iso)}
                          initial={{ opacity: 0, y: 10, scale: 0.94 }}
                          animate={{ opacity: inMonth ? 1 : 0.5, y: 0, scale: 1 }}
                          transition={{ duration: 0.35, delay: Math.min(i * 0.011, 0.4), ease }}
                          whileHover={{ y: -3, transition: { duration: 0.15 } }}
                          whileTap={{ scale: 0.97 }}
                          aria-label={`${dayFmt.format(d)}${evs.length ? `, ${evs.length} événement${evs.length > 1 ? "s" : ""}` : ""}`}
                          aria-pressed={isSel}
                          className={cn(
                            "group relative flex min-h-[96px] flex-col gap-1 overflow-hidden rounded-2xl border p-2 text-left transition-[background-color,box-shadow,border-color] duration-200 max-sm:min-h-[58px]",
                            inMonth ? "border-line-soft bg-canvas/50 hover:border-line hover:bg-surface hover:shadow-[var(--shadow-md)]" : "border-transparent bg-transparent",
                            isSel && "border-transparent bg-surface shadow-[var(--shadow-md)]",
                          )}
                        >
                          {isSel && <motion.span layoutId="cal-sel" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-500/70" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                          <span className="flex items-center justify-between">
                            <span className={cn("relative flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-medium tabular", isToday ? "bg-gradient-to-br from-brand-500 to-violet-500 font-semibold text-white shadow-[0_4px_14px_-2px_rgb(59_110_245/0.55)]" : inMonth ? "text-ink" : "text-faint")}>
                              {isToday && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30 [animation-duration:2.4s]" />}
                              <span className="relative">{d.getUTCDate()}</span>
                            </span>
                            {evs.length > 0 && <span className={cn("rounded-full px-1.5 text-[10.5px] font-semibold tabular", hasLate ? "bg-rose-500/15 text-rose-600" : "bg-subtle text-muted")}>{evs.length}</span>}
                          </span>
                          <span className="hidden flex-col gap-1 sm:flex">
                            {evs.slice(0, 2).map((e) => (
                              <span key={e.id} className={cn("truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[10.5px] font-medium", KINDS[e.kind].bar)}>{e.title}</span>
                            ))}
                            {evs.length > 2 && <span className="px-1 text-[10.5px] font-medium text-muted">+{evs.length - 2} autres</span>}
                          </span>
                          <span className="mt-auto flex gap-1 sm:hidden">{evs.slice(0, 4).map((e) => <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", KINDS[e.kind].dot)} />)}</span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div key="agenda" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="px-5 pb-5">
                {agendaDays.length === 0 ? (
                  <p className="flex items-center gap-2 py-10 text-sm text-faint"><CalendarDays className="h-4 w-4" /> Aucun événement en {monthLongFmt.format(first)}.</p>
                ) : (
                  <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[27px] before:top-2 before:w-px before:bg-line-soft">
                    {agendaDays.map((iso, di) => {
                      const d = new Date(`${iso}T00:00:00Z`);
                      const isToday = iso === today;
                      return (
                        <motion.li key={iso} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: Math.min(di * 0.04, 0.5), ease }} className="relative flex gap-4">
                          <div className={cn("relative z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-center", isToday ? "border-transparent bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-[0_8px_20px_-6px_rgb(59_110_245/0.6)]" : "border-line-soft bg-surface text-ink")}>
                            <span className="text-lg font-semibold leading-none tabular">{d.getUTCDate()}</span>
                            <span className={cn("mt-0.5 text-[10px] font-medium uppercase", isToday ? "text-white/80" : "text-muted")}>{weekdayFmt.format(d).slice(0, 3)}</span>
                          </div>
                          <ul className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                            {(byDay.get(iso) ?? []).map((e) => (
                              <li key={e.id}>
                                <Link prefetch={false} href={e.href} className={cn("block rounded-xl border-l-[3px] px-3 py-2 transition-transform hover:translate-x-1", KINDS[e.kind].bar)}>
                                  <span className="block truncate text-[13px] font-medium">{e.title}{e.late ? " · en retard" : ""}</span>
                                  {e.detail && <span className="block truncate text-xs opacity-70">{e.detail}</span>}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </motion.li>
                      );
                    })}
                  </ol>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="space-y-4">
          {/* Détail du jour sélectionné */}
          <section className="overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-transparent px-5 py-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={selected ?? "none"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }} className="flex items-center gap-4">
                  {selDate ? (
                    <>
                      <span className="text-5xl font-semibold leading-none tracking-tight tabular text-ink">{selDate.getUTCDate()}</span>
                      <span>
                        <span className="block text-sm font-semibold capitalize text-ink">{weekdayFmt.format(selDate)}</span>
                        <span className="block text-xs capitalize text-muted">{monthLongFmt.format(selDate)}</span>
                        <span className="mt-1 block text-xs font-medium text-brand-600">{selEvents.length ? `${selEvents.length} événement${selEvents.length > 1 ? "s" : ""}` : "Journée libre"}</span>
                      </span>
                    </>
                  ) : <span className="text-sm font-semibold text-ink">Sélectionnez un jour</span>}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="p-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul key={selected ?? "none"} initial="hidden" animate="show" exit={{ opacity: 0 }} variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-1.5">
                  {selected && selEvents.length === 0 && (
                    <motion.li variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="flex items-center gap-2 px-2 py-3 text-[13px] text-faint"><CalendarDays className="h-4 w-4" /> Rien de prévu ce jour-là.</motion.li>
                  )}
                  {selEvents.map((e) => (
                    <motion.li key={e.id} variants={{ hidden: { opacity: 0, x: 14 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease } } }}>
                      <Link prefetch={false} href={e.href} className={cn("group flex items-start gap-2.5 rounded-xl border-l-[3px] px-3 py-2.5 transition-all hover:translate-x-0.5 hover:shadow-[var(--shadow-sm)]", KINDS[e.kind].bar)}>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium">{e.title}</span>
                          {e.detail && <span className="block truncate text-xs opacity-70">{e.detail}</span>}
                        </span>
                        {e.late && <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-rose-600">En retard</span>}
                      </Link>
                    </motion.li>
                  ))}
                </motion.ul>
              </AnimatePresence>
            </div>
          </section>

          {/* Filtres */}
          <section className="rounded-3xl border border-line-soft bg-surface p-5 shadow-[var(--shadow-sm)]">
            <p className="text-sm font-semibold text-ink">Filtrer</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(KINDS) as CalEvent["kind"][]).map((k) => {
                const n = events.filter((e) => e.kind === k).length;
                const off = hidden.has(k);
                return (
                  <li key={k}>
                    <motion.button
                      layout
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setHidden((s) => { const x = new Set(s); if (off) x.delete(k); else x.add(k); return x; })}
                      aria-pressed={!off}
                      className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors", off ? "border-line-soft bg-transparent text-faint line-through" : KINDS[k].chip)}
                    >
                      <AnimatePresence initial={false}>
                        {!off && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 12, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
                      </AnimatePresence>
                      {KINDS[k].label}
                      <span className="tabular opacity-70">{n}</span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
