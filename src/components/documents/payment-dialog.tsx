"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { centsToInput, formatMAD, parseAmountToCents } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/status";
import { cn, toDateInput, todayUTC } from "@/lib/utils";

type Method = keyof typeof PAYMENT_METHODS;

export interface PaymentSubmit {
  amount: number; date: string; method: Method; reference: string; notes: string; idempotencyKey: string;
}
type SubmitResult = { ok: true; data: { balance: number } } | { ok: false; error: string; fieldErrors?: Record<string, string> };
type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}

export function PaymentDialog({ open, onOpenChange, submit, balance, issueDate, onDone, direction = "in" }: { open: boolean; onOpenChange: (o: boolean) => void; submit: (d: PaymentSubmit) => Promise<SubmitResult>; balance: number; issueDate: string; onDone: () => void; direction?: "in" | "out" }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<Method>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  // Une clé d'idempotence par ouverture : renvoyer le même formulaire ne crée jamais deux paiements
  const keyRef = useRef<string>("");
  const lockRef = useRef(false);

  useEffect(() => {
    if (open) {
      keyRef.current = newKey();
      lockRef.current = false;
      setAmount(centsToInput(balance));
      setDate(toDateInput(todayUTC()));
      setMethod("BANK_TRANSFER");
      setReference("");
      setNotes("");
      setErrors({});
    }
  }, [open, balance]);

  const cents = parseAmountToCents(amount);
  const after = cents !== null ? balance - cents : balance;

  const onSubmit = async () => {
    if (lockRef.current) return;
    if (cents === null || cents <= 0) return setErrors({ amount: "Saisissez un montant supérieur à zéro" });
    if (cents > balance) return setErrors({ amount: `Le montant dépasse le reste à payer (${formatMAD(balance)})` });
    if (date < issueDate.slice(0, 10)) return setErrors({ date: "Doit suivre la date d'émission" });
    lockRef.current = true;
    setPending(true);
    try {
      const res = await submit({ amount: cents, date, method, reference, notes, idempotencyKey: keyRef.current });
      if (res.ok) {
        toast.success(res.data.balance <= 0 ? "Paiement enregistré — facture soldée" : `Paiement enregistré — reste ${formatMAD(res.data.balance)}`);
        onDone();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        lockRef.current = false; // la correction de la saisie reste possible avec la même clé
      }
    } finally {
      setPending(false);
    }
  };

  const refLabel = method === "CHECK" ? "N° de chèque" : method === "LCN" ? "N° d'effet" : method === "BANK_TRANSFER" ? "Référence du virement" : "Référence";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={direction === "in" ? "Enregistrer un paiement" : "Régler le fournisseur"}
      description={`Reste à payer : ${formatMAD(balance)}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button variant="success" onClick={onSubmit} loading={pending}>Enregistrer le paiement</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <Field label={direction === "in" ? "Montant reçu" : "Montant payé"} required error={errors.amount}>
          {(p) => <Input {...p} autoFocus inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErrors({}); }} trailing="DH" className="h-11 text-lg font-semibold tabular" />}
        </Field>
        <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Montants rapides">
          {[{ l: "Totalité", v: balance }, { l: "50 %", v: Math.round(balance / 2) }, { l: "30 %", v: Math.round(balance * 0.3) }].map((q) => (
            <button key={q.l} type="button" aria-pressed={cents === q.v} onClick={() => { setAmount(centsToInput(q.v)); setErrors({}); }} className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors", cents === q.v ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "text-muted ring-line hover:bg-subtle")}>
              {q.l} · {formatMAD(q.v)}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date du paiement" required error={errors.date}>
            {(p) => <DatePicker {...p} value={date} onChange={(d) => { setDate(d); setErrors({}); }} invalid={!!errors.date} />}
          </Field>
          <Field label="Mode de paiement" required>
            {(p) => (
              <Select {...p} value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {Object.entries(PAYMENT_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label={refLabel} error={errors.reference}>
          {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Facultatif" />}
        </Field>
        <Field label="Note" error={errors.notes}>
          {(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facultatif" />}
        </Field>
        <div className="flex items-center justify-between rounded-lg bg-canvas px-3.5 py-2.5 text-[13px] ring-1 ring-inset ring-line-soft" aria-live="polite">
          <span className="text-muted">Reste après ce paiement</span>
          <span className={cn("font-semibold tabular", after < 0 ? "text-rose-600" : after === 0 ? "text-emerald-700" : "text-ink")}>
            {after < 0 ? "Montant supérieur au solde" : after === 0 ? "Facture soldée ✓" : formatMAD(after)}
          </span>
        </div>
      </form>
    </Dialog>
  );
}

export function VoidPaymentDialog({ payment, onOpenChange, onDone, action }: { payment: { id: string; amount: number } | null; onOpenChange: (o: boolean) => void; onDone: () => void; action: (id: string, reason: string) => Promise<ActionResult> }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (payment) {
      setReason("");
      setError(undefined);
    }
  }, [payment]);
  const submit = async () => {
    if (!payment || pending) return;
    if (reason.trim().length < 3) return setError("Indiquez le motif (3 caractères minimum)");
    setPending(true);
    const res = await action(payment.id, reason);
    setPending(false);
    if (res.ok) {
      toast.success(res.message ?? "Paiement annulé");
      onDone();
    } else toast.error(res.error);
  };
  return (
    <Dialog
      open={!!payment}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title="Annuler ce paiement ?"
      description={payment ? `Le paiement de ${formatMAD(payment.amount)} restera visible dans l'historique, barré, avec son motif. Le solde et la situation de règlement seront recalculés.` : undefined}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>Conserver</Button>
          <Button variant="danger" onClick={submit} loading={pending}>Annuler le paiement</Button>
        </>
      }
    >
      <Field label="Motif de l'annulation" required error={error}>
        {(p) => <Textarea {...p} autoFocus rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }} placeholder="Ex. : chèque retourné impayé, saisie en double…" />}
      </Field>
    </Dialog>
  );
}
