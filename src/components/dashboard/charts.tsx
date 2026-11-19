"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactMAD, formatMAD } from "@/lib/money";
import { cn } from "@/lib/utils";

// Palette validée (CVD, contraste) : indigo Mactura + orange Mactura
const C_PRIMARY = "#4f43ad";
const C_SECONDARY = "#ee6136";
const GRID = "#eceef3";
const AXIS = "#9a9fb3";

function ChartTooltip({ active, payload, label, names }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string; names: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[200px] rounded-lg bg-surface px-3 py-2.5 shadow-[var(--shadow-ring),var(--shadow-lg)]">
      <p className="mb-1.5 text-xs font-medium capitalize text-muted">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5 text-[13px]">
          <span className="flex items-center gap-2 text-ink-soft">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {names[p.dataKey]}
          </span>
          <span className="font-semibold tabular text-ink">{formatMAD(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; value?: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-3 sm:px-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value && <span className="font-semibold tabular text-ink">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: { data: { month: string; invoiced: number; collected: number }[] }) {
  const reduce = useReducedMotion();
  const totalInv = data.reduce((s, d) => s + d.invoiced, 0);
  const totalCol = data.reduce((s, d) => s + d.collected, 0);
  return (
    <div>
      <Legend
        items={[
          { color: C_PRIMARY, label: "Facturé", value: formatMAD(totalInv) },
          { color: C_SECONDARY, label: "Encaissé", value: formatMAD(totalCol) },
        ]}
      />
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="g-inv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C_PRIMARY} stopOpacity={0.16} />
                <stop offset="100%" stopColor={C_PRIMARY} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g-col" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C_SECONDARY} stopOpacity={0.12} />
                <stop offset="100%" stopColor={C_SECONDARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} dy={8} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v) => formatCompactMAD(v)} width={56} />
            <Tooltip content={<ChartTooltip names={{ invoiced: "Facturé", collected: "Encaissé" }} />} cursor={{ stroke: "#c9ccd8", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="invoiced"
              stroke={C_PRIMARY}
              strokeWidth={2}
              fill="url(#g-inv)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              isAnimationActive={!reduce}
              animationDuration={1100}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="collected"
              stroke={C_SECONDARY}
              strokeWidth={2}
              fill="url(#g-col)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              isAnimationActive={!reduce}
              animationDuration={1100}
              animationBegin={150}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function QuotesChart({ data }: { data: { month: string; sent: number; accepted: number; count: number; acceptedCount: number }[] }) {
  const reduce = useReducedMotion();
  const count = data.reduce((s, d) => s + d.count, 0);
  const acc = data.reduce((s, d) => s + d.acceptedCount, 0);
  return (
    <div>
      <Legend
        items={[
          { color: C_PRIMARY, label: "Devis émis", value: String(count) },
          { color: C_SECONDARY, label: "Devis acceptés", value: String(acc) },
        ]}
      />
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} dy={8} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} tickFormatter={(v) => formatCompactMAD(v)} width={56} />
            <Tooltip content={<ChartTooltip names={{ sent: "Devis émis", accepted: "Devis acceptés" }} />} cursor={{ fill: "rgb(79 67 173 / 0.05)", radius: 6 }} />
            <Bar dataKey="sent" fill={C_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={900} />
            <Bar dataKey="accepted" fill={C_SECONDARY} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={900} animationBegin={120} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Couleurs de statut (réservées) — toujours accompagnées d'un libellé
const STATUS_COLORS: Record<string, string> = { PAID: "#10b981", PARTIAL: "#8b5cf6", PENDING: "#f59e0b", OVERDUE: "#f43f5e" };

export function StatusDonut({ data }: { data: { key: string; label: string; value: number }[] }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = hover !== null ? data[hover] : null;

  if (total === 0) {
    return <p className="px-5 py-16 text-center text-sm text-muted">Aucune facture émise sur la période.</p>;
  }

  return (
    <div className="p-5">
      <div className="relative mx-auto h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={data.filter((d) => d.value > 0).length > 1 ? 2 : 0}
              stroke="none"
              cornerRadius={4}
              isAnimationActive={!reduce}
              animationDuration={1000}
              onMouseEnter={(_, i) => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {data.map((d, i) => (
                <Cell key={d.key} fill={STATUS_COLORS[d.key]} opacity={hover === null || hover === i ? 1 : 0.35} style={{ transition: "opacity 200ms" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.p key={shown?.key ?? "total"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] font-medium text-muted">
            {shown ? shown.label : "Total facturé"}
          </motion.p>
          <p className="mt-0.5 text-[15px] font-semibold tabular tracking-tight text-ink">{formatCompactMAD(shown ? shown.value : total)} DH</p>
          {shown && <p className="text-[11px] tabular text-faint">{((shown.value / total) * 100).toFixed(1).replace(".", ",")} %</p>}
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {data.map((d, i) => (
          <li
            key={d.key}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn("flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors", hover === i && "bg-subtle")}
          >
            <span className="flex items-center gap-2 text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STATUS_COLORS[d.key] }} />
              {d.label}
            </span>
            <span className="flex items-center gap-3">
              <span className="font-medium tabular text-ink">{formatMAD(d.value)}</span>
              <span className="w-12 text-right text-xs tabular text-faint">{total ? ((d.value / total) * 100).toFixed(0) : 0} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
