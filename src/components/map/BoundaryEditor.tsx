import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Crosshair, Footprints, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { token } from "@/components/ui/charts";
import { useT } from "@/i18n";
import { acres, boundaryProblem, hectares, MAX_CORNERS, round6, type LngLat } from "@/lib/geo";

/*
 * Draw a farm's boundary on satellite imagery (FRM-01/03). Three ways to add
 * a corner, so it works on a small phone and on the farm itself:
 *   - tap the map,
 *   - line the crosshair up and press "Add corner here",
 *   - stand at the corner and press "Add where I'm standing" (GPS).
 * Corners can be dragged. The ring is [lng, lat] (GeoJSON order), open.
 * Loaded lazily: Leaflet is only needed on the screens that draw.
 */

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
/** Kenya, for farmers who haven't shared their location yet. */
const DEFAULT_VIEW: [number, number, number] = [0.3, 37.9, 6];
const FARM_ZOOM = 17;

export default function BoundaryEditor({ value, onChange, center }: {
  value: LngLat[];
  onChange: (ring: LngLat[]) => void;
  /** The farm's GPS pin, if known: the map starts there. */
  center?: { lat: number; lng: number } | null;
}) {
  const t = useT();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const shape = useRef<L.Polygon | null>(null);
  const corners = useRef<L.LayerGroup | null>(null);
  // Leaflet handlers are bound once; they read the latest ring and callback through refs.
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const [gps, setGps] = useState<"idle" | "busy" | "failed">("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const add = (lng: number, lat: number) => {
    const ring = latest.current.value;
    if (ring.length >= MAX_CORNERS) return;
    latest.current.onChange([...ring, [round6(lng), round6(lat)]]);
  };

  useEffect(() => {
    if (!el.current) return;
    const start = latest.current.value[0];
    const m = L.map(el.current, { zoomSnap: 0.5, maxZoom: 19 });
    if (start) m.setView([start[1], start[0]], FARM_ZOOM);
    else if (center) m.setView([center.lat, center.lng], FARM_ZOOM);
    else m.setView([DEFAULT_VIEW[0], DEFAULT_VIEW[1]], DEFAULT_VIEW[2]);
    L.tileLayer(SATELLITE, { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }).addTo(m);
    L.tileLayer(LABELS, { maxZoom: 19 }).addTo(m);
    shape.current = L.polygon([], { color: token("var(--surface)"), weight: 2, fillColor: token("var(--green-400)"), fillOpacity: 0.35 }).addTo(m);
    corners.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => add(e.latlng.lng, e.latlng.lat));
    map.current = m;
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el.current);
    // A fitted boundary is the best starting view when editing one.
    if (latest.current.value.length >= 3) m.fitBounds(latest.current.value.map(([lng, lat]) => [lat, lng] as [number, number]), { padding: [32, 32], maxZoom: 18 });
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A GPS fix that arrives after the map opened: go there, unless drawing has started.
  useEffect(() => {
    if (center && !latest.current.value.length) map.current?.setView([center.lat, center.lng], FARM_ZOOM);
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw the shape and its draggable corners.
  useEffect(() => {
    const problem = boundaryProblem(value);
    shape.current?.setLatLngs(value.map(([lng, lat]) => [lat, lng] as L.LatLngTuple));
    shape.current?.setStyle({ fillColor: token(problem === "crosses" ? "var(--terracotta)" : "var(--green-400)") });
    const group = corners.current;
    if (!group) return;
    group.clearLayers();
    value.forEach(([lng, lat], i) => {
      const handle = L.marker([lat, lng], {
        draggable: true,
        keyboard: false,
        icon: L.divIcon({ className: i === 0 ? "corner-handle first" : "corner-handle", iconSize: [18, 18] }),
      });
      handle.on("dragend", () => {
        const p = handle.getLatLng();
        const next = [...latest.current.value];
        next[i] = [round6(p.lng), round6(p.lat)];
        latest.current.onChange(next);
      });
      group.addLayer(handle);
    });
  }, [value]);

  const addAtCentre = () => {
    const c = map.current?.getCenter();
    if (c) add(c.lng, c.lat);
  };

  const addHere = () => {
    if (!navigator.geolocation) return setGps("failed");
    setGps("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        add(pos.coords.longitude, pos.coords.latitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], Math.max(map.current.getZoom(), FARM_ZOOM));
        setGps("idle");
      },
      () => setGps("failed"),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  };

  const problem = boundaryProblem(value);
  const ha = hectares(value);

  return (
    <div className="boundary-editor stack" style={{ gap: 8 }}>
      <div className="boundary-map">
        <div ref={el} className="boundary-leaflet" role="application" aria-label={t("boundary.mapLabel")} />
        <span className="boundary-crosshair" aria-hidden />
      </div>
      <div className="boundary-actions">
        <Button size="sm" icon={<Crosshair size={16} aria-hidden />} onClick={addAtCentre}>{t("boundary.addCentre")}</Button>
        <Button size="sm" icon={<Footprints size={16} aria-hidden />} onClick={addHere} loading={gps === "busy"}>{t("boundary.addHere")}</Button>
        <Button size="sm" variant="quiet" icon={<Undo2 size={16} aria-hidden />} onClick={() => onChange(value.slice(0, -1))} disabled={!value.length}>{t("boundary.undo")}</Button>
        <Button size="sm" variant="quiet" icon={<Trash2 size={16} aria-hidden />} onClick={() => onChange([])} disabled={!value.length}>{t("boundary.clear")}</Button>
      </div>
      <p className="small" aria-live="polite">
        {!value.length
          ? <span className="muted">{t("boundary.howTo")}</span>
          : problem === "few"
            ? <span className="muted">{t("boundary.needMore", { n: value.length })}</span>
            : problem === "crosses"
              ? <span className="ink-cost">{t("boundary.crosses")}</span>
              : problem === "big"
                ? <span className="ink-cost">{t("boundary.tooBig")}</span>
                : <span><strong>{t("boundary.area", { acres: acres(value).toFixed(acres(value) < 10 ? 2 : 1), ha: ha.toFixed(ha < 10 ? 2 : 1) })}</strong> <span className="muted">· {t("boundary.corners", { n: value.length })}</span></span>}
      </p>
      {gps === "failed" && <p className="small ink-cost">{t("boundary.gpsFailed")}</p>}
      {accuracy !== null && accuracy > 15 && <p className="small muted">{t("boundary.gpsAccuracy", { m: accuracy })}</p>}
    </div>
  );
}
