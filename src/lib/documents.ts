import "server-only";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { computeTotals } from "./calc";
import { BusinessError } from "./action";
import { lineItemSchema } from "./validation";
import { parseDateOnly } from "./utils";

type LineItem = z.infer<typeof lineItemSchema>;

/** Vérifie que le client et les produits référencés appartiennent bien à l'entreprise. */
export async function assertDocumentRefs(companyId: string, customerId: string, items: LineItem[]) {
  const customer = await db.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true, name: true, paymentDays: true } });
  if (!customer) throw new BusinessError("Client introuvable.", { customerId: "Sélectionnez un client valide" });
  const productIds = [...new Set(items.map((i) => i.productId).filter((x): x is string => !!x))];
  if (productIds.length) {
    const count = await db.product.count({ where: { id: { in: productIds }, companyId } });
    if (count !== productIds.length) throw new BusinessError("Un article référencé est introuvable.");
  }
  return customer;
}

/** Recalcule les totaux côté serveur (jamais de confiance accordée aux montants envoyés par le client). */
export function buildDocument(items: LineItem[], globalType: "PERCENT" | "AMOUNT", globalValue: number) {
  const totals = computeTotals(items, { type: globalType, value: globalValue });
  for (const v of [totals.total, totals.subtotal]) {
    if (!Number.isSafeInteger(v)) throw new BusinessError("Montant total trop élevé.");
  }
  return {
    totals: {
      subtotal: BigInt(totals.subtotal),
      discountTotal: BigInt(totals.discountTotal),
      taxableTotal: BigInt(totals.taxableTotal),
      taxTotal: BigInt(totals.taxTotal),
      total: BigInt(totals.total),
    },
    items: items.map((it, i) => ({
      productId: it.productId,
      position: i,
      description: it.description,
      details: it.details,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: BigInt(it.unitPrice),
      discountType: it.discountType,
      discount: it.discountType === "PERCENT" ? it.discount : 0,
      discountAmount: BigInt(it.discountType === "AMOUNT" ? it.discount : 0),
      taxRate: it.taxRate,
      netAmount: BigInt(totals.lines[i].net),
    })),
    global: {
      globalDiscountType: globalType,
      globalDiscount: globalType === "PERCENT" ? globalValue : 0,
      globalDiscountAmount: BigInt(globalType === "AMOUNT" ? globalValue : 0),
    },
    total: totals.total,
  };
}

/** Convertit une ligne stockée en entrée du moteur de calcul. */
export function storedLineToInput(it: { quantity: number; unitPrice: bigint; discountType: "PERCENT" | "AMOUNT"; discount: number; discountAmount: bigint; taxRate: number }) {
  return {
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
    discountType: it.discountType,
    discount: it.discountType === "AMOUNT" ? Number(it.discountAmount) : it.discount,
    taxRate: it.taxRate,
  };
}

export function dateOrThrow(s: string, field: string) {
  const d = parseDateOnly(s);
  if (!d) throw new BusinessError("Date invalide.", { [field]: "Date invalide" });
  return d;
}

/** Situation de règlement selon le montant encaissé (indépendante du cycle de vie). */
export function paymentStatusFor(total: bigint, paid: bigint): PaymentStatus {
  if (total > 0n && paid >= total) return "PAID";
  if (paid > 0n) return "PARTIAL";
  return "UNPAID";
}

/**
 * Recalcule le montant encaissé depuis les paiements actifs (non annulés) et met à jour
 * la situation de règlement. Source de vérité unique : la table des paiements.
 */
export async function syncInvoicePayments(tx: Prisma.TransactionClient, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { total: true } });
  const agg = await tx.payment.aggregate({ where: { invoiceId, voidedAt: null }, _sum: { amount: true }, _max: { date: true } });
  const paid = agg._sum.amount ?? 0n;
  const paymentStatus = paymentStatusFor(inv.total, paid);
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid: paid, paymentStatus, paidAt: paymentStatus === "PAID" ? agg._max.date : null },
  });
}

/** Verrouille la facture pendant la transaction (évite les doubles paiements concurrents). */
export async function lockInvoice(tx: Prisma.TransactionClient, id: string, companyId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Invoice" WHERE id = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
  if (rows.length === 0) throw new BusinessError("Facture introuvable.");
  return tx.invoice.findUniqueOrThrow({ where: { id } });
}

/** Charge un document (devis ou facture) complet pour l'affichage, le PDF et l'aperçu. */
export async function loadCompanyForDocument(companyId: string) {
  return db.company.findUniqueOrThrow({ where: { id: companyId } });
}
