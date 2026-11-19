"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Building2, Check, FileCog, KeyRound, Landmark, Percent, Plus, Star, Trash2, UserPlus, UserRound, Users } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/confirm";
import { useForm } from "@/hooks/use-form";
import { formatRate, parseRate } from "@/lib/money";
import { ROLE_LABELS } from "@/lib/status";
import { MOROCCAN_CITIES } from "@/lib/cities";
import { cn, initials } from "@/lib/utils";
import { addMember, changePassword, deleteTaxRate, removeMember, saveTaxRate, updateCompany, updateDocumentSettings, updateMemberRole, updateProfile } from "@/app/(app)/parametres/actions";

const ease = [0.16, 1, 0.3, 1] as const;

type Str<T> = { [K in keyof T]: string } & { [k: string]: unknown };

interface Props {
  initialTab: string;
  company: Record<string, string>;
  documents: Record<string, string>;
  taxRates: { id: string; name: string; rate: number; isDefault: boolean }[];
  members: { id: string; role: Role; user: { id: string; name: string; email: string }; isMe: boolean }[];
  profile: { name: string; email: string };
  usage: { invoices: number; quotes: number; customers: number };
  perms: { settings: boolean; members: boolean };
}

const TABS = [
  { id: "entreprise", label: "Entreprise", icon: Building2 },
  { id: "documents", label: "Documents", icon: FileCog },
  { id: "tva", label: "TVA", icon: Percent },
  { id: "equipe", label: "Équipe", icon: Users },
  { id: "profil", label: "Profil", icon: UserRound },
];

function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="p-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line-soft bg-canvas/50 px-5 py-3">{footer}</div>}
    </Card>
  );
}

function CompanyTab({ initial, canEdit }: { initial: Record<string, string>; canEdit: boolean }) {
  const router = useRouter();
  const { values, set, errors, pending, submit } = useForm<Str<typeof initial>>(initial as Str<typeof initial>);
  const f = (k: string, label: string, opts: { hint?: string; placeholder?: string; mono?: boolean; numeric?: boolean; span?: boolean; dir?: "rtl"; list?: string } = {}) => (
    <Field label={label} hint={opts.hint} error={errors[k]} className={opts.span ? "sm:col-span-2" : undefined}>
      {(p) => (
        <Input
          {...p}
          disabled={!canEdit}
          dir={opts.dir}
          list={opts.list}
          inputMode={opts.numeric ? "numeric" : undefined}
          value={values[k] as string}
          onChange={(e) => set(k, opts.numeric ? e.target.value.replace(/[^\d\s]/g, "") : e.target.value)}
          placeholder={opts.placeholder}
          className={cn(opts.mono && "font-mono text-[13px] tracking-wide", opts.dir === "rtl" && "text-right")}
        />
      )}
    </Field>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => updateCompany(values), { onSuccess: () => router.refresh() }); }} className="space-y-5" noValidate>
      <Section title="Identité" description="Affichée en en-tête de vos devis et factures.">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("name", "Raison sociale", { span: true })}
          {f("legalForm", "Forme juridique", { placeholder: "SARL, SA, SARL AU, auto-entrepreneur…" })}
          {f("capital", "Capital social", { placeholder: "100 000 DH" })}
          {f("nameAr", "Raison sociale en arabe", { dir: "rtl", span: true, placeholder: "الاسم التجاري" })}
        </div>
      </Section>
      <Section title="Identifiants légaux" description="Mentions obligatoires sur les factures au Maroc.">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("ice", "ICE", { hint: "15 chiffres", mono: true, numeric: true })}
          {f("taxId", "Identifiant fiscal (IF)", { mono: true, numeric: true })}
          {f("rc", "Registre de commerce (RC)", { mono: true })}
          {f("rcCity", "Tribunal du RC", { placeholder: "Casablanca", list: "settings-cities" })}
          {f("patente", "Taxe professionnelle (patente)", { mono: true })}
          {f("cnss", "CNSS", { mono: true })}
        </div>
      </Section>
      <Section title="Coordonnées" description="Adresse et contacts imprimés sur vos documents.">
        <div className="grid gap-4 sm:grid-cols-2">
          {f("address", "Adresse", { span: true })}
          {f("city", "Ville", { list: "settings-cities" })}
          {f("postalCode", "Code postal", { numeric: true })}
          {f("phone", "Téléphone")}
          {f("email", "E-mail")}
          {f("website", "Site web", { span: true })}
        </div>
        <datalist id="settings-cities">{MOROCCAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
      </Section>
      <Section
        title="Coordonnées bancaires"
        description="Affichées sur vos factures pour faciliter les virements."
        footer={canEdit && <Button type="submit" loading={pending}>Enregistrer les modifications</Button>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {f("bankName", "Banque", { placeholder: "Attijariwafa Bank, BMCE, CIH…" })}
          {f("rib", "RIB", { hint: "24 chiffres", mono: true, numeric: true })}
        </div>
      </Section>
    </form>
  );
}

function DocumentsTab({ initial, taxRates, canEdit }: { initial: Record<string, string>; taxRates: Props["taxRates"]; canEdit: boolean }) {
  const router = useRouter();
  const { values, set, errors, pending, submit } = useForm<Str<typeof initial>>(initial as Str<typeof initial>);
  const year = new Date().getFullYear();
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => updateDocumentSettings({ ...values, defaultTaxRate: Number(values.defaultTaxRate) }), { onSuccess: () => router.refresh() });
      }}
    >
      <Section title="Numérotation" description="Séquence continue par année, attribuée automatiquement.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Préfixe des factures" error={errors.invoicePrefix} hint={`Exemple : ${values.invoicePrefix || "FAC"}-${year}-0001`}>
            {(p) => <Input {...p} disabled={!canEdit} value={values.invoicePrefix as string} onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={8} className="font-mono" />}
          </Field>
          <Field label="Préfixe des devis" error={errors.quotePrefix} hint={`Exemple : ${values.quotePrefix || "DEV"}-${year}-0001`}>
            {(p) => <Input {...p} disabled={!canEdit} value={values.quotePrefix as string} onChange={(e) => set("quotePrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={8} className="font-mono" />}
          </Field>
        </div>
      </Section>
      <Section title="Valeurs par défaut">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Délai de paiement" error={errors.defaultPaymentDays}>
            {(p) => <Input {...p} disabled={!canEdit} inputMode="numeric" value={values.defaultPaymentDays as string} onChange={(e) => set("defaultPaymentDays", e.target.value.replace(/\D/g, ""))} trailing="jours" />}
          </Field>
          <Field label="Validité des devis" error={errors.quoteValidityDays}>
            {(p) => <Input {...p} disabled={!canEdit} inputMode="numeric" value={values.quoteValidityDays as string} onChange={(e) => set("quoteValidityDays", e.target.value.replace(/\D/g, ""))} trailing="jours" />}
          </Field>
          <Field label="TVA par défaut" error={errors.defaultTaxRate}>
            {(p) => (
              <Select {...p} disabled={!canEdit} value={values.defaultTaxRate as string} onChange={(e) => set("defaultTaxRate", e.target.value)}>
                {taxRates.map((t) => <option key={t.id} value={t.rate}>{t.name}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Section>
      <Section title="Textes par défaut" description="Pré-remplis à la création de chaque document, modifiables ensuite." footer={canEdit && <Button type="submit" loading={pending}>Enregistrer</Button>}>
        <div className="grid gap-4 md:grid-cols-2">
          {(["invoiceNotes", "invoiceTerms", "quoteNotes", "quoteTerms"] as const).map((k) => (
            <Field key={k} label={{ invoiceNotes: "Note des factures", invoiceTerms: "Conditions des factures", quoteNotes: "Note des devis", quoteTerms: "Conditions des devis" }[k]} error={errors[k]}>
              {(p) => <Textarea {...p} disabled={!canEdit} rows={3} value={values[k] as string} onChange={(e) => set(k, e.target.value)} />}
            </Field>
          ))}
        </div>
      </Section>
    </form>
  );
}

function TaxTab({ taxRates, canEdit }: { taxRates: Props["taxRates"]; canEdit: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const add = () => {
    const bp = parseRate(rate);
    if (bp === null || bp > 10000) return toast.error("Taux invalide (0 à 100 %)");
    start(async () => {
      const res = await saveTaxRate(null, { name: name || `TVA ${formatRate(bp)} %`, rate: bp });
      if (res.ok) { toast.success(res.message); setName(""); setRate(""); router.refresh(); } else toast.error(res.error);
    });
  };
  return (
    <Section title="Taux de TVA" description="Configurez les taux applicables à votre activité (taux marocains standards : 20 %, 14 %, 10 %, 7 %, exonéré). Les documents existants conservent leur taux.">
      <ul className="divide-y divide-line-soft rounded-xl ring-1 ring-line-soft">
        <AnimatePresence initial={false}>
          {taxRates.map((t) => (
            <motion.li key={t.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-14 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold tabular text-brand-700">{formatRate(t.rate)} %</span>
              <span className="flex-1 text-sm font-medium text-ink">{t.name}</span>
              {t.isDefault ? <Badge tone="brand" dot={false}><Star className="h-3 w-3" /> Par défaut</Badge> : canEdit && (
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: `Supprimer « ${t.name} » ?`, description: "Le taux ne sera plus proposé. Les documents existants ne sont pas modifiés.", confirmLabel: "Supprimer", danger: true }))) return;
                    const res = await deleteTaxRate(t.id);
                    if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.error);
                  }}
                  className="rounded-md p-1.5 text-faint hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Supprimer ${t.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Libellé (ex. TVA réduite)" aria-label="Libellé du taux" />
          <div className="sm:w-36"><Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="Taux" trailing="%" aria-label="Taux en pourcentage" /></div>
          <Button type="submit" loading={pending} disabled={!rate}><Plus className="h-4 w-4" /> Ajouter</Button>
        </form>
      )}
    </Section>
  );
}

function TeamTab({ members, canManage }: { members: Props["members"]; canManage: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const { values, set, setValues, errors, pending, submit } = useForm({ name: "", email: "", role: "MEMBER", password: "" });
  return (
    <>
      <Section
        title="Équipe"
        description="Chaque membre accède uniquement aux données de cette entreprise, selon son rôle."
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span><b className="font-medium text-ink-soft">Administrateur</b> : tout, y compris paramètres</span>
            <span><b className="font-medium text-ink-soft">Membre</b> : créer et modifier</span>
            <span><b className="font-medium text-ink-soft">Lecture seule</b> : consulter</span>
          </div>
          {canManage && <Button size="sm" onClick={() => { setValues({ name: "", email: "", role: "MEMBER", password: "" }); setOpen(true); }}><UserPlus className="h-4 w-4" /> Ajouter un membre</Button>}
        </div>
        <ul className="divide-y divide-line-soft rounded-xl ring-1 ring-line-soft">
          {members.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <span className="flex flex-1 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-600 ring-1 ring-inset ring-accent-100">{initials(m.user.name)}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{m.user.name} {m.isMe && <span className="text-xs font-normal text-muted">(vous)</span>}</span>
                  <span className="block truncate text-xs text-muted">{m.user.email}</span>
                </span>
              </span>
              {canManage && m.role !== "OWNER" && !m.isMe ? (
                <span className="flex items-center gap-2">
                  <Select
                    aria-label={`Rôle de ${m.user.name}`}
                    value={m.role}
                    onChange={async (e) => {
                      const res = await updateMemberRole(m.id, e.target.value);
                      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.error);
                    }}
                    className="h-8 w-40 text-[13px]"
                  >
                    <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                    <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                    <option value="VIEWER">{ROLE_LABELS.VIEWER}</option>
                  </Select>
                  <button
                    onClick={async () => {
                      if (!(await confirm({ title: `Retirer ${m.user.name} ?`, description: "Cette personne perdra immédiatement l'accès à l'espace.", confirmLabel: "Retirer", danger: true }))) return;
                      const res = await removeMember(m.id);
                      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.error);
                    }}
                    className="rounded-md p-1.5 text-faint hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Retirer ${m.user.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <Badge tone={m.role === "OWNER" ? "brand" : "neutral"} dot={false}>{ROLE_LABELS[m.role]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Ajouter un membre"
        description="Communiquez-lui son mot de passe provisoire de manière sécurisée."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button loading={pending} onClick={() => submit(() => addMember(values), { onSuccess: () => { setOpen(false); router.refresh(); } })}>Ajouter</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nom complet" required error={errors.name}>{(p) => <Input {...p} autoFocus value={values.name} onChange={(e) => set("name", e.target.value)} />}</Field>
          <Field label="E-mail" required error={errors.email}>{(p) => <Input {...p} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />}</Field>
          <Field label="Rôle" required>
            {(p) => (
              <Select {...p} value={values.role} onChange={(e) => set("role", e.target.value)}>
                <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                <option value="VIEWER">{ROLE_LABELS.VIEWER}</option>
              </Select>
            )}
          </Field>
          <Field label="Mot de passe provisoire" required hint="8 caractères minimum, avec lettres et chiffres" error={errors.password}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} />}</Field>
        </div>
      </Dialog>
    </>
  );
}

function ProfileTab({ profile }: { profile: Props["profile"] }) {
  const router = useRouter();
  const prof = useForm(profile);
  const pw = useForm({ current: "", next: "", confirm: "" });
  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); prof.submit(() => updateProfile(prof.values), { onSuccess: () => router.refresh() }); }} noValidate>
        <Section title="Mon profil" footer={<Button type="submit" loading={prof.pending}>Enregistrer</Button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" error={prof.errors.name}>{(p) => <Input {...p} value={prof.values.name} onChange={(e) => prof.set("name", e.target.value)} />}</Field>
            <Field label="E-mail de connexion" error={prof.errors.email}>{(p) => <Input {...p} type="email" value={prof.values.email} onChange={(e) => prof.set("email", e.target.value)} />}</Field>
          </div>
        </Section>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); pw.submit(() => changePassword(pw.values), { onSuccess: () => pw.setValues({ current: "", next: "", confirm: "" }) }); }} noValidate>
        <Section title="Mot de passe" description="Le changement déconnecte vos autres appareils." footer={<Button type="submit" loading={pw.pending}><KeyRound className="h-4 w-4" /> Modifier le mot de passe</Button>}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mot de passe actuel" error={pw.errors.current}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={pw.values.current} onChange={(e) => pw.set("current", e.target.value)} />}</Field>
            <Field label="Nouveau mot de passe" error={pw.errors.next}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.values.next} onChange={(e) => pw.set("next", e.target.value)} />}</Field>
            <Field label="Confirmation" error={pw.errors.confirm}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.values.confirm} onChange={(e) => pw.set("confirm", e.target.value)} />}</Field>
          </div>
        </Section>
      </form>
    </div>
  );
}

export function SettingsView(props: Props) {
  const tabs = TABS;
  const [tab, setTab] = useState(tabs.some((t) => t.id === props.initialTab) ? props.initialTab : "entreprise");
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:px-0" aria-label="Sections des paramètres">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors", tab === t.id ? "text-ink" : "text-muted hover:text-ink")}
          >
            {tab === t.id && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-line),var(--shadow-xs)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <t.icon className={cn("relative h-4 w-4", tab === t.id ? "text-brand-700" : "text-faint")} />
            <span className="relative">{t.label}</span>
          </button>
        ))}
        <div className="mt-4 hidden rounded-xl bg-surface p-4 text-xs text-muted shadow-[var(--shadow-ring)] lg:block">
          <p className="flex items-center gap-1.5 font-medium text-ink-soft"><Landmark className="h-3.5 w-3.5" /> Votre espace</p>
          <p className="mt-2 tabular">{props.usage.customers} clients · {props.usage.quotes} devis · {props.usage.invoices} factures</p>
          <p className="mt-1 flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" /> Données isolées et sécurisées</p>
        </div>
      </nav>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease }}>
          {!props.perms.settings && (tab === "entreprise" || tab === "documents" || tab === "tva") && (
            <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 ring-1 ring-inset ring-amber-200">Lecture seule : seuls les administrateurs peuvent modifier ces paramètres.</p>
          )}
          {tab === "entreprise" && <CompanyTab initial={props.company} canEdit={props.perms.settings} />}
          {tab === "documents" && <DocumentsTab initial={props.documents} taxRates={props.taxRates} canEdit={props.perms.settings} />}
          {tab === "tva" && <TaxTab taxRates={props.taxRates} canEdit={props.perms.settings} />}
          {tab === "equipe" && <TeamTab members={props.members} canManage={props.perms.members} />}
          {tab === "profil" && <ProfileTab profile={props.profile} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
