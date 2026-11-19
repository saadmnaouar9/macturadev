// Tests d'intégration du cycle de vie des factures et des paiements.
// Exécutés sur une vraie base PostgreSQL (npm run test:integration) : transactions,
// verrous de ligne et contraintes d'unicité sont ceux de la production.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { buildDocument } from "@/lib/documents";
import { BusinessError } from "@/lib/action";
import {
  cancelInvoiceService,
  issueInvoiceService,
  markInvoiceSentService,
  recordPaymentService,
  voidPaymentService,
  type ServiceContext,
} from "@/lib/invoice-service";
import { invoiceDisplayStatus, isOverdue } from "@/lib/status";
import { invoiceStatusWhere } from "@/lib/document-filters";
import { getDashboard } from "@/lib/dashboard";
import { addDays, todayUTC } from "@/lib/utils";

let ctx: ServiceContext;
let otherCtx: ServiceContext;
let customerId: string;

const TOTAL = 120_000; // 1 000,00 HT + TVA 20 % = 1 200,00 DH TTC

async function draftInvoice(opts: { issueDate?: Date; dueDate?: Date; companyId?: string; customer?: string } = {}) {
  const built = buildDocument(
    [{ productId: null, description: "Prestation", details: null, quantity: 1000, unit: "forfait", unitPrice: 100_000, discountType: "PERCENT", discount: 0, taxRate: 2000 }],
    "PERCENT",
    0,
  );
  const issueDate = opts.issueDate ?? addDays(todayUTC(), -5);
  return db.invoice.create({
    data: {
      companyId: opts.companyId ?? ctx.companyId,
      customerId: opts.customer ?? customerId,
      issueDate,
      dueDate: opts.dueDate ?? addDays(issueDate, 30),
      ...built.totals,
      ...built.global,
      items: { create: built.items },
    },
  });
}

async function issued(opts?: Parameters<typeof draftInvoice>[0]) {
  const d = await draftInvoice(opts);
  await issueInvoiceService(opts?.companyId ? { companyId: opts.companyId, userId: null } : ctx, d.id);
  return d.id;
}

const pay = (invoiceId: string, amount: number, key = randomUUID(), c = ctx) =>
  recordPaymentService(c, { invoiceId, amount, date: todayUTC(), method: "BANK_TRANSFER", idempotencyKey: key });

async function rejects(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof BusinessError, `BusinessError attendu, reçu : ${String(err)}`);
    assert.match((err as Error).message, pattern);
    return true;
  });
}

async function makeCompany(name: string) {
  const company = await db.company.create({ data: { name, taxRates: { create: [{ name: "TVA 20 %", rate: 2000, isDefault: true }] } } });
  const user = await db.user.create({ data: { email: `${randomUUID()}@test.ma`, name: "Testeur", passwordHash: "x", memberships: { create: { companyId: company.id, role: "OWNER" } } } });
  const customer = await db.customer.create({ data: { companyId: company.id, name: `Client ${name}` } });
  return { ctx: { companyId: company.id, userId: user.id }, customerId: customer.id };
}

before(async () => {
  const url = process.env.DATABASE_URL ?? "";
  assert.ok(url.includes("_test"), "Les tests d'intégration doivent tourner sur une base *_test");
});

beforeEach(async () => {
  await db.company.deleteMany({ where: { name: { startsWith: "TEST " } } });
  const a = await makeCompany("TEST Atlas");
  const b = await makeCompany("TEST Autre");
  ctx = a.ctx;
  customerId = a.customerId;
  otherCtx = b.ctx;
});

after(async () => {
  await db.company.deleteMany({ where: { name: { startsWith: "TEST " } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@test.ma" } } });
  await db.$disconnect();
});

describe("cycle de vie", () => {
  test("l'émission attribue une numérotation continue et ne touche pas au règlement", async () => {
    const year = todayUTC().getUTCFullYear();
    const a = await issued();
    const b = await issued();
    const [ia, ib] = await Promise.all([db.invoice.findUniqueOrThrow({ where: { id: a } }), db.invoice.findUniqueOrThrow({ where: { id: b } })]);
    assert.equal(ia.number, `FAC-${year}-0001`);
    assert.equal(ib.number, `FAC-${year}-0002`);
    assert.equal(ia.status, "ISSUED");
    assert.equal(ia.paymentStatus, "UNPAID");
    assert.ok(ia.issuedAt);
    assert.equal(ia.sentAt, null);
  });

  test("émissions concurrentes : numéros uniques et sans trou", async () => {
    const drafts = await Promise.all(Array.from({ length: 6 }, () => draftInvoice()));
    await Promise.all(drafts.map((d) => issueInvoiceService(ctx, d.id)));
    const numbers = (await db.invoice.findMany({ where: { companyId: ctx.companyId }, select: { number: true } })).map((i) => Number(i.number!.slice(-4))).sort((x, y) => x - y);
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6]);
  });

  test("transitions invalides refusées côté serveur", async () => {
    const d = await draftInvoice();
    await rejects(markInvoiceSentService(ctx, d.id), /Émettez la facture/);
    await rejects(cancelInvoiceService(ctx, d.id), /brouillon/);
    await issueInvoiceService(ctx, d.id);
    await rejects(issueInvoiceService(ctx, d.id), /déjà émise/);
    await markInvoiceSentService(ctx, d.id);
    await rejects(markInvoiceSentService(ctx, d.id), /déjà marquée comme envoyée/);
    await cancelInvoiceService(ctx, d.id);
    await rejects(markInvoiceSentService(ctx, d.id), /annulée/);
    await rejects(issueInvoiceService(ctx, d.id), /annulée/);
  });

  test("l'envoi est un événement distinct de l'émission et du paiement", async () => {
    const id = await issued();
    await pay(id, 50_000);
    let inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.status, "ISSUED"); // un paiement n'« envoie » pas la facture
    assert.equal(inv.paymentStatus, "PARTIAL");
    await markInvoiceSentService(ctx, id);
    inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.status, "SENT");
    assert.equal(inv.paymentStatus, "PARTIAL"); // l'envoi ne modifie pas le règlement
    assert.equal(inv.amountPaid, 50_000n);
  });
});

describe("paiements", () => {
  test("paiements partiels multiples jusqu'au solde", async () => {
    const id = await issued();
    const r1 = await pay(id, 30_000);
    assert.equal(r1.paymentStatus, "PARTIAL");
    assert.equal(r1.balance, 90_000);
    const r2 = await pay(id, 40_000);
    assert.equal(r2.paymentStatus, "PARTIAL");
    assert.equal(r2.amountPaid, 70_000);
    assert.equal(r2.balance, 50_000);
    const r3 = await pay(id, 50_000);
    assert.equal(r3.paymentStatus, "PAID");
    assert.equal(r3.balance, 0);
    const inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    assert.equal(inv.payments.length, 3);
    assert.equal(inv.amountPaid, BigInt(TOTAL));
    assert.ok(inv.paidAt);
    assert.equal(inv.status, "ISSUED");
  });

  test("paiement total en une fois", async () => {
    const id = await issued();
    const r = await pay(id, TOTAL);
    assert.equal(r.paymentStatus, "PAID");
    assert.equal(r.balance, 0);
  });

  test("montant supérieur au reste à payer refusé, facture soldée non réglable", async () => {
    const id = await issued();
    await rejects(pay(id, TOTAL + 1), /dépasse le reste à payer/);
    await pay(id, 100_000);
    await rejects(pay(id, 20_001), /dépasse le reste à payer/);
    await pay(id, 20_000);
    await rejects(pay(id, 1), /entièrement réglée/);
    assert.equal(await db.payment.count({ where: { invoiceId: id } }), 2);
  });

  test("montants nuls ou négatifs refusés", async () => {
    const id = await issued();
    await rejects(pay(id, 0), /supérieur à zéro/);
    await rejects(pay(id, -500), /supérieur à zéro/);
  });

  test("paiement refusé sur un brouillon", async () => {
    const d = await draftInvoice();
    await rejects(pay(d.id, 10_000), /Émettez la facture/);
  });

  test("paiements concurrents : le verrou empêche de dépasser le solde", async () => {
    const id = await issued();
    const results = await Promise.allSettled([pay(id, 80_000), pay(id, 80_000)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.amountPaid, 80_000n);
  });

  test("isolation : une autre entreprise ne peut pas encaisser la facture", async () => {
    const id = await issued();
    await rejects(pay(id, 10_000, randomUUID(), otherCtx), /introuvable/);
  });
});

describe("soumissions en double (idempotence)", () => {
  test("même clé rejouée : un seul paiement enregistré", async () => {
    const id = await issued();
    const key = randomUUID();
    const first = await pay(id, 30_000, key);
    const second = await pay(id, 30_000, key);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.paymentId, first.paymentId);
    assert.equal(await db.payment.count({ where: { invoiceId: id } }), 1);
    assert.equal((await db.invoice.findUniqueOrThrow({ where: { id } })).amountPaid, 30_000n);
  });

  test("même clé en parallèle : la contrainte unique en base garantit un seul paiement", async () => {
    const id = await issued();
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(id, 30_000, key)));
    assert.equal(new Set(results.map((r) => r.paymentId)).size, 1);
    assert.equal(await db.payment.count({ where: { invoiceId: id } }), 1);
    assert.equal((await db.invoice.findUniqueOrThrow({ where: { id } })).amountPaid, 30_000n);
  });

  test("la contrainte d'unicité existe au niveau de la base", async () => {
    const id = await issued();
    const key = randomUUID();
    await db.payment.create({ data: { companyId: ctx.companyId, invoiceId: id, amount: 100n, date: todayUTC(), idempotencyKey: key } });
    await assert.rejects(db.payment.create({ data: { companyId: ctx.companyId, invoiceId: id, amount: 100n, date: todayUTC(), idempotencyKey: key } }), /Unique constraint/);
  });
});

describe("annulation de paiements", () => {
  test("annuler un paiement recalcule solde et règlement, l'historique est conservé", async () => {
    const id = await issued();
    const p1 = await pay(id, 70_000);
    await pay(id, 50_000);
    assert.equal((await db.invoice.findUniqueOrThrow({ where: { id } })).paymentStatus, "PAID");

    await voidPaymentService(ctx, p1.paymentId, "Chèque retourné impayé");
    let inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    assert.equal(inv.paymentStatus, "PARTIAL");
    assert.equal(inv.amountPaid, 50_000n);
    assert.equal(inv.paidAt, null);
    assert.equal(inv.payments.length, 2, "le paiement annulé reste en base");
    const voided = inv.payments.find((p) => p.id === p1.paymentId)!;
    assert.ok(voided.voidedAt);
    assert.equal(voided.voidReason, "Chèque retourné impayé");

    const log = await db.activity.findMany({ where: { entityId: id, type: "payment.voided" } });
    assert.equal(log.length, 1);
    assert.match(log[0].message, /Chèque retourné impayé/);

    // Le solde libéré peut à nouveau être encaissé
    await pay(id, 70_000);
    inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    assert.equal(inv.paymentStatus, "PAID");
    assert.equal(inv.payments.length, 3);
  });

  test("annuler tous les paiements ramène la facture à « non payée »", async () => {
    const id = await issued();
    const p = await pay(id, TOTAL);
    await voidPaymentService(ctx, p.paymentId, "Saisie en double");
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.paymentStatus, "UNPAID");
    assert.equal(inv.amountPaid, 0n);
  });

  test("double annulation et motif vide refusés", async () => {
    const id = await issued();
    const p = await pay(id, 10_000);
    await rejects(voidPaymentService(ctx, p.paymentId, " "), /motif/);
    await voidPaymentService(ctx, p.paymentId, "Erreur de saisie");
    await rejects(voidPaymentService(ctx, p.paymentId, "Encore"), /déjà annulé/);
  });

  test("les totaux du tableau de bord ignorent les paiements annulés", async () => {
    const id = await issued();
    const p = await pay(id, 40_000);
    await pay(id, 20_000);
    let dash = await getDashboard(ctx.companyId, "30d");
    assert.equal(dash.kpis.collected.value, 60_000);
    await voidPaymentService(ctx, p.paymentId, "Rejet bancaire");
    dash = await getDashboard(ctx.companyId, "30d");
    assert.equal(dash.kpis.collected.value, 20_000);
    assert.equal(dash.kpis.unpaid.value, TOTAL - 20_000);
  });
});

describe("factures en retard", () => {
  test("échue et non soldée ⇒ en retard (calculé, jamais stocké)", async () => {
    const issueDate = addDays(todayUTC(), -60);
    const id = await issued({ issueDate, dueDate: addDays(issueDate, 30) });
    let inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(inv.status, "ISSUED");
    assert.equal(inv.paymentStatus, "UNPAID");
    assert.equal(isOverdue(inv), true);
    assert.equal(invoiceDisplayStatus(inv), "OVERDUE");
    const filtered = await db.invoice.findMany({ where: { companyId: ctx.companyId, ...invoiceStatusWhere("OVERDUE") } });
    assert.deepEqual(filtered.map((f) => f.id), [id]);

    // Partiellement payée : toujours en retard
    await recordPaymentService(ctx, { invoiceId: id, amount: 20_000, date: todayUTC(), method: "CASH", idempotencyKey: randomUUID() });
    inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(invoiceDisplayStatus(inv), "OVERDUE");
    assert.equal(inv.paymentStatus, "PARTIAL");

    // Soldée : n'est plus en retard
    await recordPaymentService(ctx, { invoiceId: id, amount: TOTAL - 20_000, date: todayUTC(), method: "CHECK", idempotencyKey: randomUUID() });
    inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    assert.equal(isOverdue(inv), false);
    assert.equal(invoiceDisplayStatus(inv), "PAID");
  });

  test("non échue ⇒ pas en retard ; brouillon et annulée jamais en retard", async () => {
    const id = await issued({ issueDate: todayUTC(), dueDate: addDays(todayUTC(), 30) });
    assert.equal(isOverdue(await db.invoice.findUniqueOrThrow({ where: { id } })), false);
    const old = addDays(todayUTC(), -90);
    const d = await draftInvoice({ issueDate: old, dueDate: addDays(old, 10) });
    assert.equal(invoiceDisplayStatus(d), "DRAFT");
    const c = await issued({ issueDate: old, dueDate: addDays(old, 10) });
    await cancelInvoiceService(ctx, c);
    assert.equal(invoiceDisplayStatus(await db.invoice.findUniqueOrThrow({ where: { id: c } })), "CANCELLED");
  });

  test("le tableau de bord compte les factures en retard", async () => {
    const old = addDays(todayUTC(), -45);
    await issued({ issueDate: old, dueDate: addDays(old, 15) });
    await issued();
    const dash = await getDashboard(ctx.companyId, "12m");
    assert.equal(dash.kpis.overdue.count, 1);
    assert.equal(dash.kpis.overdue.value, TOTAL);
    assert.equal(dash.kpis.unpaid.count, 2);
  });
});

describe("annulation de factures", () => {
  test("annulation refusée tant qu'un paiement actif existe", async () => {
    const id = await issued();
    const p = await pay(id, 10_000);
    await rejects(cancelInvoiceService(ctx, id), /Annulez d'abord les paiements/);
    await voidPaymentService(ctx, p.paymentId, "Remboursé au client");
    await cancelInvoiceService(ctx, id);
    const inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    assert.equal(inv.status, "CANCELLED");
    assert.ok(inv.cancelledAt);
    assert.ok(inv.number, "le numéro reste attribué");
    assert.equal(inv.payments.length, 1, "l'historique des paiements est conservé");
  });

  test("une facture annulée ne peut plus recevoir de paiement", async () => {
    const id = await issued();
    await markInvoiceSentService(ctx, id);
    await cancelInvoiceService(ctx, id);
    await rejects(pay(id, 10_000), /annulée/);
    await rejects(cancelInvoiceService(ctx, id), /déjà annulée/);
    assert.equal(await db.payment.count({ where: { invoiceId: id } }), 0);
  });

  test("la piste d'audit trace chaque événement", async () => {
    const id = await issued();
    await markInvoiceSentService(ctx, id);
    const p = await pay(id, 10_000);
    await voidPaymentService(ctx, p.paymentId, "Erreur");
    await cancelInvoiceService(ctx, id);
    const types = (await db.activity.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } })).map((a) => a.type);
    assert.deepEqual(types, ["invoice.issued", "invoice.sent", "payment.created", "payment.voided", "invoice.cancelled"]);
  });
});
