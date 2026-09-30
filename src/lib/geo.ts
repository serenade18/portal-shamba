/*
 * Farm boundary geometry in the browser, matching apps/farms/geometry.py on
 * the server so the form can warn before saving. Points are [lng, lat]
 * (GeoJSON order); rings here are open (the first point is not repeated).
 */

export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_378_137;
const M2_PER_ACRE = 4046.8564224;
export const MAX_FARM_HA = 3000;
export const MAX_CORNERS = 200;

const rad = (d: number) => (d * Math.PI) / 180;

/** Spherical area (the formula turf.js uses). */
export function areaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i]!;
    const [lng2, lat2] = ring[(i + 1) % ring.length]!;
    total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return (Math.abs(total) * EARTH_RADIUS_M ** 2) / 2;
}

export const hectares = (ring: LngLat[]) => areaM2(ring) / 10_000;
export const acres = (ring: LngLat[]) => areaM2(ring) / M2_PER_ACRE;

const orient = (a: LngLat, b: LngLat, c: LngLat) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const within = (a: LngLat, b: LngLat, c: LngLat) =>
  Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);

function meet(p1: LngLat, p2: LngLat, q1: LngLat, q2: LngLat): boolean {
  const d1 = orient(q1, q2, p1), d2 = orient(q1, q2, p2), d3 = orient(p1, p2, q1), d4 = orient(p1, p2, q2);
  if (d1 && d2 && d3 && d4 && (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0)) return true;
  return (!d1 && within(q1, q2, p1)) || (!d2 && within(q1, q2, p2)) || (!d3 && within(p1, p2, q1)) || (!d4 && within(p1, p2, q2));
}

/** True if two edges that aren't neighbours touch: the farmer went round out of order. */
export function crossesItself(ring: LngLat[]): boolean {
  const n = ring.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (meet(ring[i]!, ring[(i + 1) % n]!, ring[j]!, ring[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

export type BoundaryProblem = "few" | "crosses" | "big" | null;

/** What stops this ring being saved, if anything. An empty ring is fine (no boundary). */
export function boundaryProblem(ring: LngLat[]): BoundaryProblem {
  if (!ring.length) return null;
  // Crossing first: a bow tie's two halves cancel out to almost no area.
  if (crossesItself(ring)) return "crosses";
  if (ring.length < 3 || areaM2(ring) < 1) return "few";
  if (hectares(ring) > MAX_FARM_HA) return "big";
  return null;
}

/** GeoJSON for the API: the ring closed, or null for no boundary. */
export function toPolygon(ring: LngLat[]): { type: "Polygon"; coordinates: LngLat[][] } | null {
  return ring.length >= 3 ? { type: "Polygon", coordinates: [[...ring, ring[0]!]] } : null;
}

/** The open ring back from the API's GeoJSON. */
export function fromPolygon(p: { coordinates: LngLat[][] } | null | undefined): LngLat[] {
  const ring = p?.coordinates[0] ?? [];
  return ring.length > 1 && ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1] ? ring.slice(0, -1) : ring;
}

export const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
