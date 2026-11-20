import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthCard, AuthTitle } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard>
      <AuthTitle
        title={<span className="flex items-center justify-center gap-2"><KeyRound className="h-5 w-5 text-brand-300" /> Mot de passe oublié ?</span>}
        subtitle="L'envoi d'e-mails n'est pas encore configuré : la réinitialisation automatique n'est pas disponible."
      />
      <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-relaxed text-white/65">
        Si vous êtes connecté sur un autre appareil, modifiez votre mot de passe dans <span className="font-medium text-white">Paramètres → Profil</span>. Sinon, contactez le propriétaire de votre espace.
      </p>
      <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-[13px] font-medium text-brand-300 transition-colors hover:text-brand-200 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour à la connexion
      </Link>
    </AuthCard>
  );
}
