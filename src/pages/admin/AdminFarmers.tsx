import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import { usePaged } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, NoPermission, SkeletonRows } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useAdminSession } from "@/stores/adminSession";

/** /admin/farmers: every farmer who has signed up (GET /staff/farmers), searchable. */
export function AdminFarmers() {
  const t = useT();
  const navigate = useNavigate();
  const staffId = useAdminSession((s) => s.user?.id);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // Search as the person types, without a request per key press.
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const list = usePaged(["admin", staffId, "farmers", q], (cursor) => api.staff.farmers(q, cursor));

  return (
    <>
      <PageHead title={t("admin.farmers")} sub={t("admin.farmersSub")} />
      <Panel
        title={
          <span className="admin-search">
            <Search size={18} aria-hidden />
            <TextField label={<span className="visually-hidden">{t("admin.farmersSearch")}</span>} value={search} onChange={setSearch} type="search" placeholder={t("admin.farmersSearchHint")} autoComplete="off" />
          </span>
        }
        actions={list.rows.length > 0 && <span className="small muted">{t("admin.farmersShown", { n: list.rows.length })}</span>}
        bodyless
      >
        {list.isLoading ? (
          <div className="panel-body"><SkeletonRows /></div>
        ) : list.error instanceof ApiError && list.error.status === 403 ? (
          <NoPermission text={t("admin.forbidden")} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.rows.length ? (
          <EmptyState text={q ? t("admin.farmersNoMatch", { q }) : t("admin.farmersEmpty")} />
        ) : (
          <Table
            rows={list.rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/farmers/${r.id}`)}
            caption={t("admin.farmers")}
            columns={[
              {
                key: "n", header: t("admin.col.farmer"), label: t("admin.col.farmer"),
                render: (r) => (
                  <span className="strong">
                    {r.name || <span className="muted">{t("admin.noName")}</span>}
                    {!r.is_active && <> <Chip tone="terracotta">{t("admin.disabled")}</Chip></>}
                  </span>
                ),
              },
              { key: "c", header: t("admin.col.contact"), label: t("admin.col.contact"), render: (r) => <span className="small">{formatPhone(r.phone)}{r.email && <><br /><span className="muted">{r.email}</span></>}</span> },
              { key: "a", header: t("admin.col.account"), label: t("admin.col.account"), render: (r) => (r.organisation ? <>{r.organisation}{r.role && <span className="small muted"> · {t(`role.${r.role}`)}</span>}</> : <Chip tone="amber">{t("admin.noAccount")}</Chip>) },
              { key: "v", header: t("admin.col.via"), label: t("admin.col.via"), render: (r) => (r.platform ? t(`admin.platform.${r.platform}`) : "–") },
              { key: "s", header: t("admin.col.lastSeen"), label: t("admin.col.lastSeen"), render: (r) => (r.last_seen_at ? <span className="num">{formatDate(r.last_seen_at, t.locale)}</span> : "–") },
              { key: "j", header: t("admin.col.joined"), label: t("admin.col.joined"), render: (r) => <span className="num">{formatDate(r.date_joined, t.locale)}</span> },
            ]}
            footer={list.hasNextPage && (
              <Button variant="quiet" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>{t("common.loadMore")}</Button>
            )}
          />
        )}
      </Panel>
    </>
  );
}
