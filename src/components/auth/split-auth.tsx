"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/brand";

const ease = [0.16, 1, 0.3, 1] as const;

/** Pastilles flottantes du panneau de marque (position, libellé, durée du flottement) */
const PILLS = [
  { label: "Factures & devis", cls: "right-8 top-24", dur: 6.5 },
  { label: "Suivi des paiements", cls: "left-8 top-[23%]", dur: 7.5 },
  { label: "TVA automatique", cls: "right-8 top-[46%]", dur: 6 },
  { label: "Trésorerie en temps réel", cls: "right-12 bottom-[13%]", dur: 8 },
] as const;

const AVATARS = [
  { t: "SM", c: "from-sky-400 to-blue-600" },
  { t: "YE", c: "from-amber-400 to-orange-500" },
  { t: "AB", c: "from-emerald-400 to-teal-600" },
  { t: "KH", c: "from-violet-400 to-fuchsia-600" },
] as const;

/**
 * Mise en page « écran partagé » des pages de connexion : panneau de marque à gauche (dégradé bleu),
 * formulaire à droite. Les couleurs du panneau de marque ne changent pas avec le thème ; le panneau du formulaire suit le thème.
 */
export function SplitAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1080px] px-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease }}
        className="split-card grid overflow-hidden rounded-[28px] md:min-h-[640px] md:grid-cols-[1.05fr_1fr]"
      >
        {/* Panneau de marque */}
        <aside className="brand-panel relative hidden flex-col justify-between overflow-hidden p-8 md:flex">
          <div aria-hidden className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-blue-500/35 blur-3xl" />

          <div className="relative z-10">
            <Logo priority className="h-[26px]" />
          </div>

          {PILLS.map((p, i) => (
            <motion.span
              key={p.label}
              aria-hidden
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
              transition={{ opacity: { duration: 0.6, delay: 0.3 + i * 0.12 }, scale: { duration: 0.6, delay: 0.3 + i * 0.12 }, y: { duration: p.dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 } }}
              className={`bp-pill absolute z-10 ${p.cls}`}
            >
              {p.label}
            </motion.span>
          ))}

          <div className="relative z-10 max-w-[360px]">
            <h2 className="bp-title text-[40px] font-medium leading-[1.1] tracking-[-0.03em]">Pilotez votre activité, simplement.</h2>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                {AVATARS.map((a) => (
                  <span key={a.t} className={`bp-avatar flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold ${a.c}`}>{a.t}</span>
                ))}
              </div>
              <p className="bp-muted text-[13px] leading-snug">Facturation, devis, TVA et trésorerie, au même endroit.</p>
            </div>
          </div>

          <div className="bp-muted relative z-10 flex items-center justify-between text-xs">
            <span>© 2026 Mactura</span>
            <span>Conçu pour les entreprises marocaines</span>
          </div>
        </aside>

        {/* Panneau du formulaire */}
        <div className="split-form flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-[380px]">
            <div className="mb-8 flex justify-center md:hidden">
              <Logo adaptive priority className="h-[26px]" />
            </div>
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
