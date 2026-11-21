"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Layers } from "lucide-react";
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

type Theme = "dark" | "light";

// ── Données gratuites, sans clé : tuiles vectorielles OpenFreeMap (OpenStreetMap) + relief AWS Terrain Tiles ──
const VECTOR = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const HOME = { center: [-7.1, 31.8] as [number, number], zoom: 5, pitch: 48, bearing: -10 };
const PITCH_3D = 48;
const COLUMN_RADIUS_PX = 7;
const BUBBLE_SIZE = 34;

const PALETTE = {
  dark: {
    land: "#0b1530", water: "#06142f", wood: "#0e1d3a", sand: "#12203a", boundary: "#7fa2f0", boundaryRegion: "#5470b5", road: "#4c63a0",
    label: "#c3d0ef", labelHalo: "#07102a", hillShadow: "#020611", hillHighlight: "#5f7fd1", hillAccent: "#3a4f9a",
    sky: "#050c22", horizon: "#16275a", fog: "#0b1736", indigo: "#6a62dc", orange: "#EC5D34",
  },
  light: {
    land: "#eef2f8", water: "#bfd8f4", wood: "#e2ecde", sand: "#f1ead8", boundary: "#3d5a9e", boundaryRegion: "#8ea3cf", road: "#ffffff",
    label: "#2e3a63", labelHalo: "#ffffff", hillShadow: "#6b7aa6", hillHighlight: "#ffffff", hillAccent: "#8e9dc6",
    sky: "#a9c4ee", horizon: "#e3ecfa", fog: "#f3f6fc", indigo: "#36307E", orange: "#EC5D34",
  },
} as const;

const NAME = ["coalesce", ["get", "name:fr"], ["get", "name:latin"], ["get", "name"]];

/** Style de carte complet (fond, relief, hydrographie, frontières, routes, libellés, ciel) — maison, pour un rendu cohérent clair/sombre. */
function buildStyle(theme: Theme, columns: GeoJSON.FeatureCollection): StyleSpecification {
  const c = PALETTE[theme];
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      omt: { type: "vector", url: VECTOR, attribution: '© <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
      dem: { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: 'Relief : <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>' },
      columns: { type: "geojson", data: columns },
    },
    terrain: { source: "dem", exaggeration: 1.7 },
    sky: { "sky-color": c.sky, "horizon-color": c.horizon, "fog-color": c.fog, "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.35 },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": c.land } },
      {
        id: "landcover", type: "fill", source: "omt", "source-layer": "landcover",
        paint: { "fill-color": ["match", ["get", "class"], ["wood", "forest"], c.wood, ["sand", "rock"], c.sand, ["grass", "farmland"], c.wood, c.land], "fill-opacity": 0.85 },
      },
      {
        id: "hillshade", type: "hillshade", source: "dem",
        paint: { "hillshade-shadow-color": c.hillShadow, "hillshade-highlight-color": c.hillHighlight, "hillshade-accent-color": c.hillAccent, "hillshade-exaggeration": theme === "dark" ? 0.55 : 0.45 },
      },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": c.water } },
      {
        id: "roads", type: "line", source: "omt", "source-layer": "transportation", minzoom: 6,
        filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
        paint: { "line-color": c.road, "line-opacity": theme === "dark" ? 0.55 : 0.9, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 2.2] },
      },
      {
        id: "boundary-region", type: "line", source: "omt", "source-layer": "boundary", minzoom: 4,
        filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": c.boundaryRegion, "line-opacity": 0.55, "line-width": 0.8, "line-dasharray": [3, 2] },
      },
      {
        id: "boundary-country", type: "line", source: "omt", "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
        paint: { "line-color": c.boundary, "line-opacity": 0.85, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 9, 2] },
      },
      {
        id: "columns", type: "fill-extrusion", source: "columns",
        paint: {
          "fill-extrusion-color": ["case", [">", ["get", "due"], 0], c.orange, c.indigo],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: "label-country", type: "symbol", source: "omt", "source-layer": "place", filter: ["==", ["get", "class"], "country"], maxzoom: 7,
        layout: { "text-field": NAME as never, "text-font": ["Noto Sans Bold"], "text-size": 13, "text-transform": "uppercase", "text-letter-spacing": 0.12 },
        paint: { "text-color": c.label, "text-halo-color": c.labelHalo, "text-halo-width": 1.4, "text-opacity": 0.8 },
      },
      {
        id: "label-city", type: "symbol", source: "omt", "source-layer": "place", minzoom: 5,
        filter: ["match", ["get", "class"], ["city", "town"], true, false],
        layout: { "text-field": NAME as never, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 10, 14], "text-anchor": "top", "text-offset": [0, 0.6] },
        paint: { "text-color": c.label, "text-halo-color": c.labelHalo, "text-halo-width": 1.3, "text-opacity": 0.9 },
      },
    ],
  };
}

/** Cercle (polygone à 20 côtés) de rayon donné en mètres autour d'un point. */
function circle(lng: number, lat: number, radiusM: number): [number, number][] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return ring;
}

const columnHeightPx = (n: number) => 26 + Math.min(n, 8) * 11;

/** Colonnes dimensionnées en pixels d'écran (donc lisibles à tous les niveaux de zoom) puis converties en mètres. */
function buildColumns(groups: Group[], zoom: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: groups.map((g) => {
      const mpp = (78_271.52 * Math.cos((g.lat * Math.PI) / 180)) / 2 ** zoom; // mètres par pixel (tuiles de 512 px)
      return {
        type: "Feature",
        properties: { city: g.city, due: g.due, height: columnHeightPx(g.items.length) * mpp },
        geometry: { type: "Polygon", coordinates: [circle(g.lng, g.lat, COLUMN_RADIUS_PX * mpp)] },
      };
    }),
  };
}

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

// Le worker est servi depuis /public (le bundler Next ne sait pas résoudre le worker intégré de MapLibre)
let workerSet = false;
function ensureWorker() {
  if (workerSet) return;
  workerSet = true;
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

const currentTheme = (): Theme => (typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark");

export default function SuppliersMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Map<string, { marker: maplibregl.Marker; group: Group }>>(new Map());
  const popup = useRef<maplibregl.Popup | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);
  const [failed, setFailed] = useState(false);

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
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const openPopup = useCallback((g: Group) => {
    const m = map.current;
    if (!m) return;
    popup.current?.remove();
    const lift = columnHeightPx(g.items.length) * Math.sin((m.getPitch() * Math.PI) / 180) + BUBBLE_SIZE / 2 + 6;
    const p = new maplibregl.Popup({ closeButton: false, maxWidth: "280px", offset: [0, -lift], className: "sup-gl-popup" })
      .setLngLat([g.lng, g.lat])
      .setDOMContent(popupContent(g))
      .addTo(m);
    p.on("close", () => setActive((c) => (c === g.city ? null : c)));
    popup.current = p;
    setActive(g.city);
  }, []);

  /** Place chaque pastille au sommet de sa colonne (la hauteur à l'écran dépend de l'inclinaison). */
  const layoutMarkers = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const sin = Math.sin((m.getPitch() * Math.PI) / 180);
    markers.current.forEach(({ marker, group }) => marker.setOffset([0, -(columnHeightPx(group.items.length) * sin + BUBBLE_SIZE / 2 - 2)]));
  }, []);

  // Création de la carte (une seule fois)
  useEffect(() => {
    if (!el.current || map.current) return;
    let m: maplibregl.Map;
    try {
      ensureWorker();
      m = new maplibregl.Map({
        container: el.current,
        style: buildStyle(currentTheme(), buildColumns(groupsRef.current, HOME.zoom)),
        center: HOME.center,
        zoom: HOME.zoom,
        pitch: HOME.pitch,
        bearing: HOME.bearing,
        minZoom: 3.5,
        maxZoom: 13,
        maxPitch: 72,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
    } catch {
      setFailed(true); // WebGL indisponible : la liste des villes reste utilisable
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    // La molette ne zoome qu'après un clic dans la carte : on ne bloque pas le défilement de la page
    m.scrollZoom.disable();
    m.on("click", () => m.scrollZoom.enable());
    m.getContainer().addEventListener("mouseleave", () => m.scrollZoom.disable());

    // Colonnes : redimensionnées à chaque zoom pour garder une taille constante à l'écran
    m.on("zoom", () => {
      const src = m.getSource("columns") as GeoJSONSource | undefined;
      src?.setData(buildColumns(groupsRef.current, m.getZoom()));
    });
    m.on("pitch", layoutMarkers);
    m.on("click", "columns", (e) => {
      const city = e.features?.[0]?.properties?.city as string | undefined;
      const g = groupsRef.current.find((x) => x.city === city);
      if (g) openPopup(g);
    });
    m.on("mouseenter", "columns", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "columns", () => (m.getCanvas().style.cursor = ""));
    m.on("error", (e) => {
      // Une tuile manquante n'empêche pas la carte de fonctionner ; seul un échec de chargement du style est bloquant
      if (!m.isStyleLoaded() && !m.getSource("omt")) setFailed(true);
      void e;
    });

    // Suit le thème clair / sombre de l'application
    let theme = currentTheme();
    const mo = new MutationObserver(() => {
      const next = currentTheme();
      if (next === theme) return;
      theme = next;
      m.setStyle(buildStyle(next, buildColumns(groupsRef.current, m.getZoom())));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);

    return () => {
      mo.disconnect();
      ro.disconnect();
      popup.current?.remove();
      markers.current.forEach(({ marker }) => marker.remove());
      markers.current.clear();
      m.remove();
      map.current = null;
    };
  }, [layoutMarkers, openPopup]);

  // Pastilles + colonnes : un repère par ville, avec le nombre de fournisseurs
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach(({ marker }) => marker.remove());
    markers.current.clear();
    groups.forEach((g) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "sup-pin";
      node.title = `${g.city} : ${g.items.length} fournisseur(s)`;
      node.setAttribute("aria-label", node.title);
      const bubble = document.createElement("span");
      bubble.className = `sup-pin-bubble${g.due > 0 ? " is-due" : ""}`;
      bubble.style.width = bubble.style.height = `${BUBBLE_SIZE}px`;
      bubble.style.fontSize = "13px";
      bubble.textContent = String(g.items.length);
      node.appendChild(bubble);
      node.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openPopup(g);
      });
      const marker = new maplibregl.Marker({ element: node, anchor: "center" }).setLngLat([g.lng, g.lat]).addTo(m);
      markers.current.set(g.city, { marker, group: g });
    });
    layoutMarkers();
    const src = m.getSource("columns") as GeoJSONSource | undefined;
    src?.setData(buildColumns(groups, m.getZoom()));
    if (groups.length > 1) {
      const b = new maplibregl.LngLatBounds();
      groups.forEach((g) => b.extend([g.lng, g.lat]));
      m.fitBounds(b, { padding: { top: 70, bottom: 30, left: 40, right: 40 }, maxZoom: 7, pitch: m.getPitch(), bearing: HOME.bearing, animate: false });
      m.jumpTo({ zoom: Math.min(m.getZoom() + 0.25, 7.5) });
    } else if (groups.length === 1) {
      m.jumpTo({ center: [groups[0].lng, groups[0].lat], zoom: 7 });
    }
  }, [groups, layoutMarkers, openPopup]);

  const focus = (g: Group) => {
    const m = map.current;
    if (!m) return;
    m.flyTo({ center: [g.lng, g.lat], zoom: Math.max(m.getZoom(), 8), duration: 1100, essential: false });
    window.setTimeout(() => openPopup(g), 900);
  };

  const toggle3D = () => {
    const m = map.current;
    if (!m) return;
    const next = !is3D;
    setIs3D(next);
    m.easeTo({ pitch: next ? PITCH_3D : 0, bearing: next ? HOME.bearing : 0, duration: 900, essential: false });
  };

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="relative isolate h-[400px] lg:h-[500px]">
        <div ref={el} className="sup-map" style={{ position: "absolute", inset: 0 }} role="application" aria-label="Carte 3D des fournisseurs" />
        {failed && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 bg-canvas px-6 text-center">
            <Layers className="h-6 w-6 text-faint" />
            <p className="text-sm font-medium text-ink">La carte 3D n&apos;a pas pu s&apos;afficher</p>
            <p className="max-w-xs text-xs text-muted">Elle nécessite WebGL et un accès aux fonds de carte. La liste des villes reste disponible à droite.</p>
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 z-[5] flex gap-2">
          <span className="sup-legend"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> À jour</span>
          <span className="sup-legend"><span className="h-2.5 w-2.5 rounded-full bg-accent-500" /> Solde à payer</span>
        </div>
        <button type="button" onClick={toggle3D} aria-pressed={is3D} className="sup-legend absolute right-3 top-3 z-[5] cursor-pointer transition-colors hover:bg-subtle" title="Basculer entre la vue 3D inclinée et la vue à plat">
          <Box className="h-3.5 w-3.5" /> {is3D ? "Vue 3D" : "Vue à plat"}
        </button>
        <p className="pointer-events-none absolute bottom-3 left-3 z-[5] hidden text-[11px] text-muted sm:block">Clic droit + glisser (ou Ctrl + glisser) pour pivoter · colonnes : hauteur = nombre de fournisseurs</p>
      </div>
      <div className="flex max-h-[500px] flex-col border-t border-line-soft lg:border-l lg:border-t-0">
        <p className="px-4 pb-2 pt-4 text-[11px] font-semibold text-faint">Villes ({groups.length})</p>
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
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", g.due > 0 ? "bg-accent-500" : "bg-brand-500")}>{g.items.length}</span>
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
