"use client";

import Link from "@/components/ui/fast-link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { CardApi } from "@/components/data/resource-view";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";

type Row = { id: string } & Record<string, unknown>;

const DAY = 86400000;
/** Échéance du projet : « Dans 12 j », « 3 j de retard » (uniquement pour un projet planifié, en cours ou en pause). */
function endLabel(end: string | null, status: string) {
  if (!end || !["PLANNED", "ACTIVE", "ON_HOLD"].includes(status)) return null;
  const d = Math.round((Date.parse(end.slice(0, 10)) - Date.parse(new Date().toISOString().slice(0, 10))) / DAY);
  if (d === 0) return { text: "Fin aujourd'hui", late: false };
  if (d > 0) return { text: `Dans ${d} j`, late: false };
  return { text: `${-d} j de retard`, late: true };
}

/** Carte d'un projet (affichage « Cartes » de la liste) : client, état, avancement des tâches, période et budget. */
export function ProjectCard({ row, api }: { row: Row; api: CardApi }) {
  const name = String(row.name ?? "");
  const customer = row.customerName ? String(row.customerName) : null;
  const status = String(row.status ?? "PLANNED");
  const meta = PROJECT_STATUS[status];
  const progress = Math.max(0, Math.min(100, Number(row.progress ?? 0)));
  const start = row.startDate ? String(row.startDate) : null;
  const end = row.endDate ? String(row.endDate) : null;
  const budget = Number(row.budget ?? 0);
  const due = endLabel(end, status);
  const bar = status === "DONE" ? "bg-emerald-600" : due?.late ? "bg-rose-600" : "bg-brand-500";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: status === "CANCELLED" ? 0.65 : 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(api.index, 14) * 0.03, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("flex flex-col rounded-xl border border-line-soft bg-surface p-4 transition-colors hover:border-line", api.editable && "cursor-pointer")}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-[15px] font-semibold text-ink outline-none hover:text-brand-700 focus-visible:underline disabled:cursor-default disabled:hover:text-ink" onClick={api.open} disabled={!api.editable}>{name}</button>
          <p className="truncate text-xs text-muted">{customer ?? "Sans client"}</p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0">{api.menu}</div>
      </div>

      <div className="mt-3">{meta && <Badge tone={meta.tone}>{meta.label}</Badge>}</div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>Avancement des tâches</span>
          <span className="font-medium tabular text-ink-soft">{Math.round(progress)} %</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-subtle" role="img" aria-label={`${Math.round(progress)} % des tâches terminées`}>
          <div className={cn("h-full", bar)} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">Période</p>
          <p className="text-[13px] font-medium text-ink">{start ? formatDate(start) : "—"}{end ? ` → ${formatDate(end)}` : ""}</p>
          {due && <p className={cn("text-xs", due.late ? "font-medium text-rose-700" : "text-faint")}>{due.text}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Budget HT</p>
          <p className="text-[15px] font-semibold tabular text-ink">{budget > 0 ? formatMAD(budget) : "—"}</p>
        </div>
      </div>

      {api.extras.some((a) => a.href) && (
        <div data-no-row-click className="mt-3 flex flex-wrap gap-1">
          {api.extras.filter((a) => a.href).map((a) => (
            <Link key={a.label} href={a.href!} className="rounded-md px-2 py-1 text-[13px] font-medium text-brand-700 hover:bg-subtle">{a.label}</Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
