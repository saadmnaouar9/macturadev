"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
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

const KINDS: Record<CalEvent["kind"], { label: string; chip: string; dot: string }> = {
  invoice: { label: "Échéances clients", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200/70", dot: "bg-emerald-500" },
  purchase: { label: "À payer (fournisseurs)", chip: "bg-accent-50 text-accent-600 ring-accent-100", dot: "bg-accent-500" },
  quote: { label: "Expirations de devis", chip: "bg-amber-50 text-amber-800 ring-amber-200/70", dot: "bg-amber-500" },
  task: { label: "Tâches", chip: "bg-brand-50 text-brand-700 ring-brand-200/70", dot: "bg-brand-600" },
  contract: { label: "Fins de contrat", chip: "bg-violet-50 text-violet-700 ring-violet-200/70", dot: "bg-violet-500" },
  project: { label: "Fins de projet", chip: "bg-sky-50 text-sky-700 ring-sky-200/70", dot: "bg-sky-500" },
  prospect: { label: "Relances prospects", chip: "bg-rose-50 text-rose-700 ring-rose-200/70", dot: "bg-rose-500" },
};
const WEEK = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function shift(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export function CalendarView({ month, events, today }: { month: string; events: CalEvent[]; today: string }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(today.startsWith(month) ? today : null);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - offset + i)));
  const visible = useMemo(() => events.filter((e) => !hidden.has(e.kind)), [events, hidden]);
  const byDay = useMemo(() => { const map = new Map<string, CalEvent[]>(); visible.forEach((e) => map.set(e.date, [...(map.get(e.date) ?? []), e])); return map; }, [visible]);
  const selEvents = selected ? byDay.get(selected) ?? [] : [];
  const rows = days[35].getUTCMonth() === m - 1 ? 6 : 5;

  return (
    <>
      <PageHeader title="Calendrier" description="Échéances, relances et rendez-vous de tous vos modules, au même endroit." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <h2 className="text-[15px] font-semibold capitalize text-ink">{monthFmt.format(first)}</h2>
            <div className="flex items-center gap-1">
              <Link prefetch={false} href={`/calendrier?m=${shift(month, -1)}`} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Mois précédent"><ChevronLeft className="h-4 w-4" /></Link>
              <Link prefetch={false} href={`/calendrier?m=${today.slice(0, 7)}`} className="rounded-md px-2.5 py-1 text-[13px] font-medium text-ink-soft hover:bg-subtle">Aujourd&apos;hui</Link>
              <Link prefetch={false} href={`/calendrier?m=${shift(month, 1)}`} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Mois suivant"><ChevronRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line-soft bg-canvas/70 text-center text-[11px] font-medium uppercase tracking-[0.05em] text-muted">
            {WEEK.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={month} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="grid grid-cols-7">
              {days.slice(0, rows * 7).map((d, i) => {
                const iso = d.toISOString().slice(0, 10);
                const inMonth = d.getUTCMonth() === m - 1;
                const evs = byDay.get(iso) ?? [];
                const isToday = iso === today;
                const isSel = iso === selected;
                return (
                  <button
                    key={iso}
                    onClick={() => setSelected(iso)}
                    aria-label={`${dayFmt.format(d)}${evs.length ? `, ${evs.length} événement${evs.length > 1 ? "s" : ""}` : ""}`}
                    aria-pressed={isSel}
                    className={cn("flex min-h-[92px] flex-col gap-1 border-b border-r border-line-soft p-1.5 text-left transition-colors hover:bg-subtle max-sm:min-h-[56px]", (i + 1) % 7 === 0 && "border-r-0", !inMonth && "bg-canvas/40", isSel && "bg-brand-50/50")}
                  >
                    <span className={cn("flex h-6 w-6 items-center justify-center self-start rounded-full text-xs tabular", isToday ? "bg-brand-500 font-semibold text-white" : inMonth ? "text-ink" : "text-faint")}>{d.getUTCDate()}</span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {evs.slice(0, 2).map((e) => <span key={e.id} className={cn("truncate rounded px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset", KINDS[e.kind].chip, e.late && "ring-rose-300")}>{e.title}</span>)}
                      {evs.length > 2 && <span className="px-1 text-[10.5px] font-medium text-muted">+{evs.length - 2} autres</span>}
                    </span>
                    <span className="flex gap-0.5 sm:hidden">{evs.slice(0, 4).map((e) => <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", KINDS[e.kind].dot)} />)}</span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold capitalize text-ink">{selected ? dayFmt.format(new Date(`${selected}T00:00:00Z`)) : "Sélectionnez un jour"}</p>
            {selected && selEvents.length === 0 && <p className="mt-3 flex items-center gap-2 text-[13px] text-faint"><CalendarDays className="h-4 w-4" /> Rien de prévu ce jour-là.</p>}
            <ul className="mt-3 space-y-2">
              {selEvents.map((e) => (
                <li key={e.id}>
                  <Link prefetch={false} href={e.href} className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-subtle">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", KINDS[e.kind].dot)} />
                    <span className="min-w-0">
                      <span className={cn("block text-[13px] font-medium", e.late ? "text-rose-700" : "text-ink")}>{e.title}{e.late ? " · en retard" : ""}</span>
                      {e.detail && <span className="block truncate text-xs text-muted">{e.detail}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Filtrer</p>
            <ul className="mt-3 space-y-1">
              {(Object.keys(KINDS) as CalEvent["kind"][]).map((k) => {
                const n = events.filter((e) => e.kind === k).length;
                const off = hidden.has(k);
                return (
                  <li key={k}>
                    <button onClick={() => setHidden((s) => { const x = new Set(s); off ? x.delete(k) : x.add(k); return x; })} aria-pressed={!off} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-subtle">
                      <span className={cn("h-2.5 w-2.5 rounded-full transition-opacity", KINDS[k].dot, off && "opacity-25")} />
                      <span className={cn("flex-1", off ? "text-faint line-through" : "text-ink-soft")}>{KINDS[k].label}</span>
                      <span className="text-xs tabular text-faint">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
