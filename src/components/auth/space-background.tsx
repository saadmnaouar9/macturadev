/** Fond des pages d'authentification : image fixe (public/brand/auth-bg-3.jpg), sans aucune animation. */
export function SpaceBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 bg-[#030a1f] bg-[url('/brand/auth-bg-3.jpg')] bg-cover bg-center bg-no-repeat">
      {/* léger voile pour garder le texte lisible sur toute la surface */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_65%_at_50%_48%,rgba(2,6,23,0.5)_0%,rgba(2,6,23,0.18)_55%,rgba(0,0,0,0.35)_100%)]" />
    </div>
  );
}
