"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { BellRing, CalendarClock, Mail, Percent, Phone, Target, Trophy, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
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

const TONES = {
  brand: { tile: "bg-brand-50 text-brand-700 ring-brand-200/70", glow: "bg-brand-500/25" },
  emerald: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", glow: "bg-emerald-500/25" },
  violet: { tile: "bg-violet-50 text-violet-700 ring-violet-200/70", glow: "bg-violet-500/25" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-200/80", glow: "bg-amber-500/25" },
} as const;

/** Couleur de chaque étape du pipeline (barre, point, halo). */
const STAGE: Record<string, { bar: string; dot: string; text: string }> = {
  NEW: { bar: "bg-sky-500", dot: "bg-sky-400", text: "text-sky-700" },
  CONTACTED: { bar: "bg-brand-500", dot: "bg-brand-400", text: "text-brand-700" },
  QUALIFIED: { bar: "bg-violet-500", dot: "bg-violet-400", text: "text-violet-700" },
  PROPOSAL: { bar: "bg-amber-500", dot: "bg-amber-400", text: "text-amber-700" },
  WON: { bar: "bg-emerald-500", dot: "bg-emerald-400", text: "text-emerald-700" },
  LOST: { bar: "bg-faint", dot: "bg-faint", text: "text-muted" },
};

function Kpi({ label, sub, icon: Icon, tone, index, children, pulse }: { label: string; sub: string; icon: LucideIcon; tone: keyof typeof TONES; index: number; children: React.ReactNode; pulse?: boolean }) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: EASE }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="glass group relative overflow-hidden rounded-xl p-4 shadow-[var(--shadow-ring),var(--shadow-md)]"
    >
      <span aria-hidden className={cn("pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100", t.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1.5 truncate text-[22px] font-semibold tracking-tight text-ink">{children}</p>
          <p className="mt-0.5 truncate text-[11px] text-faint">{sub}</p>
        </div>
        <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", t.tile)}>
          <Icon className="h-5 w-5" />
          {pulse && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-amber-400/80" />}
        </span>
      </div>
    </motion.div>
  );
}

/** Pipeline : une colonne par étape, cliquable pour filtrer la liste (même paramètre d'URL que les onglets). */
function Pipeline({ stages }: { stages: ProspectStats["pipeline"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "";
  const max = Math.max(1, ...stages.map((s) => s.count));
  const select = (status: string) => {
    const next = new URLSearchParams(params.toString());
    if (current === status) next.delete("status");
    else next.set("status", status);
    next.delete("page");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.28, ease: EASE }}
      className="glass mb-5 rounded-xl p-4 shadow-[var(--shadow-ring),var(--shadow-md)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Pipeline commercial</h2>
        <p className="text-[11px] text-faint">Cliquez sur une étape pour filtrer</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((s, i) => {
          const meta = PROSPECT_STATUS[s.status];
          const st = STAGE[s.status];
          const active = current === s.status;
          return (
            <motion.button
              key={s.status}
              onClick={() => select(s.status)}
              aria-pressed={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.34 + i * 0.05, ease: EASE }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.97 }}
              className={cn("rounded-lg p-3 text-left ring-1 ring-inset transition-colors", active ? "bg-white/[0.07] ring-brand-200/60" : "bg-white/[0.025] ring-line hover:bg-white/[0.05]")}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                {meta.label}
              </span>
              <span className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular text-ink"><AnimatedNumber value={s.count} /></span>
              </span>
              <span className="block truncate text-[11px] tabular text-muted">{formatMAD(s.value)}</span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-subtle">
                <motion.span
                  className={cn("block h-full rounded-full", st.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.count / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.05, ease: EASE }}
                />
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

export function ProspectStatsPanel({ stats }: { stats: ProspectStats }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi index={0} tone="brand" icon={Target} label="Pipeline ouvert" sub={`${stats.openCount} opportunité${stats.openCount > 1 ? "s" : ""}`}>
          <AnimatedNumber value={stats.openValue} kind="mad" />
        </Kpi>
        <Kpi index={1} tone="emerald" icon={Trophy} label="Affaires gagnées" sub={`${stats.wonCount} prospect${stats.wonCount > 1 ? "s" : ""}`}>
          <AnimatedNumber value={stats.wonValue} kind="mad" />
        </Kpi>
        <Kpi index={2} tone="violet" icon={Percent} label="Taux de conversion" sub="gagnés / clôturés">
          {stats.conversionBp === null ? "—" : <AnimatedNumber value={stats.conversionBp} kind="percent" />}
        </Kpi>
        <Kpi index={3} tone="amber" icon={BellRing} label="À relancer" sub="relances échues" pulse={stats.dueCount > 0}>
          <AnimatedNumber value={stats.dueCount} />
        </Kpi>
      </div>
      <Pipeline stages={stats.pipeline} />
    </>
  );
}

type Row = { id: string } & Record<string, unknown>;

export function ProspectCard({ row, api }: { row: Row; api: CardApi }) {
  const status = String(row.status ?? "NEW");
  const meta = PROSPECT_STATUS[status];
  const st = STAGE[status] ?? STAGE.NEW;
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
      whileHover={{ y: -4, transition: { duration: 0.2, ease: EASE } }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("glass group relative flex flex-col overflow-hidden rounded-xl p-4 ring-1 ring-inset ring-line transition-shadow duration-300 hover:shadow-[var(--shadow-lg)] hover:ring-brand-200/60", api.editable && "cursor-pointer")}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), rgb(91 155 255 / 0.16), transparent 70%)" }} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", st.bar)} />

      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-100 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
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
            {overdue ? <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" /><span className="relative h-2 w-2 rounded-full bg-rose-500" /></span> : <CalendarClock className="h-3.5 w-3.5" />}
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
