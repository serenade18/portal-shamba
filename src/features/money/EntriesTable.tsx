import type { FinanceEntry } from "@/api/types";
import { LoadMore, Money, RecordedBy, Table, type Column } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/format";

export function EntriesTable({ rows, hasNext, loadingMore, onMore, showEnterprise = true }: { rows: FinanceEntry[]; hasNext: boolean; loadingMore: boolean; onMore: () => void; showEnterprise?: boolean }) {
  const t = useT();
  if (!rows.length) return <div className="panel"><EmptyState text={t("money.entriesEmpty")} /></div>;
  const columns: Column<FinanceEntry>[] = [
    { key: "date", header: t("common.date"), render: (e) => formatDate(e.occurred_on, t.locale) },
    {
      key: "cat",
      header: t("money.col.category"),
      render: (e) => (
        <span>
          <span className="strong">{t.dyn(`cat.${e.category}`, e.category)}</span>
          {e.note && <span className="small muted"> · {e.note}</span>}
        </span>
      ),
    },
    ...(showEnterprise ? [{ key: "for", header: t("money.col.for"), render: (e: FinanceEntry) => e.enterprise_name ?? t("common.wholeFarm") }] : []),
    {
      key: "amount",
      header: t("money.col.amount"),
      numeric: true,
      render: (e) => (
        <span>
          <span className="visually-hidden">{e.kind === "cost" ? t("common.costs") : t("common.revenue")} </span>
          <Money value={e.kind === "cost" ? -Number(e.amount) : e.amount} kind={e.kind === "cost" ? "cost" : "revenue"} />
        </span>
      ),
    },
    { key: "by", header: t("common.recordedBy"), render: (e) => <RecordedBy by={e.recorded_by} /> },
  ];
  return <Table rows={rows} columns={columns} rowKey={(e) => e.id} footer={<LoadMore hasNext={hasNext} loading={loadingMore} onClick={onMore} />} />;
}
