"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/fast-link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { AlertTriangle, ArrowUpRight, CalendarCheck2, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, ListTodo, SlidersHorizontal } from "lucide-react";
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

/** text : couleur du libellé · dot : pastille · chip : fond/bordure de la pastille de filtre active */
const KINDS: Record<CalEvent["kind"], { label: string; text: string; dot: string; chip: string }> = {
  invoice: { label: "Échéances clients", text: "text-emerald-700", dot: "bg-emerald-500", chip: "border-emerald-500/35 bg-emerald-500/10" },
  purchase: { label: "À payer (fournisseurs)", text: "text-accent-600", dot: "bg-accent-500", chip: "border-accent-500/35 bg-accent-500/10" },
  quote: { label: "Expirations de devis", text: "text-amber-700", dot: "bg-amber-500", chip: "border-amber-500/35 bg-amber-500/10" },
  task: { label: "Tâches", text: "text-brand-700", dot: "bg-brand-500", chip: "border-brand-500/35 bg-brand-500/10" },
  contract: { label: "Fins de contrat", text: "text-brand-700", dot: "bg-brand-500", chip: "border-brand-500/35 bg-brand-500/10" },
  project: { label: "Fins de projet", text: "text-brand-700", dot: "bg-brand-500", chip: "border-brand-500/35 bg-brand-500/10" },
  prospect: { label: "Relances prospects", text: "text-rose-700", dot: "bg-rose-500", chip: "border-rose-500/35 bg-rose-500/10" },
};
const WEEK = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const yearFmt = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
const monthLongFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const ease = [0.16, 1, 0.3, 1] as const;
/** Intensité de la teinte d'un jour selon le nombre d'événements (carte de chaleur) */
const HEAT = [0, 0.05, 0.09, 0.13, 0.18];

function shift(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
const dayDiff = (iso: string, today: string) => Math.round((Date.parse(iso) - Date.parse(today)) / 86400000);

function relLabel(iso: string, today: string, late?: boolean) {
  const d = dayDiff(iso, today);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  if (d > 1) return `Dans ${d} j`;
  return late ? `${-d} j de retard` : `Il y a ${-d} j`;
}

const slide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40, filter: "blur(6px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.4, ease } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40, filter: "blur(6px)", transition: { duration: 0.18 } }),
};
const listVariants: Variants = { show: { transition: { staggerChildren: 0.05 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } } };

function MiniStat({ icon: Icon, label, value, tone }: { icon: typeof CalendarDays; label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 px-3 first:pl-0 last:pr-0 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone)}><Icon className="h-5 w-5" /></span>
      <div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p key={value} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.25 }} className="text-2xl font-semibold leading-none tabular text-ink">{value}</motion.p>
        </AnimatePresence>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function EventRow({ e, today, compact }: { e: CalEvent; today: string; compact?: boolean }) {
  return (
    <Link href={e.href} className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-subtle">
      <span className="mt-1.5 flex shrink-0 flex-col items-center"><span className={cn("h-2.5 w-2.5 rounded-full ring-4 ring-subtle", KINDS[e.kind].dot)} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{e.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className={cn("font-medium", KINDS[e.kind].text)}>{KINDS[e.kind].label}</span>
          {!compact && e.detail && <span className="truncate">{e.detail}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", e.late ? "text-muted" : "bg-subtle text-muted")}>{relLabel(e.date, today, e.late)}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-faint opacity-0 transition-all group-hover:translate-x-0.5 group- group-hover:opacity-100" />
      </span>
    </Link>
  );
}

export function CalendarView({ month, events, today }: { month: string; events: CalEvent[]; today: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [selected, setSelected] = useState<string>(today.startsWith(month) ? today : `${month}-01`);
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
  const selEvents = byDay.get(selected) ?? [];
  const selDate = new Date(`${selected}T00:00:00Z`);

  // Prochaines échéances : retards d'abord, puis à venir (toutes périodes chargées)
  const upcoming = useMemo(() => {
    const late = visible.filter((e) => e.late).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    const next = visible.filter((e) => !e.late && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    return [...late, ...next];
  }, [visible, today]);

  // Agenda : regroupement par urgence
  const groups = useMemo(() => {
    const g: { key: string; title: string; tone: string; items: CalEvent[] }[] = [
      { key: "late", title: "En retard", tone: "text-rose-600", items: [] },
      { key: "today", title: "Aujourd'hui", tone: "text-brand-600", items: [] },
      { key: "week", title: "Cette semaine", tone: "text-ink", items: [] },
      { key: "later", title: "Plus tard", tone: "text-ink", items: [] },
      { key: "past", title: "Passés", tone: "text-faint", items: [] },
    ];
    [...inThisMonth].sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
      const d = dayDiff(e.date, today);
      const k = e.late ? "late" : d === 0 ? "today" : d > 0 && d <= 7 ? "week" : d > 7 ? "later" : "past";
      g.find((x) => x.key === k)!.items.push(e);
    });
    return g.filter((x) => x.items.length);
  }, [inThisMonth, today]);

  return (
    <>
      <PageHeader title="Calendrier" description="Échéances, relances et rendez-vous de tous vos modules, au même endroit." />

      {/* Filtre par type : barre compacte, sur une seule ligne, juste sous le titre */}
      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} aria-label="Filtrer par type" className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-surface/80 p-1.5 pl-3.5 shadow-[var(--shadow-sm)] backdrop-blur-sm">
        <span className="flex shrink-0 items-center gap-2 border-r border-line-soft pr-3 text-[13px] font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white"><SlidersHorizontal className="h-3.5 w-3.5" /></span>
          <span className="hidden sm:inline">Filtrer</span>
        </span>
        <ul className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
          {(Object.keys(KINDS) as CalEvent["kind"][]).map((k) => {
            const n = events.filter((e) => e.kind === k).length;
            const off = hidden.has(k);
            return (
              <li key={k} className="shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setHidden((s) => { const x = new Set(s); if (off) x.delete(k); else x.add(k); return x; })}
                  aria-pressed={!off}
                  className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[12.5px] font-medium transition-all duration-200", off ? "border-transparent bg-transparent text-faint hover:bg-subtle" : cn(KINDS[k].chip, "text-ink hover:shadow-[var(--shadow-sm)]"))}
                >
                  <span className={cn("h-2 w-2 rounded-full transition-all", KINDS[k].dot, off && "scale-75 opacity-30")} />
                  <span className={cn(off && "line-through")}>{KINDS[k].label}</span>
                  <span className={cn("text-[11px] font-semibold tabular", off ? "text-faint" : "text-muted")}>{n}</span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </motion.section>

      {/* Bandeau : mois, vue, navigation, chiffres clés */}
      <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="relative mb-4 overflow-hidden rounded-xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
        <div className="relative flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-0.5 rounded-lg bg-subtle p-1">
              <Link href={`/calendrier?m=${shift(month, -1)}`} className="rounded-xl p-2 text-muted transition-all hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-xs)] active:scale-90" aria-label="Mois précédent"><ChevronLeft className="h-4 w-4" /></Link>
              <Link href={`/calendrier?m=${today.slice(0, 7)}`} className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-all hover:bg-surface hover:shadow-[var(--shadow-xs)]">Aujourd&apos;hui</Link>
              <Link href={`/calendrier?m=${shift(month, 1)}`} className="rounded-xl p-2 text-muted transition-all hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-xs)] active:scale-90" aria-label="Mois suivant"><ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="overflow-hidden">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.h2 key={month} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" className="text-3xl font-semibold capitalize tracking-tight text-ink">
                  {monthFmt.format(first)} <span className="font-normal text-faint">{yearFmt.format(first)}</span>
                </motion.h2>
              </AnimatePresence>
            </div>
            <div role="tablist" aria-label="Affichage" className="relative flex rounded-lg bg-subtle p-1">
              {([["month", "Mois", LayoutGrid], ["agenda", "Agenda", ListTodo]] as const).map(([k, label, Icon]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cn("relative flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-medium transition-colors", mode === k ? "text-ink" : "text-muted hover:text-ink")}>
                  {mode === k && <motion.span layoutId="cal-mode" className="absolute inset-0 rounded-xl bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line-soft" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                  <Icon className="relative h-3.5 w-3.5" /> <span className="relative">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid w-full grid-cols-3 divide-x divide-line-soft xl:flex xl:w-auto xl:items-center">
            <MiniStat icon={CalendarDays} label={`Événements en ${monthFmt.format(first)}`} value={inThisMonth.length} tone="text-muted" />
            <MiniStat icon={AlertTriangle} label="En retard" value={lateCount} tone="text-muted" />
            <MiniStat icon={CalendarCheck2} label="Aujourd'hui" value={todayCount} tone="text-muted" />
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
          <AnimatePresence mode="wait" initial={false}>
            {mode === "month" ? (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="grid grid-cols-7 border-b border-line-soft bg-canvas/50 text-center text-[11px] font-semibold text-faint">
                  {WEEK.map((d) => <div key={d} className="py-3">{d}</div>)}
                </div>
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div key={month} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" className="grid grid-cols-7 gap-px bg-line-soft">
                    {days.slice(0, rows * 7).map((d, i) => {
                      const iso = d.toISOString().slice(0, 10);
                      const inMonth = d.getUTCMonth() === m - 1;
                      const evs = byDay.get(iso) ?? [];
                      const isToday = iso === today;
                      const isSel = iso === selected;
                      const heat = HEAT[Math.min(evs.length, HEAT.length - 1)];
                      const col = i % 7;
                      const row = Math.floor(i / 7);
                      return (
                        <motion.button
                          key={iso}
                          type="button"
                          onClick={() => setSelected(iso)}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4, delay: Math.min((col + row) * 0.04, 0.45) }}
                          aria-label={`${dayFmt.format(d)}${evs.length ? `, ${evs.length} événement${evs.length > 1 ? "s" : ""}` : ""}`}
                          aria-pressed={isSel}
                          style={{ backgroundImage: heat && inMonth ? `linear-gradient(rgb(59 110 245 / ${heat}), rgb(59 110 245 / ${heat}))` : undefined }}
                          className={cn("group relative flex min-h-[104px] flex-col gap-1.5 bg-surface p-2 text-left transition-colors hover:bg-brand-500/[0.07] max-sm:min-h-[60px]", !inMonth && "bg-canvas/60 opacity-60")}
                        >
                          {isSel && <motion.span layoutId="cal-sel" className="pointer-events-none absolute inset-0 z-10 ring-2 ring-inset ring-brand-500" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                          <span className="flex items-center justify-between">
                            <span className={cn("relative flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[13px] font-medium tabular", isToday ? "bg-brand-500 font-semibold text-white" : "text-ink-soft")}>
                              {d.getUTCDate()}
                            </span>
                            {evs.some((e) => e.late) && <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />}
                          </span>
                          <span className="hidden flex-col gap-1 sm:flex">
                            {evs.slice(0, 3).map((e) => (
                              <span key={e.id} className="flex items-center gap-1.5 text-[11px] leading-4">
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", KINDS[e.kind].dot)} />
                                <span className={cn("truncate font-medium", KINDS[e.kind].text)}>{e.title}</span>
                              </span>
                            ))}
                            {evs.length > 3 && <span className="pl-3 text-[10.5px] font-semibold text-muted">+{evs.length - 3} autres</span>}
                          </span>
                          <span className="mt-auto flex gap-1 sm:hidden">{evs.slice(0, 4).map((e) => <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", KINDS[e.kind].dot)} />)}</span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
                <div className="flex items-center justify-end gap-2 border-t border-line-soft px-4 py-2.5 text-[11px] text-faint">
                  Moins
                  {HEAT.map((h, i) => <span key={i} className="h-3 w-5 rounded-[4px] ring-1 ring-inset ring-line-soft" style={{ backgroundColor: i ? `rgb(59 110 245 / ${Math.max(h * 2.2, 0.1)})` : "transparent" }} />)}
                  Plus
                </div>
              </motion.div>
            ) : (
              <motion.div key="agenda" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="p-4 sm:p-6">
                {groups.length === 0 ? (
                  <p className="flex items-center gap-2 py-12 text-sm text-faint"><CalendarDays className="h-4 w-4" /> Aucun événement en {monthLongFmt.format(first)}.</p>
                ) : (
                  <div className="space-y-6">
                    {groups.map((g) => (
                      <div key={g.key}>
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className={cn("text-[11px] font-semibold", g.tone)}>{g.title}</h3>
                          <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold tabular text-muted">{g.items.length}</span>
                          <span className="h-px flex-1 bg-line-soft" />
                        </div>
                        <motion.ul initial="hidden" animate="show" variants={listVariants} className="space-y-0.5">
                          {g.items.map((e) => (
                            <motion.li key={e.id} variants={itemVariants} className="flex items-center gap-1">
                              <span className="w-14 shrink-0 text-right text-xs font-medium tabular text-faint">{shortFmt.format(new Date(`${e.date}T00:00:00Z`))}</span>
                              <div className="min-w-0 flex-1"><EventRow e={e} today={today} /></div>
                            </motion.li>
                          ))}
                        </motion.ul>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="space-y-4">
          {/* Jour sélectionné : chronologie */}
          <section className="overflow-hidden rounded-xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-4 border-b border-line-soft  px-5 py-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={selected} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex items-center gap-4">
                  <span className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-surface shadow-[var(--shadow-sm)] ring-1 ring-line-soft">
                    <span className="text-[10px] font-semibold leading-none text-brand-600">{weekdayFmt.format(selDate).slice(0, 3)}</span>
                    <span className="mt-0.5 text-2xl font-semibold leading-none tabular text-ink">{selDate.getUTCDate()}</span>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold capitalize text-ink">{weekdayFmt.format(selDate)} {selDate.getUTCDate()} {monthFmt.format(selDate)}</span>
                    <span className="block text-xs text-muted">{selEvents.length ? `${selEvents.length} événement${selEvents.length > 1 ? "s" : ""}` : "Journée libre"}{selected === today ? " · aujourd'hui" : ""}</span>
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="p-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul key={selected} initial="hidden" animate="show" exit={{ opacity: 0 }} variants={listVariants} className="relative">
                  {selEvents.length === 0 && (
                    <motion.li variants={itemVariants} className="flex items-center gap-2 px-3 py-5 text-[13px] text-faint"><CalendarDays className="h-4 w-4" /> Rien de prévu ce jour-là.</motion.li>
                  )}
                  {selEvents.map((e) => (
                    <motion.li key={e.id} variants={itemVariants}><EventRow e={e} today={today} /></motion.li>
                  ))}
                </motion.ul>
              </AnimatePresence>
            </div>
          </section>

          {/* Prochaines échéances */}
          <section className="rounded-xl border border-line-soft bg-surface p-2 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 px-3 pb-1 pt-3">
              <CalendarClock className="h-4 w-4 text-brand-600" />
              <p className="text-sm font-semibold text-ink">Prochaines échéances</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="px-3 py-4 text-[13px] text-faint">Aucune échéance à venir.</p>
            ) : (
              <motion.ul initial="hidden" animate="show" variants={listVariants} key={`${month}-${hidden.size}`}>
                {upcoming.map((e) => <motion.li key={e.id} variants={itemVariants}><EventRow e={e} today={today} compact /></motion.li>)}
              </motion.ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
