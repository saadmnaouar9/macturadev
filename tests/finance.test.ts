import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals, computeLine } from "../src/lib/calc.ts";
import { parseAmountToCents, formatMAD, parseQuantity, parseRate, centsToInput, formatQuantity } from "../src/lib/money.ts";
import { amountToFrenchWords, integerToFrenchWords } from "../src/lib/number-to-words.ts";

test("ligne simple : 3 × 100,00 DH à 20 %", () => {
  const t = computeTotals([{ quantity: 3000, unitPrice: 10000, discount: 0, taxRate: 2000 }]);
  assert.equal(t.subtotal, 30000);
  assert.equal(t.taxTotal, 6000);
  assert.equal(t.total, 36000);
});

test("pas d'erreur flottante : 0,1 + 0,2", () => {
  const t = computeTotals([
    { quantity: 1000, unitPrice: 10, discount: 0, taxRate: 0 },
    { quantity: 1000, unitPrice: 20, discount: 0, taxRate: 0 },
  ]);
  assert.equal(t.total, 30);
});

test("remise ligne + remise globale + TVA multi-taux", () => {
  const t = computeTotals(
    [
      { quantity: 2500, unitPrice: 12999, discount: 1000, taxRate: 2000 }, // 2,5 × 129,99 − 10 %
      { quantity: 1000, unitPrice: 50000, discount: 0, taxRate: 1000 },
    ],
    500, // 5 % globale
  );
  // ligne 1 : brut 324,975 → 32498 ; remise 3250 ; net 29248 ; globale 1462 ; base 27786
  const l1 = computeLine({ quantity: 2500, unitPrice: 12999, discount: 1000, taxRate: 2000 }, 500);
  assert.deepEqual(l1, { gross: 32498, lineDiscount: 3250, net: 29248, globalDiscount: 1462, taxable: 27786 });
  // ligne 2 : 50000 ; globale 2500 ; base 47500
  assert.equal(t.taxableTotal, 27786 + 47500);
  assert.deepEqual(t.taxes, [
    { rate: 2000, base: 27786, amount: 5557 },
    { rate: 1000, base: 47500, amount: 4750 },
  ]);
  assert.equal(t.total, 27786 + 47500 + 5557 + 4750);
  assert.equal(t.discountTotal, 3250 + 1462 + 2500);
});

test("grands montants sans perte de précision", () => {
  const t = computeTotals([{ quantity: 1_000_000_000, unitPrice: 999_999_99, discount: 0, taxRate: 2000 }]);
  assert.equal(t.subtotal, 99_999_999_000_000);
  assert.ok(Number.isSafeInteger(t.total));
});

test("saisie de montants", () => {
  assert.equal(parseAmountToCents("1 234,50"), 123450);
  assert.equal(parseAmountToCents("1234.5"), 123450);
  assert.equal(parseAmountToCents("1.234,56"), 123456);
  assert.equal(parseAmountToCents("1,234.56"), 123456);
  assert.equal(parseAmountToCents("12"), 1200);
  assert.equal(parseAmountToCents("0,005"), 1);
  assert.equal(parseAmountToCents("abc"), null);
  assert.equal(parseAmountToCents(""), null);
  assert.equal(centsToInput(123450), "1234,50");
});

test("format MAD", () => {
  assert.equal(formatMAD(123456789), "1 234 567,89 DH");
  assert.equal(formatMAD(0), "0,00 DH");
});

test("quantités et taux", () => {
  assert.equal(parseQuantity("1,5"), 1500);
  assert.equal(parseQuantity("2"), 2000);
  assert.equal(parseQuantity("0,125"), 125);
  assert.equal(parseQuantity("-1"), null);
  assert.equal(formatQuantity(1500), "1,5");
  assert.equal(parseRate("20"), 2000);
  assert.equal(parseRate("5,5"), 550);
});

test("montants en lettres", () => {
  assert.equal(integerToFrenchWords(71), "soixante et onze");
  assert.equal(integerToFrenchWords(80), "quatre-vingts");
  assert.equal(integerToFrenchWords(200), "deux cents");
  assert.equal(integerToFrenchWords(200000), "deux cent mille");
  assert.equal(integerToFrenchWords(1_000_000), "un million");
  assert.equal(amountToFrenchWords(1234550), "Douze mille trois cent quarante-cinq dirhams et cinquante centimes");
  assert.equal(amountToFrenchWords(100), "Un dirham");
});

test("remise ligne en montant fixe (plafonnée au brut)", () => {
  const t = computeTotals([
    { quantity: 2000, unitPrice: 10000, discount: 5000, discountType: "AMOUNT", taxRate: 2000 }, // 200 − 50 = 150
    { quantity: 1000, unitPrice: 1000, discount: 99999, discountType: "AMOUNT", taxRate: 2000 }, // plafonné à 10
  ]);
  assert.equal(t.lines[0].net, 15000);
  assert.equal(t.lines[1].net, 0);
  assert.equal(t.lineDiscountTotal, 6000);
  assert.equal(t.total, 18000);
});

test("remise globale en montant fixe répartie exactement au prorata", () => {
  const lines = [
    { quantity: 1000, unitPrice: 10000, discount: 0, taxRate: 2000 },
    { quantity: 1000, unitPrice: 10000, discount: 0, taxRate: 2000 },
    { quantity: 1000, unitPrice: 10000, discount: 0, taxRate: 1000 },
  ];
  const t = computeTotals(lines, { type: "AMOUNT", value: 10000 }); // 100 DH sur 300 DH
  const parts = t.lines.map((l) => l.globalDiscount);
  assert.equal(parts.reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual(parts, [3334, 3333, 3333]);
  assert.equal(t.taxableTotal, 20000);
  assert.deepEqual(t.taxes, [
    { rate: 2000, base: 13333, amount: 2667 },
    { rate: 1000, base: 6667, amount: 667 },
  ]);
  assert.equal(t.total, 20000 + 2667 + 667);
});

test("remise globale fixe plafonnée au total HT", () => {
  const t = computeTotals([{ quantity: 1000, unitPrice: 5000, discount: 0, taxRate: 2000 }], { type: "AMOUNT", value: 999999 });
  assert.equal(t.taxableTotal, 0);
  assert.equal(t.total, 0);
});
