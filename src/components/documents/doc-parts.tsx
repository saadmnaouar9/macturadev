"use client";

import { motion } from "framer-motion";
import { Check, CircleDollarSign, Clock, FileText, Receipt, Send, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatDate, formatRelative } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

export function WorkflowStepper({ steps, current, failed }: { steps: { label: string; date?: string | null }[]; current: number; failed?: { at: number; label: string } }) {
  return (
    <ol className="flex items-start" aria-label="Progression du document">
      {steps.map((s, i) => {
        const isFailed = failed && failed.at === i;
        const done = i < current || (i === current && !isFailed && i === steps.length - 1);
        const active = i === current;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span className="absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 bg-line">
                <motion.span className="block h-full bg-brand-600" initial={{ width: 0 }} animate={{ width: i <= current ? "100%" : 0 }} transition={{ duration: 0.6, delay: 0.15 * i, ease }} />
              </span>
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12 * i, type: "spring", stiffness: 400, damping: 22 }}
              className={cn(
                "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface",
                isFailed ? "bg-rose-500 text-white" : done || i < current ? "bg-brand-500 text-white" : active ? "bg-brand-50 text-brand-700 ring-brand-100" : "bg-subtle text-faint",
              )}
            >
              {isFailed ? <XCircle className="h-4 w-4" /> : done || i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </motion.span>
            <span className={cn("mt-2 text-[12px] font-medium", isFailed ? "text-rose-600" : i <= current ? "text-ink" : "text-faint")}>{isFailed ? failed.label : s.label}</span>
            {s.date && <span className="text-[11px] text-faint">{formatDate(s.date)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const ICON: Record<string, { icon: typeof Clock; cls: string }> = {
  payment: { icon: CircleDollarSign, cls: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  accepted: { icon: Check, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  rejected: { icon: XCircle, cls: "bg-rose-50 text-rose-600 ring-rose-100" },
  cancelled: { icon: XCircle, cls: "bg-rose-50 text-rose-600 ring-rose-100" },
  sent: { icon: Send, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  issued: { icon: Receipt, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  converted: { icon: Receipt, cls: "bg-brand-50 text-brand-600 ring-brand-100" },
  default: { icon: FileText, cls: "bg-subtle text-muted ring-line" },
};

export function DocTimeline({ items }: { items: { id: string; type: string; message: string; createdAt: string; userName: string | null }[] }) {
  return (
    <Card>
      <CardHeader title="Historique" description="Toutes les actions sur ce document" />
      {items.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-[13px] text-faint">Aucun événement.</p>
      ) : (
        <ol className="relative px-5 pb-5 pt-4">
          <span className="absolute bottom-8 left-[34px] top-6 w-px bg-line" aria-hidden />
          {items.map((a, i) => {
            const k = a.type.split(".")[1] ?? "";
            const key = a.type.startsWith("payment.created") ? "payment" : ICON[k] ? k : "default";
            const I = ICON[key];
            return (
              <motion.li key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} className="mb-3.5 flex gap-3 last:mb-0">
                <span className={cn("relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset", I.cls)}>
                  <I.icon className="h-3.5 w-3.5" />
                </span>
                <span className="pt-0.5">
                  <span className="block text-[13px] leading-snug text-ink-soft">{a.message}</span>
                  <span className="block text-[11px] text-faint">{formatRelative(a.createdAt)}{a.userName ? ` · ${a.userName}` : ""}</span>
                </span>
              </motion.li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
