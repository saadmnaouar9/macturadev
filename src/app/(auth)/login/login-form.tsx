"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthCard, AuthTitle } from "@/components/auth/auth-card";
import { DarkButton, DarkCheckbox, DarkInput } from "@/components/auth/dark-ui";
import { useForm } from "@/hooks/use-form";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const { values, set, errors, pending, submit } = useForm({ email: "", password: "", remember: true });

  return (
    <AuthCard>
      <AuthTitle title={"Bienvenue sur Mactura"} subtitle="Vos identifiants servent uniquement à vous authentifier. Toutes les données restent dans votre base." />
      <form
        noValidate
        className="mt-7 space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => loginAction(values, next), { silent: true, onSuccess: (d) => { router.replace(d.redirectTo); router.refresh(); } });
        }}
      >
        <DarkInput label="Adresse e-mail" type="email" autoComplete="email" autoFocus icon={<Mail className="h-4 w-4" />} value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <DarkInput
          label="Mot de passe"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
          trailing={
            <button type="button" onClick={() => setShow((s) => !s)} className="rounded-lg p-2 text-white/45 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <div className="flex items-center justify-between pb-1 pt-1.5">
          <DarkCheckbox checked={values.remember} onChange={(v) => set("remember", v)}>Se souvenir de moi</DarkCheckbox>
          <Link href="/mot-de-passe-oublie" className="text-[13px] font-medium text-violet-300 transition-colors hover:text-violet-200 hover:underline">Mot de passe oublié ?</Link>
        </div>
        <DarkButton type="submit" loading={pending}>
          Se connecter
          {!pending && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
        </DarkButton>
      </form>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-center text-xs text-white/50">
        <span className="font-medium text-white/70">Compte démo :</span> demo@mactura.ma · <span className="font-mono text-white/70">Demo1234</span>
      </div>
      <p className="mt-5 text-center text-[13px] text-white/50">
        Pas encore de compte ? <Link href="/register" className="font-medium text-violet-300 transition-colors hover:text-violet-200 hover:underline">Créer un espace</Link>
      </p>
    </AuthCard>
  );
}
