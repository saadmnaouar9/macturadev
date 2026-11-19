import Link from "next/link";
import { LogoMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <LogoMark className="h-10 w-10" />
      <p className="mt-8 font-mono text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Ce document n&apos;existe pas ou n&apos;appartient pas à votre espace.</p>
      <Link href="/dashboard" className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400">Retour au tableau de bord</Link>
    </div>
  );
}
