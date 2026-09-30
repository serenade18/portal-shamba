import { useCallback, useMemo } from "react";
import { useT } from "@/i18n";

/*
 * Country shapes for the staff map. src/assets/geo/africa.json was cut from
 * Natural Earth 1:50m (via world-atlas) and keyed by ISO alpha-2; it loads on
 * demand so other pages don't pay for it.
 */

export type Ring = [number, number][]; // [lng, lat]
export interface CountryShape {
  type: "Feature";
  properties: { code: string };
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
}

/** Every code the map draws, so callers can list countries that fall outside it. */
export const AFRICA = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ",
  "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE",
  "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW", "EH",
]);

/** Mainland Africa and its nearby islands, from Cape Verde to Mauritius ([south, west], [north, east]). */
export const AFRICA_BOUNDS: [[number, number], [number, number]] = [[-35.5, -26], [38, 59.5]];

let shapes: Promise<CountryShape[]> | null = null;
export const loadShapes = () =>
  (shapes ??= import("@/assets/geo/africa.json").then((m) => (m.default as unknown as { features: CountryShape[] }).features));

export function polygons(s: CountryShape): Ring[][] {
  return s.geometry.type === "Polygon" ? [s.geometry.coordinates] : s.geometry.coordinates;
}

/**
 * Where to zoom for a country: its largest landmass, so far-off territories
 * (South Africa's Prince Edward Islands, Mauritius' Rodrigues) don't pull the
 * view out to sea.
 */
export function mainBounds(s: CountryShape): [[number, number], [number, number]] {
  let best: [[number, number], [number, number]] = [[0, 0], [0, 0]];
  let bestArea = -1;
  for (const poly of polygons(s)) {
    let w = Infinity, e = -Infinity, so = Infinity, n = -Infinity;
    for (const [lng, lat] of poly[0]!) {
      w = Math.min(w, lng); e = Math.max(e, lng); so = Math.min(so, lat); n = Math.max(n, lat);
    }
    const area = (e - w) * (n - so);
    if (area > bestArea) {
      bestArea = area;
      best = [[so, w], [n, e]];
    }
  }
  return best;
}

/** One hue, light to dark (8.5). */
export const STEPS = ["var(--green-400)", "var(--green-600)", "var(--green-900)"] as const;
export const EMPTY = "var(--map-empty)";

/**
 * Splits 1..max into up to three bands on a log scale (640 gives 1–8, 9–74,
 * 75–640), so one large market doesn't flatten every other country into the
 * lightest shade.
 */
export function bands(max: number): [number, number][] {
  if (max <= 0) return [];
  if (max <= STEPS.length) return Array.from({ length: max }, (_, i) => [i + 1, i + 1]);
  const a = Math.max(1, Math.floor(max ** (1 / 3)));
  const b = Math.max(a + 1, Math.floor(max ** (2 / 3)));
  return [[1, a], [a + 1, b], [b + 1, max]];
}

export function shade(n: number, ranges: [number, number][]): string {
  if (n <= 0) return EMPTY;
  return STEPS[Math.max(0, ranges.findIndex(([lo, hi]) => n >= lo && n <= hi))]!;
}

type Counted = "accounts" | "farmers" | "farms" | "countries";

/** "1 farm", "12 farms": plural-aware counts for the map, numbers grouped. */
export function useCount() {
  const t = useT();
  return useCallback((what: Counted, n: number) => t.n(`admin.map.n.${what}`, n, { n: n.toLocaleString("en") }), [t]);
}

export function useCountryName() {
  const t = useT();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([t.locale, "en"], { type: "region" });
    } catch {
      /* very old browser: show the code */
    }
    return (code: string) => names?.of(code) ?? code;
  }, [t.locale]);
}
