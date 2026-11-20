/** Coordonnées (latitude, longitude) des villes proposées dans l'application (voir cities.ts). Sert à placer les fournisseurs sur la carte. */
const CITY_COORDS: Record<string, [number, number]> = {
  casablanca: [33.5731, -7.5898],
  rabat: [34.0209, -6.8416],
  marrakech: [31.6295, -7.9811],
  fes: [34.0331, -5.0003],
  tanger: [35.7595, -5.834],
  agadir: [30.4278, -9.5981],
  meknes: [33.8935, -5.5547],
  oujda: [34.6814, -1.9086],
  kenitra: [34.261, -6.5802],
  tetouan: [35.5785, -5.3684],
  sale: [34.0531, -6.7985],
  temara: [33.9287, -6.9063],
  safi: [32.2994, -9.2372],
  mohammedia: [33.6861, -7.3829],
  "el jadida": [33.2316, -8.5007],
  "beni mellal": [32.3373, -6.3498],
  nador: [35.1681, -2.9335],
  khouribga: [32.8811, -6.9063],
  settat: [33.001, -7.6166],
  larache: [35.1932, -6.1557],
  "ksar el kebir": [35.0017, -5.9042],
  khemisset: [33.824, -6.0663],
  guelmim: [28.987, -10.0574],
  berrechid: [33.2655, -7.5875],
  taza: [34.2133, -4.0103],
  errachidia: [31.9314, -4.4244],
  ouarzazate: [30.9335, -6.937],
  essaouira: [31.5085, -9.7595],
  laayoune: [27.1253, -13.1625],
  dakhla: [23.6848, -15.9579],
  "al hoceima": [35.2517, -3.9372],
  ifrane: [33.5228, -5.1106],
  chefchaouen: [35.1688, -5.2636],
  taroudant: [30.4703, -8.8769],
  tiznit: [29.6974, -9.7316],
  berkane: [34.92, -2.32],
  "sidi kacem": [34.226, -5.708],
  "sidi slimane": [34.265, -5.926],
  youssoufia: [32.248, -8.529],
  bouskoura: [33.45, -7.65],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/** Coordonnées d'une ville marocaine (sans tenir compte des accents ni de la casse) ; `null` si la ville est inconnue. */
export function cityCoords(city: string | null | undefined): [number, number] | null {
  if (!city) return null;
  return CITY_COORDS[norm(city)] ?? null;
}
