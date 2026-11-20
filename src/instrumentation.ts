/**
 * Démarrage du serveur : en Mode Démo, la base embarquée (PGlite) est initialisée immédiatement, sans attendre la première requête qui en a besoin.
 * Sur Vercel, l'instance démarre à la première visite (page de connexion) : la base est prête pendant que la personne saisit ses identifiants,
 * au lieu de faire attendre la connexion de plusieurs secondes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmDemoDatabase } = await import("./instrumentation-node");
    warmDemoDatabase();
  }
}
