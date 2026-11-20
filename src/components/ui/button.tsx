"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent" | "success";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,color,transform,border-color] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-400",
  accent: "bg-accent-500 text-white hover:bg-accent-400",
  success: "bg-emerald-500 text-white hover:bg-emerald-600",
  secondary:
    "bg-subtle text-ink shadow-[0_0_0_1px_var(--color-line),var(--shadow-xs)] hover:bg-hover",
  outline: "border border-line bg-transparent text-ink hover:bg-subtle hover:border-line-strong",
  ghost: "text-ink-soft hover:bg-hover hover:text-ink",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const sizes: Record<Size, string> = {
  xs: "h-7 rounded-md px-2 text-xs",
  sm: "h-8 rounded-md px-3 text-[13px]",
  md: "h-9 rounded-lg px-3.5 text-sm",
  lg: "h-11 rounded-lg px-5 text-[15px]",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-md",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: { href: string; variant?: Variant; size?: Size } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  // Les routes /api/* (PDF, exports) sont des téléchargements : lien HTML simple, jamais de préchargement Next.js
  // (sinon le serveur génère le PDF en arrière-plan à chaque ouverture d'une facture ou d'un devis).
  if (href.startsWith("/api/")) {
    return (
      <a href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}
