import { Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import { usePaged } from "@/api/hooks";
import type { StaffEmail } from "@/api/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, NoPermission, SkeletonRows, type Tone } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useAdminSession } from "@/stores/adminSession";

const STATUS_TONE: Record<StaffEmail["status"], Tone> = { draft: "amber", sending: "sky", sent: "health" };

export function StatusChip({ status }: { status: StaffEmail["status"] }) {
  const t = useT();
  return <Chip tone={STATUS_TONE[status]}>{t(`email.status.${status}`)}</Chip>;
}

export function audienceLabel(t: ReturnType<typeof useT>, e: Pick<StaffEmail, "audience" | "recipient_count">) {
  return e.audience === "selected" ? t.n("email.audience.selectedN", e.recipient_count) : t(`email.audience.${e.audience}`);
}

/** /admin/emails: drafts and sent emails to farmers, newest first. */
export function AdminEmails() {
  const t = useT();
  const navigate = useNavigate();
  const staffId = useAdminSession((s) => s.user?.id);
  const list = usePaged(["admin", staffId, "emails"], (cursor) => api.staff.emails(cursor));

  return (
    <>
      <PageHead
        title={t("admin.emails")}
        sub={t("email.listSub")}
        actions={<ButtonLink to="/admin/emails/new" variant="primary" icon={<Plus size={18} aria-hidden />}>{t("email.new")}</ButtonLink>}
      />
      <Panel bodyless>
        {list.isLoading ? (
          <div className="panel-body"><SkeletonRows /></div>
        ) : list.error instanceof ApiError && list.error.status === 403 ? (
          <NoPermission text={t("admin.forbidden")} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.rows.length ? (
          <EmptyState text={t("email.empty")} action={<ButtonLink to="/admin/emails/new" variant="primary">{t("email.new")}</ButtonLink>} />
        ) : (
          <Table
            rows={list.rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/emails/${r.id}`)}
            caption={t("admin.emails")}
            columns={[
              { key: "s", header: t("email.subject"), label: t("email.subject"), render: (r) => <span className="strong">{r.subject}</span> },
              { key: "a", header: t("email.to"), label: t("email.to"), render: (r) => audienceLabel(t, r) },
              { key: "st", header: t("common.status"), label: t("common.status"), render: (r) => <StatusChip status={r.status} /> },
              {
                key: "c", header: t("email.delivered"), label: t("email.delivered"), numeric: true,
                render: (r) => (r.status === "draft" ? "–" : (
                  <span className="num">
                    {t("email.sentOf", { sent: r.counts.sent, total: r.counts.total })}
                    {r.counts.failed > 0 && <span className="ink-cost"> · {t("email.failedN", { n: r.counts.failed })}</span>}
                  </span>
                )),
              },
              { key: "d", header: t("common.date"), label: t("common.date"), render: (r) => <span className="num">{formatDate(r.sent_at ?? r.updated_at, t.locale)}</span> },
            ]}
            footer={list.hasNextPage && <Button variant="quiet" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>{t("common.loadMore")}</Button>}
          />
        )}
      </Panel>
    </>
  );
}
