"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const Ctx = createContext<{ pending: boolean; setParams: (patch: Record<string, string | null>) => void }>({ pending: false, setParams: () => {} });

/** Gère l'état des listes (recherche, filtres, tri, page) dans l'URL. */
export function ListState({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );
  return <Ctx.Provider value={{ pending, setParams }}>{children}</Ctx.Provider>;
}

export const useListState = () => useContext(Ctx);

export function SearchInput({ placeholder = "Rechercher…", className }: { placeholder?: string; className?: string }) {
  const params = useSearchParams();
  const { setParams, pending } = useListState();
  const [value, setValue] = useState(params.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setParams({ q: value.trim() || null }), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-faint" />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      )}
      <input
        dir="auto"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-sm text-ink shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] placeholder:text-faint hover:border-white/20 focus:border-brand-400 focus:shadow-[var(--shadow-focus)] focus:outline-none"
      />
      {value && (
        <button onClick={() => setValue("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink" aria-label="Effacer la recherche">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Onglets de filtre avec indicateur animé et compteurs. */
export function FilterTabs({ param = "status", options, layoutId }: { param?: string; options: { value: string; label: string; count?: number }[]; layoutId: string }) {
  const params = useSearchParams();
  const { setParams } = useListState();
  const current = params.get(param) ?? "";
  return (
    <div className="scrollbar-thin -mx-1 flex gap-0.5 overflow-x-auto px-1">
      {options.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value || "all"}
            onClick={() => setParams({ [param]: o.value || null })}
            className={cn("relative flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}
          >
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-md bg-subtle ring-1 ring-inset ring-line" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && (
              <span className={cn("relative rounded px-1 text-[11px] tabular", active ? "bg-surface text-ink-soft" : "text-faint")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SortHeader({ field, children, align = "left", className }: { field: string; children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  const params = useSearchParams();
  const { setParams } = useListState();
  const sort = params.get("sort");
  const dir = params.get("dir") ?? "desc";
  const active = sort === field;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-4 py-2.5 text-left text-[12px] font-medium text-muted first:pl-5 last:pr-5", align === "right" && "text-right", className)}>
      <button
        onClick={() => setParams({ sort: field, dir: active && dir === "desc" ? "asc" : "desc" })}
        className={cn("group inline-flex items-center gap-1 rounded transition-colors hover:text-ink", active && "text-ink", align === "right" && "flex-row-reverse")}
      >
        {children}
        <Icon className={cn("h-3.5 w-3.5 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-60")} />
      </button>
    </th>
  );
}

export function Th({ children, align = "left", className }: { children?: React.ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <th scope="col" className={cn("px-4 py-2.5 text-left text-[12px] font-medium text-muted first:pl-5 last:pr-5", align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </th>
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useListState();
  return (
    <div className={cn("relative overflow-x-auto transition-opacity duration-200", pending && "opacity-60", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-y border-line-soft bg-canvas/70">
      <tr>{children}</tr>
    </thead>
  );
}

export function Row({ children, href, index = 0, className }: { children: React.ReactNode; href?: string; index?: number; className?: string }) {
  const router = useRouter();
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 12) * 0.022, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => {
        if (!href) return;
        const target = e.target as HTMLElement;
        if (target.closest("a,button,[role=menuitem],[data-no-row-click]")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
      className={cn("group border-b border-line-soft transition-colors last:border-0", href && "cursor-pointer hover:bg-white/[0.04]", className)}
    >
      {children}
    </motion.tr>
  );
}

export function Td({ children, align = "left", className }: { children?: React.ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", align === "right" && "text-right", align === "center" && "text-center", className)}>{children}</td>;
}

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const { setParams } = useListState();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line-soft px-5 py-3 sm:flex-row">
      <p className="text-[13px] text-muted">
        <span className="tabular font-medium text-ink-soft">{from}–{to}</span> sur <span className="tabular font-medium text-ink-soft">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} className="rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-30" aria-label="Page précédente">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-faint">…</span>
          ) : (
            <button
              key={n}
              onClick={() => setParams({ page: String(n) })}
              aria-current={n === page ? "page" : undefined}
              className={cn("h-7 min-w-7 rounded-md px-2 text-[13px] font-medium tabular transition-colors", n === page ? "bg-brand-500 text-white" : "text-muted hover:bg-subtle hover:text-ink")}
            >
              {n}
            </button>
          ),
        )}
        <button disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })} className="rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-30" aria-label="Page suivante">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function RowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium text-ink hover:text-brand-700", className)}>
      {children}
    </Link>
  );
}
