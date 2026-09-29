import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProfitReport } from "@/api/types";
import { token } from "@/components/ui/charts";
import { Money, useCurrency } from "@/components/ui/data";
import { useT } from "@/i18n";
import { formatMoney, formatMonth, percentChange } from "@/lib/format";

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const compact = (v: number) => Intl.NumberFormat("en", { notation: "compact" }).format(v);

/** The one key figure (profit, Display type) with revenue and costs beside it, over a six-month trend. */
export function Overview({ data }: { data: ProfitReport }) {
  const t = useT();
  const currency = useCurrency();
  const profit = Number(data.profit);
  const change = percentChange(profit, Number(data.previous_profit));
  const word = profit < 0 ? t("dash.lossLabel") : t("dash.profitLabel");
  const monthly = data.monthly.map((m) => ({ month: m.month, revenue: Number(m.revenue), cost: Number(m.cost) }));
  const up = change !== null && change >= 0;

  return (
    <section className="panel dash-overview" aria-labelledby="dash-overview">
      <div className="panel-head">
        <h2 id="dash-overview">{t("dash.overview")}</h2>
      </div>
      <div className="overview-body">
        <div className="overview-figures">
          <div>
            <p className="small muted">{word}</p>
            <p className={`display ${profit < 0 ? "ink-loss" : "ink-profit"}`}>{profit < 0 ? "−" : ""}{formatMoney(Math.abs(profit), currency)}</p>
            <p className="small muted row" style={{ gap: 6 }}>
              {change !== null && (
                <span className={`trend-pill ${up ? "up" : "down"}`} aria-hidden>
                  {up ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
                  {Math.abs(change)}%
                </span>
              )}
              <span className="visually-hidden">{change !== null && t(up ? "dash.change.up" : "dash.change.down", { word, pct: Math.abs(change) })}</span>
              <span aria-hidden={change !== null}>{change === null ? t("dash.change.none", { word }) : t("dash.vsPrevious")}</span>
            </p>
          </div>
          <dl className="overview-stats">
            <div className="stat revenue">
              <dt className="small muted">{t("common.revenue")}</dt>
              <dd><Money value={data.revenue} kind="revenue" /></dd>
            </div>
            <div className="stat cost">
              <dt className="small muted">{t("common.costs")}</dt>
              <dd><Money value={data.cost} kind="cost" /></dd>
            </div>
          </dl>
        </div>
        <figure className="overview-chart">
          <figcaption className="spread">
            <span className="small muted">{t("dash.trend")}</span>
            <span className="legend">
              <span><i style={{ background: "var(--revenue)" }} />{t("common.revenue")}</span>
              <span><i style={{ background: "var(--cost)" }} />{t("common.costs")}</span>
            </span>
          </figcaption>
          <div style={{ width: "100%", height: 180 }} aria-hidden>
            <ResponsiveContainer>
              <AreaChart data={monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={token("var(--border)")} vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m, t.locale)} tick={{ fontSize: 12, fill: token("var(--text-secondary)") }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => compact(Number(v))} tick={{ fontSize: 12, fill: token("var(--text-secondary)") }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  formatter={(v, name) => [formatMoney(Number(v), currency), name === "revenue" ? t("common.revenue") : t("common.costs")]}
                  labelFormatter={(m) => formatMonth(String(m), t.locale)}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${token("var(--border)")}`, fontFamily: "var(--font)", fontSize: 13 }}
                />
                <Area type="monotone" dataKey="cost" stroke={token("var(--cost)")} strokeWidth={2} fill={token("var(--cost)")} fillOpacity={0.08} isAnimationActive={!still()} />
                <Area type="monotone" dataKey="revenue" stroke={token("var(--revenue)")} strokeWidth={2.5} fill={token("var(--revenue)")} fillOpacity={0.14} isAnimationActive={!still()} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <table className="visually-hidden">
            <caption>{t("dash.trend")}</caption>
            <thead><tr><th scope="col">{t("common.month")}</th><th scope="col">{t("common.revenue")}</th><th scope="col">{t("common.costs")}</th></tr></thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.month}><th scope="row">{formatMonth(m.month, t.locale)}</th><td>{formatMoney(m.revenue, currency)}</td><td>{formatMoney(m.cost, currency)}</td></tr>
              ))}
            </tbody>
          </table>
        </figure>
      </div>
    </section>
  );
}

/** Revenue and costs as a ring, with profit or loss in the middle and in the legend (3.3). */
export function MoneySplit({ data }: { data: ProfitReport }) {
  const t = useT();
  const currency = useCurrency();
  const revenue = Number(data.revenue);
  const cost = Number(data.cost);
  const profit = Number(data.profit);
  const slices = [
    { key: "revenue", value: revenue, color: "var(--revenue)" },
    { key: "cost", value: cost, color: "var(--cost)" },
  ];
  const empty = revenue === 0 && cost === 0;

  return (
    <section className="panel dash-split" aria-labelledby="dash-split">
      <div className="panel-head">
        <h2 id="dash-split">{t("dash.split")}</h2>
      </div>
      <div className="split-body">
        <div className="donut" aria-hidden>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={empty ? [{ key: "none", value: 1 }] : slices} dataKey="value" nameKey="key" innerRadius="68%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={empty ? 0 : 2} stroke="none" isAnimationActive={!still()}>
                {empty ? <Cell fill={token("var(--surface-2)")} /> : slices.map((s) => <Cell key={s.key} fill={token(s.color)} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-centre">
            <span className="small muted">{t("dash.thisPeriod")}</span>
            <span className={`strong num ${profit < 0 ? "ink-loss" : "ink-profit"}`}>{profit < 0 ? "−" : ""}{currency} {compact(Math.abs(profit))}</span>
          </div>
        </div>
        <ul className="split-legend list-plain">
          <li><i style={{ background: "var(--revenue)" }} /><span>{t("common.revenue")}</span><Money value={revenue} kind="revenue" /></li>
          <li><i style={{ background: "var(--cost)" }} /><span>{t("common.costs")}</span><Money value={cost} kind="cost" /></li>
          <li className="total"><i style={{ background: profit < 0 ? "var(--loss)" : "var(--profit)" }} /><span>{profit < 0 ? t("common.loss") : t("common.profit")}</span><Money value={profit} kind="profit" /></li>
        </ul>
      </div>
    </section>
  );
}
