"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "@/components/ui/fast-link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { SEGMENT_LABELS } from "./nav";

const Ctx = createContext<{ labels: Record<string, string>; setLabel: (path: string, label: string) => void }>({
  labels: {},
  setLabel: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const setLabel = (path: string, label: string) => setLabels((l) => (l[path] === label ? l : { ...l, [path]: label }));
  return <Ctx.Provider value={{ labels, setLabel }}>{children}</Ctx.Provider>;
}

/** Permet à une page de donner un libellé lisible au segment dynamique courant. */
export function SetBreadcrumb({ path, label }: { path: string; label: string }) {
  const { setLabel } = useContext(Ctx);
  useEffect(() => setLabel(path, label), [path, label, setLabel]);
  return null;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { labels } = useContext(Ctx);
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = labels[href] ?? SEGMENT_LABELS[seg] ?? (seg.length > 12 ? "Détail" : seg);
    return { href, label };
  });
  const parentNew = segments[segments.length - 1] === "new";
  if (parentNew && crumbs.length >= 2) {
    const parent = segments[segments.length - 2];
    crumbs[crumbs.length - 1].label = { clients: "Nouveau client", devis: "Nouveau devis", factures: "Nouvelle facture" }[parent] ?? "Nouveau";
  }

  return (
    <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1 text-[13px]">
      <AnimatePresence initial={false} mode="popLayout">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <motion.span
              key={c.href}
              layout="position"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`flex min-w-0 items-center gap-1 ${!last ? "hidden sm:flex" : ""}`}
            >
              {i > 0 && <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-faint sm:block" />}
              {last ? (
                <span className="truncate text-[15px] font-semibold tracking-tight text-ink">{c.label}</span>
              ) : (
                <Link href={c.href} className="truncate rounded px-1 py-0.5 text-muted transition-colors hover:bg-subtle hover:text-ink">
                  {c.label}
                </Link>
              )}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </nav>
  );
}
