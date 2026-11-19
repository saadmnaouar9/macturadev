"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, FileText, Loader2, Package, Plus, Receipt, Search, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_NAV } from "./nav";

interface Result {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  meta?: string;
  href: string;
  icon: LucideIcon;
}

interface ApiResult {
  customers: { id: string; name: string; city: string | null; email: string | null }[];
  invoices: { id: string; number: string | null; customer: string; total: string }[];
  quotes: { id: string; number: string; customer: string; total: string }[];
  products: { id: string; name: string; price: string; type: string }[];
  suppliers?: { id: string; name: string; city: string | null }[];
  prospects?: { id: string; name: string; contact: string | null }[];
}

export function CommandPalette({ open, onOpenChange, canWrite }: { open: boolean; onOpenChange: (o: boolean) => void; canWrite: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setData(null);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch {
        /* requête annulée */
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const nav: Result[] = ALL_NAV
      .filter((n) => !term || n.label.toLowerCase().includes(term))
      .map((n) => ({ id: `nav-${n.href}`, group: "Navigation", label: n.label, href: n.href, icon: n.icon }));
    const actions: Result[] = canWrite
      ? [
          { id: "a-inv", group: "Actions", label: "Nouvelle facture", href: "/factures/new", icon: Plus },
          { id: "a-quo", group: "Actions", label: "Nouveau devis", href: "/devis/new", icon: Plus },
          { id: "a-cus", group: "Actions", label: "Nouveau client", href: "/clients/new", icon: Plus },
          { id: "a-pro", group: "Actions", label: "Nouveau produit ou service", href: "/produits?new=1", icon: Plus },
          { id: "a-pros", group: "Actions", label: "Nouveau prospect", href: "/prospects?new=1", icon: Plus },
          { id: "a-ach", group: "Actions", label: "Nouvelle facture d'achat", href: "/achats?new=1", icon: Plus },
          { id: "a-tas", group: "Actions", label: "Nouvelle tâche", href: "/taches?new=1", icon: Plus },
        ].filter((a) => !term || a.label.toLowerCase().includes(term))
      : [];
    const remote: Result[] = data
      ? [
          ...data.customers.map((c) => ({ id: `c-${c.id}`, group: "Clients", label: c.name, sublabel: [c.city, c.email].filter(Boolean).join(" · "), href: `/clients/${c.id}`, icon: Users })),
          ...data.invoices.map((i) => ({ id: `i-${i.id}`, group: "Factures", label: i.number ?? "Brouillon", sublabel: i.customer, meta: i.total, href: `/factures/${i.id}`, icon: Receipt })),
          ...data.quotes.map((d) => ({ id: `q-${d.id}`, group: "Devis", label: d.number, sublabel: d.customer, meta: d.total, href: `/devis/${d.id}`, icon: FileText })),
          ...(data.suppliers ?? []).map((s) => ({ id: `s-${s.id}`, group: "Fournisseurs", label: s.name, sublabel: s.city ?? undefined, href: `/fournisseurs?q=${encodeURIComponent(s.name)}`, icon: Package })),
          ...(data.prospects ?? []).map((p) => ({ id: `r-${p.id}`, group: "Prospects", label: p.name, sublabel: p.contact ?? undefined, href: `/prospects?edit=${p.id}`, icon: Users })),
          ...data.products.map((p) => ({ id: `p-${p.id}`, group: "Produits & Services", label: p.name, sublabel: p.type, meta: p.price, href: `/produits?edit=${p.id}`, icon: Package })),
        ]
      : [];
    return term ? [...remote, ...actions, ...nav] : [...actions, ...nav];
  }, [q, data, canWrite]);

  useEffect(() => setActive(0), [results.length]);

  const go = (r: Result) => {
    onOpenChange(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-[#020617]/65 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
            </D.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex justify-center px-3 pt-[12vh]">
              <D.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="pointer-events-auto flex h-fit max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-popover shadow-[var(--shadow-ring),0_24px_64px_-12px_rgb(16_18_35/0.3)] focus:outline-none"
                >
                  <D.Title className="sr-only">Recherche</D.Title>
                  <D.Description className="sr-only">Rechercher des clients, factures, devis et produits</D.Description>
                  <div className="flex items-center gap-3 border-b border-line-soft px-4">
                    {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin text-faint" /> : <Search className="h-[18px] w-[18px] text-faint" />}
                    <input
                      autoFocus
                      dir="auto"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Rechercher un client, une facture, un devis, un produit…"
                      className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
                    />
                    <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 text-[11px] text-muted">Échap</kbd>
                  </div>
                  <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto p-2">
                    {results.length === 0 && !loading && (
                      <div className="px-4 py-10 text-center text-sm text-muted">Aucun résultat pour « {q} »</div>
                    )}
                    {results.map((r, i) => {
                      const header = r.group !== lastGroup ? r.group : null;
                      lastGroup = r.group;
                      return (
                        <div key={r.id}>
                          {header && <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint first:pt-1">{header}</div>}
                          <button
                            data-idx={i}
                            onMouseMove={() => setActive(i)}
                            onClick={() => go(r)}
                            className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors", active === i ? "bg-subtle" : "")}
                          >
                            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", active === i ? "bg-surface text-brand-700 ring-line" : "bg-subtle text-muted ring-transparent")}>
                              <r.icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{r.label}</span>
                              {r.sublabel && <span className="block truncate text-xs text-muted">{r.sublabel}</span>}
                            </span>
                            {r.meta && <span className="shrink-0 text-xs font-medium tabular text-muted">{r.meta}</span>}
                            {active === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 border-t border-line-soft bg-canvas/60 px-4 py-2 text-[11px] text-faint">
                    <span>↑↓ naviguer</span>
                    <span>↵ ouvrir</span>
                    <span className="ml-auto">⌘K pour ouvrir / fermer</span>
                  </div>
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
