// Moteur de calcul des documents commerciaux (devis & factures).
// Arithmétique entière en BigInt — arrondi au centime (demi supérieur), ligne par ligne.
//
//  brut ligne      = quantité × prix unitaire
//  remise ligne    = brut × remise%   OU   montant fixe (plafonné au brut)
//  net ligne (HT)  = brut − remise ligne
//  remise globale  = % appliqué à chaque net ligne
//                    OU montant fixe réparti au prorata des nets (méthode du plus fort reste,
//                    la somme des parts est exactement égale au montant)
//  base TVA        = net ligne − part de remise globale
//  TVA             = Σ par taux (Σ bases du taux × taux) — regroupée par taux, comme sur la facture
//  TTC             = Σ bases + Σ TVA

export type DiscountKind = "PERCENT" | "AMOUNT";

export interface LineInput {
  quantity: number; // millièmes
  unitPrice: number; // centimes
  discount: number; // points de base si PERCENT, centimes si AMOUNT
  discountType?: DiscountKind; // PERCENT par défaut
  taxRate: number; // points de base
}

export interface GlobalDiscount {
  type: DiscountKind;
  value: number; // points de base si PERCENT, centimes si AMOUNT
}

export interface LineResult {
  gross: number;
  lineDiscount: number;
  net: number; // HT après remise ligne
  globalDiscount: number;
  taxable: number;
}

export interface TaxBreakdown {
  rate: number;
  base: number;
  amount: number;
}

export interface DocumentTotals {
  lines: LineResult[];
  subtotal: number; // HT brut (avant toute remise)
  lineDiscountTotal: number;
  globalDiscountTotal: number;
  discountTotal: number;
  taxableTotal: number; // HT net
  taxes: TaxBreakdown[];
  taxTotal: number;
  total: number; // TTC
}

const B = BigInt;

/** a × b / d arrondi au plus proche (demi supérieur) */
function mulDivRound(a: bigint, b: bigint, d: bigint): bigint {
  const p = a * b;
  const neg = p < 0n;
  const abs = neg ? -p : p;
  const q = (abs + d / 2n) / d;
  return neg ? -q : q;
}

function clampBp(bp: number): bigint {
  if (!Number.isFinite(bp)) return 0n;
  return B(Math.min(10000, Math.max(0, Math.round(bp))));
}

function clampAmount(v: number): bigint {
  if (!Number.isFinite(v)) return 0n;
  return B(Math.max(0, Math.round(v)));
}

function lineBase(line: LineInput) {
  const gross = mulDivRound(B(Math.max(0, Math.round(line.quantity))), B(Math.max(0, Math.round(line.unitPrice))), 1000n);
  let lineDiscount: bigint;
  if (line.discountType === "AMOUNT") {
    const d = clampAmount(line.discount);
    lineDiscount = d > gross ? gross : d;
  } else {
    lineDiscount = mulDivRound(gross, clampBp(line.discount), 10000n);
  }
  return { gross, lineDiscount, net: gross - lineDiscount };
}

/** Répartit `amount` au prorata de `weights` ; Σ parts === amount (méthode du plus fort reste). */
export function allocate(amount: bigint, weights: bigint[]): bigint[] {
  const total = weights.reduce((s, w) => s + w, 0n);
  if (total === 0n || amount === 0n) return weights.map(() => 0n);
  const parts = weights.map((w) => (amount * w) / total);
  const remainders = weights.map((w, i) => ({ i, r: (amount * w) % total }));
  let left = amount - parts.reduce((s, p) => s + p, 0n);
  remainders.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  for (const { i } of remainders) {
    if (left <= 0n) break;
    parts[i] += 1n;
    left -= 1n;
  }
  return parts;
}

function normalizeGlobal(g: number | GlobalDiscount | undefined): GlobalDiscount {
  if (g === undefined) return { type: "PERCENT", value: 0 };
  if (typeof g === "number") return { type: "PERCENT", value: g };
  return g;
}

export function computeTotals(lines: LineInput[], global?: number | GlobalDiscount): DocumentTotals {
  const g = normalizeGlobal(global);
  const bases = lines.map(lineBase);
  const netSum = bases.reduce((s, b) => s + b.net, 0n);

  let globalParts: bigint[];
  if (g.type === "AMOUNT") {
    const amt = clampAmount(g.value);
    globalParts = allocate(amt > netSum ? netSum : amt, bases.map((b) => b.net));
  } else {
    const bp = clampBp(g.value);
    globalParts = bases.map((b) => mulDivRound(b.net, bp, 10000n));
  }

  const results: LineResult[] = [];
  const byRate = new Map<number, bigint>();
  let subtotal = 0n;
  let lineDiscountTotal = 0n;
  let globalDiscountTotal = 0n;
  let taxableTotal = 0n;
  bases.forEach((b, i) => {
    const taxable = b.net - globalParts[i];
    results.push({ gross: Number(b.gross), lineDiscount: Number(b.lineDiscount), net: Number(b.net), globalDiscount: Number(globalParts[i]), taxable: Number(taxable) });
    subtotal += b.gross;
    lineDiscountTotal += b.lineDiscount;
    globalDiscountTotal += globalParts[i];
    taxableTotal += taxable;
    const rate = lines[i].taxRate;
    byRate.set(rate, (byRate.get(rate) ?? 0n) + taxable);
  });

  const taxes: TaxBreakdown[] = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base: Number(base), amount: Number(mulDivRound(base, clampBp(rate), 10000n)) }));
  const taxTotal = taxes.reduce((s, t) => s + B(t.amount), 0n);

  return {
    lines: results,
    subtotal: Number(subtotal),
    lineDiscountTotal: Number(lineDiscountTotal),
    globalDiscountTotal: Number(globalDiscountTotal),
    discountTotal: Number(lineDiscountTotal + globalDiscountTotal),
    taxableTotal: Number(taxableTotal),
    taxes,
    taxTotal: Number(taxTotal),
    total: Number(taxableTotal + taxTotal),
  };
}

export function computeLine(line: LineInput, globalDiscountBp = 0): LineResult {
  return computeTotals([line], { type: "PERCENT", value: globalDiscountBp }).lines[0];
}
