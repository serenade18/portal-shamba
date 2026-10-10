import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import * as api from "@/api/endpoints";
import { useFarm, useKey } from "@/api/hooks";
import type { CropHealth, CropHealthBand, Farm, SatelliteScene } from "@/api/types";
import { BarsChart, ChartFrame } from "@/components/ui/charts";
import { KpiRow, PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, Notice, Skeleton, type Tone } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

const BAND_TONE: Record<CropHealthBand, Tone> = { bare: "terracotta", poor: "amber", fair: "lavender", good: "health" };
type Layer = "ndvi" | "truecolor";

/** A scene's PNG, fetched with the signed-in headers. */
function useSceneImage(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    setUrl(null);
    setFailed(false);
    if (path) {
      api.cropHealth.image(path).then(
        (u) => (live ? setUrl((made = u)) : u.startsWith("blob:") && URL.revokeObjectURL(u)),
        () => live && setFailed(true),
      );
    }
    return () => {
      live = false;
      if (made?.startsWith("blob:")) URL.revokeObjectURL(made);
    };
  }, [path]);
  return { url, failed };
}

const M_PER_DEG = 111_320;

/**
 * The scene laid over the farm: the image fills the bounds it was taken for, the drawn
 * boundary on top. Equirectangular in metres, scaled by latitude: true enough at farm size
 * (and browsers draw images badly in a viewBox only thousandths of a unit wide).
 */
function SceneMap({ scene, layer, bounds, farm }: { scene: SatelliteScene; layer: Layer; bounds: NonNullable<CropHealth["bounds"]>; farm: Farm }) {
  const t = useT();
  const { url, failed } = useSceneImage(scene.images[layer]);
  const [west, south, east, north] = bounds;
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180) * M_PER_DEG;
  const w = (east - west) * k;
  const h = (north - south) * M_PER_DEG;
  const pad = Math.max(w, h) * 0.04;
  const ring = farm.boundary?.coordinates[0] ?? [];
  const points = ring.map(([lng, lat]) => `${(lng - west) * k},${(north - lat) * M_PER_DEG}`).join(" ");
  return (
    <div className="crop-map">
      <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} role="img" aria-label={t("crop.mapLabel", { date: formatDate(scene.date, t.locale) })}>
        <rect x={-pad} y={-pad} width={w + 2 * pad} height={h + 2 * pad} style={{ fill: "var(--surface-2, #eef1ec)" }} />
        {url && <image href={url} x={0} y={0} width={w} height={h} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />}
        {points && <polygon points={points} fill="none" stroke="#fff" strokeWidth={Math.max(w, h) * 0.008} strokeLinejoin="round" />}
        {points && <polygon points={points} fill="none" style={{ stroke: "var(--green-700, #1f382c)" }} strokeWidth={Math.max(w, h) * 0.004} strokeLinejoin="round" />}
      </svg>
      {!url && !failed && <Skeleton height={8} width="40%" style={{ position: "absolute", left: "30%", top: "50%" }} />}
      {failed && <p className="small muted crop-map-note">{t("crop.imageFailed")}</p>}
    </div>
  );
}

function Legend() {
  const t = useT();
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div aria-hidden style={{ height: 10, borderRadius: 5, background: "linear-gradient(90deg, #a50026, #f46d43, #fee08b, #a6d96a, #1a9850, #006837)" }} />
      <div className="spread small muted">
        <span>{t("crop.band.bare")}</span>
        <span>{t("crop.band.poor")}</span>
        <span>{t("crop.band.fair")}</span>
        <span>{t("crop.band.good")}</span>
      </div>
    </div>
  );
}

function bandChip(t: ReturnType<typeof useT>, s: SatelliteScene) {
  return s.health ? <Chip tone={BAND_TONE[s.health]}>{t(`crop.band.${s.health}`)}</Chip> : "–";
}

/** Why there is nothing to show, and what to do about it. */
function NotReady({ status }: { status: CropHealth["status"] }) {
  const t = useT();
  const text = t(`crop.status.${status as Exclude<CropHealth["status"], "ready">}`);
  return (
    <div className="panel">
      <EmptyState text={text} action={status === "no_boundary" ? <Link to="/settings?tab=farm" className="btn btn-primary">{t("crop.drawBoundary")}</Link> : undefined} />
    </div>
  );
}

/** How green the farm's crops are from satellite images (NDVI), and how that is changing (CRP-05). */
export function CropHealthPage() {
  const t = useT();
  const key = useKey();
  const { farm } = useFarm();
  const q = useQuery({ queryKey: key("crop-health", farm?.id), queryFn: () => api.cropHealth.get(farm!.id), enabled: !!farm });
  const [chosen, setChosen] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("ndvi");
  const c = q.data;
  const scene = c?.scenes.find((s) => s.id === chosen) ?? c?.scenes[0] ?? null;
  const latest = c?.latest;
  // Charted ×100: the bar chart's axis counts in whole numbers.
  const history = (c?.scenes ?? []).slice().reverse().map((s) => ({ date: s.date, ndvi: Math.round((s.ndvi?.mean ?? 0) * 100) }));

  return (
    <>
      <PageHead
        title={t("crop.title")}
        sub={c?.checked_at ? `${farm?.name}. ${t("crop.checked", { time: `${formatDate(c.checked_at, t.locale, { year: false })} ${formatTime(c.checked_at, t.locale)}` })}` : farm?.name}
      />
      {q.isLoading || !farm ? (
        <div className="stack-lg"><Skeleton height={120} /><Skeleton height={360} /></div>
      ) : q.error || !c ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : c.status !== "ready" ? (
        <NotReady status={c.status} />
      ) : !scene || !latest || !c.bounds ? (
        <div className="panel"><EmptyState text={t("crop.noScenes")} /></div>
      ) : (
        <div className="stack-lg">
          <p className="muted">{t("crop.help")}</p>
          {c.scaled && <Notice tone="amber">{t("crop.scaled")}</Notice>}
          {latest.trend?.direction === "falling" && (
            <Notice tone="amber" icon={<TrendingDown size={18} aria-hidden />}>{t("crop.falling", { since: formatDate(latest.trend.since, t.locale, { year: false }) })}</Notice>
          )}
          <KpiRow
            items={[
              { label: t("crop.kpi.health"), value: bandChip(t, latest) },
              { label: t("crop.kpi.ndvi"), value: formatNumber(latest.ndvi?.mean ?? 0, 2) },
              {
                label: t("crop.kpi.change"),
                value: latest.trend ? (
                  <span className="row" style={{ gap: 6 }}>
                    {latest.trend.direction === "falling" ? <TrendingDown size={18} aria-hidden className="ink-cost" /> : latest.trend.direction === "rising" ? <TrendingUp size={18} aria-hidden /> : null}
                    {`${latest.trend.change > 0 ? "+" : ""}${formatNumber(latest.trend.change, 2)}`}
                  </span>
                ) : "–",
              },
              { label: t("crop.kpi.taken"), value: formatDate(latest.date, t.locale, { year: false }) },
            ]}
          />
          <Panel
            title={t("crop.map", { date: formatDate(scene.date, t.locale) })}
            actions={<Segmented label={t("crop.layer")} value={layer} onChange={setLayer} options={[{ value: "ndvi", label: t("crop.layer.ndvi") }, { value: "truecolor", label: t("crop.layer.truecolor") }]} />}
          >
            <div className="stack">
              <SceneMap scene={scene} layer={layer} bounds={c.bounds} farm={farm} />
              {layer === "ndvi" && <Legend />}
              <p className="small muted">{t("crop.sceneMeta", { satellite: scene.satellite, cloud: Math.round(scene.cloud_pct) })}</p>
            </div>
          </Panel>
          <Panel title={t("crop.history")}>
            <ChartFrame
              summary={t("crop.historySummary", { n: c.scenes.length, from: formatNumber((history[0]?.ndvi ?? 0) / 100, 2), to: formatNumber(latest.ndvi?.mean ?? 0, 2) })}
              table={
                <Table
                  rows={c.scenes}
                  rowKey={(s) => s.id}
                  onRowClick={(s) => setChosen(s.id)}
                  selected={scene.id}
                  columns={[
                    { key: "d", header: t("common.date"), render: (s) => formatDate(s.date, t.locale) },
                    { key: "n", header: t("crop.kpi.ndvi"), numeric: true, render: (s) => formatNumber(s.ndvi?.mean ?? 0, 2) },
                    { key: "h", header: t("crop.kpi.health"), render: (s) => bandChip(t, s) },
                    { key: "c", header: t("crop.cloud"), numeric: true, render: (s) => `${Math.round(s.cloud_pct)}%` },
                  ]}
                />
              }
            >
              <BarsChart data={history} x="date" xFormat={(d) => formatDate(d, t.locale, { year: false })} series={[{ key: "ndvi", label: t("crop.kpi.ndvi"), color: "var(--green-400)" }]} format={(v) => formatNumber(v / 100, 2)} height={220} />
            </ChartFrame>
          </Panel>
        </div>
      )}
    </>
  );
}
