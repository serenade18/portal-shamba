import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, ShoppingCart, Wallet } from "lucide-react";
import { Link } from "react-router";
import * as api from "@/api/endpoints";
import { useCatalogue, useFarm, useKey, useRange } from "@/api/hooks";
import type { Dashboard as DashboardData, TodayRecord } from "@/api/types";
import { ButtonLink } from "@/components/ui/Button";
import { Money, PageHead, Panel } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { AlertRow } from "@/pages/alerts/AlertRow";
import { useQty, useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useCan, useSession } from "@/stores/session";
import { enterprisePath } from "../enterprise/paths";
import { EnterpriseStrip } from "./EnterpriseStrip";
import { MoneySplit, Overview } from "./Overview";
import { TodayTasks, WeatherToday } from "./TodayCards";

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
    <Panel title={t("dash.moneyOwed")} className="owed-card" actions={Number(data.total) > 0 && <Link to="/sales?tab=owed" className="small strong">{t("common.view")}</Link>}>
      {Number(data.total) === 0 ? (
        <p className="muted row"><CheckCircle2 size={18} className="ink-health" aria-hidden /> {t("dash.nothingOwed")}</p>
      ) : (
        <div className="stack" style={{ gap: 4 }}>
          <p className="owed-figure"><Wallet size={22} aria-hidden /><Money value={data.total} kind="revenue" /></p>
          <p className="muted">{t.n("dash.owedFrom", data.customers)}</p>
          {data.oldest_days != null && <p className="small muted">{t("dash.oldest", { days: data.oldest_days, name: data.oldest_customer })}</p>}
        </div>
      )}
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
    <div className="dash-grid" aria-busy="true">
      <div className="span-8"><Skeleton height={300} /></div>
      <div className="span-4"><Skeleton height={300} /></div>
      <div className="span-4"><Skeleton height={260} /></div>
      <div className="span-4"><Skeleton height={260} /></div>
      <div className="span-4"><Skeleton height={260} /></div>
    </div>
  );
}

function greeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
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

  const name = useSession((s) => s.user?.name?.split(" ")[0]);
  const sub = money
    ? t("dash.farmSubtitle", { farm: farm?.name ?? "", range: t(`range.${range.preset}`), from: formatDate(range.from, t.locale, { year: false }), to: formatDate(range.to, t.locale) })
    : `${farm?.name ?? ""}. ${formatDate(new Date().toISOString(), t.locale, { weekday: true })}`;
  const actions = money && (
    <>
      <ButtonLink to="/purchases?new=1" icon={<ShoppingCart size={18} aria-hidden />}>{t("purch.new")}</ButtonLink>
      <ButtonLink to="/sales?new=1" variant="primary" icon={<Plus size={18} aria-hidden />}>{t("sales.new")}</ButtonLink>
    </>
  );
  const d = q.data;
  const active = d?.profit?.enterprises.some((e) => Number(e.cost) || Number(e.revenue));

  return (
    <>
      <PageHead title={name ? t(`dash.greeting.${greeting()}`, { name }) : farm?.name ?? ""} sub={sub} actions={actions} />
      {q.isLoading ? (
        <DashboardSkeleton />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : d ? (
        <div className="dash-grid">
          {d.profit && Number(d.profit.revenue) === 0 && Number(d.profit.cost) === 0 && (
            <div className="span-12"><FirstStep today={d.today} /></div>
          )}
          {d.profit && (
            <>
              <div className="span-8"><Overview data={d.profit} /></div>
              <div className="span-4"><MoneySplit data={d.profit} /></div>
            </>
          )}
          <div className="span-4">{weather.data ? <WeatherToday days={weather.data.forecast} /> : <Skeleton height={260} />}</div>
          <div className="span-4"><TodayTasks today={d.today} /></div>
          <div className="span-4">{d.receivables ? <Owed data={d.receivables} /> : <StockPanel data={d} />}</div>
          {d.profit && (
            <section className="panel span-12" aria-labelledby="dash-enterprises">
              <div className="panel-head">
                <div>
                  <h2 id="dash-enterprises">{t("dash.enterprises")}</h2>
                  {active && (
                    <p className="small muted">{t("dash.enterprisesSummary", { best: d.profit.enterprises[0]!.enterprise_id ? d.profit.enterprises[0]!.name : t("common.wholeFarm") })}</p>
                  )}
                </div>
              </div>
              {active ? <EnterpriseStrip rows={d.profit.enterprises} /> : <EmptyState text={t("dash.noActivity")} />}
            </section>
          )}
          <div className={d.receivables ? "span-7" : "span-12"}><Attention data={d} /></div>
          {d.receivables && <div className="span-5"><StockPanel data={d} /></div>}
        </div>
      ) : null}
    </>
  );
}
