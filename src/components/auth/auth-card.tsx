"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Icône officielle de Mactura (version claire, sans fond) au-dessus de la carte. */
export function GlassLogo() {
  return (
    <div className="space-logo relative">
      <div className="absolute inset-0 -m-6 rounded-full bg-sky-400/30 blur-3xl [[data-theme=light]_&]:bg-sky-500/15" />
      <Image src="/brand/a-mark-light.png" alt="Mactura" width={768} height={768} priority className="relative h-[88px] w-[88px] object-contain drop- [[data-theme=light]_&]:hidden" />
      <Image src="/brand/a-mark.png" alt="Mactura" width={768} height={768} priority className="relative hidden h-[88px] w-[88px] object-contain drop- [[data-theme=light]_&]:block" />
    </div>
  );
}

export function AuthCard({ children, wide, className }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full flex-col items-center px-4", wide ? "max-w-[480px]" : "max-w-[400px]")}>
      <motion.div initial={{ opacity: 0, y: -16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 -mb-8">
        <GlassLogo />
      </motion.div>
      <motion.div
        // Pas de CSS « filter » sur cet élément : il désactive le backdrop-filter (le flou de verre) de la carte
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className={cn("space-card w-full rounded-[28px] px-6 pb-7 pt-14 text-white sm:px-8", className)}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function AuthTitle({ title, subtitle }: { title: React.ReactNode; subtitle: React.ReactNode }) {
  return (
    <div className="text-center">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-[300px] text-[12.5px] leading-relaxed text-white/50">{subtitle}</p>
    </div>
  );
}
