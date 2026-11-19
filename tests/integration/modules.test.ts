// Tests d'intégration : achats fournisseurs, trésorerie, conversion prospect, facturation de contrat, calendrier, rapports.
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { BusinessError } from "@/lib/action";
import { purchaseTotals, recordPurchasePaymentService, voidPurchasePaymentService } from "@/lib/purchase-service";
import { getBalances, getMovements } from "@/lib/treasury";
import { getCalendarEvents } from "@/lib/calendar";
import { getReports, parsePeriod } from "@/lib/reports";
import { buildDocument } from "@/lib/documents";
import { issueInvoiceService, recordPaymentService, type ServiceContext } from "@/lib/invoice-service";
import { addDays, todayUTC } from "@/lib/utils";

let ctx: ServiceContext;
let supplierId: string;
let customerId: string;

async function purchase(subtotal = 100_000, taxRate = 2000, opts: { due?: Date } = {}) {
  const t = purchaseTotals(subtotal, taxRate);
  return db.purchase.create({ data: { companyId: ctx.companyId, supplierId, reference: `FA-${randomUUID().slice(0, 6)}`, issueDate: addDays(todayUTC(), -10), dueDate: opts.due ?? addDays(todayUTC(), 20), taxRate, ...t } });
}
const payP = (purchaseId: string, amount: number, method: "CASH" | "BANK_TRANSFER" = "BANK_TRANSFER", key = randomUUID()) =>
  recordPurchasePaymentService(ctx, { purchaseId, amount, date: todayUTC(), method, idempotencyKey: key });
async function rejects(p: Promise<unknown>, re: RegExp) {
  await assert.rejects(p, (e: unknown) => { assert.ok(e instanceof BusinessError, String(e)); assert.match((e as Error).message, re); return true; });
}

beforeEach(async () => {
  await db.company.deleteMany({ where: { name: { startsWith: "TEST " } } });
  const company = await db.company.create({ data: { name: "TEST Modules", taxRates: { create: [{ name: "TVA 20 %", rate: 2000, isDefault: true }] } } });
  const user = await db.user.create({ data: { email: `${randomUUID()}@test.ma`, name: "Testeur", passwordHash: "x", memberships: { create: { companyId: company.id, role: "OWNER" } } } });
  ctx = { companyId: company.id, userId: user.id };
  supplierId = (await db.supplier.create({ data: { companyId: company.id, name: "Fournisseur Test" } })).id;
  customerId = (await db.customer.create({ data: { companyId: company.id, name: "Client Test" } })).id;
});
after(async () => {
  await db.company.deleteMany({ where: { name: { startsWith: "TEST " } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@test.ma" } } });
  await db.$disconnect();
});

describe("achats fournisseurs", () => {
  test("TVA et TTC calculées en entiers", () => {
    const t = purchaseTotals(123_457, 2000);
    assert.equal(t.subtotal, 123_457n);
    assert.equal(t.taxTotal, 24_691n); // 24 691,4 → arrondi au centime
    assert.equal(t.total, 148_148n);
  });

  test("paiements partiels puis solde ; jamais au-delà du reste dû", async () => {
    const p = await purchase(100_000, 2000); // 1 200,00 TTC
    const r1 = await payP(p.id, 50_000);
    assert.equal(r1.paymentStatus, "PARTIAL");
    assert.equal(r1.balance, 70_000);
    await rejects(payP(p.id, 70_001), /dépasse le reste à payer/);
    const r2 = await payP(p.id, 70_000);
    assert.equal(r2.paymentStatus, "PAID");
    await rejects(payP(p.id, 1), /entièrement réglée/);
  });

  test("même clé d'idempotence : un seul paiement, y compris en parallèle", async () => {
    const p = await purchase();
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => payP(p.id, 30_000, "BANK_TRANSFER", key)));
    assert.equal(new Set(results.map((r) => r.paymentId)).size, 1);
    assert.equal(await db.purchasePayment.count({ where: { purchaseId: p.id } }), 1);
  });

  test("paiements concurrents : le verrou protège le solde", async () => {
    const p = await purchase();
    const res = await Promise.allSettled([payP(p.id, 80_000), payP(p.id, 80_000)]);
    assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await db.purchase.findUniqueOrThrow({ where: { id: p.id } })).amountPaid, 80_000n);
  });

  test("annulation d'un paiement : solde recalculé, historique conservé, audit tracé", async () => {
    const p = await purchase();
    const a = await payP(p.id, 120_000);
    assert.equal(a.paymentStatus, "PAID");
    await voidPurchasePaymentService(ctx, a.paymentId, "Virement rejeté");
    const after = await db.purchase.findUniqueOrThrow({ where: { id: p.id }, include: { payments: true } });
    assert.equal(after.paymentStatus, "UNPAID");
    assert.equal(after.amountPaid, 0n);
    assert.equal(after.payments.length, 1);
    assert.ok(after.payments[0].voidedAt);
    assert.equal(await db.activity.count({ where: { entityId: p.id, type: "purchase.payment_voided" } }), 1);
    await rejects(voidPurchasePaymentService(ctx, a.paymentId, "encore"), /déjà annulé/);
  });

  test("facture annulée : aucun paiement possible ; isolation entre entreprises", async () => {
    const p = await purchase();
    await db.purchase.update({ where: { id: p.id }, data: { cancelledAt: new Date() } });
    await rejects(payP(p.id, 1000), /annulée/);
    const other = await db.company.create({ data: { name: "TEST Autre" } });
    await rejects(recordPurchasePaymentService({ companyId: other.id, userId: null }, { purchaseId: p.id, amount: 100, date: todayUTC(), method: "CASH", idempotencyKey: randomUUID() }), /introuvable/);
  });
});

describe("trésorerie", () => {
  test("soldes = ouverture + encaissements − décaissements (paiements actifs, espèces → caisse)", async () => {
    await db.company.update({ where: { id: ctx.companyId }, data: { openingBank: 1_000_000n, openingCash: 50_000n } });
    // Encaissement client de 1 200,00 par virement
    const built = buildDocument([{ productId: null, description: "Service", details: null, quantity: 1000, unit: "forfait", unitPrice: 100_000, discountType: "PERCENT", discount: 0, taxRate: 2000 }], "PERCENT", 0);
    const inv = await db.invoice.create({ data: { companyId: ctx.companyId, customerId, issueDate: addDays(todayUTC(), -3), dueDate: addDays(todayUTC(), 27), ...built.totals, ...built.global, items: { create: built.items } } });
    await issueInvoiceService(ctx, inv.id);
    await recordPaymentService(ctx, { invoiceId: inv.id, amount: 120_000, date: todayUTC(), method: "BANK_TRANSFER", idempotencyKey: randomUUID() });
    // Règlement fournisseur en espèces 300,00 et par virement 200,00 (puis annulé)
    const p = await purchase(500_000, 2000);
    await payP(p.id, 30_000, "CASH");
    const v = await payP(p.id, 20_000, "BANK_TRANSFER");
    await voidPurchasePaymentService(ctx, v.paymentId, "Erreur de saisie");
    // Opérations manuelles
    await db.cashEntry.createMany({ data: [
      { companyId: ctx.companyId, account: "CASH", direction: "IN", amount: 10_000n, date: todayUTC(), label: "Alimentation caisse" },
      { companyId: ctx.companyId, account: "BANK", direction: "OUT", amount: 5_000n, date: todayUTC(), label: "Frais bancaires" },
    ] });
    const b = await getBalances(ctx.companyId);
    assert.equal(b.bank, 1_000_000 + 120_000 - 5_000); // le virement annulé est ignoré
    assert.equal(b.cash, 50_000 - 30_000 + 10_000);
    assert.equal(b.total, b.bank + b.cash);
    const bankMoves = await getMovements(ctx.companyId, { account: "BANK" });
    assert.deepEqual(bankMoves.map((m) => m.direction).sort(), ["IN", "OUT"]);
    assert.ok(!bankMoves.some((m) => m.amount === 20_000), "paiement annulé exclu du journal");
  });
});

describe("calendrier et rapports", () => {
  test("le calendrier remonte échéances, tâches et relances réelles", async () => {
    const due = addDays(todayUTC(), 5);
    const p = await purchase(100_000, 2000, { due });
    await db.task.create({ data: { companyId: ctx.companyId, title: "Appeler le client", dueDate: due } });
    await db.prospect.create({ data: { companyId: ctx.companyId, name: "Prospect X", nextActionDate: due } });
    await db.task.create({ data: { companyId: ctx.companyId, title: "Terminée", status: "DONE", dueDate: due } });
    const ev = await getCalendarEvents(ctx.companyId, todayUTC(), addDays(todayUTC(), 30));
    assert.deepEqual(ev.map((e) => e.kind).sort(), ["prospect", "purchase", "task"]);
    assert.ok(ev.find((e) => e.kind === "purchase")!.href.includes("achats"));
    await payP(p.id, 120_000);
    assert.equal((await getCalendarEvents(ctx.companyId, todayUTC(), addDays(todayUTC(), 30))).some((e) => e.kind === "purchase"), false, "une facture soldée quitte le calendrier");
  });

  test("rapport de TVA : collectée − déductible", async () => {
    const built = buildDocument([{ productId: null, description: "Prestation", details: null, quantity: 1000, unit: "forfait", unitPrice: 200_000, discountType: "PERCENT", discount: 0, taxRate: 2000 }], "PERCENT", 0);
    const inv = await db.invoice.create({ data: { companyId: ctx.companyId, customerId, issueDate: addDays(todayUTC(), -2), dueDate: addDays(todayUTC(), 28), ...built.totals, ...built.global, items: { create: built.items } } });
    await issueInvoiceService(ctx, inv.id);
    await purchase(50_000, 2000); // TVA 100,00
    const r = await getReports(ctx.companyId, parsePeriod(undefined, undefined));
    assert.equal(r.summary.revenueHT, 200_000);
    assert.equal(r.summary.tvaCollected, 40_000);
    assert.equal(r.summary.tvaDeductible, 10_000);
    assert.equal(r.summary.vatDue, 30_000);
    assert.equal(r.summary.grossMargin, 150_000);
    assert.deepEqual(r.vat.collected, [{ rate: 2000, base: 200_000, amount: 40_000 }]);
  });
});
