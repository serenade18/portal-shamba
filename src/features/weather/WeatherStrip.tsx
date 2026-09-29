import { Cloud, CloudDrizzle, CloudLightning, CloudRain, Sun } from "lucide-react";
import type { ForecastDay } from "@/api/types";
import { useT } from "@/i18n";
import { formatWeekday } from "@/lib/format";

export const CONDITION_ICON = {
  sunny: Sun,
  cloudy: Cloud,
  light_rain: CloudDrizzle,
  rain: CloudRain,
  heavy_rain: CloudLightning,
} as const;

/** Compact forecast over the sky gradient; text sits on a Deep Forest scrim (3.4). */
export function WeatherStrip({ days, title }: { days: ForecastDay[]; title: string }) {
  const t = useT();
  const heavy = days.find((d) => d.condition === "heavy_rain");
  return (
    <section className="weather-panel" aria-label={title}>
      <div className="scrim">
        <h2 style={{ color: "inherit" }}>{title}</h2>
        {heavy && (
          <p className="small strong">
            {t("weather.heavy")}: {formatWeekday(heavy.date, t.locale)}, {t("weather.mm", { n: Math.round(heavy.rain_mm) })}
          </p>
        )}
      </div>
      <ol className="weather-days list-plain">
        {days.map((d, i) => {
          const Icon = CONDITION_ICON[d.condition];
          const label = t(`cond.${d.condition}`);
          return (
            <li key={d.date} className={`weather-day ${d.condition === "heavy_rain" ? "heavy" : ""}`}>
              <span className="strong">{i === 0 ? t("common.today") : formatWeekday(d.date, t.locale)}</span>
              <Icon size={22} aria-hidden />
              <span className="visually-hidden">{label}</span>
              <span className="temp">{d.t_max}°</span>
              <span>{d.rain_mm > 0 ? t("weather.mm", { n: Math.round(d.rain_mm) }) : "–"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
