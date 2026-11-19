// Conversion d'un montant en toutes lettres (français) — mention usuelle sur les factures marocaines.

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? "soixante" : "quatre-vingt";
    if (t === 7 && u === 1) return "soixante et onze";
    return `${base}-${UNITS[10 + u]}`;
  }
  if (t === 8) return u === 0 ? "quatre-vingts" : `quatre-vingt-${UNITS[u]}`;
  if (u === 0) return TENS[t];
  if (u === 1) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h === 1) s = "cent";
  else if (h > 1) s = `${UNITS[h]} cent${r === 0 ? "s" : ""}`;
  if (r > 0) s = s ? `${s} ${below100(r)}` : below100(r);
  return s || "zéro";
}

export function integerToFrenchWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Entier positif attendu");
  if (n === 0) return "zéro";
  const scales: [number, string, string][] = [
    [1_000_000_000, "milliard", "milliards"],
    [1_000_000, "million", "millions"],
  ];
  let rest = n;
  const parts: string[] = [];
  for (const [value, singular, plural] of scales) {
    const q = Math.floor(rest / value);
    if (q > 0) {
      parts.push(`${integerToFrenchWords(q)} ${q > 1 ? plural : singular}`);
      rest %= value;
    }
  }
  const thousands = Math.floor(rest / 1000);
  if (thousands > 0) {
    // "mille" est invariable ; "cents"/"vingts" perdent leur s devant mille
    const t = thousands === 1 ? "mille" : `${below1000(thousands).replace(/(cent|vingt)s$/, "$1")} mille`;
    parts.push(t);
    rest %= 1000;
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(" ");
}

/** 1234550 → "douze mille trois cent quarante-cinq dirhams et cinquante centimes" */
export function amountToFrenchWords(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const dh = Math.floor(abs / 100);
  const c = abs % 100;
  const dhWords = `${integerToFrenchWords(dh)} dirham${dh > 1 ? "s" : ""}`;
  const out = c > 0 ? `${dhWords} et ${integerToFrenchWords(c)} centime${c > 1 ? "s" : ""}` : dhWords;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
