import type { Sale, SaleStatus } from "@/api/types";
import { LoadMore, Money, Table, type Column } from "@/components/ui/data";
import { Chip, EmptyState, type Tone } from "@/components/ui/feedback";
import { useQty, useT } from "@/i18n";
import { formatDate } from "@/lib/format";

export const SALE_TONE: Record<SaleStatus, Tone> = {
  paid: "health",
  partial: "amber",
  credit: "amber",
  awaiting_payment: "amber",
};

export function SaleStatusChip({ status }: { status: SaleStatus }) {
  const t = useT();
  return <Chip tone={SALE_TONE[status]}>{t(`saleStatus.${status}`)}</Chip>;
}

export function SalesTable({ rows, hasNext, loadingMore, onMore, onOpen, emptyText }: { rows: Sale[]; hasNext: boolean; loadingMore: boolean; onMore: () => void; onOpen?: (s: Sale) => void; emptyText?: string }) {
  const t = useT();
  const qty = useQty();
  if (!rows.length) return <div className="panel"><EmptyState text={emptyText ?? t("sales.empty")} /></div>;
  const columns: Column<Sale>[] = [
    { key: "no", header: t("sales.col.number"), render: (s) => <span className="strong num">{s.number}</span> },
    { key: "date", header: t("common.date"), render: (s) => formatDate(s.date, t.locale), sort: (a, b) => a.date.localeCompare(b.date) },
    { key: "cust", header: t("sales.col.customer"), render: (s) => s.customer_name, sort: (a, b) => a.customer_name.localeCompare(b.customer_name) },
    { key: "lines", header: t("sales.col.products"), render: (s) => s.lines.map((l) => `${qty(l.qty, l.unit)} ${l.item_name[t.locale].toLowerCase()}`).join(", ") },
    { key: "total", header: t("common.total"), numeric: true, render: (s) => <Money value={s.total} kind="revenue" />, sort: (a, b) => Number(a.total) - Number(b.total) },
    { key: "owed", header: t("sales.col.owed"), numeric: true, render: (s) => (Number(s.balance_due) > 0 ? <Money value={s.balance_due} /> : "–") },
    { key: "status", header: t("common.status"), render: (s) => <SaleStatusChip status={s.status} /> },
  ];
  return <Table rows={rows} columns={columns} rowKey={(s) => s.id} onRowClick={onOpen} footer={<LoadMore hasNext={hasNext} loading={loadingMore} onClick={onMore} />} />;
}
