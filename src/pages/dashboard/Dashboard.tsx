import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { Link } from "react-router";
import * as api from "@/api/endpoints";
import { useCatalogue, useFarm, useKey, useRange } from "@/api/hooks";
import type { Dashboard as DashboardData, TodayRecord } from "@/api/types";
import { ButtonLink } from "@/components/ui/Button";
import { Money, PageHead, Panel, useCurrency } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { AlertRow } from "@/pages/alerts/AlertRow";
import { useQty, useT } from "@/i18n";
import { formatDate, formatMoney, percentChange } from "@/lib/format";
import { useCan } from "@/stores/session";
import { enterprisePath } from "../enterprise/paths";
import { WeatherStrip } from "../weather/WeatherStrip";
import { EnterpriseStrip } from "./EnterpriseStrip";

function Headline({ data }: { data: NonNullable<DashboardData["profit"]> }) {
  const t = useT();
  const profit = Number(data.profit);
  const change = percentChange(profit, Number(data.previous_profit));
  const word = profit < 0 ? t("dash.lossLabel") : t("dash.profitLabel");
  return (
    <div className="headline">
      <div>
        <p className="muted">{word}</p>
        <p className={`display ${profit < 0 ? "ink-loss" : "ink-profit"}`}>{formatMoney(profit, useCurrency())}</p>
        <p className="small muted">
          {change === null ? t("dash.change.none", { word }) : t(change >= 0 ? "dash.change.up" : "dash.change.down", { word, pct: Math.abs(change) })}
        </p>
      </div>
      <div className="side">
        <div>
          <p className="small muted">{t("common.revenue")}</p>
          <Money value={data.revenue} kind="revenue" className="strong" />
        </div>
        <div>
          <p className="small muted">{t("common.costs")}</p>
          <Money value={data.cost} kind="cost" className="strong" />
        </div>
      </div>
    </div>
  );
}

function FirstStep({ today }: { today: TodayRecord[] }) {
  const t = useT();
  const catalogue = useCatalogue();
  const first = today[0];
  if (!first) return null;
  const type = catalogue.data?.enterprise_types.find((x) => x.code === first.type);
  if (!type) return null;
  const label = type.labels[t.locale].toLowerCase();
  let text = t("dash.first.batch", { type: label });
  let action = "day";
  if (type.module === "livestock") (text = t("dash.first.milk")), (action = "milk");
  else if (type.code === "layers") text = t("dash.first.eggs");
  else if (type.module === "crops") (text = t("dash.first.season", { type: label })), (action = "activity");
  return (
    <Panel title={t("dash.firstStep")}>
      <div className="stack">
        <p className="muted">{t("dash.firstStepHelp")}</p>
        <div>
          <ButtonLink variant="primary" to={`${enterprisePath(type.module, first.enterprise_id)}?action=${action}`}>{text}</ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

function Attention({ data }: { data: DashboardData }) {
  const t = useT();
  return (
    <Panel title={t("dash.needsAttention")}>
      {data.alerts.length === 0 ? (
        <p className="muted row"><CheckCircle2 size={18} className="ink-health" aria-hidden /> {t("dash.allClear")}</p>
      ) : (
        <div className="alert-list" style={{ marginTop: -12, marginBottom: -12 }}>
          {data.alerts.slice(0, 6).map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function Owed({ data }: { data: NonNullable<DashboardData["receivables"]> }) {
  const t = useT();
  return (
    <Panel title={t("dash.moneyOwed")} actions={Number(data.total) > 0 && <Link to="/sales?tab=owed" className="small strong">{t("common.view")}</Link>}>
      {Number(data.total) === 0 ? (
        <p className="muted">{t("dash.nothingOwed")}</p>
      ) : (
        <div className="stack" style={{ gap: 4 }}>
          <p>
            <Money value={data.total} kind="revenue" className="strong" /> {t.n("dash.owedFrom", data.customers)}
          </p>
          {data.oldest_days != null && <p className="small muted">{t("dash.oldest", { days: data.oldest_days, name: data.oldest_customer })}</p>}
        </div>
      )}
    </Panel>
  );
}

function TodayPanel({ data }: { data: DashboardData }) {
  const t = useT();
  const qty = useQty();
  const catalogue = useCatalogue();
  return (
    <Panel title={t("dash.today")} bodyless>
      {data.today.map((r, i) => {
        const module = catalogue.data?.enterprise_types.find((x) => x.code === r.type)?.module;
        return (
          <div key={r.enterprise_id} className="spread" style={{ padding: "12px 20px", borderTop: i ? "1px solid var(--border)" : undefined }}>
            <div>
              {module ? <Link to={enterprisePath(module, r.enterprise_id)} className="strong">{r.name}</Link> : <span className="strong">{r.name}</span>}
              <p className="small muted">
                {r.summary.map((s) => (s.unit ? qty(s.value, s.unit) : `${s.value} ${t("rec.deaths").toLowerCase()}`)).join(", ")}
              </p>
            </div>
            {r.recorded ? <Chip tone="health">{t("dash.recorded")}</Chip> : <Chip tone="amber" icon={<CircleDashed size={14} aria-hidden />}>{t("dash.notRecorded")}</Chip>}
          </div>
        );
      })}
    </Panel>
  );
}

function StockPanel({ data }: { data: DashboardData }) {
  const t = useT();
  const qty = useQty();
  return (
    <Panel title={t("dash.stockLevels")} actions={<Link to="/stock" className="small strong">{t("dash.seeStock")}</Link>} bodyless>
      {data.stock.slice(0, 6).map((b, i) => (
        <div key={b.item_id} className="spread" style={{ padding: "12px 20px", borderTop: i ? "1px solid var(--border)" : undefined }}>
          <span>{b.item_name[t.locale]}</span>
          <span className="row" style={{ gap: 8 }}>
            <span className={`num strong ${b.status === "negative" ? "ink-cost" : ""}`}>{qty(Number(b.qty_base) / b.display_factor, b.display_unit)}</span>
            {b.status !== "ok" && <Chip tone="terracotta">{t(`stock.status.${b.status}`)}</Chip>}
          </span>
        </div>
      ))}
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="stack-lg" aria-busy="true">
      <Skeleton height={120} />
      <Skeleton height={260} />
      <div className="grid-2">
        <Skeleton height={200} />
        <Skeleton height={200} />
      </div>
    </div>
  );
}

/** Answers "what is making money?" before anything else (7.1, J6, FIN-04). */
export function Dashboard() {
  const t = useT();
  const key = useKey();
  const { farm } = useFarm();
  const range = useRange();
  const money = useCan("money.read");
  const q = useQuery({
    queryKey: key("dashboard", farm?.id, range.from, range.to),
    queryFn: () => api.dashboard.get({ farm_id: farm!.id, from: range.from, to: range.to }),
    enabled: !!farm,
  });
  const weather = useQuery({ queryKey: key("weather", farm?.id), queryFn: () => api.weather.get(farm!.id), enabled: !!farm, staleTime: 30 * 60_000 });

  const sub = money
    ? t("dash.subtitle", { range: t(`range.${range.preset}`), from: formatDate(range.from, t.locale, { year: false }), to: formatDate(range.to, t.locale) })
    : formatDate(new Date().toISOString(), t.locale, { weekday: true });

  return (
    <>
      <PageHead title={farm?.name ?? ""} sub={sub} />
      {q.isLoading ? (
        <DashboardSkeleton />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <div className="stack-lg">
          {q.data.profit ? (
            <>
              {Number(q.data.profit.revenue) === 0 && Number(q.data.profit.cost) === 0 && <FirstStep today={q.data.today} />}
              <section className="panel" aria-label={t("dash.enterprises")}>
                <Headline data={q.data.profit} />
                <div className="panel-section" style={{ borderTop: "1px solid var(--border)" }}>
                  <div style={{ padding: "16px 20px 8px" }}>
                    <h2>{t("dash.enterprises")}</h2>
                    {q.data.profit.enterprises.some((e) => Number(e.cost) || Number(e.revenue)) && (
                      <p className="small muted">{t("dash.enterprisesSummary", { best: q.data.profit.enterprises[0]!.enterprise_id ? q.data.profit.enterprises[0]!.name : t("common.wholeFarm") })}</p>
                    )}
                  </div>
                  {q.data.profit.enterprises.some((e) => Number(e.cost) || Number(e.revenue)) ? <EnterpriseStrip rows={q.data.profit.enterprises} /> : <EmptyState text={t("dash.noActivity")} />}
                </div>
              </section>
            </>
          ) : (
            <TodayPanel data={q.data} />
          )}
          <div className="grid-2">
            <div className="stack-lg">
              <Attention data={q.data} />
              {q.data.receivables && <Owed data={q.data.receivables} />}
              {!money && <StockPanel data={q.data} />}
            </div>
            <div>{weather.data ? <WeatherStrip days={weather.data.forecast} title={t("dash.weather")} /> : <Skeleton height={200} />}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
