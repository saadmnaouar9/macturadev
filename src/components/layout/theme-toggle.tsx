"use client";

import { Moon, Sun } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export const THEME_COOKIE = "mactura_theme";
export const THEME_EVENT = "mactura:theme";

/** Durée de la transition (voir `globals.css` : `theme-reveal` / `theme-old`) et du repli en fondu. */
const FADE_MS = 450;

type VTransition = { finished: Promise<void> };
type DocWithVT = Document & { startViewTransition?: (update: () => void) => VTransition };

/** Une seule transition à la fois : les clics répétés pendant l'animation sont ignorés. */
let switching = false;

/** Applique le thème : attribut sur <html> (lu par tout le CSS), cookie (lu côté serveur : aucun flash au rechargement) et évènement (ex. couleur des notifications). */
function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

/**
 * Bascule clair / sombre.
 * - Navigateurs compatibles : le nouveau thème se révèle en cercle depuis le bouton (en haut à droite) et balaie tout l'écran vers la gauche,
 *   pendant que l'ancien thème s'assombrit légèrement en retrait (View Transitions API, une capture de la page entière : barre latérale,
 *   cartes, menus, fonds, bordures et textes changent ensemble, sans scintillement).
 * - Autres navigateurs : fondu rapide des couleurs.
 * - « Réduire les animations » activé : changement immédiat.
 */
export function ThemeToggle() {
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (switching) return;
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme(next);
      return;
    }

    switching = true;
    const finish = () => {
      switching = false;
      root.classList.remove("theme-switching", "theme-fade");
    };
    const doc = document as DocWithVT;

    if (!doc.startViewTransition) {
      root.classList.add("theme-fade");
      applyTheme(next);
      window.setTimeout(finish, FADE_MS);
      return;
    }

    // Le cercle part du centre du bouton et grandit jusqu'à couvrir le coin le plus éloigné de l'écran
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${Math.ceil(radius)}px`);
    root.classList.add("theme-switching");
    try {
      doc.startViewTransition(() => applyTheme(next)).finished.then(finish, finish);
    } catch {
      applyTheme(next);
      finish();
    }
  };

  return (
    <Tooltip content="Mode clair / sombre">
      <button
        type="button"
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
        aria-label="Basculer entre le mode clair et le mode sombre"
      >
        {/* Les deux icônes sont rendues, superposées ; le CSS les fait pivoter et se fondre l'une dans l'autre : aucun écart d'hydratation */}
        <span className="relative block h-[18px] w-[18px]" aria-hidden>
          <Sun data-keep-transition className="absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ease-out [[data-theme=light]_&]:-rotate-90 [[data-theme=light]_&]:scale-50 [[data-theme=light]_&]:opacity-0" />
          <Moon data-keep-transition className="absolute inset-0 h-[18px] w-[18px] rotate-90 scale-50 opacity-0 transition-all duration-500 ease-out [[data-theme=light]_&]:rotate-0 [[data-theme=light]_&]:scale-100 [[data-theme=light]_&]:opacity-100" />
        </span>
      </button>
    </Tooltip>
  );
}
