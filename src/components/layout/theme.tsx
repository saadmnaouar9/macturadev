"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { AUTH_RE, THEME_KEY } from "@/lib/theme";

type Theme = "dark" | "light";



function stored(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

/** Applique le thème au document (sombre forcé sur les pages d'authentification), y compris lors des navigations client. */
export function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.dataset.theme = AUTH_RE.test(pathname) ? "dark" : stored();
  }, [pathname]);
  return null;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(stored()); }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* stockage indisponible : le choix vaut pour la session */ }
  }, [theme]);

  const label = theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre";
  return (
    <button onClick={toggle} aria-label={label} title={label} className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex"
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
