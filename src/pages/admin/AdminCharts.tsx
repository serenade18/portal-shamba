import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { token } from "@/components/ui/charts";

/*
 * Staff analytics charts. Each plots one measure, so each has one hue and no
 * legend (the panel title names it); hover shows the exact value, and every
 * chart sits in a ChartFrame with a table view. Marks follow the dataviz
 * specs: columns at most 24px with 4px rounded tops, 2px lines, a 10% wash
 * under lines, hairline solid gridlines.
 */

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const axis = () => ({ fontSize: 12, fill: token("var(--text-secondary)") });
const tooltipStyle = () => ({
  borderRadius: 8,
  border: `1px solid ${token("var(--border)")}`,
  fontFamily: "var(--font)",
  fontSize: 13,
  boxShadow: "var(--shadow-overlay)",
});

interface ChartProps {
  data: object[];
  x: string;
  y: string;
  color: string;
  label: string;
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  xFormat: (v: string) => string;
  height?: number;
}

export function ColumnChart({ data, x, y, color, label, format, axisFormat, xFormat, height = 220 }: ChartProps) {
  return (
    <div style={{ width: "100%", height }} aria-hidden>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={data.length > 40 ? 1 : "20%"}>
          <CartesianGrid stroke={token("var(--border)")} vertical={false} />
          <XAxis dataKey={x} tickFormatter={xFormat} tick={axis()} tickLine={false} axisLine={{ stroke: token("var(--border)") }} minTickGap={24} />
          <YAxis tickFormatter={(v) => (axisFormat ?? format)(Number(v))} tick={axis()} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgb(138 124 199 / 0.08)" }} formatter={(v) => [format(Number(v)), label]} labelFormatter={(l) => xFormat(String(l))} contentStyle={tooltipStyle()} />
          <Bar dataKey={y} fill={token(color)} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!still()} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChart({ data, x, y, color, label, format, axisFormat, xFormat, height = 220 }: ChartProps) {
  const c = token(color);
  return (
    <div style={{ width: "100%", height }} aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={token("var(--border)")} vertical={false} />
          <XAxis dataKey={x} tickFormatter={xFormat} tick={axis()} tickLine={false} axisLine={{ stroke: token("var(--border)") }} minTickGap={24} />
          <YAxis tickFormatter={(v) => (axisFormat ?? format)(Number(v))} tick={axis()} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
          <Tooltip cursor={{ stroke: token("var(--border)"), strokeWidth: 1 }} formatter={(v) => [format(Number(v)), label]} labelFormatter={(l) => xFormat(String(l))} contentStyle={tooltipStyle()} />
          <Area
            type="monotone"
            dataKey={y}
            stroke={c}
            strokeWidth={2}
            fill={c}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, fill: c, stroke: token("var(--surface)"), strokeWidth: 2 }}
            isAnimationActive={!still()}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars in plain HTML: a label, a bar on a shared scale, the value at its tip. */
export function BarList({ rows, color = "var(--green-800)", format = (v) => v.toLocaleString("en") }: {
  rows: { key: string; label: ReactNode; value: number; detail?: ReactNode }[];
  color?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bar-list list-plain">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="spread">
            <span>{r.label}</span>
            <span className="num strong">{format(r.value)}{r.detail && <span className="small muted"> {r.detail}</span>}</span>
          </div>
          <div className="bar-track" aria-hidden>
            <div className="bar" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One stacked bar of outcomes (2px gaps between segments) and a labelled key with icons. */
export function StatusBar({ rows }: { rows: { key: string; label: string; count: number; color: string; icon: ReactNode }[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="status-bar" aria-hidden>
        {rows.filter((r) => r.count > 0).map((r) => (
          <span key={r.key} style={{ flexGrow: r.count, background: r.color }} />
        ))}
      </div>
      <ul className="status-key list-plain">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="status-icon" style={{ color: r.color }}>{r.icon}</span>
            <span>{r.label}</span>
            <span className="num strong">{r.count.toLocaleString("en")}</span>
            <span className="small muted num">{total ? Math.round((r.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
