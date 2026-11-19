"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactMAD, formatMAD } from "@/lib/money";

export function SalesChart({ data }: { data: { month: string; sales: number; purchases: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="26%">
                      <CartesianGrid vertical={false} stroke="rgba(148,180,255,0.1)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#7f8db3", fontSize: 11 }} dy={8} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7f8db3", fontSize: 11 }} tickFormatter={(v) => formatCompactMAD(v)} width={56} />
                      <Tooltip cursor={{ fill: "rgb(74 141 248 / 0.09)" }} content={({ active, payload, label }) => active && payload?.length ? (
                        <div className="min-w-[190px] rounded-lg bg-surface px-3 py-2.5 shadow-[var(--shadow-ring),var(--shadow-lg)]">
                          <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
                          {payload.map((x) => <div key={String(x.dataKey)} className="flex justify-between gap-4 py-0.5 text-[13px]"><span className="flex items-center gap-2 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: x.color }} />{x.dataKey === "sales" ? "Ventes" : "Achats"}</span><span className="font-semibold tabular">{formatMAD(Number(x.value))}</span></div>)}
                        </div>) : null} />
                      <Bar dataKey="sales" fill="#4a8df8" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900} />
                      <Bar dataKey="purchases" fill="#e86533" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900} animationBegin={120} />
                    </BarChart>
                  </ResponsiveContainer>
  );
}
