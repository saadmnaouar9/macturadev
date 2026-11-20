/* eslint-disable no-console */
// Données de démonstration — compte : demo@mactura.ma / Demo1234
// Toutes les valeurs sont calculées avec le même moteur que l'application (src/lib/calc.ts).
import { PrismaClient, type Customer, type Product, type InvoiceStatus, type PaymentMethod, type QuoteStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeTotals, type LineInput } from "../src/lib/calc";

let db!: PrismaClient;

const SEED_START = 20261118;
let seed = SEED_START;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));

function todayUTC() {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
  return new Date(`${local}T00:00:00.000Z`);
}
const minDate = (a: Date, b: Date) => (a < b ? a : b);
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
};

const CUSTOMERS = [
  { type: "COMPANY", name: "Marjane Distribution SA", contactName: "Karim Bennani", city: "Casablanca", address: "Route de Rabat, Aïn Sebaâ", postalCode: "20250", email: "achats@marjane-distri.ma", phone: "0522 34 56 78" },
  { type: "COMPANY", name: "Atlas Logistique SARL", contactName: "Nadia Chraibi", city: "Tanger", address: "Zone Franche Tanger Med, Lot 42", postalCode: "90000", email: "contact@atlaslogistique.ma", phone: "0539 32 11 90" },
  { type: "COMPANY", name: "Riad Al Andalous", contactName: "Youssef Alaoui", city: "Marrakech", address: "Derb Sidi Bouloukat, Médina", postalCode: "40000", email: "direction@riad-andalous.ma", phone: "0524 38 90 12", nameAr: "رياض الأندلس" },
  { type: "COMPANY", name: "Sanad Assurances", contactName: "Salma Tazi", city: "Casablanca", address: "Bd Abdelmoumen, Quartier des Hôpitaux", postalCode: "20360", email: "it@sanad-assur.ma", phone: "0522 47 80 00" },
  { type: "COMPANY", name: "Fès Artisanat Export", contactName: "Omar Fassi Fihri", city: "Fès", address: "Quartier Industriel Sidi Brahim", postalCode: "30000", email: "export@fesartisanat.ma", phone: "0535 65 43 21" },
  { type: "COMPANY", name: "Souss Agri Coop", contactName: "Hassan Amrani", city: "Agadir", address: "Route d'Inezgane, km 8", postalCode: "80000", email: "coop@soussagri.ma", phone: "0528 23 45 67" },
  { type: "COMPANY", name: "Clinique Ibn Rochd", contactName: "Dr. Leila Berrada", city: "Rabat", address: "Avenue Mohammed VI, Souissi", postalCode: "10170", email: "administration@ibnrochd-clinique.ma", phone: "0537 75 22 10" },
  { type: "COMPANY", name: "Oriental BTP", contactName: "Rachid Ziani", city: "Oujda", address: "Bd Mohammed V, Imm. 12", postalCode: "60000", email: "contact@orientalbtp.ma", phone: "0536 68 90 34" },
  { type: "COMPANY", name: "Nour Textile SARL", contactName: "Imane Lahlou", city: "Casablanca", address: "Zone industrielle Moulay Rachid", postalCode: "20450", email: "finance@nourtextile.ma", phone: "0522 70 12 45" },
  { type: "COMPANY", name: "Agence Horizon Voyages", contactName: "Mehdi Kettani", city: "Rabat", address: "Rue Oued Fès, Agdal", postalCode: "10090", email: "booking@horizon-voyages.ma", phone: "0537 68 44 21" },
  { type: "COMPANY", name: "Électro Maghreb", contactName: "Samir Idrissi", city: "Kénitra", address: "Atlantic Free Zone, Lot 7", postalCode: "14000", email: "achats@electromaghreb.ma", phone: "0537 37 50 60" },
  { type: "COMPANY", name: "École Al Manar", contactName: "Hind Sebti", city: "Meknès", address: "Hamria, Rue de Paris", postalCode: "50000", email: "direction@almanar-ecole.ma", phone: "0535 52 11 33", nameAr: "مدرسة المنار" },
  { type: "COMPANY", name: "Tech Valley Consulting", contactName: "Anas Benjelloun", city: "Casablanca", address: "Casanearshore, Shore 7", postalCode: "20270", email: "hello@techvalley.ma", phone: "0522 77 66 55" },
  { type: "COMPANY", name: "Dar Zellige Design", contactName: "Zineb Mernissi", city: "Tétouan", address: "Avenue Hassan II", postalCode: "93000", email: "atelier@darzellige.ma", phone: "0539 71 22 98" },
  { type: "COMPANY", name: "Pharmacie Centrale El Jadida", contactName: "Abdellah Ouazzani", city: "El Jadida", address: "Place Mohammed V", postalCode: "24000", email: "pharma.centrale@menara.ma", phone: "0523 34 12 09" },
  { type: "COMPANY", name: "Royal Golf Events", contactName: "Ghita Benkirane", city: "Rabat", address: "Route des Zaërs", postalCode: "10100", email: "events@royalgolfevents.ma", phone: "0537 75 80 80" },
  { type: "INDIVIDUAL", name: "Adil Moussaoui", city: "Casablanca", address: "Résidence Les Palmiers, Maârif", postalCode: "20330", email: "adil.moussaoui@gmail.com", mobile: "0661 23 45 67" },
  { type: "INDIVIDUAL", name: "Fatima Zahra Benali", city: "Rabat", address: "Hay Riad, Secteur 12", postalCode: "10100", email: "fz.benali@outlook.com", mobile: "0662 98 76 54", nameAr: "فاطمة الزهراء بنعلي" },
  { type: "INDIVIDUAL", name: "Hamza El Ouardi", city: "Marrakech", address: "Guéliz, Rue de la Liberté", postalCode: "40000", email: "hamza.elouardi@gmail.com", mobile: "0670 11 22 33" },
  { type: "INDIVIDUAL", name: "Sara Bouzid", city: "Tanger", address: "Malabata, Résidence Al Bahr", postalCode: "90000", email: "sara.bouzid@gmail.com", mobile: "0655 44 33 22" },
] as const;

const CATEGORIES = [
  { name: "Développement", color: "#4F43AD" },
  { name: "Conseil", color: "#0EA5E9" },
  { name: "Matériel informatique", color: "#10B981" },
  { name: "Licences & Abonnements", color: "#F59E0B" },
  { name: "Formation", color: "#EE6136" },
  { name: "Maintenance", color: "#8B5CF6" },
];

const PRODUCTS: { type: "PRODUCT" | "SERVICE"; name: string; description: string; unit: string; price: number; tax: number; cat: string; sku?: string }[] = [
  { type: "SERVICE", name: "Développement site vitrine", description: "Conception et intégration d'un site vitrine responsive (jusqu'à 8 pages).", unit: "forfait", price: 18000_00, tax: 2000, cat: "Développement" },
  { type: "SERVICE", name: "Développement application web", description: "Développement sur mesure, facturé à la journée.", unit: "jour", price: 4500_00, tax: 2000, cat: "Développement" },
  { type: "SERVICE", name: "Boutique e-commerce", description: "Mise en place d'une boutique en ligne avec paiement CMI.", unit: "forfait", price: 35000_00, tax: 2000, cat: "Développement" },
  { type: "SERVICE", name: "Application mobile iOS / Android", description: "Application hybride, publication sur les stores incluse.", unit: "forfait", price: 65000_00, tax: 2000, cat: "Développement" },
  { type: "SERVICE", name: "Audit des systèmes d'information", description: "Audit complet de l'infrastructure et recommandations.", unit: "jour", price: 6000_00, tax: 2000, cat: "Conseil" },
  { type: "SERVICE", name: "Accompagnement transformation digitale", description: "Conseil stratégique, ateliers et feuille de route.", unit: "jour", price: 7500_00, tax: 2000, cat: "Conseil" },
  { type: "SERVICE", name: "Conformité loi 09-08 (CNDP)", description: "Mise en conformité protection des données personnelles.", unit: "forfait", price: 12000_00, tax: 2000, cat: "Conseil" },
  { type: "PRODUCT", name: "Ordinateur portable Pro 14\"", description: "Intel Core i7, 16 Go RAM, SSD 512 Go.", unit: "unité", price: 13900_00, tax: 2000, cat: "Matériel informatique", sku: "HW-LAP-14P" },
  { type: "PRODUCT", name: "Écran 27\" QHD", description: "Dalle IPS, USB-C 65 W.", unit: "unité", price: 3290_00, tax: 2000, cat: "Matériel informatique", sku: "HW-MON-27Q" },
  { type: "PRODUCT", name: "Imprimante multifonction laser", description: "Couleur, recto-verso, Wi-Fi.", unit: "unité", price: 4850_00, tax: 2000, cat: "Matériel informatique", sku: "HW-PRN-MFL" },
  { type: "PRODUCT", name: "Routeur Wi-Fi 6 professionnel", description: "Double bande, gestion cloud.", unit: "unité", price: 1890_00, tax: 2000, cat: "Matériel informatique", sku: "HW-NET-W6" },
  { type: "PRODUCT", name: "Câble réseau Cat6", description: "Câble cuivre blindé, vendu au mètre.", unit: "m", price: 6_50, tax: 2000, cat: "Matériel informatique", sku: "HW-CAB-C6" },
  { type: "SERVICE", name: "Licence Microsoft 365 Business", description: "Abonnement annuel par utilisateur.", unit: "utilisateur", price: 1320_00, tax: 2000, cat: "Licences & Abonnements" },
  { type: "SERVICE", name: "Hébergement cloud managé", description: "Serveur dédié virtuel, sauvegardes quotidiennes.", unit: "mois", price: 950_00, tax: 2000, cat: "Licences & Abonnements" },
  { type: "SERVICE", name: "Nom de domaine .ma", description: "Enregistrement ou renouvellement annuel.", unit: "an", price: 290_00, tax: 2000, cat: "Licences & Abonnements" },
  { type: "SERVICE", name: "Formation bureautique avancée", description: "Excel, Word, PowerPoint — session de groupe.", unit: "jour", price: 3800_00, tax: 2000, cat: "Formation" },
  { type: "SERVICE", name: "Formation cybersécurité", description: "Sensibilisation des collaborateurs aux risques.", unit: "session", price: 5500_00, tax: 2000, cat: "Formation" },
  { type: "SERVICE", name: "Contrat de maintenance annuel", description: "Support, mises à jour et interventions illimitées.", unit: "an", price: 24000_00, tax: 2000, cat: "Maintenance" },
  { type: "SERVICE", name: "Intervention technique sur site", description: "Déplacement et main-d'œuvre.", unit: "heure", price: 450_00, tax: 2000, cat: "Maintenance" },
  { type: "PRODUCT", name: "Manuel utilisateur imprimé", description: "Documentation reliée.", unit: "unité", price: 180_00, tax: 0, cat: "Formation", sku: "DOC-MAN-01" },
];

const METHODS: PaymentMethod[] = ["BANK_TRANSFER", "BANK_TRANSFER", "BANK_TRANSFER", "CHECK", "CHECK", "CASH", "LCN", "CARD"];

function genIce() {
  let s = "00";
  for (let i = 0; i < 13; i++) s += between(0, 9);
  return s;
}

/** Remplit la base avec le jeu de données de démonstration (utilisé par le CLI et par le Mode Démo en ligne). */
export async function seedDemo(client: PrismaClient, opts: { quiet?: boolean } = {}) {
  db = client;
  seed = SEED_START;
  const log = opts.quiet ? () => {} : console.log;
  log("› Nettoyage du compte de démonstration…");
  const existing = await db.user.findUnique({ where: { email: "demo@mactura.ma" }, include: { memberships: true } });
  if (existing) {
    for (const m of existing.memberships) await db.company.delete({ where: { id: m.companyId } }).catch(() => {});
    await db.user.delete({ where: { id: existing.id } });
  }

  const today = todayUTC();
  const company = await db.company.create({
    data: {
      name: "Atlas Digital Solutions",
      nameAr: "أطلس ديجيتال سولوشنز",
      legalForm: "SARL",
      ice: "002345678000094",
      taxId: "45678912",
      rc: "456789",
      rcCity: "Casablanca",
      patente: "35712468",
      cnss: "8765432",
      capital: "500 000 DH",
      address: "Twin Center, Tour Ouest, 12e étage, Bd Zerktouni",
      city: "Casablanca",
      postalCode: "20100",
      phone: "0522 95 40 40",
      email: "contact@atlasdigital.ma",
      website: "www.atlasdigital.ma",
      bankName: "Attijariwafa Bank",
      rib: "007 780 0001234567890123 45",
      invoiceNotes: "Merci pour votre confiance.",
      invoiceTerms: "Paiement par virement bancaire à réception. Tout retard de paiement entraîne des pénalités conformément à la loi 69-21.",
      quoteNotes: "Nous restons à votre disposition pour toute information complémentaire.",
      quoteTerms: "Acompte de 30 % à la commande. Solde à la livraison.",
      taxRates: {
        create: [
          { name: "TVA 20 %", rate: 2000, isDefault: true },
          { name: "TVA 14 %", rate: 1400 },
          { name: "TVA 10 %", rate: 1000 },
          { name: "TVA 7 %", rate: 700 },
          { name: "Exonéré", rate: 0 },
        ],
      },
    },
  });

  const user = await db.user.create({
    data: {
      email: "demo@mactura.ma",
      name: "Yasmine El Idrissi",
      passwordHash: await bcrypt.hash("Demo1234", 12),
      memberships: { create: { companyId: company.id, role: "OWNER", notificationsSeenAt: addDays(today, -3) } },
    },
  });

  log("› Catalogue…");
  const cats = new Map<string, string>();
  for (const c of CATEGORIES) {
    const cat = await db.category.create({ data: { ...c, companyId: company.id } });
    cats.set(c.name, cat.id);
  }
  const products: Product[] = [];
  for (const p of PRODUCTS) {
    products.push(
      await db.product.create({
        data: {
          companyId: company.id,
          type: p.type,
          name: p.name,
          description: p.description,
          unit: p.unit,
          unitPrice: BigInt(p.price),
          taxRate: p.tax,
          sku: p.sku,
          categoryId: cats.get(p.cat),
          createdAt: addDays(today, -400),
        },
      }),
    );
  }

  log("› Clients…");
  const customers: Customer[] = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const isCompany = c.type === "COMPANY";
    customers.push(
      await db.customer.create({
        data: {
          companyId: company.id,
          ...c,
          ice: isCompany ? genIce() : null,
          taxId: isCompany ? String(between(10000000, 99999999)) : null,
          rc: isCompany ? String(between(10000, 999999)) : null,
          paymentDays: isCompany ? pick([30, 30, 60, 45]) : null,
          createdAt: addDays(today, -380 + i * 12),
        },
      }),
    );
  }

  const counters = { INVOICE: new Map<number, number>(), QUOTE: new Map<number, number>() };
  const nextNumber = (kind: "INVOICE" | "QUOTE", date: Date) => {
    const y = date.getUTCFullYear();
    const n = (counters[kind].get(y) ?? 0) + 1;
    counters[kind].set(y, n);
    return `${kind === "INVOICE" ? "FAC" : "DEV"}-${y}-${String(n).padStart(4, "0")}`;
  };

  function makeItems() {
    const n = between(1, 4);
    const chosen = new Set<number>();
    while (chosen.size < n) chosen.add(between(0, products.length - 1));
    return [...chosen].map((idx, position) => {
      const p = products[idx];
      const unit = p.unit;
      const qty = unit === "m" ? between(50, 400) * 1000 : unit === "heure" ? between(2, 16) * 1000 : unit === "jour" ? between(2, 15) * 1000 : unit === "utilisateur" ? between(5, 40) * 1000 : unit === "mois" ? 12000 : between(1, 6) * 1000;
      return {
        productId: p.id,
        position,
        description: p.name,
        details: p.description,
        quantity: qty,
        unit,
        unitPrice: Number(p.unitPrice),
        discount: rand() < 0.2 ? pick([500, 1000, 1500]) : 0,
        taxRate: p.taxRate,
      };
    });
  }

  function persistTotals(items: ReturnType<typeof makeItems>, globalDiscount: number) {
    const t = computeTotals(items as LineInput[], globalDiscount);
    return {
      totals: {
        subtotal: BigInt(t.subtotal),
        discountTotal: BigInt(t.discountTotal),
        taxableTotal: BigInt(t.taxableTotal),
        taxTotal: BigInt(t.taxTotal),
        total: BigInt(t.total),
      },
      items: items.map((it, i) => ({ ...it, unitPrice: BigInt(it.unitPrice), netAmount: BigInt(t.lines[i].net) })),
      total: t.total,
    };
  }

  log("› Devis et factures sur 12 mois…");
  const activities: { type: string; entityType: string; entityId: string; message: string; amount?: bigint; createdAt: Date }[] = [];

  // Les documents sont créés par ordre chronologique pour une numérotation continue
  const events: { date: Date; kind: "quote" | "invoice" }[] = [];
  for (let d = 360; d >= 0; d -= between(2, 5)) events.push({ date: addDays(today, -d), kind: rand() < 0.45 ? "quote" : "invoice" });

  for (const ev of events) {
    const customer = pick(customers);
    const age = Math.round((today.getTime() - ev.date.getTime()) / 86400000);
    const globalDiscount = rand() < 0.12 ? pick([500, 1000]) : 0;
    const built = persistTotals(makeItems(), globalDiscount);

    if (ev.kind === "quote") {
      const expiryDate = addDays(ev.date, 30);
      let status: QuoteStatus;
      if (age < 6) status = pick(["DRAFT", "SENT", "SENT"]);
      else if (age < 30) status = pick(["SENT", "SENT", "ACCEPTED", "REJECTED"]);
      else status = pick(["ACCEPTED", "ACCEPTED", "ACCEPTED", "REJECTED", "SENT"]);
      const quote = await db.quote.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          number: nextNumber("QUOTE", ev.date),
          status,
          issueDate: ev.date,
          expiryDate,
          globalDiscount,
          notes: company.quoteNotes,
          terms: company.quoteTerms,
          sentAt: status !== "DRAFT" ? addDays(ev.date, 1) : null,
          acceptedAt: status === "ACCEPTED" ? minDate(addDays(ev.date, between(2, 12)), today) : null,
          rejectedAt: status === "REJECTED" ? minDate(addDays(ev.date, between(3, 15)), today) : null,
          createdAt: ev.date,
          ...built.totals,
          items: { create: built.items },
        },
      });
      activities.push({ type: "quote.created", entityType: "quote", entityId: quote.id, message: `Devis ${quote.number} créé pour ${customer.name}`, amount: quote.total, createdAt: ev.date });
      if (status === "ACCEPTED") {
        activities.push({ type: "quote.accepted", entityType: "quote", entityId: quote.id, message: `${customer.name} a accepté le devis ${quote.number}`, amount: quote.total, createdAt: quote.acceptedAt! });
        // La majorité des devis acceptés sont convertis en facture
        if (rand() < 0.75 && age > 10) {
          const invDate = quote.acceptedAt!;
          await createInvoice(customer, invDate, built, globalDiscount, quote.id);
        }
      }
      if (status === "REJECTED") {
        activities.push({ type: "quote.rejected", entityType: "quote", entityId: quote.id, message: `${customer.name} a refusé le devis ${quote.number}`, createdAt: quote.rejectedAt! });
      }
    } else {
      await createInvoice(customer, ev.date, built, globalDiscount, null);
    }
  }

  async function createInvoice(customer: (typeof customers)[number], issueDate: Date, built: ReturnType<typeof persistTotals>, globalDiscount: number, quoteId: string | null) {
    const age = Math.round((today.getTime() - issueDate.getTime()) / 86400000);
    const dueDays = customer.paymentDays ?? 30;
    const dueDate = addDays(issueDate, dueDays);
    // Scénario de règlement simulé, puis dérivation des deux dimensions stockées
    type Scenario = "DRAFT" | "ISSUED" | "SENT" | "PARTIAL" | "PAID" | "CANCELLED";
    let scenario: Scenario;
    const r = rand();
    if (age < 3) scenario = r < 0.6 ? "DRAFT" : "SENT";
    else if (age < 45) scenario = r < 0.4 ? "PAID" : r < 0.6 ? "PARTIAL" : r < 0.85 ? "SENT" : "ISSUED";
    else if (age < 120) scenario = r < 0.72 ? "PAID" : r < 0.85 ? "PARTIAL" : "SENT";
    else scenario = r < 0.93 ? "PAID" : "PARTIAL";
    if (r > 0.985 && age > 20) scenario = "CANCELLED";

    const status: InvoiceStatus = scenario === "DRAFT" ? "DRAFT" : scenario === "CANCELLED" ? "CANCELLED" : scenario === "ISSUED" ? "ISSUED" : "SENT";
    const number = status === "DRAFT" ? null : nextNumber("INVOICE", issueDate);
    const payments: { amount: bigint; date: Date; method: PaymentMethod; reference: string | null; voidedAt?: Date; voidReason?: string }[] = [];
    if (scenario === "PAID") {
      const payDate = addDays(issueDate, Math.min(age, between(5, dueDays + 10)));
      if (rand() < 0.3 && built.total > 1000_00) {
        const first = BigInt(Math.round(built.total * 0.4));
        payments.push({ amount: first, date: addDays(issueDate, Math.min(age, between(1, 8))), method: pick(METHODS), reference: null });
        payments.push({ amount: BigInt(built.total) - first, date: payDate, method: pick(METHODS), reference: null });
      } else payments.push({ amount: BigInt(built.total), date: payDate, method: pick(METHODS), reference: null });
    } else if (scenario === "PARTIAL") {
      const d = addDays(issueDate, Math.min(age, between(2, 15)));
      // Quelques paiements saisis par erreur puis annulés : ils restent dans l'historique
      if (rand() < 0.3) payments.push({ amount: BigInt(Math.round(built.total * 0.2)), date: d, method: "CHECK", reference: null, voidedAt: addDays(d, 1), voidReason: "Chèque retourné impayé" });
      payments.push({ amount: BigInt(Math.round(built.total * pick([0.3, 0.4, 0.5]))), date: d, method: pick(METHODS), reference: null });
    }
    // Les gros montants ne se règlent pas en espèces
    for (const p of payments) if (p.method === "CASH" && p.amount > 2_000_000n) p.method = "BANK_TRANSFER";
    for (const p of payments) {
      p.reference = p.method === "CHECK" ? `CHQ ${between(1000000, 9999999)}` : p.method === "BANK_TRANSFER" ? `VIR-${between(100000, 999999)}` : p.method === "LCN" ? `LCN ${between(100000, 999999)}` : null;
    }
    const active = payments.filter((p) => !p.voidedAt);
    const amountPaid = active.reduce((s, p) => s + p.amount, 0n);
    const paymentStatus = amountPaid >= BigInt(built.total) && built.total > 0 ? "PAID" : amountPaid > 0n ? "PARTIAL" : "UNPAID";
    const invoice = await db.invoice.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        quoteId,
        number,
        status,
        paymentStatus,
        issueDate,
        dueDate,
        paymentTerms: `${dueDays} jours`,
        globalDiscount,
        notes: company.invoiceNotes,
        terms: company.invoiceTerms,
        amountPaid,
        issuedAt: number ? issueDate : null,
        sentAt: status === "SENT" ? addDays(issueDate, 1) : null,
        paidAt: paymentStatus === "PAID" ? active[active.length - 1].date : null,
        cancelledAt: status === "CANCELLED" ? addDays(issueDate, 5) : null,
        createdAt: issueDate,
        ...built.totals,
        items: { create: built.items },
        payments: { create: payments.map((p) => ({ ...p, companyId: company.id, createdById: user.id })) },
      },
    });
    if (number) activities.push({ type: "invoice.issued", entityType: "invoice", entityId: invoice.id, message: `Facture ${number} émise pour ${customer.name}`, amount: invoice.total, createdAt: issueDate });
    for (const p of payments) {
      const amt = `${(Number(p.amount) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, " ")} DH`;
      activities.push({ type: "payment.created", entityType: "invoice", entityId: invoice.id, message: `Paiement de ${amt} reçu de ${customer.name} (${number})`, amount: p.amount, createdAt: p.date });
      if (p.voidedAt) activities.push({ type: "payment.voided", entityType: "invoice", entityId: invoice.id, message: `Paiement de ${amt} annulé (${number}) — motif : ${p.voidReason}`, amount: p.amount, createdAt: p.voidedAt });
    }
  }

  for (const [kind, map] of Object.entries(counters)) {
    for (const [year, value] of map) {
      await db.counter.create({ data: { companyId: company.id, kind: kind as "INVOICE" | "QUOTE", year, value } });
    }
  }
  await db.activity.createMany({ data: activities.map((a) => ({ ...a, companyId: company.id, userId: user.id })) });

  // ─────────── Achats, trésorerie, CRM étendu, organisation ───────────
  log("› Fournisseurs, achats, trésorerie…");
  await db.company.update({ where: { id: company.id }, data: { openingBank: BigInt(150_000_00), openingCash: BigInt(80_000_00) } });
  const SUPPLIERS = [
    { name: "Maroc Télécom Entreprises", city: "Rabat", paymentDays: 30, cat: "Télécom" },
    { name: "Dell Maroc Distribution", city: "Casablanca", paymentDays: 45, cat: "Matériel" },
    { name: "Lydec Électricité & Eau", city: "Casablanca", paymentDays: 15, cat: "Énergie" },
    { name: "Imprimerie Al Watan", city: "Casablanca", paymentDays: 30, cat: "Marketing" },
    { name: "Cloud Hosting Africa", city: "Rabat", paymentDays: 30, cat: "Services" },
    { name: "Bureau Plus Fournitures", city: "Casablanca", paymentDays: 30, cat: "Fournitures" },
    { name: "Royal Air Maroc Business", city: "Casablanca", paymentDays: 0, cat: "Déplacements" },
    { name: "Cabinet Expert Comptable Naji", city: "Casablanca", paymentDays: 30, cat: "Services" },
  ];
  const suppliers: { id: string; name: string; paymentDays: number | null; cat: string }[] = [];
  for (const sp of SUPPLIERS) {
    const sup = await db.supplier.create({ data: { companyId: company.id, name: sp.name, city: sp.city, paymentDays: sp.paymentDays, ice: genIce(), taxId: String(between(10000000, 99999999)), rc: String(between(10000, 999999)), email: `compta@${sp.name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.ma`, phone: `05 22 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`, createdAt: addDays(today, -380) } });
    suppliers.push({ id: sup.id, name: sup.name, paymentDays: sp.paymentDays, cat: sp.cat });
  }
  const act2: { type: string; entityType: string; entityId: string; message: string; amount?: bigint; createdAt: Date }[] = [];
  const fmt = (c: bigint | number) => `${(Number(c) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, " ")} DH`;
  for (let i = 0; i < 32; i++) {
    const date = addDays(today, -between(2, 335));
    const sup = pick(suppliers);
    const sub = between(900, 48000) * 100;
    const taxRate = pick([2000, 2000, 2000, 2000, 1000, 0]);
    const t = computeTotals([{ quantity: 1000, unitPrice: sub, discount: 0, taxRate }]);
    const age = Math.round((today.getTime() - date.getTime()) / 86400000);
    const r = rand();
    const mode = age > 60 ? (r < 0.8 ? "PAID" : r < 0.9 ? "PARTIAL" : "UNPAID") : r < 0.4 ? "PAID" : r < 0.6 ? "PARTIAL" : "UNPAID";
    const pays: { amount: bigint; date: Date; method: PaymentMethod; reference: string | null; voidedAt?: Date; voidReason?: string }[] = [];
    const payDate = addDays(date, Math.min(age, between(3, 35)));
    const method: PaymentMethod = t.total <= 2_000_000 && rand() < 0.3 ? "CASH" : pick(["BANK_TRANSFER", "BANK_TRANSFER", "CHECK"]);
    if (i === 5) {
      pays.push({ amount: BigInt(t.total), date: payDate, method: "BANK_TRANSFER", reference: "VIR-REJETÉ", voidedAt: addDays(payDate, 2), voidReason: "Virement rejeté par la banque" });
      pays.push({ amount: BigInt(t.total), date: addDays(payDate, 4 > age ? 0 : 4), method: "CHECK", reference: `CHQ ${between(1000000, 9999999)}` });
    } else if (mode === "PAID") pays.push({ amount: BigInt(t.total), date: payDate, method, reference: method === "CASH" ? null : `${method === "CHECK" ? "CHQ" : "VIR"}-${between(100000, 999999)}` });
    else if (mode === "PARTIAL") pays.push({ amount: BigInt(Math.round(t.total * pick([0.3, 0.5, 0.6]))), date: payDate, method: method === "CASH" ? "BANK_TRANSFER" : method, reference: `VIR-${between(100000, 999999)}` });
    const active = pays.filter((x) => !x.voidedAt);
    const paid = active.reduce((a, x) => a + x.amount, 0n);
    const cancelled = i === 9 && pays.length === 0;
    const ref = `FA-${String(date.getUTCFullYear()).slice(2)}${String(between(100, 9999)).padStart(4, "0")}`;
    const pur = await db.purchase.create({
      data: {
        companyId: company.id, supplierId: sup.id, reference: ref, issueDate: date, dueDate: addDays(date, sup.paymentDays ?? 30), category: sup.cat,
        subtotal: BigInt(t.subtotal), taxRate, taxTotal: BigInt(t.taxTotal), total: BigInt(t.total), amountPaid: paid,
        paymentStatus: paid >= BigInt(t.total) ? "PAID" : paid > 0n ? "PARTIAL" : "UNPAID", cancelledAt: cancelled ? addDays(date, 3) : null, createdAt: date,
        payments: { create: pays.map((x) => ({ ...x, companyId: company.id, createdById: user.id })) },
      },
    });
    act2.push({ type: "purchase.created", entityType: "purchase", entityId: pur.id, message: `Achat ${ref} enregistré — ${sup.name} (${fmt(t.total)} TTC)`, amount: BigInt(t.total), createdAt: date });
    for (const x of pays) {
      act2.push({ type: "purchase.paid", entityType: "purchase", entityId: pur.id, message: `Paiement de ${fmt(x.amount)} à ${sup.name} (${ref})`, amount: x.amount, createdAt: x.date });
      if (x.voidedAt) act2.push({ type: "purchase.payment_voided", entityType: "purchase", entityId: pur.id, message: `Paiement de ${fmt(x.amount)} à ${sup.name} annulé (${ref}) — motif : ${x.voidReason}`, amount: x.amount, createdAt: x.voidedAt });
    }
  }

  // Fournisseurs supplémentaires, répartis dans tout le Maroc (carte des fournisseurs).
  // Valeurs déterministes (sans tirage aléatoire) : elles ne modifient pas le reste du jeu de données.
  const EXTRA_SUPPLIERS = [
    { name: "Atlas Packaging Industries", city: "Tanger", paymentDays: 30, cat: "Fournitures", amount: 14_800 },
    { name: "Souss Informatique Services", city: "Agadir", paymentDays: 30, cat: "Services" },
    { name: "Fès Mobilier Professionnel", city: "Fès", paymentDays: 45, cat: "Matériel", amount: 36_500 },
    { name: "Marrakech Print & Signalétique", city: "Marrakech", paymentDays: 30, cat: "Marketing" },
    { name: "Oriental Logistique Express", city: "Oujda", paymentDays: 30, cat: "Déplacements", amount: 9_200 },
    { name: "Kénitra Énergie Solaire", city: "Kénitra", paymentDays: 60, cat: "Énergie" },
    { name: "Meknès Formation & Conseil", city: "Meknès", paymentDays: 30, cat: "Services", amount: 18_000 },
    { name: "Tétouan Textile Pro", city: "Tétouan", paymentDays: 45, cat: "Fournitures" },
    { name: "Safi Maintenance Industrielle", city: "Safi", paymentDays: 30, cat: "Services" },
    { name: "El Jadida Sécurité Services", city: "El Jadida", paymentDays: 30, cat: "Services", amount: 7_400 },
    { name: "Laâyoune Télécom Sahara", city: "Laâyoune", paymentDays: 30, cat: "Télécom" },
    { name: "Béni Mellal Agro Équipements", city: "Béni Mellal", paymentDays: 45, cat: "Matériel", amount: 52_000 },
    { name: "Nador Import-Export", city: "Nador", paymentDays: 30, cat: "Déplacements" },
    { name: "Essaouira Artisanat Déco", city: "Essaouira", paymentDays: 15, cat: "Marketing" },
    { name: "Dakhla Maritime Services", city: "Dakhla", paymentDays: 30, cat: "Déplacements" },
  ];
  for (let i = 0; i < EXTRA_SUPPLIERS.length; i++) {
    const sp = EXTRA_SUPPLIERS[i];
    const slug = sp.name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const sup = await db.supplier.create({
      data: {
        companyId: company.id, name: sp.name, city: sp.city, paymentDays: sp.paymentDays,
        ice: `00${String(1_840_000_000_000 + i * 7_919_317).padStart(13, "0")}`, taxId: String(31_200_000 + i * 48_113), rc: String(100_000 + i * 7_351),
        email: `compta@${slug}.ma`, phone: `05 ${20 + (i % 5)} ${String(10 + i * 3).padStart(2, "0")} ${String(40 + i * 2).padStart(2, "0")} ${String(11 + i * 5).padStart(2, "0")}`,
        createdAt: addDays(today, -300 + i * 7),
      },
    });
    if ("amount" in sp && sp.amount) {
      // Une facture d'achat récente, non réglée (affichée en orange sur la carte)
      const t = computeTotals([{ quantity: 1000, unitPrice: sp.amount * 100, discount: 0, taxRate: 2000 }]);
      const date = addDays(today, -(12 + i * 2));
      await db.purchase.create({
        data: {
          companyId: company.id, supplierId: sup.id, reference: `FA-26${String(8100 + i * 13)}`, issueDate: date, dueDate: addDays(date, sp.paymentDays), category: sp.cat,
          subtotal: BigInt(t.subtotal), taxRate: 2000, taxTotal: BigInt(t.taxTotal), total: BigInt(t.total), amountPaid: 0n, paymentStatus: "UNPAID", cancelledAt: null, createdAt: date,
        },
      });
    }
  }

  // Opérations de trésorerie : loyer et frais récurrents, apport, caisse
  const entries: { account: "CASH" | "BANK"; direction: "IN" | "OUT"; amount: number; date: Date; label: string; category: string }[] = [];
  for (let m = 11; m >= 0; m--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 5));
    if (d > today) continue;
    entries.push({ account: "BANK", direction: "OUT", amount: 12_000_00, date: d, label: "Loyer du local — Twin Center", category: "Loyer" });
    entries.push({ account: "BANK", direction: "OUT", amount: between(120, 380) * 100, date: addDays(d, 20), label: "Frais et commissions bancaires", category: "Frais bancaires" });
    if (m % 2 === 0) {
      const amt = between(20, 60) * 100 * 10;
      entries.push({ account: "BANK", direction: "OUT", amount: amt, date: addDays(d, 8), label: "Retrait pour alimentation de la caisse", category: "Virement interne" });
      entries.push({ account: "CASH", direction: "IN", amount: amt, date: addDays(d, 8), label: "Alimentation de la caisse (retrait bancaire)", category: "Virement interne" });
    }
    entries.push({ account: "CASH", direction: "OUT", amount: between(40, 180) * 100, date: addDays(d, between(1, 20)), label: pick(["Fournitures de bureau", "Café et collations équipe", "Frais postaux", "Petit matériel"]), category: "Frais généraux" });
    entries.push({ account: "CASH", direction: "OUT", amount: between(30, 150) * 100, date: addDays(d, between(1, 25)), label: pick(["Taxi — déplacement client", "Parking et péage", "Carburant"]), category: "Déplacements" });
  }
  entries.push({ account: "BANK", direction: "IN", amount: 80_000_00, date: addDays(today, -200), label: "Apport en compte courant d'associé", category: "Apport" });
  await db.cashEntry.createMany({ data: entries.filter((e) => e.date <= today).map((e) => ({ ...e, amount: BigInt(e.amount), companyId: company.id, createdById: user.id })) });

  log("› Prospects, projets, tâches, contrats, employés…");
  const PROSPECTS = [
    { name: "Hôtel Atlas Palace", contactName: "Rachid Berrada", status: "PROPOSAL", value: 85_000, source: "Recommandation", next: 3 },
    { name: "Groupe Scolaire Les Lauriers", contactName: "Samira Lahlou", status: "QUALIFIED", value: 42_000, source: "Site web", next: 6 },
    { name: "Cabinet Dentaire Smile", contactName: "Dr. Yassine Tazi", status: "CONTACTED", value: 18_000, source: "Appel entrant", next: -2 },
    { name: "Boulangerie Dar Khobz", contactName: "Hakim Zniber", status: "NEW", value: 9_500, source: "Réseaux sociaux", next: 1 },
    { name: "Port Autonome Logistics", contactName: "Nawal Ouali", status: "PROPOSAL", value: 210_000, source: "Salon / événement", next: 9 },
    { name: "Coopérative Argane d'Or", contactName: "Fatima Ait Brahim", status: "QUALIFIED", value: 27_000, source: "Prospection", next: -5 },
    { name: "Résidence Les Jardins", contactName: "Omar Belhaj", status: "NEW", value: 14_000, source: "Site web", next: 4 },
    { name: "Transport Rapide SARL", contactName: "Amine Chakir", status: "CONTACTED", value: 33_000, source: "Recommandation", next: 12 },
    { name: "Pharmacie Ibn Sina", contactName: "Dr. Zineb Alami", status: "WON", value: 22_000, source: "Recommandation", next: null },
    { name: "Café Littéraire Rabat", contactName: "Soufiane Idrissi", status: "WON", value: 12_500, source: "Réseaux sociaux", next: null },
    { name: "Atelier Menuiserie Fès", contactName: "Brahim Naciri", status: "LOST", value: 16_000, source: "Prospection", next: null },
    { name: "Agence Immobilière Prestige", contactName: "Kenza Mouline", status: "LOST", value: 38_000, source: "Salon / événement", next: null },
  ] as const;
  for (const [i, pr] of PROSPECTS.entries()) {
    await db.prospect.create({ data: { companyId: company.id, name: pr.name, contactName: pr.contactName, email: `contact@${pr.name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.ma`, phone: `06 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`, source: pr.source, status: pr.status, value: BigInt(pr.value * 100), nextActionDate: pr.next === null ? null : addDays(today, pr.next), convertedCustomerId: pr.status === "WON" ? customers[16 + (i % 3)].id : null, createdAt: addDays(today, -between(5, 120)) } });
  }

  const PROJECTS = [
    { name: "Refonte du site e-commerce", c: 0, status: "ACTIVE", budget: 120_000, start: -60, end: 40 },
    { name: "Application mobile de réservation", c: 2, status: "ACTIVE", budget: 85_000, start: -30, end: 75 },
    { name: "Migration cloud & sauvegardes", c: 3, status: "ACTIVE", budget: 48_000, start: -15, end: 20 },
    { name: "Déploiement ERP — phase 1", c: 7, status: "PLANNED", budget: 150_000, start: 15, end: 140 },
    { name: "Audit cybersécurité", c: 6, status: "DONE", budget: 30_000, start: -120, end: -70 },
    { name: "Site vitrine & identité visuelle", c: 12, status: "ON_HOLD", budget: 22_000, start: -45, end: 30 },
  ] as const;
  const projects: { id: string }[] = [];
  for (const pj of PROJECTS) projects.push(await db.project.create({ data: { companyId: company.id, customerId: customers[pj.c].id, name: pj.name, status: pj.status, budget: BigInt(pj.budget * 100), startDate: addDays(today, pj.start), endDate: addDays(today, pj.end), description: "Projet suivi dans Mactura." } }));
  const TASKS = [
    ["Maquettes de la page d'accueil", 0, "DONE", "MEDIUM", -20], ["Intégration du tunnel de commande", 0, "IN_PROGRESS", "HIGH", 5], ["Paiement CMI — recette", 0, "TODO", "HIGH", 12],
    ["Rédaction des contenus produits", 0, "TODO", "LOW", 20], ["Spécifications fonctionnelles", 1, "DONE", "HIGH", -10], ["Développement de l'écran de réservation", 1, "IN_PROGRESS", "HIGH", 14],
    ["Notifications push", 1, "TODO", "MEDIUM", 30], ["Inventaire des serveurs", 2, "DONE", "MEDIUM", -8], ["Migration de la base de données", 2, "IN_PROGRESS", "HIGH", -1],
    ["Plan de reprise d'activité", 2, "TODO", "MEDIUM", 9], ["Cahier des charges ERP", 3, "TODO", "HIGH", 21], ["Rapport d'audit final", 4, "DONE", "MEDIUM", -72],
    ["Relancer la validation de la charte graphique", 5, "TODO", "LOW", -4], [null, null, "TODO", "MEDIUM", 2], [null, null, "IN_PROGRESS", "LOW", 7],
  ] as const;
  const FREE = ["Préparer la déclaration de TVA", "Renouveler le nom de domaine .ma", "Relancer les factures en retard"];
  for (const [i, t] of TASKS.entries()) {
    await db.task.create({ data: { companyId: company.id, title: t[0] ?? FREE[i % 3], projectId: t[1] === null ? null : projects[t[1]].id, assigneeId: i % 4 === 3 ? null : user.id, status: t[2], priority: t[3], dueDate: addDays(today, t[4]), completedAt: t[2] === "DONE" ? addDays(today, t[4]) : null, createdAt: addDays(today, t[4] - 15) } });
  }

  const CONTRACTS = [
    ["CTR-2026-001", "Maintenance annuelle du système d'information", 3, "ACTIVE", -200, 165, 48_000, "YEARLY", true],
    ["CTR-2026-002", "Hébergement cloud managé", 0, "ACTIVE", -300, 65, 11_400, "YEARLY", true],
    ["CTR-2026-003", "Support applicatif mensuel", 6, "ACTIVE", -90, null, 4_500, "MONTHLY", true],
    ["CTR-2025-014", "Licences Microsoft 365", 8, "ACTIVE", -380, 20, 26_400, "YEARLY", false],
    ["CTR-2025-009", "Accompagnement digital", 11, "ACTIVE", -400, -15, 18_000, "QUARTERLY", false],
    ["CTR-2026-004", "Tierce maintenance applicative", 12, "DRAFT", 10, 375, 36_000, "YEARLY", false],
    ["CTR-2024-021", "Formation continue du personnel", 4, "TERMINATED", -700, -300, 9_000, "ONE_TIME", false],
  ] as const;
  for (const c of CONTRACTS) await db.contract.create({ data: { companyId: company.id, reference: c[0], title: c[1], customerId: customers[c[2]].id, status: c[3], startDate: addDays(today, c[4]), endDate: c[5] === null ? null : addDays(today, c[5]), amount: BigInt(c[6] * 100), frequency: c[7], autoRenew: c[8] } });

  const EMPLOYEES = [
    ["Yasmine", "El Idrissi", "Directrice générale", "Direction", 38_000, -1800], ["Karim", "Benjelloun", "Responsable commercial", "Ventes", 22_000, -1400], ["Salma", "Ouazzani", "Comptable", "Finance", 14_500, -1100],
    ["Amine", "Tahiri", "Développeur senior", "Technique", 26_000, -900], ["Nadia", "Fassi", "Développeuse front-end", "Technique", 19_000, -600], ["Othmane", "Berrada", "Chef de projet", "Technique", 24_000, -1000],
    ["Imane", "Chraibi", "Assistante administrative", "Administration", 8_500, -400], ["Hamza", "Lahlou", "Technicien support", "Technique", 9_800, -150],
  ] as const;
  for (const e of EMPLOYEES) await db.employee.create({ data: { companyId: company.id, firstName: e[0], lastName: e[1], position: e[2], department: e[3], salary: BigInt(e[4] * 100), hireDate: addDays(today, e[5]), email: `${e[0].toLowerCase()}.${e[1].toLowerCase()}@atlasdigital.ma`, cin: `BK${between(100000, 999999)}`, cnss: String(between(1000000, 9999999)), active: true } });
  await db.employee.create({ data: { companyId: company.id, firstName: "Mehdi", lastName: "Sebti", position: "Développeur", department: "Technique", salary: BigInt(17_000_00), hireDate: addDays(today, -1300), active: false, notes: "A quitté l'entreprise." } });
  await db.activity.createMany({ data: act2.map((a) => ({ ...a, companyId: company.id, userId: user.id })) });

  const [ci, cq, cp] = await Promise.all([db.invoice.count({ where: { companyId: company.id } }), db.quote.count({ where: { companyId: company.id } }), db.payment.count({ where: { companyId: company.id } })]);
  log(`✓ ${customers.length} clients, ${products.length} produits, ${cq} devis, ${ci} factures, ${cp} paiements`);
  log("✓ Connexion : demo@mactura.ma / Demo1234");
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  const client = new PrismaClient();
  seedDemo(client)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => client.$disconnect());
}
