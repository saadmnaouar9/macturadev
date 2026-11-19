"use client";

import { Moon, Sun } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export const THEME_COOKIE = "mactura_theme";
export const THEME_EVENT = "mactura:theme";

/** Bascule clair / sombre de la zone de contenu (la barre latérale ne change jamais). Le choix est mémorisé dans un cookie lu côté serveur : pas de flash au chargement. */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  };
  return (
    <Tooltip content="Mode clair / sombre">
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-md p-2 text-muted transition-colors hover:bg-subtle hover:text-ink"
        aria-label="Basculer entre le mode clair et le mode sombre"
      >
        {/* Les deux icônes sont rendues ; le CSS affiche celle qui convient : aucun écart d'hydratation */}
        <Sun className="h-[18px] w-[18px] [[data-theme=light]_&]:hidden" />
        <Moon className="hidden h-[18px] w-[18px] [[data-theme=light]_&]:block" />
      </button>
    </Tooltip>
  );
}
