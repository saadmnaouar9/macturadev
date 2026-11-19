import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, FileText, Receipt, ShieldCheck, Users, Wallet } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { Logo } from "@/components/brand";

const FEATURES = [
  { icon: Users, title: "CRM clients", text: "Fiches particuliers et entreprises avec ICE, IF, RC, historique complet des échanges commerciaux." },
  { icon: FileText, title: "Devis", text: "Créez des devis professionnels en quelques secondes, suivez leur acceptation et convertissez-les en facture." },
  { icon: Receipt, title: "Factures", text: "Numérotation continue, TVA multi-taux, remises, PDF conformes et montant en toutes lettres." },
  { icon: Wallet, title: "Paiements", text: "Virement, chèque, espèces, LCN : enregistrez les règlements partiels et suivez les retards." },
  { icon: BarChart3, title: "Pilotage", text: "Chiffre d'affaires, encours, taux de conversion : un tableau de bord toujours à jour." },
  { icon: ShieldCheck, title: "Sécurité", text: "Données isolées par entreprise, rôles et permissions, sessions sécurisées." },
];

export default async function Home() {
  if (await getAuth()) redirect("/dashboard");
  return (
    <div className="min-h-dvh bg-surface">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo className="h-6" priority />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-subtle hover:text-ink">
            Connexion
          </Link>
          <Link href="/register" className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-400">
            Essayer gratuitement
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgb(79_67_173/0.10),transparent_65%)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-soft shadow-[var(--shadow-ring)]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> Conçu pour les entreprises marocaines · MAD · TVA · ICE
          </span>
          <h1 className="mt-6 text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink sm:text-6xl">
            Votre gestion commerciale,
            <br />
            <span className="text-brand-700">enfin simple.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted">
            Mactura réunit vos clients, devis, factures, produits et paiements dans un espace unique, élégant et rapide.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="group inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-brand-400">
              Créer mon espace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="inline-flex h-11 items-center rounded-lg px-5 text-[15px] font-medium text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-subtle">
              Voir la démo
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-px overflow-hidden rounded-2xl bg-line shadow-[var(--shadow-ring)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface p-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <f.icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line-soft py-8 text-center text-xs text-faint">© {new Date().getFullYear()} Mactura</footer>
    </div>
  );
}
