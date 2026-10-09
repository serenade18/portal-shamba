import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, MapPin, MapPinOff, Phone } from "lucide-react";
import { Suspense, lazy, useMemo, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import type { StaffFarmerDetail } from "@/api/types";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, NoPermission, Skeleton, SkeletonRows } from "@/components/ui/feedback";
import { LANGUAGE_NAMES, useT } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useAdminSession } from "@/stores/adminSession";
import { useCountryName } from "./geo";
import { LandBanner } from "./LandBanner";

const FarmerFarmsMap = lazy(() => import("./FarmerFarmsMap"));

type Account = StaffFarmerDetail["accounts"][number];
type FarmRow = Account["farms"][number] & { account: Account };

const ACRES_PER_HA = 2.4710538;
const whole = (v: number) => v.toLocaleString("en");

/** /admin/farmers/:id: one farmer in full (GET /staff/farmers/{id}). */
export function AdminFarmer() {
  const t = useT();
  const { id = "" } = useParams();
  const staffId = useAdminSession((s) => s.user?.id);
  const q = useQuery({ queryKey: ["admin", staffId, "farmer", id], queryFn: () => api.staff.farmer(id) });

  const back = (
    <ButtonLink to="/admin/farmers" variant="quiet" size="sm" className="flush" icon={<ArrowLeft size={16} aria-hidden />}>
      {t("admin.farmers")}
    </ButtonLink>
  );

  if (q.isLoading) return <>{back}<SkeletonRows rows={6} height={64} /></>;
  if (q.error instanceof ApiError && q.error.status === 403) return <>{back}<NoPermission text={t("admin.forbidden")} /></>;
  if (q.error instanceof ApiError && q.error.status === 404) return <>{back}<EmptyState text={t("admin.farmer.notFound")} /></>;
  if (q.error || !q.data) return <>{back}<ErrorState error={q.error} onRetry={() => q.refetch()} /></>;
  return <>{back}<Farmer f={q.data} /></>;
}

function Farmer({ f }: { f: StaffFarmerDetail }) {
  const t = useT();
  const countryName = useCountryName();
  const [selected, setSelected] = useState<string | null>(null);
  const farms = useMemo<FarmRow[]>(() => f.accounts.flatMap((a) => a.farms.map((farm) => ({ ...farm, account: a }))), [f.accounts]);
  const located = farms.filter((x) => x.location || x.boundary);
  const active = f.accounts.filter((a) => a.membership_active);

  return (
    <>
      <PageHead
        title={
          <span className="farmer-title">
            {f.name || <span className="muted">{t("admin.noName")}</span>}
            {!f.is_active && <Chip tone="terracotta">{t("admin.disabled")}</Chip>}
          </span>
        }
        sub={t("admin.farmer.joined", { date: formatDate(f.date_joined, t.locale) })}
      />

      <div className="stack">
        <div className="farmer-contact">
          <a href={`tel:${f.phone}`}><Phone size={16} aria-hidden /> {formatPhone(f.phone)}</a>
          {f.email && <a href={`mailto:${f.email}`}><Mail size={16} aria-hidden /> {f.email}</a>}
          {f.username && <span className="muted">@{f.username}</span>}
          <span className="muted">{t("admin.farmer.language", { lang: LANGUAGE_NAMES[f.preferred_locale] ?? f.preferred_locale })}</span>
          <span className="muted">
            {f.last_seen_at ? t("admin.farmer.lastSeen", { date: formatDate(f.last_seen_at, t.locale) }) : t("admin.farmer.neverSeen")}
          </span>
        </div>

        <LandBanner land={f.land} title={t("admin.farmer.land")} />

        <Panel title={t("admin.farmer.farms", { n: farms.length })} bodyless>
          {!farms.length ? (
            <EmptyState text={t("admin.farmer.noFarms")} />
          ) : (
            <>
              {located.length > 0 && (
                <div className="farmer-map-wrap">
                  <Suspense fallback={<Skeleton height={360} />}>
                    <FarmerFarmsMap farms={located} selected={selected} onSelect={setSelected} />
                  </Suspense>
                </div>
              )}
              <Table
                rows={farms}
                rowKey={(r) => r.id}
                caption={t("admin.farmer.farms", { n: farms.length })}
                selected={selected}
                onRowClick={(r) => (r.location || r.boundary) && setSelected(r.id)}
                columns={[
                  {
                    key: "n", header: t("admin.farmer.col.farm"), label: t("admin.farmer.col.farm"),
                    render: (r) => (
                      <span className="farmer-farm-name">
                        {r.location || r.boundary ? <MapPin size={16} aria-hidden /> : <MapPinOff size={16} aria-hidden className="muted" />}
                        <span>
                          <span className="strong">{r.name}</span>
                          <br />
                          <span className="small muted">{[r.county, r.account.name].filter(Boolean).join(" · ")}</span>
                        </span>
                      </span>
                    ),
                  },
                  { key: "a", header: t("admin.map.area"), label: t("admin.map.area"), render: (r) => <FarmArea r={r} /> },
                  {
                    key: "e", header: t("admin.farmer.col.keeps"), label: t("admin.farmer.col.keeps"),
                    render: (r) => {
                      const parts = (["livestock", "crops", "batches"] as const).filter((m) => r.enterprises[m]).map((m) => t.n(`admin.farmer.module.${m}`, r.enterprises[m]!));
                      return parts.length ? <span className="small">{parts.join(", ")}</span> : <span className="muted">–</span>;
                    },
                  },
                  {
                    key: "s", header: t("admin.farmer.col.status"), label: t("admin.farmer.col.status"),
                    render: (r) => (
                      <span className="small">
                        {r.setup_complete ? t("admin.farmer.setupDone") : <Chip tone="amber">{t("admin.map.setupPending")}</Chip>}
                        {r.weather_sync && r.weather_sync.status !== "none" && <><br /><span className="muted">{t(`boundary.sync.${r.weather_sync.status}`)}</span></>}
                      </span>
                    ),
                  },
                  { key: "c", header: t("admin.col.created"), label: t("admin.col.created"), render: (r) => <span className="num small">{formatDate(r.created_at, t.locale)}</span> },
                ]}
              />
            </>
          )}
        </Panel>

        <div className="farmer-columns">
          <Panel title={t("admin.farmer.accounts", { n: active.length })} bodyless>
            {!f.accounts.length ? (
              <EmptyState text={t("admin.noAccount")} />
            ) : (
              <Table
                rows={f.accounts}
                rowKey={(a) => a.id}
                caption={t("admin.farmer.accounts", { n: active.length })}
                columns={[
                  {
                    key: "n", header: t("admin.col.account"), label: t("admin.col.account"),
                    render: (a) => (
                      <span>
                        <span className="strong">{a.name}</span>
                        {!a.membership_active && <> <Chip tone="neutral">{t("admin.farmer.left")}</Chip></>}
                        {!a.is_active && <> <Chip tone="terracotta">{t("admin.disabled")}</Chip></>}
                        <br />
                        <span className="small muted">{t(`role.${a.role}`)} · {countryName(a.country)} · {t.n("admin.map.n.farmers", a.members)}</span>
                      </span>
                    ),
                  },
                  {
                    key: "p", header: t("admin.kpi.collected"), label: t("admin.kpi.collected"), numeric: true,
                    render: (a) => (
                      <span className="small">
                        <span className="ink-revenue strong">{formatMoney(a.payments.collected, a.currency)}</span>
                        <br />
                        <span className="muted">{t("admin.kpi.successDetail", { ok: whole(a.payments.succeeded), n: whole(a.payments.requests) })}</span>
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Panel>

          <Panel title={t("admin.farmer.devices")} bodyless>
            {!f.devices.length ? (
              <EmptyState text={t("admin.farmer.noDevices")} />
            ) : (
              <Table
                rows={f.devices}
                rowKey={(d) => d.id}
                caption={t("admin.farmer.devices")}
                columns={[
                  {
                    key: "d", header: t("admin.col.via"), label: t("admin.col.via"),
                    render: (d) => (
                      <span>
                        <span className="strong">{t(`admin.platform.${d.platform}`)}</span>
                        {d.revoked && <> <Chip tone="neutral">{t("admin.farmer.signedOut")}</Chip></>}
                        <br />
                        <span className="small muted">{[d.name, d.app_version && `v${d.app_version}`].filter(Boolean).join(" · ") || "–"}</span>
                      </span>
                    ),
                  },
                  { key: "s", header: t("admin.col.lastSeen"), label: t("admin.col.lastSeen"), render: (d) => <span className="num small">{formatDate(d.last_seen_at, t.locale)}</span> },
                ]}
              />
            )}
          </Panel>
        </div>

        <Panel title={t("admin.farmer.activity")}>
          {!f.activity.length ? (
            <p className="small muted">{t("admin.farmer.noActivity")}</p>
          ) : (
            <ol className="list-plain farmer-activity">
              {f.activity.map((a, i) => (
                <li key={i}>
                  <span className="num small muted">{formatDate(a.occurred_at, t.locale)}</span>
                  <span>
                    {t.dyn(`admin.action.${a.action}`, a.action)}
                    {a.organisation && <span className="small muted"> · {a.organisation}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

/** Measured area if the farmer drew the boundary, else the plots they entered. */
function FarmArea({ r }: { r: FarmRow }) {
  const t = useT();
  if (r.area_ha) {
    const ha = Number(r.area_ha);
    return (
      <span className="small">
        {t("boundary.area", { acres: (ha * ACRES_PER_HA).toFixed(2), ha: ha.toFixed(2) })}
        <br />
        <span className="muted">{t("admin.farmer.measured")}</span>
      </span>
    );
  }
  if (r.plots_acres) {
    return (
      <span className="small">
        {t("admin.land.acres", { n: Number(r.plots_acres).toFixed(2) })}
        <br />
        <span className="muted">{t("admin.farmer.fromPlots")}</span>
      </span>
    );
  }
  return <span className="muted small">{t("admin.farmer.noArea")}</span>;
}
