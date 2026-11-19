"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Building2, Check, Eye, EyeOff, Hash, Lock, Mail, MapPin, UserRound } from "lucide-react";
import { AuthCard, AuthTitle } from "@/components/auth/auth-card";
import { DarkButton, DarkInput } from "@/components/auth/dark-ui";
import { useForm } from "@/hooks/use-form";
import { cn } from "@/lib/utils";
import { registerAction } from "../actions";

export function RegisterForm() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const { values, set, errors, pending, submit } = useForm({ name: "", email: "", password: "", companyName: "", city: "", ice: "" });
  const pw = values.password;
  const rules = [
    { ok: pw.length >= 8, label: "8 caractères" },
    { ok: /[A-Za-z]/.test(pw), label: "une lettre" },
    { ok: /\d/.test(pw), label: "un chiffre" },
  ];

  return (
    <AuthCard wide>
      <AuthTitle title={<>Créez votre espace <span aria-hidden>✨</span></>} subtitle="Quelques informations pour configurer Mactura pour votre entreprise marocaine." />
      <form
        noValidate
        className="mt-7 space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(() => registerAction(values), { silent: true, success: "Bienvenue sur Mactura !", onSuccess: (d) => { router.replace(d.redirectTo); router.refresh(); } });
        }}
      >
        <DarkInput label="Nom complet" autoComplete="name" autoFocus icon={<UserRound className="h-4 w-4" />} value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <DarkInput label="E-mail professionnel" type="email" autoComplete="email" icon={<Mail className="h-4 w-4" />} value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <DarkInput
          label="Mot de passe"
          type={show ? "text" : "password"}
          autoComplete="new-password"
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
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-0.5">
          {rules.map((r) => (
            <span key={r.label} className={cn("inline-flex items-center gap-1 text-xs transition-colors duration-200", r.ok ? "text-emerald-300" : "text-white/35")}>
              <Check className={cn("h-3.5 w-3.5 transition-transform duration-200", r.ok ? "scale-100" : "scale-75 opacity-60")} /> {r.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1.5">
          <span className="h-px flex-1 bg-white/10" />
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/40"><Building2 className="h-3.5 w-3.5" /> Entreprise</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <DarkInput label="Raison sociale" autoComplete="organization" icon={<Building2 className="h-4 w-4" />} value={values.companyName} onChange={(e) => set("companyName", e.target.value)} error={errors.companyName} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <DarkInput label="Ville" icon={<MapPin className="h-4 w-4" />} value={values.city} onChange={(e) => set("city", e.target.value)} error={errors.city} />
          <DarkInput label="ICE (facultatif)" inputMode="numeric" maxLength={15} icon={<Hash className="h-4 w-4" />} value={values.ice} onChange={(e) => set("ice", e.target.value.replace(/\D/g, ""))} error={errors.ice} className="tabular" />
        </div>
        <div className="pt-1.5">
          <DarkButton type="submit" loading={pending}>
            Créer mon espace
            {!pending && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
          </DarkButton>
        </div>
      </form>
      <p className="mt-5 text-center text-[13px] text-white/50">
        Déjà inscrit ? <Link href="/login" className="font-medium text-violet-300 transition-colors hover:text-violet-200 hover:underline">Se connecter</Link>
      </p>
    </AuthCard>
  );
}
