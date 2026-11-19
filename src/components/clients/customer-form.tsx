"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Landmark, MapPin, NotebookPen, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, SegmentedControl, Textarea } from "@/components/ui/field";
import { useForm } from "@/hooks/use-form";
import { MOROCCAN_CITIES } from "@/lib/cities";
import { createCustomer, updateCustomer } from "@/app/(app)/clients/actions";

export interface CustomerFormValues {
  [key: string]: unknown;
  type: "COMPANY" | "INDIVIDUAL";
  name: string;
  nameAr: string;
  contactName: string;
  email: string;
  phone: string;
  mobile: string;
  ice: string;
  taxId: string;
  rc: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  paymentDays: string;
  notes: string;
}

export const emptyCustomer: CustomerFormValues = {
  type: "COMPANY", name: "", nameAr: "", contactName: "", email: "", phone: "", mobile: "", ice: "", taxId: "", rc: "",
  address: "", city: "", postalCode: "", country: "Maroc", paymentDays: "", notes: "",
};

function Section({ icon: Icon, title, description, children, index }: { icon: typeof Building2; title: string; description: string; children: React.ReactNode; index: number }) {
  return (
    <motion.section
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="grid gap-6 border-b border-line-soft px-5 py-6 last:border-0 sm:px-6 lg:grid-cols-[240px_1fr]"
    >
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </motion.section>
  );
}

export interface CreatedCustomer {
  id: string; name: string; nameAr: string | null; contactName: string | null; city: string | null; address: string | null; postalCode: string | null;
  ice: string | null; taxId: string | null; rc: string | null; email: string | null; paymentDays: number | null;
}

export function CustomerForm({ initial, customerId, onCreated, onCancel, compact }: { initial?: CustomerFormValues; customerId?: string; onCreated?: (c: CreatedCustomer) => void; onCancel?: () => void; compact?: boolean }) {
  const router = useRouter();
  const { values, set, errors, pending, submit } = useForm<CustomerFormValues>(initial ?? emptyCustomer);
  const isCompany = values.type === "COMPANY";

  const payload = () => ({ ...values, paymentDays: values.paymentDays === "" ? null : Number(values.paymentDays) });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId) {
      submit(() => updateCustomer(customerId, payload()), { onSuccess: () => { router.push(`/clients/${customerId}`); router.refresh(); } });
    } else {
      submit(() => createCustomer(payload()), {
        onSuccess: (c) => {
          if (onCreated) onCreated(c);
          else router.push(`/clients/${c.id}`);
        },
      });
    }
  };

  let i = 0;
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className={compact ? "shadow-none" : undefined}>
        <Section index={i++} icon={UserRound} title="Identité" description="Particulier ou entreprise. Le nom apparaît sur vos devis et factures.">
          <div className="sm:col-span-2">
            <SegmentedControl
              layoutId="customer-type"
              value={values.type}
              onChange={(v) => set("type", v)}
              options={[
                { value: "COMPANY", label: <><Building2 className="h-3.5 w-3.5" /> Entreprise</> },
                { value: "INDIVIDUAL", label: <><UserRound className="h-3.5 w-3.5" /> Particulier</> },
              ]}
              className="w-full sm:w-auto"
            />
          </div>
          <Field label={isCompany ? "Raison sociale" : "Nom complet"} required error={errors.name} className="sm:col-span-2">
            {(p) => <Input {...p} autoFocus value={values.name} onChange={(e) => set("name", e.target.value)} placeholder={isCompany ? "Atlas Logistique SARL" : "Adil Moussaoui"} />}
          </Field>
          <Field label="Nom en arabe" hint="Facultatif — affiché sur les documents" error={errors.nameAr}>
            {(p) => <Input {...p} dir="rtl" lang="ar" value={values.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="الاسم بالعربية" className="text-right" />}
          </Field>
          {isCompany && (
            <Field label="Contact principal" error={errors.contactName}>
              {(p) => <Input {...p} value={values.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Nadia Chraibi" />}
            </Field>
          )}
        </Section>

        <Section index={i++} icon={Phone} title="Coordonnées" description="Pour envoyer vos documents et relancer vos paiements.">
          <Field label="E-mail" error={errors.email} className="sm:col-span-2">
            {(p) => <Input {...p} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@entreprise.ma" />}
          </Field>
          <Field label="Téléphone fixe" error={errors.phone}>
            {(p) => <Input {...p} type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0522 00 00 00" />}
          </Field>
          <Field label="Mobile" error={errors.mobile}>
            {(p) => <Input {...p} type="tel" value={values.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="0661 00 00 00" />}
          </Field>
        </Section>

        <AnimatePresence initial={false}>
          {isCompany && (
            <Section key="legal" index={i++} icon={Landmark} title="Informations légales" description="Identifiants obligatoires sur les factures entre professionnels au Maroc.">
              <Field label="ICE" hint="Identifiant Commun de l'Entreprise — 15 chiffres" error={errors.ice} className="sm:col-span-2">
                {(p) => (
                  <Input {...p} inputMode="numeric" maxLength={15} value={values.ice} onChange={(e) => set("ice", e.target.value.replace(/\D/g, ""))} placeholder="001234567000089" className="tabular tracking-wide" trailing={`${values.ice.length}/15`} />
                )}
              </Field>
              <Field label="IF" hint="Identifiant fiscal" error={errors.taxId}>
                {(p) => <Input {...p} inputMode="numeric" value={values.taxId} onChange={(e) => set("taxId", e.target.value.replace(/\D/g, ""))} placeholder="12345678" className="tabular" />}
              </Field>
              <Field label="RC" hint="Registre de commerce" error={errors.rc}>
                {(p) => <Input {...p} value={values.rc} onChange={(e) => set("rc", e.target.value)} placeholder="123456" className="tabular" />}
              </Field>
            </Section>
          )}
        </AnimatePresence>

        <Section index={i++} icon={MapPin} title="Adresse" description="Adresse de facturation.">
          <Field label="Adresse" error={errors.address} className="sm:col-span-2">
            {(p) => <Input {...p} value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Bd Zerktouni, Imm. 12, 3e étage" />}
          </Field>
          <Field label="Ville" error={errors.city}>
            {(p) => (
              <>
                <Input {...p} list="ma-cities" value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Casablanca" />
                <datalist id="ma-cities">
                  {MOROCCAN_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Code postal" error={errors.postalCode}>
            {(p) => <Input {...p} inputMode="numeric" maxLength={5} value={values.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, ""))} placeholder="20000" className="tabular" />}
          </Field>
          <Field label="Pays" error={errors.country}>
            {(p) => <Input {...p} value={values.country} onChange={(e) => set("country", e.target.value)} />}
          </Field>
        </Section>

        <Section index={i++} icon={NotebookPen} title="Conditions & notes" description="Délai de paiement appliqué par défaut aux factures de ce client.">
          <Field label="Délai de paiement" hint="Laisser vide pour utiliser le délai de l'entreprise" error={errors.paymentDays}>
            {(p) => <Input {...p} inputMode="numeric" value={values.paymentDays} onChange={(e) => set("paymentDays", e.target.value.replace(/\D/g, ""))} placeholder="30" trailing="jours" />}
          </Field>
          <Field label="Notes internes" error={errors.notes} className="sm:col-span-2">
            {(p) => <Textarea {...p} value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Informations utiles, préférences, historique…" />}
          </Field>
        </Section>

        <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-xl border-t border-line-soft bg-surface/90 px-5 py-3.5 backdrop-blur sm:px-6">
          <Button variant="secondary" onClick={() => (onCancel ? onCancel() : router.back())} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {customerId ? "Enregistrer les modifications" : "Créer le client"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
