import { Undo2 } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { useErrorText } from "@/api/hooks";
import type { StockMovement } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { LoadMore, Money, RecordedBy, Table, type Column } from "@/components/ui/data";
import { Chip, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useCan } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useInvalidateOrg } from "../enterprise/forms";

/**
 * The ledger view (7.3): a reversal sits directly beneath the entry it
 * corrects, which is struck through lightly with a "Corrected" chip.
 * Nothing disappears (INV-04).
 */
export function MovementsTable({ rows, hasNext, loadingMore, onMore, showItem = true }: { rows: StockMovement[]; hasNext: boolean; loadingMore: boolean; onMore: () => void; showItem?: boolean }) {
  const t = useT();
  const qty = useQty();
  const errorText = useErrorText();
  const money = useCan("money.read");
  const canWrite = useCan("stock.write");
  const invalidate = useInvalidateOrg();
  const [target, setTarget] = useState<StockMovement | null>(null);
  const reverse = useMutation({
    mutationFn: (id: string) => api.stock.reverse(id),
    onSuccess: () => {
      invalidate();
      toast(t("stock.reversed"));
      setTarget(null);
    },
    onError: (e) => {
      toast(errorText(e), "error");
      setTarget(null);
    },
  });

  if (!rows.length) return <div className="panel"><EmptyState text={t("stock.historyEmpty")} /></div>;

  const columns: Column<StockMovement>[] = [
    { key: "date", header: t("common.date"), render: (m) => <span className="strike">{formatDate(m.occurred_at, t.locale)}</span> },
    ...(showItem ? [{ key: "item", header: t("stock.item"), render: (m: StockMovement) => <span className="strike strong">{m.item_name[t.locale]}</span> }] : []),
    {
      key: "type",
      header: t("common.status"),
      label: "",
      render: (m) => (
        <span className="row" style={{ gap: 6 }}>
          <span className="strike">{t(`mv.${m.movement_type}`)}</span>
          {m.reversed_by_id && <Chip tone="lavender">{t("stock.corrected")}</Chip>}
          {m.movement_type === "reversal" && <Chip tone="lavender">{t("stock.correction")}</Chip>}
        </span>
      ),
    },
    {
      key: "qty",
      header: t("common.quantity"),
      numeric: true,
      render: (m) => {
        const n = Number(m.qty_base);
        const sign = n > 0 ? "+" : n < 0 ? "−" : "";
        return <span className={`strike ${n < 0 ? "" : "ink-health"}`} title={`${m.qty_base} ${m.base_unit}`}>{sign}{qty(Math.abs(Number(m.qty_entered)), m.unit_entered, 2)}</span>;
      },
    },
    { key: "ent", header: t("common.enterprise"), render: (m) => <span className="strike">{m.enterprise_name ?? "–"}</span> },
    ...(money ? [{ key: "cost", header: t("common.value"), numeric: true, render: (m: StockMovement) => (m.total_cost && Number(m.total_cost) > 0 ? <span className="strike"><Money value={m.total_cost} /></span> : "–") }] : []),
    { key: "by", header: t("common.recordedBy"), render: (m) => <RecordedBy by={m.recorded_by} /> },
    ...(canWrite
      ? [{
          key: "act",
          header: <span className="visually-hidden">{t("stock.reverse")}</span>,
          label: "",
          render: (m: StockMovement) =>
            m.movement_type !== "reversal" && !m.reversed_by_id ? (
              <Button variant="quiet" size="sm" icon={<Undo2 size={14} />} onClick={() => setTarget(m)}>
                {t("stock.reverse")}
              </Button>
            ) : null,
        }]
      : []),
  ];

  return (
    <>
      <Table
        rows={rows}
        columns={columns}
        rowKey={(m) => m.id}
        rowClassName={(m) => (m.reversed_by_id ? "struck" : m.movement_type === "reversal" ? "reversal" : undefined)}
        footer={<LoadMore hasNext={hasNext} loading={loadingMore} onClick={onMore} />}
      />
      {target && (
        <ConfirmDialog
          title={t("stock.reverseTitle")}
          body={
            <div className="stack">
              <p>
                <strong>{target.item_name[t.locale]}</strong>: {t(`mv.${target.movement_type}`)} {qty(target.qty_entered, target.unit_entered)}, {formatDate(target.occurred_at, t.locale)}
              </p>
              <p className="muted">{t("stock.reverseHelp")}</p>
            </div>
          }
          confirmLabel={t("stock.reverse")}
          loading={reverse.isPending}
          onConfirm={() => reverse.mutate(target.id)}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}
