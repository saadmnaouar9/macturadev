"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { inputBase } from "./field";
import { cn, formatDate, toDateInput, todayUTC } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
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
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
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
          className={cn(inputBase, "flex h-9 items-center gap-2 text-left", !value && "text-faint")}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-faint" />
          <span className="truncate">{selected ? formatDate(selected, "long") : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[296px] p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Mois précédent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold capitalize text-ink">{monthFmt.format(month)}</div>
          <button type="button" onClick={() => shift(1)} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Mois suivant">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[11px] font-medium text-faint">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="py-1">{d}</div>
          ))}
        </div>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={month.toISOString()}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-7 gap-0.5"
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
                    className={cn(
                      "relative flex h-9 items-center justify-center rounded-md text-[13px] tabular transition-colors",
                      inMonth ? "text-ink" : "text-faint/70",
                      isSel ? "bg-brand-500 font-semibold text-white shadow-sm" : "hover:bg-subtle",
                      isToday && !isSel && "font-semibold text-brand-700",
                    )}
                  >
                    {d.getUTCDate()}
                    {isToday && !isSel && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-500" />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-2 flex justify-between border-t border-line-soft pt-2">
          <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50" onClick={() => { onChange(today); setOpen(false); }}>
            Aujourd&apos;hui
          </button>
          <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-subtle" onClick={() => setOpen(false)}>
            Fermer
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
