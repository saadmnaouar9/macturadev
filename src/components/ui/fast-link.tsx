"use client";

import Link from "next/link";
import { forwardRef, useState } from "react";

type Props = React.ComponentProps<typeof Link>;

/**
 * Lien interne avec préchargement « à l'intention » : la page cible est chargée dès que le pointeur survole le lien, qu'il reçoit le focus clavier
 * ou qu'un doigt le touche, soit ~100–300 ms avant le clic. Le clic affiche alors la page depuis le cache du routeur, sans attendre le serveur.
 *
 * Pourquoi pas le préchargement automatique : les pages sont dynamiques (données de l'utilisateur), donc Next ne précharge que leur gabarit ;
 * précharger tous les liens visibles exécuterait des dizaines de requêtes serveur inutiles. Un `prefetch` explicite reste prioritaire.
 */
const FastLink = forwardRef<HTMLAnchorElement, Props>(function FastLink({ prefetch, onMouseEnter, onFocus, onTouchStart, ...props }, ref) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      ref={ref}
      {...props}
      prefetch={prefetch ?? (intent ? true : false)}
      onMouseEnter={(e) => { setIntent(true); onMouseEnter?.(e); }}
      onFocus={(e) => { setIntent(true); onFocus?.(e); }}
      onTouchStart={(e) => { setIntent(true); onTouchStart?.(e); }}
    />
  );
});

export default FastLink;
