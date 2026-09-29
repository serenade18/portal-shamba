import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Hourglass, MailPlus, RefreshCw, Sprout, Users, Wallet, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ApiError, MOCK_MODE } from "@/api/client";
import * as api from "@/api/endpoints";
import type { AnalyticsDays, StaffAnalytics } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { ChartFrame } from "@/components/ui/charts";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, ErrorState, NoPermission, Skeleton } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { formatDate, formatMoney, formatTime, percentChange } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useAdminSession } from "@/stores/adminSession";
import { BarList, ColumnChart, LineChart, StatusBar } from "./AdminCharts";

const compact = (v: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const whole = (v: number) => v.toLocaleString("en");

function Change({ current, previous, days }: { current: number; previous: number; days: number }) {
  const t = useT();
  const pct = percentChange(current, previous);
  if (pct === null) return null;
  if (pct === 0) return <span className="small muted">{t("admin.noChange", { n: days })}</span>;
  const up = pct > 0;
  return (
    <span className="small muted row" style={{ gap: 6 }}>
      <span className={`trend-pill ${up ? "up" : "down"}`}>
        {up ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
        <span className="visually-hidden">{up ? "+" : "−"}</span>
        {Math.abs(pct)}%
      </span>
      {t("admin.vsPrevious", { n: days })}
    </span>
  );
}

function Kpi({ icon, label, value, children, wide }: { icon: ReactNode; label: string; value: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? "kpi-tile wide" : "kpi-tile"}>
      <p className="kpi-label"><span className="kpi-icon" aria-hidden>{icon}</span>{label}</p>
      <p className="kpi-value num">{value}</p>
      <div className="kpi-detail">{children}</div>
    </section>
  );
}

function DataTable({ rows, head }: { rows: [string, string][]; head: [string, string] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th scope="col">{head[0]}</th><th scope="col" className="num">{head[1]}</th></tr></thead>
        <tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td className="num">{b}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Dashboard({ data, days }: { data: StaffAnalytics; days: AnalyticsDays }) {
  const t = useT();
  const cur = data.currency;
  const tot = data.totals;
  const day = (iso: string) => formatDate(iso, t.locale, { year: false });
  const daily = data.daily.map((d) => ({ ...d, collected: Number(d.collected) }));
  const peak = daily.reduce((a, d) => (d.active_farmers > a.active_farmers ? d : a), daily[0]!);
  const signupChange = percentChange(tot.farmers.new, tot.farmers.previous_new);
  const signedUp = data.funnel[0]?.count ?? 0;
  const statusMeta = {
    succeeded: { color: "var(--health)", icon: <CheckCircle2 size={16} /> },
    failed: { color: "var(--terracotta)", icon: <XCircle size={16} /> },
    expired: { color: "var(--text-muted)", icon: <Clock size={16} /> },
    pending: { color: "var(--amber)", icon: <Hourglass size={16} /> },
    awaiting_otp: { color: "var(--amber)", icon: <Hourglass size={16} /> },
  } as const;

  return (
    <div className="dash-grid">
      <div className="span-12 kpi-grid">
        <Kpi icon={<Users size={18} />} label={t("admin.kpi.farmers")} value={whole(tot.farmers.total)}>
          <span className="small strong">{t("admin.kpi.farmersNew", { n: whole(tot.farmers.new) })}</span>
          <Change current={tot.farmers.new} previous={tot.farmers.previous_new} days={days} />
        </Kpi>
        <Kpi icon={<Sprout size={18} />} label={t("admin.kpi.accounts")} value={whole(tot.organisations.total)}>
          <span className="small strong">{t("admin.kpi.farmersNew", { n: whole(tot.organisations.new) })}</span>
          <Change current={tot.organisations.new} previous={tot.organisations.previous_new} days={days} />
        </Kpi>
        <Kpi icon={<Users size={18} />} label={t("admin.kpi.active")} value={whole(tot.active_farmers.count)}>
          {tot.farmers.total > 0 && <span className="small strong">{t("admin.kpi.activeShare", { pct: Math.round((tot.active_farmers.count / tot.farmers.total) * 100) })}</span>}
          <Change current={tot.active_farmers.count} previous={tot.active_farmers.previous} days={days} />
        </Kpi>
        <Kpi wide icon={<Wallet size={18} />} label={t("admin.kpi.collected")} value={<span className="ink-revenue">{formatMoney(tot.payments.collected, cur)}</span>}>
          <Change current={Number(tot.payments.collected)} previous={Number(tot.payments.previous_collected)} days={days} />
        </Kpi>
        <Kpi icon={<CheckCircle2 size={18} />} label={t("admin.kpi.successRate")} value={tot.payments.success_rate === null ? "–" : `${tot.payments.success_rate}%`}>
          <span className="small muted">
            {tot.payments.requests ? t("admin.kpi.successDetail", { ok: whole(tot.payments.succeeded), n: whole(tot.payments.requests) }) : t("admin.kpi.noPayments")}
          </span>
        </Kpi>
        <Kpi wide icon={<MailPlus size={18} />} label={t("admin.kpi.invitations")} value={whole(tot.pending_invitations)}>
          <span className="small muted">{t("admin.kpi.invitationsDetail")}</span>
        </Kpi>
      </div>

      <div className="span-8">
        <Panel title={t("admin.signups")}>
          <ChartFrame
            summary={t("admin.signupsSummary", {
              n: whole(tot.farmers.new),
              days,
              change: signupChange === null ? "" : `${signupChange >= 0 ? "+" : "−"}${Math.abs(signupChange)}% ${t("admin.vsPrevious", { n: days })}`,
            }).replace(", .", ".")}
            table={<DataTable head={[t("admin.col.day"), t("admin.signups")]} rows={daily.map((d) => [day(d.date), whole(d.signups)])} />}
          >
            <ColumnChart data={daily} x="date" y="signups" color="var(--lavender)" label={t("admin.kpi.farmers")} format={whole} xFormat={day} />
          </ChartFrame>
        </Panel>
      </div>
      <div className="span-4">
        <Panel title={t("admin.funnel")}>
          <div className="stack">
            <p className="small muted">{t("admin.funnelSummary", { days })}</p>
            <BarList
              color="var(--lavender)"
              rows={data.funnel.map((s) => ({
                key: s.step,
                label: t(`admin.funnel.${s.step}`),
                value: s.count,
                detail: signedUp ? `${Math.round((s.count / signedUp) * 100)}%` : undefined,
              }))}
            />
          </div>
        </Panel>
      </div>

      <div className="span-6">
        <Panel title={t("admin.active")}>
          <ChartFrame
            summary={t("admin.activeSummary", { max: whole(peak.active_farmers), date: day(peak.date) })}
            table={<DataTable head={[t("admin.col.day"), t("admin.active")]} rows={daily.map((d) => [day(d.date), whole(d.active_farmers)])} />}
          >
            <LineChart data={daily} x="date" y="active_farmers" color="var(--green-800)" label={t("admin.kpi.active")} format={whole} xFormat={day} />
          </ChartFrame>
        </Panel>
      </div>
      <div className="span-6">
        <Panel title={t("admin.collectedDaily")}>
          <ChartFrame
            summary={t("admin.collectedSummary", { total: formatMoney(tot.payments.collected, cur) })}
            table={<DataTable head={[t("admin.col.day"), t("admin.col.collected")]} rows={daily.map((d) => [day(d.date), formatMoney(d.collected, cur)])} />}
          >
            <ColumnChart data={daily} x="date" y="collected" color="var(--amber)" label={t("admin.col.collected")} format={(v) => formatMoney(v, cur)} axisFormat={compact} xFormat={day} />
          </ChartFrame>
        </Panel>
      </div>

      <div className="span-4">
        <Panel title={t("admin.platforms")}>
          <div className="stack">
            <p className="small muted">{t("admin.platformsHelp")}</p>
            <BarList rows={data.platforms.map((p) => ({ key: p.platform, label: t(`admin.platform.${p.platform}`), value: p.devices }))} />
          </div>
        </Panel>
      </div>
      <div className="span-4">
        <Panel title={t("admin.languages")}>
          <BarList rows={data.languages.map((l) => ({ key: l.locale, label: l.locale === "sw" ? "Kiswahili" : "English", value: l.farmers }))} />
        </Panel>
      </div>
      <div className="span-4">
        <Panel title={t("admin.roles")}>
          <BarList rows={data.roles.map((r) => ({ key: r.role, label: t(`role.${r.role}`), value: r.members }))} />
        </Panel>
      </div>

      <div className="span-4">
        <Panel title={t("admin.paymentStatus")}>
          <div className="stack">
            <p className="small muted">{t("admin.paymentStatusHelp")}</p>
            <StatusBar rows={data.payment_statuses.map((s) => ({ key: s.status, label: t(`admin.status.${s.status}`), count: s.count, ...statusMeta[s.status] }))} />
          </div>
        </Panel>
      </div>
      <div className="span-8">
        <Panel title={t("admin.recent")} bodyless>
          <Table
            rows={data.recent_signups}
            rowKey={(r) => r.id}
            caption={t("admin.recent")}
            columns={[
              { key: "n", header: t("admin.col.farmer"), label: t("admin.col.farmer"), render: (r) => <span className="strong">{r.name || <span className="muted">{t("admin.noName")}</span>}</span> },
              { key: "c", header: t("admin.col.contact"), label: t("admin.col.contact"), render: (r) => <span className="small">{formatPhone(r.phone)}{r.email && <><br /><span className="muted">{r.email}</span></>}</span> },
              { key: "a", header: t("admin.col.account"), label: t("admin.col.account"), render: (r) => (r.organisation ? <>{r.organisation}{r.role && <span className="small muted"> · {t(`role.${r.role}`)}</span>}</> : <Chip tone="amber">{t("admin.noAccount")}</Chip>) },
              { key: "v", header: t("admin.col.via"), label: t("admin.col.via"), render: (r) => (r.platform ? t(`admin.platform.${r.platform}`) : "–") },
              { key: "j", header: t("admin.col.joined"), label: t("admin.col.joined"), render: (r) => <span className="num">{formatDate(r.date_joined, t.locale)}</span> },
            ]}
          />
        </Panel>
      </div>

      <div className="span-12">
        <Panel title={t("admin.top")} bodyless>
          <Table
            rows={data.top_organisations}
            rowKey={(r) => r.id}
            caption={t("admin.top")}
            columns={[
              { key: "n", header: t("admin.col.account"), label: t("admin.col.account"), render: (r) => <span className="strong">{r.name}</span> },
              { key: "o", header: t("admin.col.owner"), label: t("admin.col.owner"), render: (r) => r.owner ?? "–" },
              { key: "m", header: t("admin.col.members"), label: t("admin.col.members"), numeric: true, render: (r) => whole(r.members), sort: (a, b) => a.members - b.members },
              { key: "c", header: t("admin.col.collected"), label: t("admin.col.collected"), numeric: true, render: (r) => <span className="ink-revenue">{formatMoney(r.collected, cur)}</span>, sort: (a, b) => Number(a.collected) - Number(b.collected) },
              { key: "d", header: t("admin.col.created"), label: t("admin.col.created"), render: (r) => formatDate(r.created_at, t.locale) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash-grid" aria-busy="true">
      <div className="span-12 kpi-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={128} />)}</div>
      <div className="span-8"><Skeleton height={320} /></div>
      <div className="span-4"><Skeleton height={320} /></div>
      <div className="span-6"><Skeleton height={320} /></div>
      <div className="span-6"><Skeleton height={320} /></div>
    </div>
  );
}

/** /admin: platform-wide numbers for Shamba OS staff (GET /staff/analytics). */
export function AdminDashboard() {
  const t = useT();
  const [days, setDays] = useState<AnalyticsDays>(30);
  const staffId = useAdminSession((s) => s.user?.id);
  const q = useQuery({
    queryKey: ["admin", staffId, "analytics", days],
    queryFn: () => api.staff.analytics(days),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const sub = q.data
    ? t("admin.analyticsSub", { from: formatDate(q.data.from, t.locale), to: formatDate(q.data.to, t.locale), time: formatTime(q.data.generated_at, t.locale) })
    : undefined;

  return (
    <>
      <PageHead
        title={
          <span className="row" style={{ gap: 12 }}>
            {t("admin.analyticsTitle")}
            {MOCK_MODE === "all" && <Chip tone="lavender">{t("admin.demoData")}</Chip>}
          </span>
        }
        sub={sub}
        actions={
          <>
            <Segmented
              label={t("admin.period")}
              value={String(days) as "7" | "30" | "90"}
              onChange={(v) => setDays(Number(v) as AnalyticsDays)}
              options={[7, 30, 90].map((n) => ({ value: String(n) as "7" | "30" | "90", label: t("admin.days", { n }) }))}
            />
            <Button icon={<RefreshCw size={16} aria-hidden />} onClick={() => q.refetch()} loading={q.isFetching} aria-label={t("admin.refresh")} />
          </>
        }
      />
      {q.isLoading ? (
        <DashboardSkeleton />
      ) : q.error instanceof ApiError && q.error.status === 403 ? (
        <NoPermission text={t("admin.forbidden")} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <div style={{ opacity: q.isPlaceholderData ? 0.6 : 1, transition: "opacity .2s" }}>
          <Dashboard data={q.data} days={q.data.days} />
        </div>
      ) : null}
    </>
  );
}
