"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const EVENT = "mactura:navigate";

/** À appeler avant un router.push() programmatique : affiche la barre de progression. */
export function startNavProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/**
 * Barre de progression fine en haut de l'écran : retour visuel immédiat à chaque navigation,
 * sans écran de chargement intermédiaire (qui retarderait l'affichage du contenu de ~300 ms).
 */
export function TopProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<{ creep?: ReturnType<typeof setInterval>; hide?: ReturnType<typeof setTimeout>; guard?: ReturnType<typeof setTimeout> }>({});
  const active = useRef(false);

  const clear = () => {
    clearInterval(timers.current.creep);
    clearTimeout(timers.current.hide);
    clearTimeout(timers.current.guard);
  };
  const finish = () => {
    if (!active.current) return;
    active.current = false;
    clear();
    setWidth(100);
    timers.current.hide = setTimeout(() => { setVisible(false); setWidth(0); }, 220);
  };
  const start = () => {
    if (active.current) return;
    active.current = true;
    clear();
    setVisible(true);
    setWidth(14);
    // progression « asymptotique » : avance vite puis ralentit, sans jamais atteindre 100 % avant la fin réelle
    timers.current.creep = setInterval(() => setWidth((w) => w + (88 - w) * 0.12), 120);
    timers.current.guard = setTimeout(finish, 12000);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (url.pathname.startsWith("/api/")) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(EVENT, start);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { finish(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5">
      <div
        className="h-full bg-gradient-to-r from-sky-400 via-brand-400 to-violet-400 shadow-[0_0_10px_rgb(77_141_255/0.8)]"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0, transition: "width 220ms ease-out, opacity 200ms ease-out" }}
      />
    </div>
  );
}
