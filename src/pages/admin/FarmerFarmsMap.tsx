import { Cartesian2, Cartesian3, HeightReference, LabelStyle, PolygonHierarchy, ScreenSpaceEventHandler, ScreenSpaceEventType, type Entity } from "cesium";
import { useEffect, useRef } from "react";
import type { Farm } from "@/api/types";
import { boundsOf, color, createMap, HEIGHT, rectangle, type MapHandle } from "@/components/map/cesium";
import { useT } from "@/i18n";

/*
 * One farmer's farms over satellite imagery, on the staff farmer page: drawn
 * boundaries where the farmer drew them, pins elsewhere. Opens framed on all
 * of them; choosing a farm (here or in the list) flies to it. Loaded lazily.
 */

/** The narrowest fitted view, in degrees (~450 m). */
const FARM_SPAN = 0.004;

export default function FarmerFarmsMap({ farms, selected, onSelect }: {
  farms: Pick<Farm, "id" | "name" | "location" | "boundary">[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapHandle | null>(null);
  const ids = useRef(new Map<Entity, string>());
  const latest = useRef(onSelect);
  latest.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const handle = createMap(el.current);
    const scene = handle.viewer.scene;
    const input = new ScreenSpaceEventHandler(scene.canvas);
    input.setInputAction((e: { position: Cartesian2 }) => {
      const picked = scene.pick(e.position) as { id?: Entity } | undefined;
      const id = picked?.id && ids.current.get(picked.id);
      if (id) latest.current(id);
    }, ScreenSpaceEventType.LEFT_CLICK);
    input.setInputAction((e: { endPosition: Cartesian2 }) => {
      const picked = scene.pick(e.endPosition) as { id?: Entity } | undefined;
      scene.canvas.style.cursor = picked?.id && ids.current.has(picked.id) ? "pointer" : "";
    }, ScreenSpaceEventType.MOUSE_MOVE);
    map.current = handle;
    return () => {
      input.destroy();
      handle.viewer.destroy();
      map.current = null;
      ids.current.clear();
    };
  }, []);

  // Pins and boundaries, redrawn when the farms or the selection change.
  useEffect(() => {
    const viewer = map.current?.viewer;
    if (!viewer) return;
    viewer.entities.removeAll();
    ids.current.clear();
    for (const f of farms) {
      const on = f.id === selected;
      const ring = f.boundary?.coordinates[0];
      if (ring) {
        const positions = ring.map(([lng, lat]) => Cartesian3.fromDegrees(lng, lat));
        ids.current.set(viewer.entities.add({
          polygon: { hierarchy: new PolygonHierarchy(positions), material: color("var(--lavender)", on ? 0.3 : 0.15), zIndex: 0 },
        }), f.id);
        ids.current.set(viewer.entities.add({
          polyline: { positions: [...positions, positions[0]!], clampToGround: true, width: on ? 3 : 2, material: color(on ? "var(--lavender)" : "var(--surface)"), zIndex: 1 },
        }), f.id);
      }
      if (f.location) {
        ids.current.set(viewer.entities.add({
          position: Cartesian3.fromDegrees(f.location.lng, f.location.lat),
          point: {
            pixelSize: on ? 18 : 13,
            color: color(on ? "var(--lavender)" : "var(--surface)"),
            outlineColor: color("var(--text)"),
            outlineWidth: 2,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: f.name,
            font: "600 13px system-ui, sans-serif",
            fillColor: color("#fff"),
            outlineColor: color("#000", 0.8),
            outlineWidth: 3,
            style: LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cartesian2(0, -20),
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }), f.id);
      }
    }
    viewer.scene.requestRender();
  }, [farms, selected]);

  // Frame every farm, or fly to the chosen one.
  useEffect(() => {
    const camera = map.current?.viewer.camera;
    if (!camera) return;
    const farm = farms.find((f) => f.id === selected);
    const points = (farm ? [farm] : farms).flatMap((f) =>
      f.boundary?.coordinates[0] ?? (f.location ? [[f.location.lng, f.location.lat] as [number, number]] : []),
    );
    if (!points.length) return;
    if (points.length === 1) camera.flyTo({ destination: Cartesian3.fromDegrees(points[0]![0], points[0]![1], HEIGHT.farmArea), duration: farm ? 1.2 : 0 });
    else camera.flyTo({ destination: rectangle(boundsOf(points), 0.2, FARM_SPAN), duration: farm ? 1.2 : 0 });
  }, [farms, selected]);

  return <div ref={el} className="farmer-map" role="region" aria-label={t("admin.farmer.mapLabel")} />;
}
