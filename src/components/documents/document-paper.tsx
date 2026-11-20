import type { DocumentTotals } from "@/lib/calc";
import { formatMAD, formatQuantity, formatRate, formatAmount } from "@/lib/money";
import { amountToFrenchWords } from "@/lib/number-to-words";
import { cn, formatDate } from "@/lib/utils";

export interface PaperCompany {
  name: string;
  nameAr?: string | null;
  legalForm?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  ice?: string | null;
  taxId?: string | null;
  rc?: string | null;
  rcCity?: string | null;
  patente?: string | null;
  cnss?: string | null;
  capital?: string | null;
  bankName?: string | null;
  rib?: string | null;
  accentColor?: string | null;
}

export interface PaperCustomer {
  name: string;
  nameAr?: string | null;
  contactName?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  ice?: string | null;
  taxId?: string | null;
  rc?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PaperItem {
  description: string;
  details?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountType: "PERCENT" | "AMOUNT";
  discount: number; // bp ou centimes
  taxRate: number;
}

export interface PaperProps {
  kind: "quote" | "invoice";
  number: string | null;
  issueDate: string;
  secondDate: string;
  reference?: string | null;
  paymentTerms?: string | null;
  company: PaperCompany;
  customer: PaperCustomer | null;
  items: PaperItem[];
  totals: DocumentTotals;
  globalDiscount: { type: "PERCENT" | "AMOUNT"; value: number };
  notes?: string | null;
  terms?: string | null;
  amountPaid?: number;
  watermark?: string | null;
  className?: string;
}

/** Aperçu fidèle du document (même mise en page que le PDF). */
export function DocumentPaper(p: PaperProps) {
  const isQuote = p.kind === "quote";
  const title = isQuote ? "Devis" : "Facture";
  const accent = p.company.accentColor || "#3A3182";
  const legal = [
    p.company.ice && `ICE : ${p.company.ice}`,
    p.company.taxId && `IF : ${p.company.taxId}`,
    p.company.rc && `RC : ${p.company.rc}${p.company.rcCity ? ` (${p.company.rcCity})` : ""}`,
    p.company.patente && `Patente : ${p.company.patente}`,
    p.company.cnss && `CNSS : ${p.company.cnss}`,
  ].filter(Boolean);
  const hasLineDiscount = p.items.some((i) => i.discount > 0);
  const balance = p.amountPaid !== undefined ? p.totals.total - p.amountPaid : null;

  return (
    <div className={cn("paper relative mx-auto w-full max-w-[820px] overflow-hidden rounded-sm text-[#1b1e2e]", p.className)}>
      <div className="h-1.5" style={{ background: accent }} />
      {p.watermark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[24deg] select-none text-[64px] font-bold text-black/[0.04] sm:text-[96px]">{p.watermark}</span>
        </div>
      )}
      <div className="relative p-6 text-[12px] leading-relaxed sm:p-10 sm:text-[12.5px]">
        {/* En-tête */}
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight" style={{ color: accent }}>
              {p.company.name}
              {p.company.legalForm && <span className="font-normal text-[#5b6075]"> {p.company.legalForm}</span>}
            </p>
            {p.company.nameAr && <p dir="rtl" lang="ar" className="text-[13px] text-[#5b6075]">{p.company.nameAr}</p>}
            <div className="mt-1.5 text-[#5b6075]">
              {p.company.address && <p>{p.company.address}</p>}
              {(p.company.postalCode || p.company.city) && <p>{[p.company.postalCode, p.company.city].filter(Boolean).join(" ")}{p.company.country && p.company.country !== "Maroc" ? `, ${p.company.country}` : ""}</p>}
              <p>{[p.company.phone, p.company.email].filter(Boolean).join(" · ")}</p>
              {p.company.website && <p>{p.company.website}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[26px] font-semibold text-[#0e1124]">{title}</p>
            <p className="mt-0.5 font-mono text-[13px] font-medium text-[#3b3f55]">{p.number ?? (isQuote ? "—" : "Brouillon — non numérotée")}</p>
            <dl className="mt-3 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-0.5 text-[#5b6075] sm:justify-end">
              <dt>Date d&apos;émission</dt>
              <dd className="font-medium text-[#1b1e2e]">{p.issueDate ? formatDate(p.issueDate, "numeric") : "—"}</dd>
              <dt>{isQuote ? "Valable jusqu'au" : "Échéance"}</dt>
              <dd className="font-medium text-[#1b1e2e]">{p.secondDate ? formatDate(p.secondDate, "numeric") : "—"}</dd>
              {p.reference && (<><dt>Référence</dt><dd className="font-medium text-[#1b1e2e]">{p.reference}</dd></>)}
            </dl>
          </div>
        </div>

        {/* Client */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div />
          <div className="rounded-md bg-[#f6f6fa] p-4">
            <p className="text-[10px] font-semibold text-[#9a9fb3]">{isQuote ? "Devis adressé à" : "Facturé à"}</p>
            {p.customer ? (
              <>
                <p className="mt-1 text-[14px] font-semibold text-[#0e1124]">{p.customer.name}</p>
                {p.customer.nameAr && <p dir="rtl" lang="ar" className="text-[#5b6075]">{p.customer.nameAr}</p>}
                <div className="text-[#5b6075]">
                  {p.customer.contactName && <p>À l&apos;attention de {p.customer.contactName}</p>}
                  {p.customer.address && <p>{p.customer.address}</p>}
                  {(p.customer.postalCode || p.customer.city) && <p>{[p.customer.postalCode, p.customer.city].filter(Boolean).join(" ")}</p>}
                  {p.customer.ice && <p className="mt-1 font-medium text-[#3b3f55]">ICE : {p.customer.ice}</p>}
                  {(p.customer.taxId || p.customer.rc) && <p>{[p.customer.taxId && `IF : ${p.customer.taxId}`, p.customer.rc && `RC : ${p.customer.rc}`].filter(Boolean).join(" · ")}</p>}
                </div>
              </>
            ) : (
              <p className="mt-1 italic text-[#9a9fb3]">Aucun client sélectionné</p>
            )}
          </div>
        </div>

        {/* Lignes */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="text-[10.5px] text-white" style={{ background: accent }}>
                <th className="rounded-l-[3px] px-3 py-2 text-left font-semibold">Désignation</th>
                <th className="px-2 py-2 text-right font-semibold">Qté</th>
                <th className="px-2 py-2 text-right font-semibold">P.U. HT</th>
                {hasLineDiscount && <th className="px-2 py-2 text-right font-semibold">Remise</th>}
                <th className="px-2 py-2 text-right font-semibold">TVA</th>
                <th className="rounded-r-[3px] px-3 py-2 text-right font-semibold">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {p.items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center italic text-[#9a9fb3]">Aucune ligne</td></tr>
              )}
              {p.items.map((it, i) => (
                <tr key={i} className="border-b border-[#ececf2] align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-[#0e1124]" dir="auto">{it.description || <span className="italic text-[#9a9fb3]">Sans désignation</span>}</p>
                    {it.details && <p className="mt-0.5 whitespace-pre-line text-[11px] text-[#646a82]" dir="auto">{it.details}</p>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular">{formatQuantity(it.quantity)} <span className="text-[#9a9fb3]">{it.unit}</span></td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular">{formatAmount(it.unitPrice)}</td>
                  {hasLineDiscount && (
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular text-[#646a82]">
                      {it.discount > 0 ? (it.discountType === "AMOUNT" ? `−${formatAmount(it.discount)}` : `${formatRate(it.discount)} %`) : "—"}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular text-[#646a82]">{formatRate(it.taxRate)} %</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular">{formatAmount(p.totals.lines[i]?.net ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="mt-6 flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
          <div className="max-w-sm text-[11.5px] text-[#5b6075]">
            <p className="text-[10px] font-semibold text-[#9a9fb3]">{isQuote ? "Arrêté le présent devis à la somme de" : "Arrêtée la présente facture à la somme de"}</p>
            <p className="mt-1 font-medium italic text-[#1b1e2e]">{amountToFrenchWords(p.totals.total)} TTC</p>
          </div>
          <dl className="w-full space-y-1.5 sm:w-[280px]">
            <div className="flex justify-between"><dt className="text-[#5b6075]">Total HT brut</dt><dd className="tabular">{formatMAD(p.totals.subtotal)}</dd></div>
            {p.totals.lineDiscountTotal > 0 && <div className="flex justify-between"><dt className="text-[#5b6075]">Remises sur lignes</dt><dd className="tabular">−{formatMAD(p.totals.lineDiscountTotal)}</dd></div>}
            {p.totals.globalDiscountTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#5b6075]">Remise globale{p.globalDiscount.type === "PERCENT" ? ` (${formatRate(p.globalDiscount.value)} %)` : ""}</dt>
                <dd className="tabular">−{formatMAD(p.totals.globalDiscountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[#ececf2] pt-1.5 font-medium"><dt>Total HT net</dt><dd className="tabular">{formatMAD(p.totals.taxableTotal)}</dd></div>
            {p.totals.taxes.map((t) => (
              <div key={t.rate} className="flex justify-between"><dt className="text-[#5b6075]">TVA {formatRate(t.rate)} %</dt><dd className="tabular">{formatMAD(t.amount)}</dd></div>
            ))}
            <div className="mt-1 flex items-baseline justify-between rounded-md px-3 py-2.5 text-white" style={{ background: accent }}>
              <dt className="text-[12px] font-semibold">Total TTC</dt>
              <dd className="text-[15px] font-semibold tabular">{formatMAD(p.totals.total)}</dd>
            </div>
            {balance !== null && p.amountPaid! > 0 && (
              <>
                <div className="flex justify-between px-1 pt-1"><dt className="text-[#5b6075]">Déjà réglé</dt><dd className="tabular">−{formatMAD(p.amountPaid!)}</dd></div>
                <div className="flex justify-between px-1 font-semibold"><dt>Reste à payer</dt><dd className="tabular">{formatMAD(balance)}</dd></div>
              </>
            )}
          </dl>
        </div>

        {/* Notes & conditions */}
        {(p.notes || p.terms || p.paymentTerms || (!isQuote && p.company.rib)) && (
          <div className="mt-8 grid gap-5 border-t border-[#ececf2] pt-5 text-[11.5px] sm:grid-cols-2">
            <div className="space-y-3">
              {p.notes && (<div><p className="text-[10px] font-semibold text-[#9a9fb3]">Note</p><p className="mt-1 whitespace-pre-line text-[#3b3f55]" dir="auto">{p.notes}</p></div>)}
              {p.terms && (<div><p className="text-[10px] font-semibold text-[#9a9fb3]">Conditions</p><p className="mt-1 whitespace-pre-line text-[#3b3f55]" dir="auto">{p.terms}</p></div>)}
            </div>
            <div className="space-y-3">
              {!isQuote && p.paymentTerms && (<div><p className="text-[10px] font-semibold text-[#9a9fb3]">Conditions de paiement</p><p className="mt-1 text-[#3b3f55]">{p.paymentTerms}</p></div>)}
              {!isQuote && (p.company.bankName || p.company.rib) && (
                <div>
                  <p className="text-[10px] font-semibold text-[#9a9fb3]">Coordonnées bancaires</p>
                  {p.company.bankName && <p className="mt-1 text-[#3b3f55]">{p.company.bankName}</p>}
                  {p.company.rib && <p className="font-mono text-[11px] text-[#3b3f55]">RIB : {p.company.rib}</p>}
                </div>
              )}
              {isQuote && (
                <div className="rounded-md border border-dashed border-[#d7d9e2] p-3 text-[#9a9fb3]">
                  <p className="text-[10px] font-semibold">Bon pour accord</p>
                  <p className="mt-6 text-[10.5px]">Date, cachet et signature du client</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mentions légales */}
        <div className="mt-8 border-t border-[#ececf2] pt-3 text-center text-[10px] leading-relaxed text-[#9a9fb3]">
          <p>{p.company.name}{p.company.legalForm ? ` ${p.company.legalForm}` : ""}{p.company.capital ? ` au capital de ${p.company.capital}` : ""}</p>
          {legal.length > 0 && <p>{legal.join(" · ")}</p>}
        </div>
      </div>
    </div>
  );
}
