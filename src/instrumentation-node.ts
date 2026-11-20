/** Code de démarrage réservé à l'environnement Node (voir `instrumentation.ts`). */
import { isDemoMode } from "./lib/demo/mode";
import { db } from "./lib/db";

export function warmDemoDatabase() {
  if (!isDemoMode()) return;
  // volontairement non attendu : le serveur accepte les requêtes pendant l'initialisation
  void db.user.count().catch(() => {});
}
