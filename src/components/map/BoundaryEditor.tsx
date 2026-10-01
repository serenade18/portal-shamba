import {
  CallbackProperty,
  Cartesian3,
  ColorMaterialProperty,
  ConstantPositionProperty,
  HeightReference,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Cartesian2,
  type Entity,
} from "cesium";
import { Crosshair, Footprints, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n";
import { acres, boundaryProblem, hectares, MAX_CORNERS, round6, type LngLat } from "@/lib/geo";
import { altitude, boundsOf, centre, color, createMap, HEIGHT, lngLatAt, rectangle, type MapHandle } from "./cesium";

/*
 * Draw a farm's boundary on satellite imagery (FRM-01/03). Three ways to add
 * a corner, so it works on a small phone and on the farm itself:
 *   - tap the map,
 *   - line the crosshair up and press "Add corner here",
 *   - stand at the corner and press "Add where I'm standing" (GPS).
 * Corners can be dragged. The ring is [lng, lat] (GeoJSON order), open.
 * Loaded lazily: Cesium is only needed on the screens that draw.
 */

/** Kenya, for farmers who haven't shared their location yet. */
const DEFAULT_VIEW: LngLat = [37.9, 0.3];
/** The narrowest fitted view, in degrees (~450 m): a tiny plot shouldn't fill the screen. */
const FIT_SPAN = 0.004;
const CORNER = "corner:";

const at = ([lng, lat]: LngLat) => Cartesian3.fromDegrees(lng, lat);

export default function BoundaryEditor({ value, onChange, center }: {
  value: LngLat[];
  onChange: (ring: LngLat[]) => void;
  /** The farm's GPS pin, if known: the map starts there. */
  center?: { lat: number; lng: number } | null;
}) {
  const t = useT();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapHandle | null>(null);
  const shape = useRef<Entity | null>(null);
  const corners = useRef<Entity[]>([]);
  // The ring as drawn: runs ahead of `value` while a corner is being dragged.
  const ring = useRef<LngLat[]>(value);
  // Cesium handlers are bound once; they read the latest ring and callback through refs.
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const [gps, setGps] = useState<"idle" | "busy" | "failed">("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const add = (lng: number, lat: number) => {
    const prev = latest.current.value;
    if (prev.length >= MAX_CORNERS) return;
    latest.current.onChange([...prev, [round6(lng), round6(lat)]]);
  };

  useEffect(() => {
    if (!el.current) return;
    // Drawing is done looking straight down, so tilting is off.
    const handle = createMap(el.current, { tilt: false });
    const { viewer } = handle;
    const scene = viewer.scene;
    const start = latest.current.value[0];
    const [lng, lat] = start ?? (center ? [center.lng, center.lat] : DEFAULT_VIEW);
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(lng, lat, start || center ? HEIGHT.farm : HEIGHT.country) });
    // A fitted boundary is the best starting view when editing one.
    if (latest.current.value.length >= 3) viewer.camera.setView({ destination: rectangle(boundsOf(latest.current.value), 0.15, FIT_SPAN) });

    shape.current = viewer.entities.add({
      polygon: {
        show: new CallbackProperty(() => ring.current.length >= 3, false),
        hierarchy: new CallbackProperty(() => new PolygonHierarchy(ring.current.map(at)), false),
        material: color("var(--green-400)", 0.35),
      },
      polyline: {
        show: new CallbackProperty(() => ring.current.length >= 2, false),
        positions: new CallbackProperty(() => [...ring.current, ...ring.current.slice(0, 1)].map(at), false),
        clampToGround: true,
        width: 2,
        material: color("var(--surface)"),
      },
    });

    // Tap to add a corner; press and drag a corner to move it.
    const input = new ScreenSpaceEventHandler(scene.canvas);
    const cornerAt = (pos: Cartesian2) => {
      const id = (scene.pick(pos) as { id?: Entity } | undefined)?.id?.id;
      return id?.startsWith(CORNER) ? Number(id.slice(CORNER.length)) : null;
    };
    let dragging: number | null = null;
    let dragged = false;
    input.setInputAction((e: { position: Cartesian2 }) => {
      dragging = cornerAt(e.position);
      if (dragging === null) return;
      scene.screenSpaceCameraController.enableInputs = false;
      scene.canvas.style.cursor = "grabbing";
    }, ScreenSpaceEventType.LEFT_DOWN);
    input.setInputAction((e: { endPosition: Cartesian2 }) => {
      if (dragging === null) {
        scene.canvas.style.cursor = cornerAt(e.endPosition) === null ? "" : "grab";
        return;
      }
      const p = lngLatAt(viewer, e.endPosition);
      if (!p) return;
      dragged = true;
      ring.current = ring.current.map((c, i) => (i === dragging ? p : c));
      (corners.current[dragging]?.position as ConstantPositionProperty | undefined)?.setValue(at(p));
      scene.requestRender();
    }, ScreenSpaceEventType.MOUSE_MOVE);
    input.setInputAction(() => {
      if (dragging === null) return;
      dragging = null;
      scene.screenSpaceCameraController.enableInputs = true;
      scene.canvas.style.cursor = "";
      if (dragged) latest.current.onChange(ring.current.map(([lng, lat]) => [round6(lng), round6(lat)]));
    }, ScreenSpaceEventType.LEFT_UP);
    input.setInputAction((e: { position: Cartesian2 }) => {
      // The click that ends a drag, or one on a corner, doesn't add a corner.
      if (dragged || cornerAt(e.position) !== null) {
        dragged = false;
        return;
      }
      const p = lngLatAt(viewer, e.position);
      if (p) add(p[0], p[1]);
    }, ScreenSpaceEventType.LEFT_CLICK);

    map.current = handle;
    return () => {
      input.destroy();
      viewer.destroy();
      map.current = null;
      shape.current = null;
      corners.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A GPS fix that arrives after the map opened: go there, unless drawing has started.
  useEffect(() => {
    if (center && !latest.current.value.length) map.current?.viewer.camera.setView({ destination: Cartesian3.fromDegrees(center.lng, center.lat, HEIGHT.farm) });
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw the shape and its draggable corners.
  useEffect(() => {
    ring.current = value;
    const viewer = map.current?.viewer;
    if (!viewer || !shape.current) return;
    const problem = boundaryProblem(value);
    shape.current.polygon!.material = new ColorMaterialProperty(color(problem === "crosses" ? "var(--terracotta)" : "var(--green-400)", 0.35));
    for (const c of corners.current) viewer.entities.remove(c);
    corners.current = value.map((p, i) =>
      viewer.entities.add({
        id: `${CORNER}${i}`,
        position: new ConstantPositionProperty(at(p)),
        point: {
          pixelSize: 16,
          color: color(i === 0 ? "var(--lavender)" : "var(--green-600)"),
          outlineColor: color("#fff"),
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          // Always on top of the imagery and the shape.
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }),
    );
    viewer.scene.requestRender();
  }, [value]);

  const addAtCentre = () => {
    const c = map.current && centre(map.current.viewer);
    if (c) add(c[0], c[1]);
  };

  const addHere = () => {
    if (!navigator.geolocation) return setGps("failed");
    setGps("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        add(pos.coords.longitude, pos.coords.latitude);
        setAccuracy(Math.round(pos.coords.accuracy));
        const viewer = map.current?.viewer;
        viewer?.camera.setView({ destination: Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude, Math.min(altitude(viewer), HEIGHT.farm)) });
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
        <div ref={el} className="boundary-globe" role="application" aria-label={t("boundary.mapLabel")} />
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
