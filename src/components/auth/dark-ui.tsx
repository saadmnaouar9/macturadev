"use client";

import { forwardRef, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DarkInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; // étiquette accessible (masquée visuellement)
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  error?: string;
}

export const DarkInput = forwardRef<HTMLInputElement, DarkInputProps>(function DarkInput({ label, icon, trailing, error, className, ...props }, ref) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="group relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 transition-colors duration-200 group-focus-within:text-violet-300">{icon}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          placeholder={label}
          className={cn(
            "space-input h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] text-sm text-white placeholder:text-white/40 outline-none transition-all duration-200",
            "hover:border-white/20 focus:border-violet-400/70 focus:bg-white/[0.08]",
            "aria-[invalid=true]:border-rose-400/60 aria-[invalid=true]:",
            icon ? "pl-10" : "pl-3.5", trailing ? "pr-11" : "pr-3.5", className,
          )}
          {...props}
        />
        {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p id={`${id}-err`} role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden pt-1.5 text-xs font-medium text-rose-300">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

export function DarkButton({ loading, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "space-btn group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-violet-500 text-sm font-semibold text-white",
        " transition-transform duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0520] active:translate-y-0 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      {loading && <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden />}
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

export function DarkCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="group flex items-center gap-2.5 rounded text-left text-[13px] text-white/70 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300/60">
      <span className={cn("flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all duration-200", checked ? "border-violet-400 bg-violet-500" : "border-white/25 bg-white/[0.04] group-hover:border-violet-300/70")}>
        <Check className={cn("h-3 w-3 text-white transition-transform duration-200", checked ? "scale-100" : "scale-0")} strokeWidth={3} />
      </span>
      {children}
    </button>
  );
}
