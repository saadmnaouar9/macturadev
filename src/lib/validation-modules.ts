import { z } from "zod";

const text = (max = 300) =>
  z.string().trim().max(max, `${max} caractères maximum`).optional().nullable().transform((v) => (v ? v : null));
const optDate = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").nullable());
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const money = z.preprocess((v) => (v === null || v === undefined || v === "" ? 0 : v), z.number().int("Montant invalide").min(0, "Montant négatif").max(1e13, "Montant trop élevé"));
const email = text(200).refine((v) => !v || z.string().email().safeParse(v).success, "Adresse e-mail invalide");
const phone = text(30).refine((v) => !v || /^[+\d][\d\s.\-()]{5,}$/.test(v), "Numéro de téléphone invalide");
const ice = text(20).refine((v) => !v || /^\d{15}$/.test(v), "L'ICE doit contenir 15 chiffres");
const optInt = (max: number, msg: string) => z.preprocess((v) => (v === "" || v === undefined ? null : v), z.number().int(msg).min(0, msg).max(max, msg).nullable());

export const prospectSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis").max(150),
  contactName: text(120),
  email,
  phone,
  source: text(60),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]),
  value: money,
  nextActionDate: optDate,
  notes: text(2000),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis").max(150),
  contactName: text(120),
  email,
  phone,
  ice,
  taxId: text(20).refine((v) => !v || /^\d{1,15}$/.test(v), "IF : chiffres uniquement"),
  rc: text(30),
  address: text(300),
  city: text(80),
  paymentDays: optInt(365, "0 à 365 jours"),
  notes: text(2000),
});

export const purchaseSchema = z
  .object({
    supplierId: z.string().min(1, "Sélectionnez un fournisseur"),
    reference: z.string().trim().min(1, "Référence requise").max(80),
    issueDate: dateStr,
    dueDate: dateStr,
    category: text(60),
    subtotal: z.number().int("Montant invalide").min(1, "Le montant doit être supérieur à zéro").max(1e13, "Montant trop élevé"),
    taxRate: z.number().int().min(0).max(10000),
    notes: text(2000),
  })
  .refine((d) => d.dueDate >= d.issueDate, { path: ["dueDate"], message: "L'échéance doit suivre la date de facture" });

export const purchasePaymentSchema = z.object({
  purchaseId: z.string().min(1),
  amount: z.number().int().min(1, "Le montant doit être supérieur à zéro"),
  date: dateStr,
  method: z.enum(["BANK_TRANSFER", "CASH", "CHECK", "CARD", "LCN", "OTHER"]),
  reference: text(100),
  notes: text(500),
  idempotencyKey: z.string().uuid("Clé de soumission invalide"),
});

export const cashEntrySchema = z.object({
  account: z.enum(["CASH", "BANK"]),
  direction: z.enum(["IN", "OUT"]),
  amount: z.number().int("Montant invalide").min(1, "Le montant doit être supérieur à zéro").max(1e13, "Montant trop élevé"),
  date: dateStr,
  label: z.string().trim().min(2, "Libellé requis").max(150),
  category: text(60),
  reference: text(80),
});

export const openingBalancesSchema = z.object({
  openingCash: z.number().int().min(-1e13).max(1e13),
  openingBank: z.number().int().min(-1e13).max(1e13),
});

export const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Le nom est requis").max(150),
    customerId: text(40),
    status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "DONE", "CANCELLED"]),
    startDate: optDate,
    endDate: optDate,
    budget: money,
    description: text(2000),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, { path: ["endDate"], message: "La fin doit suivre le début" });

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Le titre est requis").max(200),
  description: text(2000),
  projectId: text(40),
  assigneeId: text(40),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: optDate,
});

export const contractSchema = z
  .object({
    reference: z.string().trim().min(1, "Référence requise").max(60),
    title: z.string().trim().min(2, "L'intitulé est requis").max(200),
    customerId: z.string().min(1, "Sélectionnez un client"),
    status: z.enum(["DRAFT", "ACTIVE", "TERMINATED"]),
    startDate: dateStr,
    endDate: optDate,
    amount: money,
    frequency: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "YEARLY"]),
    autoRenew: z.boolean(),
    notes: text(2000),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { path: ["endDate"], message: "La fin doit suivre le début" });

export const employeeSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(80),
  lastName: z.string().trim().min(2, "Nom requis").max(80),
  email,
  phone,
  position: text(100),
  department: text(100),
  hireDate: optDate,
  salary: money,
  cin: text(20),
  cnss: text(20),
  active: z.boolean(),
  notes: text(2000),
});
