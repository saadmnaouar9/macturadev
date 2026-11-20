"use client";

import { forwardRef, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-lg border border-line bg-field px-3 text-sm text-ink placeholder:text-faint shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand-400 focus:shadow-[var(--shadow-focus)] focus:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-rose-400 aria-[invalid=true]:";

export function Label({ children, htmlFor, required, className }: { children: React.ReactNode; htmlFor?: string; required?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-[13px] font-medium text-ink-soft", className)}>
      {children}
      {required && <span className="ml-0.5 text-accent-500">*</span>}
    </label>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          role="alert"
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 text-xs font-medium text-rose-600"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errId : undefined })}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      <FieldError message={error} id={errId} />
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { leading?: React.ReactNode; trailing?: React.ReactNode }>(
  function Input({ className, leading, trailing, ...props }, ref) {
    if (leading || trailing) {
      return (
        <div className="relative">
          {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">{leading}</span>}
          <input ref={ref} dir="auto" className={cn(inputBase, "h-9", leading && "pl-9", trailing && "pr-12", className)} {...props} />
          {trailing && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-faint">{trailing}</span>}
        </div>
      );
    }
    return <input ref={ref} dir="auto" className={cn(inputBase, "h-9", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} dir="auto" className={cn(inputBase, "resize-y py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputBase, "h-9 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    </div>
  );
});

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  layoutId: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg bg-subtle p-0.5 shadow-[inset_0_0_0_1px_var(--color-line)]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-brand-500/25"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-brand-600" : "bg-line-strong",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 35 }}
        className={cn("block h-4 w-4 rounded-full bg-white shadow-sm", checked ? "ml-[18px]" : "ml-0.5")}
      />
    </button>
  );
}
