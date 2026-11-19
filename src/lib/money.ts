// Utilitaires monétaires — tous les montants internes sont des entiers en centimes.

const groupFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1234567 → "12 345,67" */
export function formatAmount(cents: number | bigint): string {
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  return groupFormatter.format(n / 100).replace(/ | /g, " ");
}

/** 1234567 → "12 345,67 DH" */
export function formatMAD(cents: number | bigint): string {
  return `${formatAmount(cents)} DH`;
}

/** Format compact pour les graphiques : 1 250 000 DH → "12,5 k" */
export function formatCompactMAD(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(".", ",")} k`;
  return v.toFixed(0);
}

/**
 * Convertit une saisie utilisateur ("1 234,50", "1234.5", "1,234.50") en centimes.
 * Retourne null si la saisie est invalide. Aucune arithmétique flottante.
 */
export function parseAmountToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return parseAmountToCents(String(input));
  }
  let s = input.trim().replace(/\s| | /g, "").replace(/(DH|MAD)$/i, "");
  if (s === "") return null;
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);
  let intPart = s;
  let decPart = "";
  if (decimalPos !== -1) {
    const tail = s.slice(decimalPos + 1);
    // Saisie française : la virgule est toujours décimale. Un point seul suivi de groupes
    // de 3 chiffres ("1.234.567") est un séparateur de milliers ; sinon il est décimal.
    const both = lastComma !== -1 && lastDot !== -1;
    const dotThousands = !both && lastComma === -1 && /^\d{1,3}(\.\d{3})+$/.test(s);
    if (!dotThousands) {
      intPart = s.slice(0, decimalPos);
      decPart = tail;
    } else {
      intPart = s;
    }
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  if (intPart === "" && decPart === "") return null;
  const cents = Number(intPart || "0") * 100 + Number((decPart + "00").slice(0, 2));
  if (decPart.length > 2) {
    // arrondi au centime (demi supérieur) sur la 3e décimale
    const third = Number(decPart[2]);
    if (third >= 5) return (negative ? -1 : 1) * (cents + 1);
  }
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Centimes → valeur éditable "1234,50" */
export function centsToInput(cents: number | bigint | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const n = Number(cents);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Quantité en millièmes → "1,5" */
export function formatQuantity(milli: number): string {
  const s = (milli / 1000).toFixed(3).replace(/\.?0+$/, "");
  return s.replace(".", ",");
}

/** "1,5" → 1500 */
export function parseQuantity(input: string | number): number | null {
  const s = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,3})?$/.test(s)) return null;
  const [i, d = ""] = s.split(".");
  return Number(i) * 1000 + Number((d + "000").slice(0, 3));
}

/** Points de base → "20" / "5,5" */
export function formatRate(bp: number): string {
  return (bp / 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

/** "20" / "5,5" → 2000 / 550 */
export function parseRate(input: string | number): number | null {
  const s = String(input).trim().replace(",", ".").replace("%", "");
  if (s === "") return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [i, d = ""] = s.split(".");
  const bp = Number(i) * 100 + Number((d + "00").slice(0, 2));
  return bp;
}
