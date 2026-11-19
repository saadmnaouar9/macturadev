"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Box, Wrench } from "lucide-react";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Select, Switch, Textarea } from "@/components/ui/field";
import { useForm } from "@/hooks/use-form";
import { centsToInput, formatMAD, parseAmountToCents } from "@/lib/money";
import { computeTotals } from "@/lib/calc";
import { saveProduct } from "@/app/(app)/produits/actions";
import type { CategoryItem } from "./categories-dialog";

export interface ProductValue {
  id?: string;
  type: "PRODUCT" | "SERVICE";
  name: string;
  description: string | null;
  sku: string | null;
  unit: string;
  unitPrice: number;
  taxRate: number;
  categoryId: string | null;
  active: boolean;
}

export const UNITS = ["unité", "forfait", "heure", "jour", "mois", "an", "kg", "m", "m²", "m³", "litre", "lot", "pièce", "session", "utilisateur"];

type FormValues = { [k: string]: unknown; type: "PRODUCT" | "SERVICE"; name: string; description: string; sku: string; unit: string; price: string; taxRate: string; categoryId: string; active: boolean };

function toForm(p: ProductValue | null, defaultTaxRate: number): FormValues {
  return {
    type: p?.type ?? "SERVICE",
    name: p?.name ?? "",
    description: p?.description ?? "",
    sku: p?.sku ?? "",
    unit: p?.unit ?? "unité",
    price: p ? centsToInput(p.unitPrice) : "",
    taxRate: String(p?.taxRate ?? defaultTaxRate),
    categoryId: p?.categoryId ?? "",
    active: p?.active ?? true,
  };
}

export function ProductDrawer({
  open, onOpenChange, product, categories, taxRates, defaultTaxRate, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; product: ProductValue | null; categories: CategoryItem[];
  taxRates: { name: string; rate: number }[]; defaultTaxRate: number; onSaved: () => void;
}) {
  const { values, set, setValues, errors, setErrors, pending, submit } = useForm<FormValues>(toForm(product, defaultTaxRate));

  useEffect(() => {
    if (open) {
      setValues(toForm(product, defaultTaxRate));
      setErrors({});
    }
  }, [open, product, defaultTaxRate, setValues, setErrors]);

  const cents = parseAmountToCents(values.price);
  const rate = Number(values.taxRate);
  const ttc = cents !== null ? computeTotals([{ quantity: 1000, unitPrice: cents, discount: 0, taxRate: rate }]).total : null;

  const onSubmit = () => {
    if (cents === null) {
      setErrors({ unitPrice: "Saisissez un prix valide (ex. 1 250,00)" });
      return;
    }
    submit(
      () => saveProduct(product?.id ?? null, {
        type: values.type, name: values.name, description: values.description, sku: values.sku, unit: values.unit,
        unitPrice: cents, taxRate: rate, categoryId: values.categoryId || null, active: values.active,
      }),
      { onSuccess: onSaved },
    );
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={product?.id ? "Modifier l'article" : "Nouvel article"}
      description="Les modifications n'affectent pas les documents déjà créés."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={onSubmit} loading={pending}>{product?.id ? "Enregistrer" : "Ajouter au catalogue"}</Button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <SegmentedControl
          layoutId="product-kind"
          value={values.type}
          onChange={(v) => set("type", v)}
          className="w-full"
          options={[
            { value: "SERVICE", label: <><Wrench className="h-3.5 w-3.5" /> Service</> },
            { value: "PRODUCT", label: <><Box className="h-3.5 w-3.5" /> Produit</> },
          ]}
        />
        <Field label="Désignation" required error={errors.name}>
          {(p) => <Input {...p} autoFocus value={values.name} onChange={(e) => set("name", e.target.value)} placeholder={values.type === "SERVICE" ? "Développement site vitrine" : "Ordinateur portable 14\""} />}
        </Field>
        <Field label="Description" hint="Reprise sous la désignation sur vos documents" error={errors.description}>
          {(p) => <Textarea {...p} rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Détails, caractéristiques, conditions…" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Référence (SKU)" error={errors.sku}>
            {(p) => <Input {...p} value={values.sku} onChange={(e) => set("sku", e.target.value)} placeholder="REF-001" className="font-mono text-[13px]" />}
          </Field>
          <Field label="Catégorie" error={errors.categoryId}>
            {(p) => (
              <Select {...p} value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Sans catégorie</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
        </div>

        <div className="rounded-xl bg-canvas p-4 ring-1 ring-inset ring-line-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prix unitaire HT" required error={errors.unitPrice}>
              {(p) => <Input {...p} inputMode="decimal" value={values.price} onChange={(e) => { set("price", e.target.value); setErrors({}); }} placeholder="0,00" trailing="DH" className="tabular" />}
            </Field>
            <Field label="Unité" error={errors.unit}>
              {(p) => (
                <>
                  <Input {...p} list="units" value={values.unit} onChange={(e) => set("unit", e.target.value)} />
                  <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
                </>
              )}
            </Field>
            <Field label="TVA" error={errors.taxRate}>
              {(p) => (
                <Select {...p} value={values.taxRate} onChange={(e) => set("taxRate", e.target.value)}>
                  {taxRates.map((t) => <option key={t.rate} value={t.rate}>{t.name}</option>)}
                </Select>
              )}
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Prix TTC</p>
              <motion.p key={ttc ?? "x"} initial={{ opacity: 0.4, y: 2 }} animate={{ opacity: 1, y: 0 }} className="flex h-9 items-center text-base font-semibold tabular text-ink">
                {ttc !== null ? formatMAD(ttc) : "—"}
              </motion.p>
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl p-1">
          <span>
            <span className="block text-sm font-medium text-ink">Article actif</span>
            <span className="block text-xs text-muted">Les articles inactifs ne sont plus proposés dans les documents.</span>
          </span>
          <Switch checked={values.active} onChange={(v) => set("active", v)} label="Article actif" />
        </label>
      </form>
    </Drawer>
  );
}
