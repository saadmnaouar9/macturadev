"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { inputBase } from "./field";
import { cn } from "@/lib/utils";

export interface ComboItem {
  value: string;
  label: string;
  sublabel?: string;
  meta?: string;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyText = "Aucun résultat",
  onCreate,
  createLabel = "Créer",
  id,
  invalid,
  className,
  renderTrigger,
}: {
  items: ComboItem[];
  value: string | null;
  onChange: (value: string, item: ComboItem) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onCreate?: (query: string) => void;
  createLabel?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
  renderTrigger?: (selected: ComboItem | undefined) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.value === value);

  const filtered = useMemo(() => {
    const n = normalize(q.trim());
    if (!n) return items.slice(0, 100);
    return items.filter((i) => normalize(`${i.label} ${i.sublabel ?? ""} ${i.meta ?? ""}`).includes(n)).slice(0, 100);
  }, [items, q]);

  const choose = (item: ComboItem) => {
    onChange(item.value, item);
    setOpen(false);
    setQ("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
      else if (onCreate && q.trim()) {
        onCreate(q.trim());
        setOpen(false);
      }
    }
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        {renderTrigger ? (
          <button type="button" id={id} className={className}>
            {renderTrigger(selected)}
          </button>
        ) : (
          <button
            type="button"
            id={id}
            aria-invalid={invalid || undefined}
            className={cn(inputBase, "flex h-9 items-center justify-between gap-2 text-left", className)}
          >
            <span className={cn("truncate", !selected && "text-faint")}>{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-line-soft px-3">
          <Search className="h-4 w-4 text-faint" />
          <input
            autoFocus
            dir="auto"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-72 overflow-y-auto p-1" role="listbox">
          {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted">{emptyText}</div>}
          {filtered.map((item, i) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={item.value === value}
              data-index={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                i === active ? "bg-subtle" : "",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{item.label}</div>
                {item.sublabel && <div className="truncate text-xs text-muted">{item.sublabel}</div>}
              </div>
              {item.meta && <span className="shrink-0 text-xs tabular text-muted">{item.meta}</span>}
              {item.value === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
            </button>
          ))}
        </div>
        {onCreate && (
          <div className="border-t border-line-soft p-1">
            <button
              type="button"
              onClick={() => {
                onCreate(q.trim());
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" />
              {createLabel}
              {q.trim() && <span className="truncate text-muted">« {q.trim()} »</span>}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
