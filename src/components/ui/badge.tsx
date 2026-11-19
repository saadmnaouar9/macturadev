import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";
import { INVOICE_STATUS, QUOTE_STATUS, type InvoiceDisplayStatus, type QuoteDisplayStatus } from "@/lib/status";

const tones: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "bg-subtle text-ink-soft ring-line", dot: "bg-faint" },
  info: { box: "bg-sky-50 text-sky-700 ring-sky-200/70", dot: "bg-sky-500" },
  success: { box: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", dot: "bg-emerald-500" },
  warning: { box: "bg-amber-50 text-amber-700 ring-amber-200/80", dot: "bg-amber-500" },
  danger: { box: "bg-rose-50 text-rose-700 ring-rose-200/70", dot: "bg-rose-500" },
  brand: { box: "bg-brand-50 text-brand-700 ring-brand-200/70", dot: "bg-brand-500" },
  violet: { box: "bg-violet-50 text-violet-700 ring-violet-200/70", dot: "bg-violet-500" },
};

export function Badge({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  const t = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", t.box, className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  const s = INVOICE_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteDisplayStatus }) {
  const s = QUOTE_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
