import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { useFarm, useKey } from "@/api/hooks";
import { BarsChart, ChartFrame } from "@/components/ui/charts";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { CONDITION_ICON, WeatherStrip } from "./WeatherStrip";

/** 7-day forecast and rain history per farm (WEA-01, WEA-02, WEA-03). */
export function WeatherPage() {
  const t = useT();
  const key = useKey();
  const { farm } = useFarm();
  const q = useQuery({ queryKey: key("weather", farm?.id), queryFn: () => api.weather.get(farm!.id), enabled: !!farm });

  if (farm && !farm.location && !farm.county) {
    return (
      <>
        <PageHead title={t("weather.title")} />
        <div className="panel"><EmptyState text={t("weather.noLocation")} /></div>
      </>
    );
  }

  const w = q.data;
  const rainDays = w?.history.filter((d) => d.rain_mm > 0).length ?? 0;
  const rainTotal = Math.round(w?.history.reduce((s, d) => s + d.rain_mm, 0) ?? 0);
  const forecastTotal = Math.round(w?.forecast.reduce((s, d) => s + d.rain_mm, 0) ?? 0);

  return (
    <>
      <PageHead
        title={t("weather.title")}
        sub={w && `${farm?.name}, ${farm?.county}. ${t("weather.updated", { time: `${formatDate(w.fetched_at, t.locale, { year: false })} ${formatTime(w.fetched_at, t.locale)}` })}`}
      />
      {q.isLoading ? (
        <div className="stack-lg"><Skeleton height={180} /><Skeleton height={300} /></div>
      ) : q.error || !w ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="stack-lg">
          <WeatherStrip days={w.forecast} title={t("weather.forecast")} />
          <Panel title={t("weather.forecast")} bodyless>
            <div style={{ padding: "12px 20px 0" }}><p className="muted">{t("weather.forecastSummary", { total: forecastTotal })}</p></div>
            <div style={{ padding: 16 }}>
              <Table
                rows={w.forecast}
                rowKey={(d) => d.date}
                columns={[
                  { key: "d", header: t("weather.col.day"), render: (d) => <span className="strong">{formatDate(d.date, t.locale, { weekday: true, year: false })}</span> },
                  {
                    key: "c",
                    header: t("weather.col.condition"),
                    render: (d) => {
                      const Icon = CONDITION_ICON[d.condition];
                      return d.condition === "heavy_rain" ? (
                        <Chip tone="sky">{t("cond.heavy_rain")}</Chip>
                      ) : (
                        <span className="row" style={{ gap: 6 }}><Icon size={18} aria-hidden className="ink-sky" />{t(`cond.${d.condition}`)}</span>
                      );
                    },
                  },
                  { key: "r", header: t("weather.rain"), numeric: true, render: (d) => (d.rain_mm > 0 ? `${t("weather.mm", { n: d.rain_mm })}, ${t("weather.chance", { p: d.rain_probability })}` : "–") },
                  { key: "t", header: t("weather.col.temp"), numeric: true, render: (d) => t("weather.temp", { min: d.t_min, max: d.t_max }) },
                ]}
              />
            </div>
          </Panel>
          <Panel title={t("weather.history")}>
            <ChartFrame
              summary={t("weather.historySummary", { total: rainTotal, days: rainDays })}
              table={
                <Table
                  rows={w.history.slice().reverse()}
                  rowKey={(d) => d.date}
                  columns={[
                    { key: "d", header: t("common.date"), render: (d) => formatDate(d.date, t.locale) },
                    { key: "r", header: t("weather.rain"), numeric: true, render: (d) => t("weather.mm", { n: d.rain_mm }) },
                    { key: "t", header: t("weather.col.temp"), numeric: true, render: (d) => t("weather.temp", { min: d.t_min, max: d.t_max }) },
                  ]}
                />
              }
            >
              <BarsChart data={w.history} x="date" xFormat={(d) => formatDate(d, t.locale, { year: false })} series={[{ key: "rain_mm", label: t("weather.rain"), color: "var(--sky)" }]} format={(v) => `${v} mm`} height={220} />
            </ChartFrame>
          </Panel>
        </div>
      )}
    </>
  );
}
