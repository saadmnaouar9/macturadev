"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cityCoords } from "@/lib/geo";
import { formatMAD } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface MapPoint {
  id: string;
  name: string;
  city: string | null;
  balance: number;
  purchaseCount: number;
}

interface Group {
  city: string;
  lat: number;
  lng: number;
  items: MapPoint[];
  due: number;
}

// Fonds de carte OpenStreetMap (gratuits, sans clé). Le mode sombre est obtenu par un filtre CSS (voir globals.css).
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Construit le contenu d'une bulle d'information avec des nœuds DOM (aucun HTML issu des données : pas d'injection possible). */
function popupContent(g: Group): HTMLElement {
  const root = document.createElement("div");
  root.className = "sup-popup";
  const title = document.createElement("p");
  title.className = "sup-popup-title";
  title.textContent = `${g.city} · ${g.items.length} fournisseur${g.items.length > 1 ? "s" : ""}`;
  root.appendChild(title);
  const list = document.createElement("ul");
  g.items.slice(0, 6).forEach((it) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `/achats?q=${encodeURIComponent(it.name)}`;
    a.textContent = it.name;
    li.appendChild(a);
    const sub = document.createElement("span");
    sub.className = it.balance > 0 ? "is-due" : "";
    sub.textContent = it.balance > 0 ? `${formatMAD(it.balance)} à payer` : "À jour";
    li.appendChild(sub);
    list.appendChild(li);
  });
  root.appendChild(list);
  if (g.items.length > 6) {
    const more = document.createElement("p");
    more.className = "sup-popup-more";
    more.textContent = `+ ${g.items.length - 6} autre${g.items.length - 6 > 1 ? "s" : ""}`;
    root.appendChild(more);
  }
  return root;
}

export default function SuppliersMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tile = useRef<L.TileLayer | null>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const [active, setActive] = useState<string | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const p of points) {
      const c = cityCoords(p.city);
      if (!c || !p.city) continue;
      const key = `${c[0]},${c[1]}`;
      const g = m.get(key) ?? { city: p.city, lat: c[0], lng: c[1], items: [], due: 0 };
      g.items.push(p);
      g.due += p.balance;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.items.length - a.items.length || a.city.localeCompare(b.city));
  }, [points]);
  const unplaced = points.length - groups.reduce((n, g) => n + g.items.length, 0);

  // Création de la carte (une seule fois)
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, minZoom: 4, maxZoom: 14 }).setView([31.8, -7.1], 5);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    // La molette ne zoome qu'après un clic dans la carte : on ne bloque pas le défilement de la page
    m.on("click", () => m.scrollWheelZoom.enable());
    m.getContainer().addEventListener("mouseleave", () => m.scrollWheelZoom.disable());
    map.current = m;
    tile.current = L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);
    const t = setTimeout(() => m.invalidateSize(), 250);
    return () => {
      clearTimeout(t);
      m.remove();
      map.current = null;
      tile.current = null;
      markers.current.clear();
    };
  }, []);

  // Repères : un par ville, avec le nombre de fournisseurs
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    // Beaucoup de villes : repères plus petits pour limiter les chevauchements
    const size = groups.length > 10 ? 30 : 42;
    groups.forEach((g) => {
      const icon = L.divIcon({
        className: "sup-pin",
        html: `<span class="sup-pin-bubble${g.due > 0 ? " is-due" : ""}" style="width:${size}px;height:${size}px;font-size:${size < 36 ? 12 : 14}px">${g.items.length}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 + 2],
      });
      const mk = L.marker([g.lat, g.lng], { icon, title: `${g.city} : ${g.items.length} fournisseur(s)` }).addTo(m);
      mk.bindPopup(() => popupContent(g), { maxWidth: 280, closeButton: false });
      mk.on("popupopen", () => setActive(g.city));
      mk.on("popupclose", () => setActive((c) => (c === g.city ? null : c)));
      markers.current.set(g.city, mk);
    });
    if (groups.length) {
      const b = L.latLngBounds(groups.map((g) => [g.lat, g.lng] as [number, number]));
      m.fitBounds(b, { padding: [40, 40], maxZoom: 7, animate: false });
    } else {
      m.setView([31.8, -7.1], 5);
    }
  }, [groups]);

  const focus = (g: Group) => {
    const m = map.current;
    const mk = markers.current.get(g.city);
    if (!m || !mk) return;
    m.flyTo([g.lat, g.lng], Math.max(m.getZoom(), 8), { duration: 0.8 });
    setTimeout(() => mk.openPopup(), 600);
  };

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="relative isolate h-[400px] lg:h-[460px]">
        <div ref={el} className="sup-map absolute inset-0" role="application" aria-label="Carte des fournisseurs" />
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex gap-2">
          <span className="sup-legend"><span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-brand-500 to-violet-500" /> À jour</span>
          <span className="sup-legend"><span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-orange-500 to-rose-500" /> Solde à payer</span>
        </div>
      </div>
      <div className="flex max-h-[460px] flex-col border-t border-line-soft lg:border-l lg:border-t-0">
        <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Villes ({groups.length})</p>
        <ul className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {groups.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-faint">Aucune ville renseignée sur vos fournisseurs.</li>}
          {groups.map((g) => (
            <li key={g.city}>
              <button
                type="button"
                onClick={() => focus(g)}
                aria-pressed={active === g.city}
                className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-subtle", active === g.city && "bg-brand-500/10")}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", g.due > 0 ? "bg-gradient-to-br from-orange-500 to-rose-500" : "bg-gradient-to-br from-brand-500 to-violet-500")}>{g.items.length}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{g.city}</span>
                  <span className={cn("block truncate text-[11.5px]", g.due > 0 ? "text-accent-600" : "text-muted")}>{g.due > 0 ? `${formatMAD(g.due)} à payer` : "Tout est réglé"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {unplaced > 0 && <p className="border-t border-line-soft px-4 py-3 text-xs text-muted">{unplaced} fournisseur{unplaced > 1 ? "s" : ""} sans ville : non affiché{unplaced > 1 ? "s" : ""} sur la carte.</p>}
      </div>
    </div>
  );
}
