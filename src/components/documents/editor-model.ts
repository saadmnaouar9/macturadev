// Modèle de données de l'éditeur : types et fonctions pures, utilisables côté serveur (pages) et client (éditeur).
import type { DiscountKind } from "@/lib/calc";
import { centsToInput, formatQuantity, formatRate } from "@/lib/money";

export interface EditorItem {
  key: string;
  productId: string | null;
  description: string;
  details: string;
  showDetails: boolean;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountType: DiscountKind;
  discount: string;
  taxRate: number;
}

export interface EditorInitial {
  customerId: string | null;
  issueDate: string;
  secondDate: string; // échéance (facture) ou validité (devis)
  reference: string;
  paymentTerms: string;
  globalDiscountType: DiscountKind;
  globalDiscount: string;
  notes: string;
  terms: string;
  items: EditorItem[];
}

export interface EditorCustomer {
  id: string;
  name: string;
  nameAr: string | null;
  contactName: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  ice: string | null;
  taxId: string | null;
  rc: string | null;
  email: string | null;
  paymentDays: number | null;
}

export interface EditorProduct {
  id: string;
  type: "PRODUCT" | "SERVICE";
  name: string;
  description: string | null;
  sku: string | null;
  unit: string;
  unitPrice: number;
  taxRate: number;
}

let keySeq = 0;
export const newKey = () => `l${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function blankItem(taxRate: number): EditorItem {
  return { key: newKey(), productId: null, description: "", details: "", showDetails: false, quantity: "1", unit: "unité", unitPrice: "", discountType: "PERCENT", discount: "", taxRate };
}

export function itemFromDb(it: { productId: string | null; description: string; details: string | null; quantity: number; unit: string; unitPrice: number; discountType: DiscountKind; discount: number; discountAmount: number; taxRate: number }): EditorItem {
  return {
    key: newKey(),
    productId: it.productId,
    description: it.description,
    details: it.details ?? "",
    showDetails: !!it.details,
    quantity: formatQuantity(it.quantity),
    unit: it.unit,
    unitPrice: centsToInput(it.unitPrice),
    discountType: it.discountType,
    discount: it.discountType === "AMOUNT" ? (it.discountAmount ? centsToInput(it.discountAmount) : "") : it.discount ? formatRate(it.discount) : "",
    taxRate: it.taxRate,
  };
}

