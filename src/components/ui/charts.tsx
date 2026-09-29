import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/i18n";
import { Button } from "./Button";

/*
 * Charts follow 8.5: tokens only, Stone gridlines, no shadows, a text summary
 * above, and the numbers available as a table. Amber is under 3:1 on white,
 * so every chart ships a legend, tooltips and the table view.
 */

/** SVG attributes can't resolve var(); read the token's value instead. */
function token(value: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(value);
  if (!m) return value;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || value;
}

const axis = () => ({ fontSize: 12, fill: token("var(--text-secondary)") });

export interface Series {
  key: string;
  label: string;
  color: string;
}

export function ChartFrame({ summary, table, children, legend }: { summary: string; table: ReactNode; children: ReactNode; legend?: Series[] }) {
  const t = useT();
  const [showTable, setShowTable] = useState(false);
  return (
    <figure style={{ margin: 0 }} className="stack">
      <figcaption className="spread">
        <span>{summary}</span>
        <Button variant="quiet" size="sm" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
          {showTable ? t("common.hideTable") : t("common.showTable")}
        </Button>
      </figcaption>
      {legend && legend.length > 1 && (
        <span className="legend">
          {legend.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      )}
      <div>{children}</div>
      {showTable && table}
    </figure>
  );
}

export function BarsChart({ data, x, series, format, axisFormat, height = 240, xFormat }: {
  axisFormat?: (v: number) => string;
  data: object[];
  x: string;
  series: Series[];
  format: (v: number) => string;
  xFormat?: (v: string) => string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid stroke={token("var(--border)")} vertical={false} />
          <XAxis dataKey={x} tick={axis()} tickLine={false} axisLine={{ stroke: token("var(--border)") }} tickFormatter={xFormat} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={axis()} tickLine={false} axisLine={false} tickFormatter={(v) => (axisFormat ?? format)(Number(v))} width={64} domain={[0, "auto"]} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgb(220 232 222 / 0.5)" }}
            formatter={(v, name) => [format(Number(v)), series.find((s) => s.key === name)?.label ?? String(name)]}
            labelFormatter={(l) => (xFormat ? xFormat(String(l)) : String(l))}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontFamily: "var(--font)", fontSize: 13 }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={token(s.color)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!window.matchMedia("(prefers-reduced-motion: reduce)").matches} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
