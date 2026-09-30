import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { ArrowLeft, ExternalLink, MapPin, MapPinOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/api/endpoints";
import type { StaffAnalytics, StaffMapFarm } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { token } from "@/components/ui/charts";
import { Chip, ErrorState, SkeletonRows } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useAdminSession } from "@/stores/adminSession";
import { AFRICA, AFRICA_BOUNDS, EMPTY, bands, loadShapes, mainBounds, shade, useCount, useCountryName, type CountryShape } from "./geo";

/*
 * The staff map: Africa shaded by farm accounts per country. Click a country
 * to zoom in and see its farms; click a farm to zoom to it over satellite
 * imagery. Loaded lazily (Leaflet is only needed here).
 */

type Country = StaffAnalytics["countries"][number];
interface View {
  country: string | null;
  farmId: string | null;
}

/** From this zoom the satellite imagery shows and countries turn into outlines. */
const DETAIL_ZOOM = 8;
const FARM_ZOOM = 16;
const whole = (v: number) => v.toLocaleString("en");
/** Countries whose main island is smaller than this (degrees across) also get a dot, or nobody could click them. */
const TINY_DEGREES = 1;

/** Leaflet tooltips take HTML; build them from text so farm names can't inject markup. */
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
  const map = useRef<L.Map | null>(null);
  const countryLayer = useRef<L.GeoJSON | null>(null);
  const farmLayer = useRef<L.LayerGroup | null>(null);
  const [shapes, setShapes] = useState<CountryShape[] | null>(null);
  const [view, setView] = useState<View>({ country: null, farmId: null });
  const [zoom, setZoom] = useState(0);

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
    const m = L.map(el.current, { zoomSnap: 0.25, minZoom: 2, maxZoom: 18 });
    m.fitBounds(AFRICA_BOUNDS);
    // Satellite imagery and place names, only once zoomed in close enough to see farms.
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      minZoom: DETAIL_ZOOM,
      maxZoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    }).addTo(m);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      minZoom: DETAIL_ZOOM,
      maxZoom: 19,
    }).addTo(m);
    // Farms get their own pane above the countries, so a highlighted country never covers them.
    m.createPane("farms").style.zIndex = "450";
    farmLayer.current = L.layerGroup().addTo(m);
    const onZoom = () => setZoom(m.getZoom());
    m.on("zoomend", onZoom);
    onZoom();
    map.current = m;
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el.current);
    let live = true;
    loadShapes().then((s) => live && setShapes(s));
    return () => {
      live = false;
      resize.disconnect();
      m.remove();
      map.current = null;
      countryLayer.current = null;
      farmLayer.current = null;
    };
  }, []);

  // Countries, shaded by farm accounts. Rebuilt when the numbers or language change.
  useEffect(() => {
    const m = map.current;
    if (!m || !shapes) return;
    countryLayer.current?.remove();
    const layer = L.geoJSON(shapes as unknown as GeoJSON.FeatureCollection, {
      onEachFeature: (f, lyr) => {
        const code = (f as unknown as CountryShape).properties.code;
        const r = byCode.get(code);
        lyr.bindTooltip(
          () => tip(countryName(code), r ? `${count("accounts", r.organisations)}, ${count("farmers", r.farmers)}` : t("admin.map.none")),
          { sticky: true, className: "leaflet-tip country-tip" },
        );
        // Zoomed in over satellite, a click is for farms, not for choosing a country again.
        lyr.on("click", () => m.getZoom() < DETAIL_ZOOM && setView({ country: code, farmId: null }));
      },
    }).addTo(m);
    layer.bringToBack();
    // Island states with farm accounts get a dot too; Mauritius is a few pixels across at this scale.
    for (const s of shapes) {
      const r = byCode.get(s.properties.code);
      const [[south, west], [north, east]] = mainBounds(s);
      if (!r || Math.max(north - south, east - west) >= TINY_DEGREES) continue;
      const dot = L.circleMarker([(south + north) / 2, (west + east) / 2], {
        radius: 6, weight: 2, color: token("var(--surface)"), fillColor: token(shade(r.organisations, ranges)), fillOpacity: 1,
      });
      dot.bindTooltip(() => tip(countryName(s.properties.code), `${count("accounts", r.organisations)}, ${count("farmers", r.farmers)}`), { sticky: true, className: "leaflet-tip country-tip" });
      dot.on("click", () => m.getZoom() < DETAIL_ZOOM && setView({ country: s.properties.code, farmId: null }));
      layer.addLayer(dot);
    }
    countryLayer.current = layer;
  }, [shapes, byCode, countryName, count, ranges, t]);

  // Country styles follow the zoom (outlines over satellite) and the selection.
  useEffect(() => {
    const layer = countryLayer.current;
    if (!layer) return;
    const detail = zoom >= DETAIL_ZOOM;
    layer.setStyle((f) => {
      const code = (f as unknown as CountryShape | undefined)?.properties.code ?? "";
      const selected = code === view.country;
      return {
        fillColor: token(shade(byCode.get(code)?.organisations ?? 0, ranges)),
        fillOpacity: detail ? 0 : 1,
        color: token(selected ? "var(--text)" : "var(--surface)"),
        weight: selected ? 2 : detail ? 1.5 : 0.8,
        opacity: detail && !selected ? 0.6 : 1,
      };
    });
    layer.eachLayer((l) => {
      if ((l as L.Path & { feature?: CountryShape }).feature?.properties.code === view.country) (l as L.Path).bringToFront();
    });
  }, [zoom, view.country, byCode, ranges, shapes]);

  // Farm dots for the chosen country.
  useEffect(() => {
    const group = farmLayer.current;
    if (!group) return;
    group.clearLayers();
    for (const f of farms) {
      if (!f.location) continue;
      const selected = f.id === view.farmId;
      const dot = L.circleMarker([f.location.lat, f.location.lng], {
        pane: "farms",
        radius: selected ? 10 : 7,
        color: token("var(--text)"),
        weight: 2,
        fillColor: token(selected ? "var(--lavender)" : "var(--surface)"),
        fillOpacity: 1,
      });
      const sub = [f.county, f.organisation.name !== f.name ? f.organisation.name : ""].filter(Boolean).join(" · ");
      dot.bindTooltip(() => tip(f.name, sub), { className: "leaflet-tip", direction: "top", offset: [0, -8] });
      dot.on("click", () => setView((v) => ({ country: v.country, farmId: f.id })));
      group.addLayer(dot);
    }
  }, [farms, view.farmId]);

  // Move the camera when the selection changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (farm?.location) {
      m.flyTo([farm.location.lat, farm.location.lng], FARM_ZOOM, { duration: 1.2 });
    } else if (view.country && !view.farmId) {
      const s = shapeByCode.get(view.country);
      if (s) m.flyToBounds(mainBounds(s), { padding: [24, 24], maxZoom: 7, duration: 0.8 });
    } else if (!view.country) {
      m.flyToBounds(AFRICA_BOUNDS, { duration: 0.8 });
    }
  }, [view.country, view.farmId, farm, shapeByCode]);

  const selected = view.country ? byCode.get(view.country) : undefined;
  const located = farms.filter((f) => f.location).length;

  return (
    <div className="farm-map">
      <div className={zoom >= DETAIL_ZOOM ? "farm-map-canvas detail" : "farm-map-canvas"}>
        <div ref={el} className="farm-map-leaflet" role="region" aria-label={t("admin.map.title")} />
        {!shapes && <div className="farm-map-loading" aria-busy="true" />}
        {zoom < DETAIL_ZOOM && (
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
