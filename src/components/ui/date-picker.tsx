"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { inputBase } from "./field";
import { cn, formatDate, toDateInput, todayUTC } from "@/lib/utils";

const WEEKDAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function DatePicker({
  value,
  onChange,
  id,
  invalid,
  placeholder = "Choisir une date",
  className,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00Z`) : null;
  const [month, setMonth] = useState(() => startOfMonth(selected ?? todayUTC()));
  const [dir, setDir] = useState(0);
  const today = toDateInput(todayUTC());

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
    const start = new Date(first);
    start.setUTCDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d;
    });
  }, [month]);

  const shift = (n: number) => {
    setDir(n);
    setMonth((m) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + n, 1)));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(startOfMonth(selected ?? todayUTC()));
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          aria-describedby={aria["aria-describedby"]}
          className={cn(inputBase, "flex h-9 items-center gap-2 text-left", !value && "text-faint", className)}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-faint" />
          <span className="truncate">{selected ? formatDate(selected, "long") : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[308px] overflow-hidden rounded-lg p-0" align="start">
        {/* En-tête : mois courant sur fond dégradé, navigation animée */}
        <div className="flex items-center justify-between  px-3 py-3">
          <button type="button" onClick={() => shift(-1)} className="rounded-xl p-2 text-muted transition-all hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-xs)] active:scale-90" aria-label="Mois précédent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="relative h-6 min-w-[140px] overflow-hidden text-center">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div key={month.toISOString()} custom={dir} initial={{ opacity: 0, y: dir * 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: dir * -14 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="text-sm font-semibold capitalize leading-6 text-ink">
                {monthFmt.format(month)}
              </motion.div>
            </AnimatePresence>
          </div>
          <button type="button" onClick={() => shift(1)} className="rounded-xl p-2 text-muted transition-all hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-xs)] active:scale-90" aria-label="Mois suivant">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 pb-3 pt-2">
          <div className="grid grid-cols-7 gap-1 pb-1.5 text-center text-[10.5px] font-semibold text-faint">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={month.toISOString()}
                custom={dir}
                initial={{ opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -28 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-7 gap-1"
              >
                {days.map((d) => {
                  const iso = toDateInput(d);
                  const inMonth = d.getUTCMonth() === month.getUTCMonth();
                  const isSel = iso === value;
                  const isToday = iso === today;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                      aria-label={formatDate(d, "long")}
                      aria-pressed={isSel}
                      className={cn(
                        "relative flex h-9 items-center justify-center rounded-xl text-[13px] tabular transition-all duration-150",
                        inMonth ? "text-ink" : "text-faint/60",
                        isSel
                          ? "bg-brand-500 font-semibold text-white"
                          : "hover:scale-110 hover:bg-brand-500/10 hover:text-brand-700",
                        isToday && !isSel && "font-semibold text-brand-700 ring-1 ring-inset ring-brand-500/50",
                      )}
                    >
                      {d.getUTCDate()}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line-soft bg-canvas/40 px-3 py-2">
          <button type="button" className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-500/10" onClick={() => { onChange(today); setOpen(false); }}>
            Aujourd&apos;hui
          </button>
          <button type="button" className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-subtle hover:text-ink" onClick={() => setOpen(false)}>
            Fermer
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
