"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarClock, Mail, Phone } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CardApi } from "@/components/data/resource-view";
import { PROSPECT_STATUS } from "@/lib/status";
import { formatMAD } from "@/lib/money";
import { cn, formatDate, initials } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface ProspectStats {
  openValue: number;
  openCount: number;
  wonValue: number;
  wonCount: number;
  conversionBp: number | null;
  dueCount: number;
  pipeline: { status: string; count: number; value: number }[];
}

/** Couleur de chaque étape : l'indigo du logo s'intensifie jusqu'à la proposition (orange du logo), puis gagné / perdu. */
const STAGE: Record<string, string> = {
  NEW: "bg-brand-300",
  CONTACTED: "bg-brand-400",
  QUALIFIED: "bg-brand-500",
  PROPOSAL: "bg-accent-500",
  WON: "bg-emerald-500",
  LOST: "bg-faint",
};

function Figure({ label, sub, children, alert }: { label: string; sub: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("mt-1 truncate text-xl font-semibold tracking-tight tabular", alert ? "text-rose-700" : "text-ink")}>{children}</dd>
      <dd className="mt-0.5 truncate text-xs text-faint">{sub}</dd>
    </div>
  );
}

/**
 * Synthèse des prospects : les chiffres clés, puis le pipeline commercial.
 * Le pipeline est une seule barre (part de la valeur de chaque étape) dont la légende sert de filtre :
 * cliquer sur une étape filtre la liste (paramètre d'URL `status`), un second clic retire le filtre.
 */
export function ProspectStatsPanel({ stats }: { stats: ProspectStats }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "";
  const select = (status: string) => {
    const next = new URLSearchParams(params.toString());
    if (!status || current === status) next.delete("status");
    else next.set("status", status);
    next.delete("page");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const totalValue = stats.pipeline.reduce((a, s) => a + s.value, 0);
  const totalCount = stats.pipeline.reduce((a, s) => a + s.count, 0);
  const share = (s: { count: number; value: number }) => (totalValue > 0 ? s.value / totalValue : totalCount > 0 ? s.count / totalCount : 0) * 100;

  return (
    <Card className="mb-4">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 p-5 lg:grid-cols-4">
        <Figure label="Pipeline ouvert" sub={`${stats.openCount} opportunité${stats.openCount > 1 ? "s" : ""}`}><AnimatedNumber value={stats.openValue} kind="mad" /></Figure>
        <Figure label="Affaires gagnées" sub={`${stats.wonCount} prospect${stats.wonCount > 1 ? "s" : ""}`}><AnimatedNumber value={stats.wonValue} kind="mad" /></Figure>
        <Figure label="Taux de conversion" sub="gagnés / clôturés">{stats.conversionBp === null ? "—" : <AnimatedNumber value={stats.conversionBp} kind="percent" />}</Figure>
        <Figure label="À relancer" sub="relances échues" alert={stats.dueCount > 0}><AnimatedNumber value={stats.dueCount} /></Figure>
      </dl>

      <div className="border-t border-line-soft p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-ink">Pipeline commercial</h2>
          <p className="text-xs text-faint">{current ? <button type="button" onClick={() => select("")} className="text-brand-700 hover:underline">Afficher toutes les étapes</button> : "Cliquez sur une étape pour filtrer la liste"}</p>
        </div>
        <div className="mt-3 flex h-2 gap-px overflow-hidden rounded-sm bg-subtle" role="img" aria-label="Répartition du pipeline par étape">
          {stats.pipeline.map((s, i) => (
            <motion.div key={s.status} className={cn("h-full", STAGE[s.status] ?? "bg-faint", current && current !== s.status && "opacity-30")} initial={{ width: 0 }} animate={{ width: `${share(s)}%` }} transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
          {stats.pipeline.map((s) => {
            const meta = PROSPECT_STATUS[s.status];
            const active = current === s.status;
            return (
              <li key={s.status}>
                <button type="button" onClick={() => select(s.status)} aria-pressed={active} className={cn("w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-subtle", active && "bg-subtle")}>
                  <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", STAGE[s.status] ?? "bg-faint")} aria-hidden />
                    <span className={cn(active && "font-medium text-ink")}>{meta?.label ?? s.status}</span>
                    <span className="tabular text-faint">{s.count}</span>
                  </span>
                  <span className="mt-0.5 block truncate pl-4 text-xs tabular text-muted">{formatMAD(s.value)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

type Row = { id: string } & Record<string, unknown>;

export function ProspectCard({ row, api }: { row: Row; api: CardApi }) {
  const status = String(row.status ?? "NEW");
  const meta = PROSPECT_STATUS[status];
    const name = String(row.name ?? "");
  const contactName = row.contactName ? String(row.contactName) : null;
  const email = row.email ? String(row.email) : null;
  const phone = row.phone ? String(row.phone) : null;
  const source = row.source ? String(row.source) : null;
  const value = Number(row.value ?? 0);
  const next = row.nextActionDate ? String(row.nextActionDate) : null;
  const closed = status === "WON" || status === "LOST";
  const overdue = !!next && !closed && next.slice(0, 10) <= new Date().toISOString().slice(0, 10);
  const primary = api.extras[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: status === "LOST" ? 0.7 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(api.index, 14) * 0.035, ease: EASE }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("group relative flex flex-col overflow-hidden rounded-xl border border-line-soft bg-surface p-4 transition-colors hover:border-line", api.editable && "cursor-pointer")}
    >

      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700 ">
          {initials(name || "?")}
        </span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-[15px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline" onClick={api.open} disabled={!api.editable}>{name}</button>
          <p className="mt-0.5 truncate text-xs text-muted">{contactName ?? "Aucun contact renseigné"}</p>
        </div>
        <div data-no-row-click className="-mr-1 -mt-1 shrink-0">{api.menu}</div>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
        {source && <span className="rounded-md bg-subtle px-2 py-0.5 text-xs text-muted">{source}</span>}
      </div>

      <div className="relative mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {email && (
          <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-brand-700" title={email}>
            <Mail className="h-3.5 w-3.5 shrink-0" /><span className="max-w-[170px] truncate">{email}</span>
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-brand-700">
            <Phone className="h-3.5 w-3.5 shrink-0" />{phone}
          </a>
        )}
        {!email && !phone && <span className="text-faint">Aucun moyen de contact</span>}
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-lg font-semibold tabular tracking-tight text-ink">{value > 0 ? formatMAD(value) : "—"}</p>
          <p className={cn("mt-0.5 inline-flex items-center gap-1.5 whitespace-nowrap text-xs", overdue ? "font-medium text-rose-600" : "text-muted")}>
            {overdue ? <span className="relative flex h-2 w-2"><span className="relative h-2 w-2 rounded-full bg-rose-500" /></span> : <CalendarClock className="h-3.5 w-3.5" />}
            {next ? `${overdue ? "À relancer · " : "Relance "}${formatDate(next)}` : "Aucune relance prévue"}
          </p>
        </div>
        {primary && (
          <span data-no-row-click>
            {primary.href ? (
              <Link href={primary.href} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200/70 transition-colors hover:bg-brand-100 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {primary.icon}{primary.label}
              </Link>
            ) : (
              <button onClick={() => primary.onSelect?.()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200/70 transition-colors hover:bg-brand-100 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {primary.icon}{primary.label}
              </button>
            )}
          </span>
        )}
      </div>
    </motion.div>
  );
}
