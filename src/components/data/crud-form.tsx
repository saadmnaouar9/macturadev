"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { centsToInput, formatRate, parseAmountToCents, parseRate } from "@/lib/money";

export type FieldType = "text" | "email" | "tel" | "textarea" | "number" | "money" | "percent" | "date" | "select" | "switch";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  numeric?: boolean; // select dont la valeur est convertie en entier
  required?: boolean;
  hint?: string;
  placeholder?: string;
  span?: boolean;
  dir?: "rtl";
  digits?: boolean; // n'accepte que des chiffres
  maxLength?: number;
  trailing?: string;
  mono?: boolean;
}

export type FormValues = Record<string, string | boolean>;
type Row = Record<string, unknown>;

export function toFormValues(fields: FieldDef[], row?: Row | null, defaults: FormValues = {}): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const raw = row ? row[f.name] : undefined;
    if (raw === undefined || raw === null) {
      out[f.name] = f.name in defaults ? defaults[f.name] : f.type === "switch" ? false : f.type === "select" && f.required && f.options?.[0] && !row ? f.options[0].value : "";
      continue;
    }
    if (f.type === "money") out[f.name] = centsToInput(raw as number);
    else if (f.type === "percent") out[f.name] = raw ? formatRate(raw as number) : "";
    else if (f.type === "date") out[f.name] = String(raw).slice(0, 10);
    else if (f.type === "switch") out[f.name] = Boolean(raw);
    else out[f.name] = String(raw);
  }
  return out;
}

/** Convertit la saisie en charge utile typée (centimes, entiers, dates ISO). */
export function fromFormValues(fields: FieldDef[], values: FormValues) {
  const payload: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === "switch") { payload[f.name] = Boolean(v); continue; }
    const s = String(v ?? "").trim();
    if (s === "") {
      if (f.required) errors[f.name] = "Champ requis";
      payload[f.name] = f.type === "text" || f.type === "email" || f.type === "tel" || f.type === "textarea" || f.type === "select" ? "" : null;
      continue;
    }
    if (f.type === "money") {
      const c = parseAmountToCents(s);
      if (c === null) errors[f.name] = "Montant invalide";
      payload[f.name] = c;
    } else if (f.type === "percent") {
      const r = parseRate(s);
      if (r === null) errors[f.name] = "Taux invalide";
      payload[f.name] = r;
    } else if (f.type === "number" || (f.type === "select" && f.numeric)) {
      const n = Number(s);
      if (!Number.isInteger(n)) errors[f.name] = "Nombre entier requis";
      payload[f.name] = n;
    } else payload[f.name] = s;
  }
  return { payload, errors };
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial: FormValues;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }>;
  onSaved: () => void;
}

export function CrudDrawer({ open, onOpenChange, title, description, fields, initial, submitLabel, onSubmit, onSaved }: Props) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (open) {
      setValues(initial);
      setErrors({});
      lock.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (name: string, v: string | boolean) => {
    setValues((s) => ({ ...s, [name]: v }));
    setErrors((e) => {
      if (!e[name]) return e;
      const n = { ...e };
      delete n[name];
      return n;
    });
  };

  const submit = async () => {
    if (lock.current) return;
    const { payload, errors: errs } = fromFormValues(fields, values);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    lock.current = true;
    setPending(true);
    try {
      const res = await onSubmit(payload);
      if (res.ok) {
        if (res.message) toast.success(res.message);
        onSaved();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        lock.current = false;
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={submit} loading={pending}>{submitLabel}</Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {fields.map((f, i) => {
          const v = values[f.name];
          const span = f.span || f.type === "textarea" || f.type === "switch";
          const cls = span ? "sm:col-span-2" : undefined;
          if (f.type === "switch") {
            return (
              <label key={f.name} className="flex items-center justify-between gap-4 rounded-xl bg-canvas px-3.5 py-3 ring-1 ring-inset ring-line-soft sm:col-span-2">
                <span className="text-sm font-medium text-ink">{f.label}{f.hint && <span className="block text-xs font-normal text-muted">{f.hint}</span>}</span>
                <Switch checked={Boolean(v)} onChange={(x) => set(f.name, x)} label={f.label} />
              </label>
            );
          }
          return (
            <Field key={f.name} label={f.label} required={f.required} hint={f.hint} error={errors[f.name]} className={cls}>
              {(p) => {
                if (f.type === "textarea") return <Textarea {...p} rows={3} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />;
                if (f.type === "select")
                  return (
                    <Select {...p} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)}>
                      {!f.required && <option value="">—</option>}
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  );
                if (f.type === "date") return <DatePicker {...p} value={String(v ?? "")} onChange={(d) => set(f.name, d)} invalid={!!errors[f.name]} />;
                const money = f.type === "money";
                return (
                  <Input
                    {...p}
                    autoFocus={i === 0}
                    type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                    inputMode={money || f.type === "percent" ? "decimal" : f.type === "number" || f.digits ? "numeric" : undefined}
                    dir={f.dir}
                    maxLength={f.maxLength}
                    value={String(v ?? "")}
                    onChange={(e) => set(f.name, f.digits ? e.target.value.replace(/\D/g, "") : e.target.value)}
                    placeholder={f.placeholder ?? (money ? "0,00" : undefined)}
                    trailing={f.trailing ?? (money ? "DH" : f.type === "percent" ? "%" : undefined)}
                    className={`${money || f.type === "number" || f.mono ? "tabular" : ""} ${f.dir === "rtl" ? "text-right" : ""}`}
                  />
                );
              }}
            </Field>
          );
        })}
      </form>
    </Drawer>
  );
}
