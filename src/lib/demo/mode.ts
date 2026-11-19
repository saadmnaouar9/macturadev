export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "1") return true;
  if (process.env.DEMO_MODE === "0") return false;
  const url = process.env.DATABASE_URL;
  if (!url) return true;
  // Déploiement Vercel avec une base inaccessible (localhost) : on bascule en démo plutôt que de planter
  return !!process.env.VERCEL && /localhost|127\.0\.0\.1/.test(url);
}
