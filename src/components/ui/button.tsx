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
    "bg-gradient-to-r from-brand-500 via-[#3b6df7] to-[#7357f5] text-white shadow-[0_8px_22px_-8px_rgb(59_110_255/0.75),inset_0_1px_0_rgb(255_255_255/0.22)] hover:-translate-y-px hover:brightness-110 hover:shadow-[0_12px_30px_-8px_rgb(59_110_255/0.95),inset_0_1px_0_rgb(255_255_255/0.28)]",
  accent: "bg-gradient-to-r from-accent-500 to-[#ff5f6d] text-white shadow-[0_8px_22px_-8px_rgb(255_110_70/0.7),inset_0_1px_0_rgb(255_255_255/0.2)] hover:-translate-y-px hover:brightness-110",
  success: "bg-emerald-400 text-emerald-950 shadow-[0_8px_22px_-10px_rgb(16_185_129/0.8)] hover:-translate-y-px hover:bg-emerald-300",
  secondary:
    "bg-white/[0.05] text-ink shadow-[0_0_0_1px_rgb(148_180_255/0.16),inset_0_1px_0_rgb(255_255_255/0.04)] hover:bg-white/[0.09] hover:shadow-[0_0_0_1px_rgb(148_180_255/0.3),0_0_18px_-6px_rgb(59_130_246/0.5)]",
  outline: "border border-line bg-transparent text-ink hover:bg-subtle hover:border-white/25",
  ghost: "text-ink-soft hover:bg-white/[0.07] hover:text-ink",
  danger: "bg-rose-500 text-white shadow-[0_8px_22px_-10px_rgb(244_63_94/0.8)] hover:-translate-y-px hover:bg-rose-400",
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
