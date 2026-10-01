import { useQuery } from "@tanstack/react-query";
import {
  Cartesian3,
  ColorMaterialProperty,
  ConstantProperty,
  HeightReference,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Cartesian2,
  type Entity,
} from "cesium";
import { ArrowLeft, ExternalLink, MapPin, MapPinOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/api/endpoints";
import type { StaffAnalytics, StaffMapFarm } from "@/api/types";
import { altitude, boundsOf, color, createMap, HEIGHT, rectangle, type MapHandle } from "@/components/map/cesium";
import { Button } from "@/components/ui/Button";
import { Chip, ErrorState, SkeletonRows } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useAdminSession } from "@/stores/adminSession";
import { AFRICA, AFRICA_BOUNDS, EMPTY, bands, loadShapes, mainBounds, polygons, shade, useCount, useCountryName, type CountryShape, type Ring } from "./geo";

/*
 * The staff map: Africa shaded by farm accounts per country, on a Cesium
 * globe. Click a country to fly in and see its farms; click a farm to fly to
 * it over satellite imagery. Loaded lazily (Cesium is only needed here).
 */

type Country = StaffAnalytics["countries"][number];
interface View {
  country: string | null;
  farmId: string | null;
}
/** What an entity on the map stands for: what clicking it selects, and its tooltip. */
interface Target {
  country?: string;
  farmId?: string;
  tip: () => HTMLElement;
}

/** Below this camera height (a few hundred km across) the satellite imagery shows and countries turn into outlines. */
const DETAIL_HEIGHT = 500_000;
/** The narrowest fitted views, in degrees: a farm (~450 m) and a country (~1,000 km). */
const FARM_SPAN = 0.004;
const COUNTRY_SPAN = 4;
const whole = (v: number) => v.toLocaleString("en");
/** Countries whose main island is smaller than this (degrees across) also get a dot, or nobody could click them. */
const TINY_DEGREES = 1;
/** Ground layers, bottom to top: country fills, country edges, the selected country's edge, farm fills, farm edges. */
const Z = { fill: 0, edge: 1, selected: 2, farm: 3, farmEdge: 4 };

const positions = (ring: Ring) => ring.map(([lng, lat]) => Cartesian3.fromDegrees(lng, lat));

/** Tooltips are built from text so farm names can't inject markup. */
function tip(title: string, line?: string): HTMLElement {
  const el = document.createElement("span");
  const b = document.createElement("strong");
  b.textContent = title;
  el.append(b);
  if (line) el.append(document.createElement("br"), document.createTextNode(line));
  return el;
}

export default function AfricaMap({ rows }: { rows: Country[] }) {
  const t = useT();
  const countryName = useCountryName();
  const count = useCount();
  const staffId = useAdminSession((s) => s.user?.id);
  const el = useRef<HTMLDivElement>(null);
  const tipEl = useRef<HTMLDivElement>(null);
  const map = useRef<MapHandle | null>(null);
  // Entities by country code: fills (hidden over satellite), edges, and a dot for tiny islands.
  const countryEntities = useRef(new Map<string, { fills: Entity[]; edges: Entity[] }>());
  const farmEntities = useRef<Entity[]>([]);
  const targets = useRef(new Map<Entity, Target>());
  const [shapes, setShapes] = useState<CountryShape[] | null>(null);
  const [view, setView] = useState<View>({ country: null, farmId: null });
  const [detail, setDetail] = useState(false);

  const byCode = useMemo(() => new Map(rows.map((r) => [r.country, r])), [rows]);
  const ranges = useMemo(() => bands(Math.max(0, ...rows.map((r) => r.organisations))), [rows]);
  const shapeByCode = useMemo(() => new Map((shapes ?? []).map((s) => [s.properties.code, s])), [shapes]);

  const farmsQ = useQuery({
    queryKey: ["admin", staffId, "map-farms", view.country],
    queryFn: () => api.staff.mapFarms(view.country!),
    enabled: !!view.country,
    staleTime: 5 * 60_000,
  });
  const farms = useMemo(
    () => (view.country && farmsQ.data?.country === view.country ? farmsQ.data.farms : []),
    [view.country, farmsQ.data],
  );
  const farm = farms.find((f) => f.id === view.farmId) ?? null;

  // The map itself: created once.
  useEffect(() => {
    if (!el.current) return;
    const handle = createMap(el.current);
    const { viewer } = handle;
    const scene = viewer.scene;
    viewer.camera.setView({ destination: rectangle(AFRICA_BOUNDS, 0) });
    viewer.camera.percentageChanged = 0.05;
    const onMove = () => setDetail(altitude(viewer) < DETAIL_HEIGHT);
    const stopWatching = viewer.camera.changed.addEventListener(onMove);
    onMove();

    const targetAt = (pos: Cartesian2) => {
      const picked = scene.pick(pos) as { id?: Entity } | undefined;
      return picked?.id ? targets.current.get(picked.id) : undefined;
    };
    const input = new ScreenSpaceEventHandler(scene.canvas);
    input.setInputAction((e: { endPosition: Cartesian2 }) => {
      const box = tipEl.current;
      const target = targetAt(e.endPosition);
      // Over satellite imagery the country labels only get in the way of the farms.
      const show = target && !(target.country && altitude(viewer) < DETAIL_HEIGHT);
      scene.canvas.style.cursor = target ? "pointer" : "";
      if (!box) return;
      box.hidden = !show;
      if (!show) return;
      box.replaceChildren(target.tip());
      box.style.transform = `translate(${e.endPosition.x + 14}px, ${e.endPosition.y + 14}px)`;
    }, ScreenSpaceEventType.MOUSE_MOVE);
    input.setInputAction((e: { position: Cartesian2 }) => {
      const target = targetAt(e.position);
      if (target?.farmId) setView((v) => ({ country: v.country, farmId: target.farmId! }));
      // Zoomed in over satellite, a click is for farms, not for choosing a country again.
      else if (target?.country && altitude(viewer) >= DETAIL_HEIGHT) setView({ country: target.country, farmId: null });
    }, ScreenSpaceEventType.LEFT_CLICK);

    map.current = handle;
    let live = true;
    loadShapes().then((s) => live && setShapes(s));
    return () => {
      live = false;
      stopWatching();
      input.destroy();
      viewer.destroy();
      map.current = null;
      countryEntities.current.clear();
      farmEntities.current = [];
      targets.current.clear();
    };
  }, []);

  // Countries, shaded by farm accounts. Rebuilt when the numbers or language change.
  useEffect(() => {
    const viewer = map.current?.viewer;
    if (!viewer || !shapes) return;
    for (const { fills, edges } of countryEntities.current.values()) {
      for (const e of [...fills, ...edges]) {
        viewer.entities.remove(e);
        targets.current.delete(e);
      }
    }
    countryEntities.current.clear();
    for (const s of shapes) {
      const code = s.properties.code;
      const r = byCode.get(code);
      const target: Target = {
        country: code,
        tip: () => tip(countryName(code), r ? `${count("accounts", r.organisations)}, ${count("farmers", r.farmers)}` : t("admin.map.none")),
      };
      const fills: Entity[] = [];
      const edges: Entity[] = [];
      for (const [outer, ...holes] of polygons(s)) {
        fills.push(viewer.entities.add({
          polygon: {
            hierarchy: new PolygonHierarchy(positions(outer!), holes.map((h) => new PolygonHierarchy(positions(h)))),
            zIndex: Z.fill,
          },
        }));
        edges.push(viewer.entities.add({ polyline: { positions: positions(outer!), clampToGround: true, zIndex: Z.edge } }));
      }
      // Island states with farm accounts get a dot too; Mauritius is a few pixels across at this scale.
      const [[south, west], [north, east]] = mainBounds(s);
      if (r && Math.max(north - south, east - west) < TINY_DEGREES) {
        fills.push(viewer.entities.add({
          position: Cartesian3.fromDegrees((west + east) / 2, (south + north) / 2),
          point: {
            pixelSize: 12,
            color: color(shade(r.organisations, ranges)),
            outlineColor: color("var(--surface)"),
            outlineWidth: 2,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        }));
      }
      for (const e of [...fills, ...edges]) targets.current.set(e, target);
      countryEntities.current.set(code, { fills, edges });
    }
    viewer.scene.requestRender();
  }, [shapes, byCode, countryName, count, ranges, t]);

  // Country styles follow the camera (outlines over satellite) and the selection.
  useEffect(() => {
    const handle = map.current;
    if (!handle) return;
    for (const layer of handle.imagery) layer.show = detail;
    for (const [code, { fills, edges }] of countryEntities.current) {
      const selected = code === view.country;
      for (const f of fills) {
        if (f.polygon) {
          f.polygon.show = new ConstantProperty(!detail);
          f.polygon.material = new ColorMaterialProperty(color(shade(byCode.get(code)?.organisations ?? 0, ranges)));
        }
      }
      for (const e of edges) {
        e.polyline!.material = new ColorMaterialProperty(color(selected ? "var(--text)" : "var(--surface)", detail && !selected ? 0.6 : 1));
        e.polyline!.width = new ConstantProperty(selected ? 2 : detail ? 1.5 : 1);
        e.polyline!.zIndex = new ConstantProperty(selected ? Z.selected : Z.edge);
      }
    }
    handle.viewer.scene.requestRender();
  }, [detail, view.country, byCode, ranges, shapes]);

  // Farm dots for the chosen country.
  useEffect(() => {
    const viewer = map.current?.viewer;
    if (!viewer) return;
    for (const e of farmEntities.current) {
      viewer.entities.remove(e);
      targets.current.delete(e);
    }
    farmEntities.current = [];
    for (const f of farms) {
      if (!f.location) continue;
      const selected = f.id === view.farmId;
      const sub = [f.county, f.organisation.name !== f.name ? f.organisation.name : ""].filter(Boolean).join(" · ");
      const target: Target = { farmId: f.id, tip: () => tip(f.name, sub) };
      const added: Entity[] = [];
      // The farmer's drawn boundary, visible once zoomed in far enough to matter.
      if (f.boundary) {
        const ring = f.boundary.coordinates[0]!;
        added.push(viewer.entities.add({
          polygon: { hierarchy: new PolygonHierarchy(positions(ring)), material: color("var(--lavender)", selected ? 0.15 : 0.05), zIndex: Z.farm },
        }));
        added.push(viewer.entities.add({
          polyline: {
            positions: positions([...ring, ring[0]!]),
            clampToGround: true,
            width: selected ? 3 : 2,
            material: color(selected ? "var(--lavender)" : "var(--surface)"),
            zIndex: Z.farmEdge,
          },
        }));
      }
      added.push(viewer.entities.add({
        position: Cartesian3.fromDegrees(f.location.lng, f.location.lat),
        point: {
          pixelSize: selected ? 20 : 14,
          color: color(selected ? "var(--lavender)" : "var(--surface)"),
          outlineColor: color("var(--text)"),
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }));
      for (const e of added) targets.current.set(e, target);
      farmEntities.current.push(...added);
    }
    viewer.scene.requestRender();
  }, [farms, view.farmId]);

  // Fly the camera when the selection changes.
  useEffect(() => {
    const camera = map.current?.viewer.camera;
    if (!camera) return;
    if (farm?.boundary) {
      camera.flyTo({ destination: rectangle(boundsOf(farm.boundary.coordinates[0]!), 0.15, FARM_SPAN), duration: 1.2 });
    } else if (farm?.location) {
      camera.flyTo({ destination: Cartesian3.fromDegrees(farm.location.lng, farm.location.lat, HEIGHT.farmArea), duration: 1.2 });
    } else if (view.country && !view.farmId) {
      const s = shapeByCode.get(view.country);
      if (s) camera.flyTo({ destination: rectangle(mainBounds(s), 0.05, COUNTRY_SPAN), duration: 0.8 });
    } else if (!view.country) {
      camera.flyTo({ destination: rectangle(AFRICA_BOUNDS, 0), duration: 0.8 });
    }
  }, [view.country, view.farmId, farm, shapeByCode]);

  const selected = view.country ? byCode.get(view.country) : undefined;
  const located = farms.filter((f) => f.location).length;

  return (
    <div className="farm-map">
      <div className="farm-map-canvas">
        <div ref={el} className="farm-map-globe" role="region" aria-label={t("admin.map.title")} />
        <div ref={tipEl} className="map-tip" role="tooltip" hidden />
        {!shapes && <div className="farm-map-loading" aria-busy="true" />}
        {!detail && (
          <ul className="map-legend list-plain" aria-label={t("admin.map.legend")}>
            <li><i style={{ background: EMPTY }} />{t("admin.map.none")}</li>
            {ranges.map(([lo, hi]) => (
              <li key={lo}><i style={{ background: shade(lo, ranges) }} />{lo === hi ? lo : `${lo}–${hi}`}</li>
            ))}
          </ul>
        )}
      </div>

      <aside className="farm-map-side" aria-live="polite">
        {!view.country ? (
          <>
            <p className="farm-map-kicker">{t("admin.map.top")}</p>
            <p className="small muted">{t("admin.map.pickCountry")}</p>
            <ul className="list-plain farm-map-list">
              {rows.filter((r) => AFRICA.has(r.country)).map((r) => (
                <li key={r.country}>
                  <button type="button" onClick={() => setView({ country: r.country, farmId: null })}>
                    <span className="map-swatch" style={{ background: shade(r.organisations, ranges) }} aria-hidden />
                    <span className="grow">{countryName(r.country)}</span>
                    <span className="num small muted">{count("accounts", r.organisations)} · {count("farms", r.farms)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : !farm ? (
          <>
            <Button variant="quiet" size="sm" className="flush" icon={<ArrowLeft size={16} aria-hidden />} onClick={() => setView({ country: null, farmId: null })}>
              {t("admin.map.allAfrica")}
            </Button>
            <h3 className="farm-map-title">{countryName(view.country)}</h3>
            <p className="small muted">
              {selected
                ? `${count("accounts", selected.organisations)}, ${count("farmers", selected.farmers)}, ${count("farms", selected.farms)}.`
                : t("admin.map.none")}
            </p>
            {farmsQ.isLoading ? (
              <SkeletonRows rows={4} height={44} />
            ) : farmsQ.error ? (
              <ErrorState error={farmsQ.error} onRetry={() => farmsQ.refetch()} />
            ) : !farms.length ? (
              <p className="small muted">{t("admin.map.noFarms", { country: countryName(view.country) })}</p>
            ) : (
              <>
                {located < farms.length && <p className="small muted">{t("admin.map.unlocated", { n: farms.length - located })}</p>}
                <ul className="list-plain farm-map-list">
                  {farms.map((f) => (
                    <li key={f.id}>
                      <button type="button" disabled={!f.location} onClick={() => setView({ country: view.country, farmId: f.id })}>
                        {f.location ? <MapPin size={16} aria-hidden /> : <MapPinOff size={16} aria-hidden />}
                        <span className="grow farm-map-name">
                          <span className="strong">{f.name}</span>
                          <span className="small muted">{[f.county, f.owner?.name].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {farmsQ.data?.truncated && <p className="small muted">{t("admin.map.truncated", { n: whole(farms.length) })}</p>}
              </>
            )}
          </>
        ) : (
          <FarmDetail farm={farm} country={countryName(view.country)} onBack={() => setView({ country: view.country, farmId: null })} />
        )}
      </aside>
    </div>
  );
}

function FarmDetail({ farm, country, onBack }: { farm: StaffMapFarm; country: string; onBack: () => void }) {
  const t = useT();
  const loc = farm.location!;
  return (
    <>
      <Button variant="quiet" size="sm" className="flush" icon={<ArrowLeft size={16} aria-hidden />} onClick={onBack}>
        {country}
      </Button>
      <h3 className="farm-map-title">{farm.name}</h3>
      {!farm.setup_complete && <Chip tone="amber">{t("admin.map.setupPending")}</Chip>}
      <dl className="farm-map-facts">
        <dt>{t("admin.col.account")}</dt>
        <dd>{farm.organisation.name}</dd>
        {farm.owner && (
          <>
            <dt>{t("admin.col.owner")}</dt>
            <dd>{farm.owner.name || "–"}<br /><span className="muted">{formatPhone(farm.owner.phone)}</span></dd>
          </>
        )}
        {farm.county && (
          <>
            <dt>{t("admin.map.county")}</dt>
            <dd>{farm.county}</dd>
          </>
        )}
        {farm.area_ha && (
          <>
            <dt>{t("admin.map.area")}</dt>
            <dd>
              {t("boundary.area", { acres: (Number(farm.area_ha) * 2.4710538).toFixed(2), ha: Number(farm.area_ha).toFixed(2) })}
              {farm.weather_sync && farm.weather_sync.status !== "none" && (
                <><br /><span className="muted">{t(`boundary.sync.${farm.weather_sync.status}`)}{farm.weather_sync.scaled && farm.weather_sync.status === "registered" ? ` ${t("admin.map.scaled")}` : ""}</span></>
              )}
            </dd>
          </>
        )}
        <dt>{t("admin.map.coordinates")}</dt>
        <dd className="num">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</dd>
        <dt>{t("admin.col.created")}</dt>
        <dd>{formatDate(farm.created_at, t.locale)}</dd>
      </dl>
      <a className="btn btn-secondary btn-sm" href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer">
        <ExternalLink size={16} aria-hidden /> {t("admin.map.openGoogle")}
      </a>
    </>
  );
}
