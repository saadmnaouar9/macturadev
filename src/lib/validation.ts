import { z } from "zod";

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

// ICE marocain : 15 chiffres
const ice = optionalText(20).refine((v) => !v || /^\d{15}$/.test(v), "L'ICE doit contenir exactement 15 chiffres");
const numericId = (label: string) =>
  optionalText(20).refine((v) => !v || /^\d{1,15}$/.test(v), `${label} : chiffres uniquement`);

export const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .max(128, "128 caractères maximum")
  .regex(/[A-Za-z]/, "Doit contenir au moins une lettre")
  .regex(/\d/, "Doit contenir au moins un chiffre");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom complet").max(100),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200),
  password: passwordSchema,
  companyName: z.string().trim().min(2, "Indiquez le nom de votre entreprise").max(150),
  city: optionalText(80),
  ice,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  remember: z.boolean().optional().default(false),
});

export const customerSchema = z
  .object({
    type: z.enum(["INDIVIDUAL", "COMPANY"]),
    name: z.string().trim().min(2, "Le nom est requis").max(150),
    nameAr: optionalText(150),
    contactName: optionalText(120),
    email: optionalText(200).refine((v) => !v || z.string().email().safeParse(v).success, "Adresse e-mail invalide"),
    phone: optionalText(30).refine((v) => !v || /^[+\d][\d\s.\-()]{5,}$/.test(v), "Numéro de téléphone invalide"),
    mobile: optionalText(30).refine((v) => !v || /^[+\d][\d\s.\-()]{5,}$/.test(v), "Numéro de téléphone invalide"),
    ice,
    taxId: numericId("IF"),
    rc: optionalText(30),
    address: optionalText(300),
    city: optionalText(80),
    postalCode: optionalText(10).refine((v) => !v || /^\d{5}$/.test(v), "Le code postal marocain comporte 5 chiffres"),
    country: z.string().trim().min(2).max(60).default("Maroc"),
    paymentDays: z.coerce.number().int().min(0, "Valeur invalide").max(365, "365 jours maximum").optional().nullable(),
    notes: optionalText(2000),
  });

export const productSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string().trim().min(2, "Le nom est requis").max(150),
  description: optionalText(1000),
  sku: optionalText(60),
  unit: z.string().trim().min(1, "Unité requise").max(30),
  unitPrice: z.number().int("Prix invalide").min(0, "Le prix ne peut pas être négatif").max(1e13, "Montant trop élevé"),
  taxRate: z.number().int().min(0).max(10000),
  categoryId: optionalText(40),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide"),
});

const discountType = z.enum(["PERCENT", "AMOUNT"]);

/** Remise : points de base (≤ 100 %) si PERCENT, centimes si AMOUNT. */
export const lineItemSchema = z
  .object({
    productId: optionalText(40),
    description: z.string().trim().min(1, "Désignation requise").max(300),
    details: optionalText(1000),
    quantity: z.number().int().min(1, "Quantité invalide").max(1e12, "Quantité trop élevée"),
    unit: z.string().trim().min(1).max(30),
    unitPrice: z.number().int().min(0, "Prix invalide").max(1e13, "Montant trop élevé"),
    discountType: discountType.default("PERCENT"),
    discount: z.number().int().min(0, "Remise invalide").max(1e13, "Montant trop élevé"),
    taxRate: z.number().int().min(0).max(10000),
  })
  .refine((l) => l.discountType === "AMOUNT" || l.discount <= 10000, { path: ["discount"], message: "Remise maximale : 100 %" });

const documentBase = {
  customerId: z.string().min(1, "Sélectionnez un client"),
  issueDate: dateString,
  reference: optionalText(80),
  globalDiscountType: discountType.default("PERCENT"),
  globalDiscount: z.number().int().min(0, "Remise invalide").max(1e13, "Montant trop élevé"),
  notes: optionalText(2000),
  terms: optionalText(2000),
  items: z.array(lineItemSchema).min(1, "Ajoutez au moins une ligne").max(200, "200 lignes maximum"),
};

const globalDiscountOk = (d: { globalDiscountType: "PERCENT" | "AMOUNT"; globalDiscount: number }) =>
  d.globalDiscountType === "AMOUNT" || d.globalDiscount <= 10000;

export const quoteSchema = z
  .object({ ...documentBase, expiryDate: dateString })
  .refine(globalDiscountOk, { path: ["globalDiscount"], message: "Remise maximale : 100 %" })
  .refine((d) => d.expiryDate >= d.issueDate, { path: ["expiryDate"], message: "La date de validité doit suivre la date d'émission" });

export const invoiceSchema = z
  .object({ ...documentBase, dueDate: dateString, paymentTerms: optionalText(200) })
  .refine(globalDiscountOk, { path: ["globalDiscount"], message: "Remise maximale : 100 %" })
  .refine((d) => d.dueDate >= d.issueDate, { path: ["dueDate"], message: "L'échéance doit suivre la date d'émission" });

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().int().min(1, "Le montant doit être supérieur à zéro"),
  date: dateString,
  method: z.enum(["BANK_TRANSFER", "CASH", "CHECK", "CARD", "LCN", "OTHER"]),
  reference: optionalText(100),
  notes: optionalText(500),
});

export const companySchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(150),
  nameAr: optionalText(150),
  legalForm: optionalText(40),
  ice,
  taxId: numericId("IF"),
  rc: optionalText(30),
  rcCity: optionalText(60),
  patente: optionalText(30),
  cnss: optionalText(30),
  capital: optionalText(40),
  address: optionalText(300),
  city: optionalText(80),
  postalCode: optionalText(10).refine((v) => !v || /^\d{5}$/.test(v), "Le code postal marocain comporte 5 chiffres"),
  phone: optionalText(30),
  email: optionalText(200).refine((v) => !v || z.string().email().safeParse(v).success, "Adresse e-mail invalide"),
  website: optionalText(200),
  bankName: optionalText(80),
  rib: optionalText(40).refine((v) => !v || /^[\d\s]{24,30}$/.test(v), "Le RIB marocain comporte 24 chiffres"),
});

export const documentSettingsSchema = z.object({
  invoicePrefix: z.string().trim().regex(/^[A-Z0-9]{1,8}$/, "Lettres majuscules et chiffres, 8 max"),
  quotePrefix: z.string().trim().regex(/^[A-Z0-9]{1,8}$/, "Lettres majuscules et chiffres, 8 max"),
  defaultPaymentDays: z.coerce.number().int().min(0).max(365),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  defaultTaxRate: z.number().int().min(0).max(10000),
  invoiceNotes: optionalText(2000),
  invoiceTerms: optionalText(2000),
  quoteNotes: optionalText(2000),
  quoteTerms: optionalText(2000),
});

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(40),
  rate: z.number().int().min(0).max(10000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(100),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel requis"),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });

export const memberSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(100),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
  password: passwordSchema,
});
