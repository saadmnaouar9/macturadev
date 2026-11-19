import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateLongFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateNumFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** Les dates métier (émission, échéance…) sont stockées à minuit UTC. */
export function formatDate(d: Date | string | null | undefined, style: "short" | "long" | "numeric" = "short") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (style === "long") return dateLongFmt.format(date);
  if (style === "numeric") return dateNumFmt.format(date);
  return dateFmt.format(date).replace(".", "");
}

export function formatRelative(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) {
    const days = Math.floor(diff / 86400);
    return days === 1 ? "hier" : `il y a ${days} j`;
  }
  return formatDate(date);
}

/** "2026-11-18" → Date à minuit UTC */
export function parseDateOnly(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "2026-11-18" (UTC) */
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

/** Aujourd'hui à minuit UTC (selon le fuseau du Maroc) */
export function todayUTC(): Date {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
  return new Date(`${local}T00:00:00.000Z`);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function pluralize(n: number, singular: string, plural?: string) {
  return `${n} ${n > 1 ? (plural ?? singular + "s") : singular}`;
}
