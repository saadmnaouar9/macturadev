"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CircleDollarSign, ShoppingCart, Wallet } from "lucide-react";
import { ResourceView, type ResourceViewProps } from "@/components/data/resource-view";
import type { FieldDef } from "@/components/data/crud-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { PaymentDialog, VoidPaymentDialog } from "@/components/documents/payment-dialog";
import { INVOICE_STATUS, PAYMENT_METHODS } from "@/lib/status";
import { formatMAD, formatRate } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
import { PurchaseStatsPanel, type PurchaseStats } from "./achats-ui";
import { addPurchasePayment, cancelPurchase, deletePurchase, savePurchase, voidPurchasePayment } from "@/app/(app)/achats/actions";

type Common = Pick<ResourceViewProps, "rows" | "total" | "page" | "pageSize" | "hasQuery" | "canWrite" | "canDelete" | "filters" | "summary" | "defaults">;

interface PurchaseRow {
  id: string;
  reference: string;
  supplierName: string;
  issueDate: string;
  dueDate: string;
  total: number;
  balance: number;
  cancelled: boolean;
  activePayments: number;
  paymentCount: number;
  payments: { id: string; amount: number; date: string; method: keyof typeof PAYMENT_METHODS; reference: string | null; voidedAt: string | null; voidReason: string | null }[];
}

const STATUS_BADGES = Object.fromEntries(Object.entries(INVOICE_STATUS));

export function PurchasesView({ suppliers, taxRates, stats, ...p }: Common & { suppliers: { value: string; label: string }[]; taxRates: { value: string; label: string }[]; stats: PurchaseStats }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<string | null>(null); // dialogue de suivi des paiements
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState<{ id: string; amount: number } | null>(null);
  const rows = p.rows as unknown as (PurchaseRow & { id: string })[];
  const current = useMemo(() => rows.find((r) => r.id === openId) ?? null, [rows, openId]);

  const fields: FieldDef[] = [
    { name: "supplierId", label: "Fournisseur", type: "select", required: true, span: true, options: suppliers },
    { name: "reference", label: "N° de facture fournisseur", type: "text", required: true, mono: true },
    { name: "category", label: "Catégorie", type: "text", placeholder: "Matériel, loyer, services…" },
    { name: "issueDate", label: "Date de facture", type: "date", required: true },
    { name: "dueDate", label: "Échéance", type: "date", required: true },
    { name: "subtotal", label: "Montant HT", type: "money", required: true },
    { name: "taxRate", label: "TVA", type: "select", numeric: true, required: true, options: taxRates },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <>
      <ResourceView
        {...p}
        title="Achats"
        description="Factures fournisseurs, règlements partiels ou totaux et TVA déductible."
        icon={ShoppingCart}
        summaryNode={<PurchaseStatsPanel stats={stats} />}
        entity="achat"
        columns={[
          { key: "reference", header: "Facture fournisseur", kind: "title", subKey: "supplierName", sort: "reference" },
          { key: "issueDate", header: "Date", kind: "date", hide: "md", sort: "issueDate" },
          { key: "dueDate", header: "Échéance", kind: "date", hide: "lg", sort: "dueDate" },
          { key: "total", header: "Montant TTC", kind: "money", align: "right", sort: "total" },
          { key: "balance", header: "Reste à payer", kind: "money", align: "right", hide: "md" },
          { key: "status", header: "Statut", kind: "badge", badge: STATUS_BADGES },
        ]}
        fields={fields}
        searchPlaceholder="Référence, fournisseur…"
        onSave={savePurchase}
        onRemove={deletePurchase}
        canEditRow={(r) => !r.cancelled && !(r.activePayments as number)}
        canDeleteRow={(r) => !(r.paymentCount as number)}
        rowActions={(r) => [
          { label: "Paiements", icon: <Wallet />, onSelect: () => setOpenId(r.id) },
          ...(p.canDelete && !r.cancelled && !(r.activePayments as number) && (r.paymentCount as number) > 0
            ? [{
                label: "Annuler la facture", icon: <Ban />, danger: true, separatorBefore: true,
                onSelect: async () => {
                  if (!(await confirm({ title: `Annuler ${r.reference} ?`, description: "La facture restera dans l'historique avec le statut « Annulée ».", confirmLabel: "Annuler la facture", danger: true }))) return;
                  const res = await cancelPurchase(r.id);
                  if (res.ok) { toast.success(res.message); } else toast.error(res.error);
                },
              }]
            : []),
        ]}
        emptyDescription="Enregistrez vos factures fournisseurs pour suivre vos dettes, vos échéances et la TVA déductible."
      />

      <Dialog
        open={!!current}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={current ? `Paiements — ${current.reference}` : "Paiements"}
        description={current ? `${current.supplierName} · ${formatMAD(current.total)} TTC` : undefined}
        footer={
          current && p.canWrite && !current.cancelled && current.balance > 0 ? (
            <Button variant="success" onClick={() => setPaying(true)}><CircleDollarSign className="h-4 w-4" /> Régler {formatMAD(current.balance)}</Button>
          ) : undefined
        }
      >
        {current && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[{ l: "Total TTC", v: current.total }, { l: "Payé", v: current.total - current.balance, c: "text-emerald-700" }, { l: "Reste", v: current.balance, c: current.balance > 0 ? "text-amber-700" : "text-faint" }].map((x) => (
                <div key={x.l} className="rounded-lg bg-canvas px-2 py-3 ring-1 ring-inset ring-line-soft">
                  <p className="text-xs text-muted">{x.l}</p>
                  <p className={cn("mt-0.5 text-[13px] font-semibold tabular", x.c)}>{formatMAD(x.v)}</p>
                </div>
              ))}
            </div>
            {current.payments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Aucun paiement enregistré.</p>
            ) : (
              <ul className="divide-y divide-line-soft rounded-xl ring-1 ring-line-soft">
                {current.payments.map((pay) => {
                  const v = !!pay.voidedAt;
                  return (
                    <li key={pay.id} className="group flex items-start gap-3 px-3.5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn("text-[13px] font-semibold tabular", v ? "text-faint line-through" : "text-ink")}>{formatMAD(pay.amount)}</span>
                          {v && <Badge dot={false}>Annulé</Badge>}
                        </span>
                        <span className="block text-xs text-muted">{formatDate(pay.date)} · {PAYMENT_METHODS[pay.method]}{pay.reference ? ` · ${pay.reference}` : ""}</span>
                        {v && <span className="block text-xs text-rose-600/90">Annulé le {formatDate(pay.voidedAt!)} — {pay.voidReason}</span>}
                      </span>
                      {p.canDelete && !v && (
                        <button onClick={() => setVoiding({ id: pay.id, amount: pay.amount })} className="rounded-md p-1.5 text-faint opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100" aria-label={`Annuler le paiement de ${formatMAD(pay.amount)}`}>
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-center text-[11px] text-faint">Taux TVA appliqué : {formatRate(Number((current as unknown as { taxRate?: number }).taxRate ?? 0))} %</p>
          </div>
        )}
      </Dialog>

      {current && (
        <>
          <PaymentDialog
            open={paying}
            onOpenChange={setPaying}
            direction="out"
            balance={current.balance}
            issueDate={current.issueDate}
            submit={(d) => addPurchasePayment({ purchaseId: current.id, ...d })}
            onDone={() => { setPaying(false); }}
          />
          <VoidPaymentDialog action={voidPurchasePayment} payment={voiding} onOpenChange={(o) => !o && setVoiding(null)} onDone={() => { setVoiding(null); }} />
        </>
      )}
    </>
  );
}
