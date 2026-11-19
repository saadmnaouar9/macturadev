"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AlignLeft, ArrowDown, ArrowUp, Box, Check, CircleAlert, Copy, Eye, History, Loader2, Package, PencilLine, Plus, Send, Trash2, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Combobox, type ComboItem } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, Input, Label, SegmentedControl, Textarea, inputBase } from "@/components/ui/field";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { CustomerForm } from "@/components/clients/customer-form";
import { computeTotals, type DiscountKind } from "@/lib/calc";
import { centsToInput, formatMAD, formatQuantity, formatRate, parseAmountToCents, parseQuantity, parseRate } from "@/lib/money";
import { amountToFrenchWords } from "@/lib/number-to-words";
import { addDays, cn, toDateInput } from "@/lib/utils";
import { saveQuote } from "@/app/(app)/devis/actions";
import { issueInvoice, saveInvoice } from "@/app/(app)/factures/actions";
import { DocumentPaper, type PaperCompany } from "./document-paper";
import { blankItem, itemFromDb, newKey, type EditorCustomer, type EditorInitial, type EditorItem, type EditorProduct } from "./editor-model";

export type { EditorCustomer, EditorInitial, EditorItem, EditorProduct };

const ease = [0.16, 1, 0.3, 1] as const;

const parseDiscount = (type: DiscountKind, s: string) => (type === "AMOUNT" ? parseAmountToCents(s || "0") : parseRate(s || "0"));

function parseItem(it: EditorItem) {
  return {
    quantity: parseQuantity(it.quantity || "0"),
    unitPrice: parseAmountToCents(it.unitPrice || "0"),
    discount: parseDiscount(it.discountType, it.discount),
    discountType: it.discountType,
    taxRate: it.taxRate,
  };
}

type SaveState = "saved" | "dirty" | "saving" | "new";

const cellInput =
  "h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-ink transition-[border-color,background-color,box-shadow] hover:border-line hover:bg-surface focus:border-brand-400 focus:bg-surface focus:shadow-[var(--shadow-focus)] focus:outline-none placeholder:text-faint aria-[invalid=true]:border-rose-300 aria-[invalid=true]:bg-rose-50/40 max-lg:border-line max-lg:bg-surface";

function DiscountToggle({ value, onChange, label }: { value: DiscountKind; onChange: (v: DiscountKind) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === "PERCENT" ? "AMOUNT" : "PERCENT")}
      aria-label={`${label} : ${value === "PERCENT" ? "pourcentage" : "montant fixe en dirhams"}. Cliquer pour changer.`}
      title={value === "PERCENT" ? "Remise en % — cliquer pour un montant fixe" : "Remise en DH — cliquer pour un pourcentage"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-muted ring-1 ring-inset ring-line transition-colors hover:bg-subtle hover:text-ink focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
    >
      {value === "PERCENT" ? "%" : "DH"}
    </button>
  );
}

/** Ligne d'article mémoïsée : seule la ligne modifiée est re-rendue à chaque frappe (et non les N lignes du document). */
const LineRow = memo(function LineRow({
  it, i, count, lineNet, lineDiscount, errors, products, taxRates, onUpdate, onRemove, onMove, onDuplicate,
}: {
  it: EditorItem; i: number; count: number; lineNet: number; lineDiscount: number; errors: Record<string, string>;
  products: EditorProduct[]; taxRates: { name: string; rate: number }[];
  onUpdate: (key: string, patch: Partial<EditorItem>) => void; onRemove: (key: string) => void; onMove: (key: string, dir: -1 | 1) => void; onDuplicate: (it: EditorItem) => void;
}) {
  const n = i + 1;
  const err = (f: string) => errors[`items.${i}.${f}`];
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease }}
      className="group/line overflow-hidden border-b border-line-soft"
    >
      <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4 lg:grid-cols-[20px_minmax(0,1fr)_76px_76px_108px_118px_84px_108px_32px] lg:items-start lg:py-2">
        <div className="hidden flex-col items-center pt-1 lg:flex">
          <span className="flex h-7 w-5 items-center justify-center text-[11px] font-medium tabular text-faint group-focus-within/line:hidden group-hover/line:hidden">{n}</span>
          <span className="hidden flex-col group-focus-within/line:flex group-hover/line:flex">
            <button type="button" onClick={() => onMove(it.key, -1)} disabled={i === 0} className="rounded p-0.5 text-faint hover:text-ink disabled:opacity-20" aria-label={`Monter la ligne ${n}`}><ArrowUp className="h-3 w-3" /></button>
            <button type="button" onClick={() => onMove(it.key, 1)} disabled={i === count - 1} className="rounded p-0.5 text-faint hover:text-ink disabled:opacity-20" aria-label={`Descendre la ligne ${n}`}><ArrowDown className="h-3 w-3" /></button>
          </span>
        </div>
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <label htmlFor={`d-${it.key}`} className="mb-1 block text-xs font-medium text-muted lg:sr-only">Désignation (ligne {n})</label>
          <div className="flex items-center gap-1">
            {it.productId && (
              <span title="Article du catalogue" className="hidden shrink-0 text-faint lg:block">
                {products.find((p) => p.id === it.productId)?.type === "SERVICE" ? <Wrench className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
              </span>
            )}
            <input id={`d-${it.key}`} dir="auto" aria-invalid={!!err("description") || undefined} value={it.description} onChange={(e) => onUpdate(it.key, { description: e.target.value })} placeholder="Désignation de l'article ou du service" className={cn(cellInput, "font-medium")} />
          </div>
          <AnimatePresence initial={false}>
            {it.showDetails && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <textarea dir="auto" rows={2} aria-label={`Description détaillée (ligne ${n})`} value={it.details} onChange={(e) => onUpdate(it.key, { details: e.target.value })} placeholder="Description détaillée (facultatif)" className={cn(cellInput, "mt-1 h-auto resize-y py-1.5 text-[13px] text-ink-soft")} />
              </motion.div>
            )}
          </AnimatePresence>
          {err("description") && <p className="mt-1 px-2 text-xs text-rose-600">{err("description")}</p>}
        </div>
        <div>
          <label htmlFor={`q-${it.key}`} className="mb-1 block text-xs font-medium text-muted lg:sr-only">Quantité (ligne {n})</label>
          <input id={`q-${it.key}`} inputMode="decimal" aria-invalid={!!err("quantity") || undefined} value={it.quantity} onChange={(e) => onUpdate(it.key, { quantity: e.target.value })} className={cn(cellInput, "text-right tabular")} />
          {err("quantity") && <p className="mt-1 text-right text-[11px] text-rose-600">{err("quantity")}</p>}
        </div>
        <div>
          <label htmlFor={`u-${it.key}`} className="mb-1 block text-xs font-medium text-muted lg:sr-only">Unité (ligne {n})</label>
          <input id={`u-${it.key}`} value={it.unit} list="editor-units" onChange={(e) => onUpdate(it.key, { unit: e.target.value })} className={cellInput} />
        </div>
        <div>
          <label htmlFor={`p-${it.key}`} className="mb-1 block text-xs font-medium text-muted lg:sr-only">Prix unitaire HT (ligne {n})</label>
          <input id={`p-${it.key}`} inputMode="decimal" aria-invalid={!!err("unitPrice") || undefined} value={it.unitPrice} onChange={(e) => onUpdate(it.key, { unitPrice: e.target.value })} placeholder="0,00" className={cn(cellInput, "text-right tabular")} />
          {err("unitPrice") && <p className="mt-1 text-right text-[11px] text-rose-600">{err("unitPrice")}</p>}
        </div>
        <div>
          <label htmlFor={`r-${it.key}`} className="mb-1 block text-xs font-medium text-muted lg:sr-only">Remise (ligne {n})</label>
          <div className="flex gap-1">
            <input id={`r-${it.key}`} inputMode="decimal" aria-invalid={!!err("discount") || undefined} value={it.discount} onChange={(e) => onUpdate(it.key, { discount: e.target.value })} placeholder="0" className={cn(cellInput, "min-w-0 text-right tabular")} />
            <DiscountToggle value={it.discountType} onChange={(t) => onUpdate(it.key, { discountType: t, discount: "" })} label={`Type de remise, ligne ${n}`} />
          </div>
          {err("discount") && <p className="mt-1 text-right text-[11px] text-rose-600">{err("discount")}</p>}
        </div>
        <div>
          <label htmlFor={`t-${it.key}`} className="mb-1 block text-xs font-medium text-muted lg:sr-only">TVA (ligne {n})</label>
          <select id={`t-${it.key}`} value={it.taxRate} onChange={(e) => onUpdate(it.key, { taxRate: Number(e.target.value) })} className={cn(cellInput, "cursor-pointer appearance-none pr-1")}>
            {taxRates.map((t) => <option key={t.rate} value={t.rate}>{formatRate(t.rate)} %</option>)}
            {!taxRates.some((t) => t.rate === it.taxRate) && <option value={it.taxRate}>{formatRate(it.taxRate)} %</option>}
          </select>
        </div>
        <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:block lg:pt-2 lg:text-right">
          <span className="text-xs font-medium text-muted lg:hidden">Total HT</span>
          <span className="text-sm font-semibold tabular text-ink" aria-label={`Total HT ligne ${n}`}>{formatMAD(lineNet)}</span>
          {lineDiscount > 0 && <span className="block text-[11px] tabular text-emerald-600 max-lg:hidden">−{formatMAD(lineDiscount)}</span>}
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-4 lg:col-span-1 lg:flex-col lg:pt-0.5">
          <button type="button" aria-pressed={it.showDetails} onClick={() => onUpdate(it.key, { showDetails: !it.showDetails })} className={cn("rounded-md p-1.5 transition-colors hover:bg-subtle", it.showDetails ? "text-brand-600" : "text-faint hover:text-ink")} aria-label={`Description détaillée, ligne ${n}`} title="Description détaillée">
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onRemove(it.key)} className="rounded-md p-1.5 text-faint transition-colors hover:bg-rose-50 hover:text-rose-600" aria-label={`Supprimer la ligne ${n}`} title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDuplicate(it)} className="rounded-md p-1.5 text-faint transition-colors hover:bg-subtle hover:text-ink lg:hidden" aria-label={`Dupliquer la ligne ${n}`}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <span className="flex gap-1 lg:hidden">
            <button type="button" onClick={() => onMove(it.key, -1)} disabled={i === 0} className="rounded-md p-1.5 text-faint hover:bg-subtle disabled:opacity-20" aria-label={`Monter la ligne ${n}`}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onMove(it.key, 1)} disabled={i === count - 1} className="rounded-md p-1.5 text-faint hover:bg-subtle disabled:opacity-20" aria-label={`Descendre la ligne ${n}`}><ArrowDown className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      </div>
    </motion.li>
  );
});


function SaveIndicator({ state }: { state: SaveState }) {
  const cfg = {
    saved: { icon: Check, text: "Enregistré", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200/70" },
    dirty: { icon: CircleAlert, text: "Modifications non enregistrées", cls: "bg-amber-50 text-amber-700 ring-amber-200/80" },
    saving: { icon: Loader2, text: "Enregistrement…", cls: "bg-brand-50 text-brand-700 ring-brand-200/70" },
    new: { icon: PencilLine, text: "Nouveau document — non enregistré", cls: "bg-subtle text-muted ring-line" },
  }[state];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 3 }}
        transition={{ duration: 0.18 }}
        className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", cfg.cls)}
      >
        <cfg.icon className={cn("h-3.5 w-3.5", state === "saving" && "animate-spin")} />
        {cfg.text}
      </motion.span>
    </AnimatePresence>
  );
}

export function DocumentEditor({
  kind,
  documentId,
  documentNumber,
  initial,
  customers: initialCustomers,
  products,
  taxRates,
  defaultTaxRate,
  defaultPaymentDays,
  validityDays,
  canIssue,
  company,
}: {
  kind: "quote" | "invoice";
  documentId?: string;
  documentNumber?: string | null;
  initial: EditorInitial;
  customers: EditorCustomer[];
  products: EditorProduct[];
  taxRates: { name: string; rate: number }[];
  defaultTaxRate: number;
  defaultPaymentDays: number;
  validityDays: number;
  canIssue?: boolean;
  company: PaperCompany;
}) {
  const router = useRouter();
  const isQuote = kind === "quote";
  const [v, setV] = useState<EditorInitial>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState(initialCustomers);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>(documentId ? "saved" : "new");
  const [backup, setBackup] = useState<EditorInitial | null>(null);
  // Verrou synchrone : empêche tout double enregistrement (⌘S répété, double clic…)
  const savingRef = useRef(false);
  const doneRef = useRef(false);
  const storageKey = `mactura:draft:${kind}:${documentId ?? "new"}`;

  const markDirty = useCallback(() => setSaveState((s) => (s === "saving" ? s : "dirty")), []);

  // Sauvegarde locale des modifications non enregistrées (restaurable)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; data: EditorInitial };
        if (Date.now() - parsed.at < 7 * 86400_000 && JSON.stringify(parsed.data) !== JSON.stringify(initial)) setBackup(parsed.data);
        else localStorage.removeItem(storageKey);
      }
    } catch {
      /* stockage indisponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), data: v }));
      } catch {
        /* stockage indisponible */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [v, saveState, storageKey]);

  const clearError = (k: string) =>
    setErrors((e) => {
      if (!e[k]) return e;
      const n = { ...e };
      delete n[k];
      return n;
    });

  const update = useCallback(
    <K extends keyof EditorInitial>(k: K, value: EditorInitial[K]) => {
      setV((s) => ({ ...s, [k]: value }));
      markDirty();
      clearError(k as string);
    },
    [markDirty],
  );

  // Gestionnaires stables (identité constante) : indispensable pour que les lignes mémoïsées ne se re-rendent pas
  const itemsRef = useRef(v.items);
  itemsRef.current = v.items;
  const updateItem = useCallback(
    (key: string, patch: Partial<EditorItem>) => {
      const idx = itemsRef.current.findIndex((i) => i.key === key);
      setV((s) => ({ ...s, items: s.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
      markDirty();
      setErrors((e) => {
        const dead = [...Object.keys(patch).map((f) => `items.${idx}.${f}`), ...(patch.discountType ? [`items.${idx}.discount`] : []), "items"].filter((k) => k in e);
        if (dead.length === 0) return e; // aucune erreur à retirer : on conserve le même objet (pas de re-rendu)
        const n = { ...e };
        for (const k of dead) delete n[k];
        return n;
      });
    },
    [markDirty],
  );

  const addItem = useCallback(
    (item?: EditorItem) => {
      setV((s) => ({ ...s, items: [...s.items, item ?? blankItem(defaultTaxRate)] }));
      markDirty();
    },
    [markDirty, defaultTaxRate],
  );
  const duplicateItem = useCallback(
    (it: EditorItem) => {
      setV((s) => ({ ...s, items: [...s.items, { ...it, key: newKey() }] }));
      markDirty();
    },
    [markDirty],
  );
  const removeItem = useCallback(
    (key: string) => {
      setV((s) => ({ ...s, items: s.items.length > 1 ? s.items.filter((i) => i.key !== key) : [blankItem(defaultTaxRate)] }));
      setErrors({});
      markDirty();
    },
    [markDirty, defaultTaxRate],
  );
  const moveItem = useCallback(
    (key: string, dir: -1 | 1) => {
      setV((s) => {
        const i = s.items.findIndex((x) => x.key === key);
        const j = i + dir;
        if (j < 0 || j >= s.items.length) return s;
        const items = [...s.items];
        [items[i], items[j]] = [items[j], items[i]];
        return { ...s, items };
      });
      setErrors({});
      markDirty();
    },
    [markDirty],
  );

  const insertProduct = (p: EditorProduct) => {
    const item: EditorItem = {
      key: newKey(), productId: p.id, description: p.name, details: p.description ?? "", showDetails: !!p.description,
      quantity: "1", unit: p.unit, unitPrice: centsToInput(p.unitPrice), discountType: "PERCENT", discount: "", taxRate: p.taxRate,
    };
    setV((s) => {
      const last = s.items[s.items.length - 1];
      const isEmpty = last && !last.description && !last.unitPrice;
      return { ...s, items: isEmpty ? [...s.items.slice(0, -1), item] : [...s.items, item] };
    });
    clearError("items");
    markDirty();
  };

  // Calculs en direct — même moteur que le serveur
  const parsed = v.items.map(parseItem);
  const globalValue = parseDiscount(v.globalDiscountType, v.globalDiscount);
  const parsedKey = JSON.stringify(parsed);
  const totals = useMemo(
    () =>
      computeTotals(
        parsed.map((p) => ({ quantity: p.quantity ?? 0, unitPrice: p.unitPrice ?? 0, discountType: p.discountType, discount: p.discount ?? 0, taxRate: p.taxRate })),
        { type: v.globalDiscountType, value: globalValue ?? 0 },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedKey, globalValue, v.globalDiscountType],
  );

  const selectedCustomer = customers.find((c) => c.id === v.customerId);
  const customerItems: ComboItem[] = customers.map((c) => ({ value: c.id, label: c.name, sublabel: [c.city, c.ice ? `ICE ${c.ice}` : null].filter(Boolean).join(" · ") || c.email || undefined }));
  const productItems: ComboItem[] = products.map((p) => ({ value: p.id, label: p.name, sublabel: [p.type === "SERVICE" ? "Service" : "Produit", p.sku, p.unit].filter(Boolean).join(" · "), meta: formatMAD(p.unitPrice) }));

  const onCustomerChange = (id: string, list = customers) => {
    const c = list.find((x) => x.id === id);
    setV((s) => {
      const next = { ...s, customerId: id };
      if (!isQuote && !documentId && s.issueDate) {
        const days = c?.paymentDays ?? defaultPaymentDays;
        next.secondDate = toDateInput(addDays(new Date(`${s.issueDate}T00:00:00Z`), days));
        next.paymentTerms = days === 0 ? "Paiement à réception" : `${days} jours`;
      }
      return next;
    });
    clearError("customerId");
    markDirty();
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!v.customerId) e.customerId = "Sélectionnez un client";
    if (!v.issueDate) e.issueDate = "Date requise";
    if (!v.secondDate) e.secondDate = "Date requise";
    else if (v.issueDate && v.secondDate < v.issueDate) e.secondDate = isQuote ? "Doit suivre la date d'émission" : "L'échéance doit suivre la date d'émission";
    if (globalValue === null || (v.globalDiscountType === "PERCENT" && globalValue > 10000)) e.globalDiscount = v.globalDiscountType === "PERCENT" ? "Entre 0 et 100 %" : "Montant invalide";
    else if (v.globalDiscountType === "AMOUNT" && globalValue > totals.lines.reduce((s, l) => s + l.net, 0)) e.globalDiscount = "Supérieure au total HT";
    v.items.forEach((it, i) => {
      const p = parsed[i];
      if (!it.description.trim()) e[`items.${i}.description`] = "Désignation requise";
      if (p.quantity === null || p.quantity <= 0) e[`items.${i}.quantity`] = "Quantité invalide";
      if (p.unitPrice === null || p.unitPrice < 0) e[`items.${i}.unitPrice`] = "Prix invalide";
      if (p.discount === null) e[`items.${i}.discount`] = "Remise invalide";
      else if (it.discountType === "PERCENT" && p.discount > 10000) e[`items.${i}.discount`] = "Max. 100 %";
      else if (it.discountType === "AMOUNT" && p.discount > (totals.lines[i]?.gross ?? 0)) e[`items.${i}.discount`] = "Supérieure au montant";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const payload = () => ({
    customerId: v.customerId ?? "",
    issueDate: v.issueDate,
    ...(isQuote ? { expiryDate: v.secondDate } : { dueDate: v.secondDate, paymentTerms: v.paymentTerms }),
    reference: v.reference,
    globalDiscountType: v.globalDiscountType,
    globalDiscount: globalValue ?? 0,
    notes: v.notes,
    terms: v.terms,
    items: v.items.map((it, i) => ({
      productId: it.productId,
      description: it.description,
      details: it.showDetails ? it.details : "",
      quantity: parsed[i].quantity ?? 0,
      unit: it.unit || "unité",
      unitPrice: parsed[i].unitPrice ?? 0,
      discountType: it.discountType,
      discount: parsed[i].discount ?? 0,
      taxRate: it.taxRate,
    })),
  });

  const save = async (thenIssue = false) => {
    if (savingRef.current || doneRef.current) return;
    if (!validate()) {
      setView("edit");
      toast.error("Veuillez corriger les champs en erreur.");
      return;
    }
    savingRef.current = true;
    const previous = saveState;
    setSaveState("saving");
    try {
      const res = isQuote ? await saveQuote(documentId ?? null, payload()) : await saveInvoice(documentId ?? null, payload());
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setSaveState(previous === "new" ? "new" : "dirty");
        toast.error(res.error);
        return;
      }
      if (thenIssue && !isQuote) {
        const issued = await issueInvoice(res.data.id);
        if (issued.ok) toast.success(`Facture ${issued.data.number} émise`);
        else toast.error(issued.error);
      } else toast.success(res.message);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* stockage indisponible */
      }
      doneRef.current = true; // le document est créé : plus aucun nouvel envoi depuis cet écran
      setSaveState("saved");
      router.push(`/${isQuote ? "devis" : "factures"}/${res.data.id}`);
          } finally {
      savingRef.current = false;
    }
  };

  // ⌘S / Ctrl+S et alerte de sortie
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!e.repeat) saveRef.current();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [saveState]);

  const quickDates = isQuote ? [15, 30, 60] : [0, 30, 60, 90];
  const saving = saveState === "saving";

  return (
    <div>
      {/* Barre d'état */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          layoutId={`editor-view-${kind}`}
          value={view}
          onChange={setView}
          options={[
            { value: "edit", label: <><PencilLine className="h-3.5 w-3.5" /> Édition</> },
            { value: "preview", label: <><Eye className="h-3.5 w-3.5" /> Aperçu</> },
          ]}
          className="w-full sm:w-auto"
        />
        <SaveIndicator state={saveState} />
      </div>

      <AnimatePresence>
        {backup && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-5 flex flex-col gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-[13px] text-amber-900">
                <History className="h-4 w-4 shrink-0" /> Des modifications non enregistrées ont été trouvées pour ce document.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { try { localStorage.removeItem(storageKey); } catch {} setBackup(null); }}>Ignorer</Button>
                <Button size="sm" onClick={() => { setV({ ...backup, items: backup.items.map((i) => ({ ...i, key: newKey() })) }); setBackup(null); setSaveState("dirty"); }}>Restaurer</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* Les deux vues restent montées : aucune saisie n'est perdue en changeant de vue */}
          <div hidden={view !== "edit"} className="space-y-5">
            <Card>
              <CardHeader title={isQuote ? "Client et validité" : "Client et échéance"} description={documentNumber ? `Numéro : ${documentNumber}` : isQuote ? "Le numéro est attribué automatiquement à la création." : "Le numéro définitif est attribué à l'émission de la facture."} />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="doc-customer" required>Client</Label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Combobox id="doc-customer" items={customerItems} value={v.customerId} onChange={(id) => onCustomerChange(id)} placeholder="Rechercher ou sélectionner un client…" searchPlaceholder="Nom, ville, ICE…" emptyText="Aucun client trouvé" invalid={!!errors.customerId} onCreate={() => setNewCustomerOpen(true)} createLabel="Nouveau client" />
                    </div>
                    <Button variant="secondary" size="icon" onClick={() => setNewCustomerOpen(true)} aria-label="Créer un nouveau client"><UserPlus className="h-4 w-4" /></Button>
                  </div>
                  <FieldError message={errors.customerId} />
                  {selectedCustomer && (
                    <p className="mt-2 text-xs text-muted">
                      {[selectedCustomer.city, selectedCustomer.ice && `ICE ${selectedCustomer.ice}`, selectedCustomer.email, selectedCustomer.paymentDays !== null && `Délai client : ${selectedCustomer.paymentDays} j`].filter(Boolean).join(" · ") || "Coordonnées incomplètes"}
                    </p>
                  )}
                </div>
                <Field label="Date d'émission" required error={errors.issueDate}>
                  {(p) => (
                    <DatePicker
                      {...p}
                      invalid={!!errors.issueDate}
                      value={v.issueDate}
                      onChange={(d) => {
                        const gap = v.issueDate && v.secondDate ? Math.round((Date.parse(v.secondDate) - Date.parse(v.issueDate)) / 86400000) : isQuote ? validityDays : defaultPaymentDays;
                        setV((s) => ({ ...s, issueDate: d, secondDate: toDateInput(addDays(new Date(`${d}T00:00:00Z`), Math.max(gap, 0))) }));
                        clearError("issueDate");
                        markDirty();
                      }}
                    />
                  )}
                </Field>
                <Field label={isQuote ? "Valable jusqu'au" : "Date d'échéance"} required error={errors.secondDate}>
                  {(p) => <DatePicker {...p} invalid={!!errors.secondDate} value={v.secondDate} onChange={(d) => update("secondDate", d)} />}
                </Field>
                <div className="-mt-2 flex flex-wrap gap-1.5 sm:col-span-2" role="group" aria-label={isQuote ? "Durées de validité rapides" : "Échéances rapides"}>
                  {quickDates.map((d) => {
                    const target = v.issueDate ? toDateInput(addDays(new Date(`${v.issueDate}T00:00:00Z`), d)) : "";
                    const active = target === v.secondDate;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          update("secondDate", target);
                          if (!isQuote) update("paymentTerms", d === 0 ? "Paiement à réception" : `${d} jours`);
                        }}
                        className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors", active ? "bg-brand-50 text-brand-700 ring-brand-200" : "text-muted ring-line hover:bg-subtle hover:text-ink")}
                      >
                        {d === 0 ? "À réception" : `${d} jours`}
                      </button>
                    );
                  })}
                </div>
                <Field label="Référence" hint="Bon de commande, projet… (facultatif)" error={errors.reference}>
                  {(p) => <Input {...p} value={v.reference} onChange={(e) => update("reference", e.target.value)} placeholder="BC-2026-118" />}
                </Field>
                {!isQuote && (
                  <Field label="Conditions de paiement" error={errors.paymentTerms}>
                    {(p) => <Input {...p} value={v.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} placeholder="30 jours fin de mois" />}
                  </Field>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Produits et services"
                description="Ajoutez des articles du catalogue ou saisissez des lignes libres. Remises en % ou en DH."
                action={
                  products.length > 0 && (
                    <Combobox
                      items={productItems}
                      value={null}
                      onChange={(id) => {
                        const p = products.find((x) => x.id === id);
                        if (p) insertProduct(p);
                      }}
                      searchPlaceholder="Rechercher dans le catalogue…"
                      emptyText="Aucun article"
                      renderTrigger={() => (
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface px-3 text-[13px] font-medium text-ink shadow-[0_0_0_1px_var(--color-line),var(--shadow-xs)] transition-colors hover:bg-subtle">
                          <Package className="h-4 w-4 text-faint" /> Catalogue
                        </span>
                      )}
                    />
                  )
                }
              />
              <div className="mt-4">
                <div className="hidden grid-cols-[20px_minmax(0,1fr)_76px_76px_108px_118px_84px_108px_32px] items-center gap-2 border-y border-line-soft bg-canvas/70 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-muted lg:grid" aria-hidden>
                  <span />
                  <span>Désignation</span>
                  <span className="text-right">Qté</span>
                  <span>Unité</span>
                  <span className="text-right">Prix HT</span>
                  <span className="text-right">Remise</span>
                  <span>TVA</span>
                  <span className="text-right">Total HT</span>
                  <span />
                </div>
                <ul aria-label="Lignes du document">
                  <AnimatePresence initial={false}>
                    {v.items.map((it, i) => {
                      return (
                        <LineRow
                          key={it.key}
                          it={it}
                          i={i}
                          count={v.items.length}
                          lineNet={totals.lines[i]?.net ?? 0}
                          lineDiscount={totals.lines[i]?.lineDiscount ?? 0}
                          errors={errors}
                          products={products}
                          taxRates={taxRates}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                          onMove={moveItem}
                          onDuplicate={duplicateItem}
                        />
                      );
                    })}
                  </AnimatePresence>
                </ul>
                <datalist id="editor-units">{["unité", "forfait", "heure", "jour", "mois", "an", "kg", "m", "m²", "lot", "pièce", "session", "utilisateur"].map((u) => <option key={u} value={u} />)}</datalist>
                <div className="flex flex-wrap items-center gap-2 p-4">
                  <Button variant="secondary" size="sm" onClick={() => addItem()}><Plus className="h-4 w-4" /> Ajouter une ligne</Button>
                  {errors.items && <span className="text-xs font-medium text-rose-600">{errors.items}</span>}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Notes et conditions" description="Affichées en bas du document." />
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Note au client" error={errors.notes}>
                  {(p) => <Textarea {...p} rows={4} value={v.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Merci pour votre confiance." />}
                </Field>
                <Field label={isQuote ? "Conditions de l'offre" : "Conditions de règlement"} error={errors.terms}>
                  {(p) => <Textarea {...p} rows={4} value={v.terms} onChange={(e) => update("terms", e.target.value)} placeholder={isQuote ? "Acompte de 30 % à la commande." : "Paiement par virement bancaire."} />}
                </Field>
              </div>
            </Card>
          </div>

          <div hidden={view !== "preview"}>
            <div className="rounded-2xl bg-black/30 p-3 sm:p-8">
              <DocumentPaper
                kind={kind}
                number={documentNumber ?? (isQuote ? "Numéro attribué à la création" : null)}
                issueDate={v.issueDate}
                secondDate={v.secondDate}
                reference={v.reference}
                paymentTerms={v.paymentTerms}
                company={company}
                customer={selectedCustomer ?? null}
                items={v.items.map((it, i) => ({ description: it.description, details: it.showDetails ? it.details : null, quantity: parsed[i].quantity ?? 0, unit: it.unit, unitPrice: parsed[i].unitPrice ?? 0, discountType: it.discountType, discount: parsed[i].discount ?? 0, taxRate: it.taxRate }))}
                totals={totals}
                globalDiscount={{ type: v.globalDiscountType, value: globalValue ?? 0 }}
                notes={v.notes}
                terms={v.terms}
                watermark={isQuote ? null : "Brouillon"}
              />
            </div>
          </div>
        </div>

        {/* Récapitulatif */}
        <aside className="xl:sticky xl:top-20 xl:self-start" aria-label="Récapitulatif des montants">
          <Card className="overflow-hidden">
            <div className="border-b border-line-soft px-5 py-4">
              <p className="text-[15px] font-semibold text-ink">Récapitulatif</p>
              <p className="text-xs text-muted">{v.items.length} ligne{v.items.length > 1 ? "s" : ""} · Montants en dirhams (MAD)</p>
            </div>
            <dl className="space-y-2.5 px-5 py-4 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Total HT brut</dt><dd className="font-medium tabular text-ink">{formatMAD(totals.subtotal)}</dd></div>
              {totals.lineDiscountTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Remises sur lignes</dt><dd className="tabular text-emerald-600">−{formatMAD(totals.lineDiscountTotal)}</dd></div>}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <dt><label htmlFor="global-discount" className="text-muted">Remise globale</label></dt>
                  <dd className="flex items-center gap-1.5">
                    {totals.globalDiscountTotal > 0 && <span className="tabular text-emerald-600">−{formatMAD(totals.globalDiscountTotal)}</span>}
                    <input id="global-discount" inputMode="decimal" aria-invalid={!!errors.globalDiscount || undefined} value={v.globalDiscount} onChange={(e) => update("globalDiscount", e.target.value)} placeholder="0" className={cn(inputBase, "h-8 w-[84px] text-right tabular")} />
                    <DiscountToggle value={v.globalDiscountType} onChange={(t) => { update("globalDiscountType", t); update("globalDiscount", ""); }} label="Type de remise globale" />
                  </dd>
                </div>
                <FieldError message={errors.globalDiscount} />
              </div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between rounded-md bg-emerald-50/70 px-2 py-1.5"><dt className="font-medium text-emerald-800">Total des remises</dt><dd className="font-semibold tabular text-emerald-700">−{formatMAD(totals.discountTotal)}</dd></div>
              )}
              <div className="flex justify-between border-t border-dashed border-line pt-2.5"><dt className="font-medium text-ink-soft">Total HT net</dt><dd className="font-semibold tabular text-ink">{formatMAD(totals.taxableTotal)}</dd></div>
              {totals.taxes.length === 0 && <div className="flex justify-between"><dt className="text-muted">TVA</dt><dd className="tabular text-ink-soft">{formatMAD(0)}</dd></div>}
              {totals.taxes.map((t) => (
                <div key={t.rate} className="flex justify-between gap-2">
                  <dt className="text-muted">TVA {formatRate(t.rate)} % <span className="text-faint">sur {formatMAD(t.base)}</span></dt>
                  <dd className="shrink-0 tabular text-ink-soft">{formatMAD(t.amount)}</dd>
                </div>
              ))}
              {totals.taxes.length > 1 && <div className="flex justify-between"><dt className="text-muted">Total TVA</dt><dd className="font-medium tabular text-ink">{formatMAD(totals.taxTotal)}</dd></div>}
            </dl>
            <div className="bg-brand-950 px-5 py-4 text-white">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-brand-200">Total TTC</span>
                <span className="text-2xl font-semibold tracking-tight" aria-live="polite"><AnimatedNumber value={totals.total} kind="mad" duration={0.5} /></span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-brand-300/90">{amountToFrenchWords(totals.total)}</p>
            </div>
            <div className="space-y-2 p-4">
              <Button className="w-full" size="lg" onClick={() => save(false)} loading={saving} disabled={saving || saveState === "saved"}>
                {saveState === "saved" ? <><Check className="h-4 w-4" /> Enregistré</> : documentId ? "Enregistrer les modifications" : isQuote ? "Créer le devis" : "Enregistrer le brouillon"}
              </Button>
              {!isQuote && !documentId && canIssue && (
                <Button variant="secondary" className="w-full" onClick={() => save(true)} disabled={saving}>
                  <Send className="h-4 w-4" /> Enregistrer et émettre
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => router.back()} disabled={saving}>{saveState === "dirty" ? "Annuler les modifications" : "Retour"}</Button>
              <p className="pt-1 text-center text-[11px] text-faint">Raccourci : <kbd className="rounded border border-line px-1">⌘S</kbd> / <kbd className="rounded border border-line px-1">Ctrl+S</kbd></p>
            </div>
          </Card>
        </aside>
      </div>

      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen} title="Nouveau client" description="Le client sera ajouté à votre CRM et sélectionné." className="sm:max-w-3xl">
        <div className="-mx-6 -my-5">
          <CustomerForm
            compact
            onCancel={() => setNewCustomerOpen(false)}
            onCreated={(created) => {
              const list = [created, ...customers];
              setCustomers(list);
              onCustomerChange(created.id, list);
              setNewCustomerOpen(false);
                          }}
          />
        </div>
      </Dialog>
    </div>
  );
}
