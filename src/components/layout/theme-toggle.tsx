"use client";

import { Moon, Sun } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export const THEME_COOKIE = "mactura_theme";
export const THEME_EVENT = "mactura:theme";

/** Repli en fondu (navigateurs sans View Transitions) ; la vague de dégradé dure 1000 ms (voir `globals.css`, `theme-wave`). */
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

/** La vague demande les View Transitions et les propriétés CSS typées (@property) pour animer le dégradé sans saccade. */
function supportsWave(doc: DocWithVT) {
  return typeof doc.startViewTransition === "function" && typeof CSS !== "undefined" && "registerProperty" in CSS;
}

/**
 * Bascule clair / sombre.
 * - Navigateurs compatibles : le nouveau thème se révèle par une vague de dégradé qui traverse tout l'écran de droite à gauche. Le bord de la vague
 *   est un fondu progressif entre l'ancien et le nouveau thème (une seule capture animée, sur le GPU : barre latérale, cartes, menus, fonds,
 *   bordures et textes changent ensemble, sans scintillement).
 * - Autres navigateurs : fondu rapide des couleurs.
 * - « Réduire les animations » activé : changement immédiat.
 */
export function ThemeToggle() {
  const toggle = () => {
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

    if (!supportsWave(doc)) {
      root.classList.add("theme-fade");
      applyTheme(next);
      window.setTimeout(finish, FADE_MS);
      return;
    }

    root.classList.add("theme-switching");
    try {
      doc.startViewTransition!(() => applyTheme(next)).finished.then(finish, finish);
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
        className="relative rounded-md p-2 text-muted transition-colors hover:bg-subtle hover:text-ink"
        aria-label="Basculer entre le mode clair et le mode sombre"
      >
        {/* Les deux icônes sont rendues, superposées ; le CSS les fait pivoter et se fondre l'une dans l'autre : aucun écart d'hydratation */}
        <span className="relative block h-[18px] w-[18px]" aria-hidden>
          <Sun data-keep-transition className="absolute inset-0 h-[18px] w-[18px] transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] [[data-theme=light]_&]:-rotate-180 [[data-theme=light]_&]:scale-50 [[data-theme=light]_&]:opacity-0" />
          <Moon data-keep-transition className="absolute inset-0 h-[18px] w-[18px] rotate-180 scale-50 opacity-0 transition-all duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] [[data-theme=light]_&]:rotate-0 [[data-theme=light]_&]:scale-100 [[data-theme=light]_&]:opacity-100" />
        </span>
      </button>
    </Tooltip>
  );
}
