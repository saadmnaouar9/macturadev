import "server-only";
import { isDemoMode } from "./demo/mode";

// Limiteur en mémoire (fenêtre glissante) — suffisant pour une instance unique.
// En production multi-instances, remplacer par Redis ou équivalent.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  // Démo publique : pas de limitation (sinon les visiteurs se bloquent eux-mêmes en réessayant le compte démo)
  if (isDemoMode()) return true;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
