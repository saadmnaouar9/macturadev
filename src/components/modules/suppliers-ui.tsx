"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { AlertTriangle, Banknote, Clock, MapPin, Truck, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import type { CardApi } from "@/components/data/resource-view";
import { cityCoords } from "@/lib/geo";
import { formatMAD } from "@/lib/money";
import { cn, initials } from "@/lib/utils";
import type { MapPoint } from "./suppliers-map";

const EASE = [0.16, 1, 0.3, 1] as const;

// Leaflet n'est chargé qu'après l'affichage de la page, et uniquement côté navigateur
const SuppliersMap = dynamic(() => import("./suppliers-map"), { ssr: false, loading: () => <Skeleton className="h-[380px] w-full rounded-none lg:h-[430px]" /> });

export interface SupplierStats {
  count: number;
  payable: number;
  dueCount: number;
}

const TONES = {
  brand: "bg-brand-500/12 text-brand-600",
  orange: "bg-orange-500/12 text-accent-600",
  emerald: "bg-emerald-500/12 text-emerald-600",
  rose: "bg-rose-500/12 text-rose-600",
} as const;

function Kpi({ icon: Icon, label, sub, tone, index, children }: { icon: LucideIcon; label: string; sub: string; tone: keyof typeof TONES; index: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: index * 0.06, ease: EASE }} whileHover={{ y: -3 }} className="group flex items-center gap-3.5 rounded-3xl border border-line-soft bg-surface p-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", TONES[tone])}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-base font-semibold tracking-tight tabular text-ink sm:text-xl">{children}</p>
        <p className="truncate text-[11px] text-faint">{sub}</p>
      </div>
    </motion.div>
  );
}

/** Synthèse des fournisseurs + carte interactive (villes, soldes à payer) */
export function SuppliersPanel({ stats, points }: { stats: SupplierStats; points: MapPoint[] }) {
  const cities = new Set(points.map((p) => (cityCoords(p.city) ? p.city : null)).filter(Boolean)).size;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi index={0} tone="brand" icon={Truck} label="Fournisseurs" sub="dans votre carnet"><AnimatedNumber value={stats.count} kind="int" /></Kpi>
        <Kpi index={1} tone="orange" icon={Banknote} label="Total à payer" sub="factures d'achat non soldées"><AnimatedNumber value={stats.payable} kind="mad" /></Kpi>
        <Kpi index={2} tone={stats.dueCount > 0 ? "rose" : "emerald"} icon={stats.dueCount > 0 ? AlertTriangle : Clock} label="À régler" sub={stats.dueCount > 0 ? "fournisseurs avec un solde" : "aucun solde en attente"}><AnimatedNumber value={stats.dueCount} kind="int" /></Kpi>
        <Kpi index={3} tone="emerald" icon={MapPin} label="Villes couvertes" sub="sur la carte ci-dessous"><AnimatedNumber value={cities} kind="int" /></Kpi>
      </div>
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease: EASE }} className="mb-4 overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-[0_6px_16px_-6px_rgb(59_110_245/0.6)]"><MapPin className="h-[18px] w-[18px]" /></span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Carte des fournisseurs</h2>
              <p className="text-xs text-muted">Répartition par ville · cliquez sur un repère pour voir les fournisseurs</p>
            </div>
          </div>
        </div>
        <SuppliersMap points={points} />
      </motion.section>
    </>
  );
}

type Row = { id: string } & Record<string, unknown>;

/** Carte d'un fournisseur (affichage « Cartes » de la liste) */
export function SupplierCard({ row, api }: { row: Row; api: CardApi }) {
  const name = String(row.name ?? "");
  const contact = row.contact ? String(row.contact) : null;
  const city = row.city ? String(row.city) : null;
  const ice = row.ice ? String(row.ice) : null;
  const balance = Number(row.balance ?? 0);
  const purchases = Number(row.purchaseCount ?? 0);
  const days = row.paymentDays ? Number(row.paymentDays) : null;
  const primary = api.extras[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.min(api.index, 14) * 0.035, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={(e) => {
        if (!api.editable || (e.target as HTMLElement).closest("button,a,[role=menuitem],[data-no-row-click]")) return;
        api.open();
      }}
      className={cn("group relative flex flex-col overflow-hidden rounded-3xl border border-line-soft bg-surface p-4 shadow-[var(--shadow-xs)] transition-shadow duration-300 hover:shadow-[var(--shadow-lg)]", api.editable && "cursor-pointer")}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", balance > 0 ? "from-orange-500 to-rose-400" : "from-brand-500 to-violet-500")} />
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-violet-500/15 text-sm font-semibold text-brand-700 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">{initials(name || "?")}</span>
        <div className="min-w-0 flex-1">
          <button className="block max-w-full truncate text-left text-[15px] font-semibold text-ink outline-none transition-colors group-hover:text-brand-700 focus-visible:underline" onClick={api.open} disabled={!api.editable}>{name}</button>
          {contact && <p className="truncate text-xs text-muted">{contact}</p>}
        </div>
        {api.menu}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]">
        {city && <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 font-medium text-brand-700"><MapPin className="h-3 w-3" />{city}</span>}
        {days !== null && <span className="rounded-full bg-subtle px-2 py-0.5 font-medium text-muted">Paiement à {days} j</span>}
        {ice && <span className="rounded-full bg-subtle px-2 py-0.5 font-mono text-muted">ICE {ice}</span>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-canvas/60 p-2.5 ring-1 ring-inset ring-line-soft">
          <p className="text-[11px] text-muted">Achats</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular text-ink">{purchases}</p>
        </div>
        <div className={cn("rounded-2xl p-2.5 ring-1 ring-inset", balance > 0 ? "bg-orange-500/8 ring-orange-500/25" : "bg-emerald-500/8 ring-emerald-500/20")}>
          <p className="text-[11px] text-muted">Reste à payer</p>
          <p className={cn("mt-0.5 truncate text-[15px] font-semibold tabular", balance > 0 ? "text-accent-600" : "text-emerald-700")}>{balance > 0 ? formatMAD(balance) : "À jour"}</p>
        </div>
      </div>
      {primary?.href && (
        <a href={primary.href} className="mt-3 inline-flex items-center gap-1.5 self-start text-[12.5px] font-medium text-brand-700 hover:underline" data-no-row-click>
          {primary.icon} {primary.label}
        </a>
      )}
    </motion.div>
  );
}
