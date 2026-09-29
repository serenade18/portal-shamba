import { CheckCircle2, CircleDashed, Droplets, Umbrella } from "lucide-react";
import { Link } from "react-router";
import { useCatalogue } from "@/api/hooks";
import type { ForecastDay, TodayRecord } from "@/api/types";
import { Panel } from "@/components/ui/data";
import { useQty, useT } from "@/i18n";
import { formatWeekday } from "@/lib/format";
import { enterprisePath } from "../enterprise/paths";
import { CONDITION_ICON } from "../weather/WeatherStrip";

/** Today's conditions large on the sky gradient (3.4), the rest of the week in a row beneath. */
export function WeatherToday({ days }: { days: ForecastDay[] }) {
  const t = useT();
  const [today, ...rest] = days;
  if (!today) return null;
  const Icon = CONDITION_ICON[today.condition];
  return (
    <section className="weather-today" aria-labelledby="dash-weather">
      <div className="spread">
        <h2 id="dash-weather">{t("dash.weatherToday")}</h2>
        <Link to="/weather" className="small strong">{t("dash.fullForecast")}</Link>
      </div>
      <div className="weather-now">
        <Icon size={56} strokeWidth={1.5} aria-hidden />
        <div>
          <p className="weather-temp">{today.t_max}<span>°C</span></p>
          <p className="strong">{t(`cond.${today.condition}`)}</p>
          <p className="small">{t("dash.low", { t: today.t_min })}</p>
        </div>
      </div>
      <div className="weather-facts">
        <span><Umbrella size={16} aria-hidden /> <b>{today.rain_probability}%</b> {t("dash.rainChance")}</span>
        <span><Droplets size={16} aria-hidden /> <b>{t("weather.mm", { n: Math.round(today.rain_mm) })}</b> {t("dash.rainfall")}</span>
      </div>
      <ol className="weather-week list-plain">
        {rest.slice(0, 6).map((d) => {
          const DayIcon = CONDITION_ICON[d.condition];
          return (
            <li key={d.date} className={d.condition === "heavy_rain" ? "heavy" : undefined}>
              <span>{formatWeekday(d.date, t.locale)}</span>
              <DayIcon size={18} aria-hidden />
              <span className="visually-hidden">{t(`cond.${d.condition}`)}</span>
              <b>{d.t_max}°</b>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Each active enterprise's daily record as a task: done in Health green, waiting in amber. */
export function TodayTasks({ today }: { today: TodayRecord[] }) {
  const t = useT();
  const qty = useQty();
  const catalogue = useCatalogue();
  const done = today.filter((r) => r.recorded).length;
  const sorted = [...today].sort((a, b) => Number(a.recorded) - Number(b.recorded));
  return (
    <Panel title={t("dash.tasks")} actions={today.length > 0 && <span className="small muted">{t("dash.tasksDone", { done, total: today.length })}</span>} bodyless>
      {today.length > 0 && (
        <div className="task-progress" aria-hidden>
          <div style={{ width: `${(done / today.length) * 100}%` }} />
        </div>
      )}
      <ul className="task-list list-plain">
        {sorted.map((r) => {
          const type = catalogue.data?.enterprise_types.find((x) => x.code === r.type);
          const to = type ? `${enterprisePath(type.module, r.enterprise_id)}${r.recorded ? "" : `?action=${type.module === "livestock" ? "milk" : type.module === "crops" ? "activity" : "day"}`}` : undefined;
          const detail = r.recorded
            ? r.summary.map((s) => (s.unit ? qty(s.value, s.unit) : `${s.value} ${t("rec.deaths").toLowerCase()}`)).join(", ")
            : t("dash.notRecorded");
          return (
            <li key={r.enterprise_id} className={r.recorded ? "done" : "pending"}>
              {r.recorded ? <CheckCircle2 size={22} aria-hidden /> : <CircleDashed size={22} aria-hidden />}
              <div>
                {to ? <Link to={to} className="strong">{r.name}</Link> : <span className="strong">{r.name}</span>}
                <p className="small muted">
                  <span className="visually-hidden">{r.recorded ? t("dash.recorded") : ""} </span>
                  {detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {today.length > 0 && done === today.length && <p className="small muted" style={{ padding: "0 20px 16px" }}>{t("dash.allRecorded")}</p>}
    </Panel>
  );
}
