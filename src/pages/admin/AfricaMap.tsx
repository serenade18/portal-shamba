import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n";

/*
 * Farm accounts per country on a map of Africa. The shapes (src/assets/geo/
 * africa.json) were cut from Natural Earth 1:50m via world-atlas and keyed by
 * ISO alpha-2; they load on demand so other pages don't pay for them.
 *
 * Africa sits across the equator, so a plain longitude/latitude projection
 * barely distorts it and needs no map library.
 */

type Ring = [number, number][];
interface Shape {
  type: "Feature";
  properties: { code: string };
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
}

export interface CountryCount {
  country: string;
  organisations: number;
  farmers: number;
}

const SCALE = 10; // px per degree in the viewBox
/** The frame: mainland Africa and its nearby islands, from Cape Verde to Mauritius. Far-off
 * territories (South Africa's Prince Edward Islands, Rodrigues) fall outside it. */
const BOUNDS = { west: -26, east: 59.5, south: -35.5, north: 38 };
const PAD = 4;
/** One hue, light to dark (8.5). Grey means no farm accounts yet. */
const STEPS = ["var(--green-400)", "var(--green-600)", "var(--green-900)"] as const;
const EMPTY = "var(--map-empty)";
/** Island states smaller than this (px² in the viewBox) also get a dot, or nobody could find or hover them. */
const TINY = 40;

/** Every code the map draws, so callers can list countries that fall outside it. */
export const AFRICA = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ",
  "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE",
  "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW", "EH",
]);

let shapes: Promise<Shape[]> | null = null;
const loadShapes = () =>
  (shapes ??= import("@/assets/geo/africa.json").then((m) => (m.default as unknown as { features: Shape[] }).features));

function polygons(s: Shape): Ring[][] {
  return s.geometry.type === "Polygon" ? [s.geometry.coordinates] : s.geometry.coordinates;
}

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

export function AfricaMap({ rows }: { rows: CountryCount[] }) {
  const t = useT();
  const countryName = useCountryName();
  const [features, setFeatures] = useState<Shape[] | null>(null);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadShapes().then((f) => live && setFeatures(f));
    return () => {
      live = false;
    };
  }, []);

  const byCode = useMemo(() => new Map(rows.map((r) => [r.country, r])), [rows]);
  const max = Math.max(0, ...rows.map((r) => r.organisations));
  const ranges = bands(max);
  const fill = (n: number) => (n <= 0 ? EMPTY : STEPS[Math.max(0, ranges.findIndex(([lo, hi]) => n >= lo && n <= hi))]!);

  const drawn = useMemo(() => {
    if (!features) return null;
    const { west: minX, east: maxX, south: minY, north: maxY } = BOUNDS;
    const px = (x: number) => (x - minX) * SCALE + PAD;
    const py = (y: number) => (maxY - y) * SCALE + PAD;
    const shapesOut = features.map((f) => {
      let d = "";
      let biggest = { area: -1, cx: 0, cy: 0 };
      let total = 0;
      for (const poly of polygons(f)) {
        for (const ring of poly) d += "M" + ring.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("L") + "Z";
        const outer = poly[0]!;
        let area = 0, cx = 0, cy = 0;
        for (let i = 0; i < outer.length; i++) {
          const [x1, y1] = outer[i]!;
          const [x2, y2] = outer[(i + 1) % outer.length]!;
          const cross = px(x1) * py(y2) - px(x2) * py(y1);
          area += cross; cx += (px(x1) + px(x2)) * cross; cy += (py(y1) + py(y2)) * cross;
        }
        area /= 2;
        total += Math.abs(area);
        if (Math.abs(area) > biggest.area) {
          biggest = area ? { area: Math.abs(area), cx: cx / (6 * area), cy: cy / (6 * area) } : { area: 0, cx: px(outer[0]![0]), cy: py(outer[0]![1]) };
        }
      }
      return { code: f.properties.code, d, cx: biggest.cx, cy: biggest.cy, tiny: total < TINY };
    });
    return { shapes: shapesOut, width: (maxX - minX) * SCALE + PAD * 2, height: (maxY - minY) * SCALE + PAD * 2 };
  }, [features]);

  if (!drawn) return <div className="africa-map loading" aria-busy="true" />;

  const hovered = hover && byCode.get(hover.code);
  const show = (code: string, el: Element) => {
    const box = el.getBoundingClientRect();
    const frame = el.closest(".africa-map")!.getBoundingClientRect();
    setHover({ code, x: box.left + box.width / 2 - frame.left, y: box.top - frame.top });
  };
  const interactive = (code: string) => {
    const r = byCode.get(code);
    const label = r ? `${countryName(code)}: ${t("admin.map.tip", { accounts: r.organisations, farmers: r.farmers })}` : countryName(code);
    return {
      tabIndex: r ? 0 : undefined,
      role: r ? "img" : undefined,
      "aria-label": r ? label : undefined,
      onPointerEnter: (e: React.PointerEvent<SVGElement>) => show(code, e.currentTarget),
      onPointerLeave: () => setHover(null),
      onFocus: (e: React.FocusEvent<SVGElement>) => show(code, e.currentTarget),
      onBlur: () => setHover(null),
    };
  };

  return (
    <div className="africa-map">
      <svg viewBox={`0 0 ${drawn.width.toFixed(0)} ${drawn.height.toFixed(0)}`} aria-hidden={rows.length ? undefined : true}>
        {drawn.shapes.map((s) => (
          <path key={s.code + s.d.length} d={s.d} fill={fill(byCode.get(s.code)?.organisations ?? 0)} className={hover?.code === s.code ? "on" : undefined} {...interactive(s.code)} />
        ))}
        {drawn.shapes.filter((s) => s.tiny && byCode.has(s.code)).map((s) => (
          <circle key={`dot-${s.code}`} cx={s.cx} cy={s.cy} r={6} fill={fill(byCode.get(s.code)!.organisations)} className={hover?.code === s.code ? "on" : undefined} {...interactive(s.code)} />
        ))}
      </svg>
      {hover && (
        <div className="map-tip" role="status" style={{ left: hover.x, top: hover.y }}>
          <strong>{countryName(hover.code)}</strong>
          <span>{hovered ? t("admin.map.tip", { accounts: hovered.organisations, farmers: hovered.farmers }) : t("admin.map.none")}</span>
        </div>
      )}
      <ul className="map-legend list-plain" aria-label={t("admin.map.legend")}>
        <li><i style={{ background: EMPTY }} />{t("admin.map.none")}</li>
        {ranges.map(([lo, hi], i) => (
          <li key={lo}><i style={{ background: STEPS[i] }} />{lo === hi ? lo : `${lo}–${hi}`}</li>
        ))}
      </ul>
    </div>
  );
}
