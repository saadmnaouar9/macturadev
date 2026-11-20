/** Fond des pages d'authentification : image fixe, sans aucune animation. Sombre : auth-bg-3.jpg · Clair : auth-bg-light.jpg. */
export function SpaceBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0">
      {/* Mode clair : image claire (public/brand/auth-bg-light.jpg), le fond « espace » ci-dessous est masqué */}
      <div className="absolute inset-0 hidden bg-[#f4f3fa] [[data-theme=light]_&]:block">
        {/* image à 60 % d'opacité sur le fond clair */}
        <div className="absolute inset-0 bg-[url('/brand/auth-bg-light.jpg')] bg-cover bg-center bg-no-repeat opacity-60" />
        <div className="absolute inset-0 bg-[#36307e] mix-blend-color" />
      </div>
      <div className="absolute inset-0 bg-[#0b0a22] bg-[url('/brand/auth-bg-3.jpg')] bg-cover bg-center bg-no-repeat [[data-theme=light]_&]:hidden">
      {/* teinte indigo de la marque : recolore la photo en conservant ses détails */}
      <div className="absolute inset-0 bg-[#36307e] mix-blend-color" />
      {/* léger voile pour garder le texte lisible sur toute la surface */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_65%_at_50%_48%,rgba(2,6,23,0.5)_0%,rgba(2,6,23,0.18)_55%,rgba(0,0,0,0.35)_100%)]" />
      </div>
    </div>
  );
}
