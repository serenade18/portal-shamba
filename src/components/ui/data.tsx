import { ArrowDown, ArrowUp, Smartphone, Monitor } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { Recorder } from "@/api/types";
import { useT } from "@/i18n";
import { cx, formatDate, formatMoney, formatTime } from "@/lib/format";
import { useMembership } from "@/stores/session";
import { Button } from "./Button";
import { Chip } from "./feedback";

export function useCurrency() {
  return useMembership()?.currency ?? "KES";
}

/**
 * Money in its fixed colours (3.3). Profit and loss always carry a sign and,
 * with `word`, the word itself, so colour is never the only signal.
 */
export function Money({ value, kind = "plain", word, className }: { value: string | number | null | undefined; kind?: "plain" | "revenue" | "cost" | "profit"; word?: boolean; className?: string }) {
  const t = useT();
  const currency = useCurrency();
  if (value === null || value === undefined) return null;
  const n = Number(value);
  let ink = "";
  if (kind === "revenue") ink = "ink-revenue";
  if (kind === "cost") ink = "ink-cost";
  if (kind === "profit") ink = n < 0 ? "ink-loss" : "ink-profit";
  const text = formatMoney(kind === "profit" && word ? Math.abs(n) : n, currency);
  return (
    <span className={cx("money", ink, className)}>
      {kind === "profit" && word && <span>{n < 0 ? t("common.loss") : t("common.profit")} </span>}
      {kind === "profit" && word && n < 0 ? `−${text}` : text}
    </span>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyless }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyless?: boolean }) {
  return (
    <section className={cx("panel", className)}>
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      {bodyless ? children : <div className="panel-body">{children}</div>}
    </section>
  );
}

export interface Column<R> {
  key: string;
  header: ReactNode;
  /** Plain-text label for the stacked mobile layout. */
  label?: string;
  render: (row: R) => ReactNode;
  numeric?: boolean;
  sort?: (a: R, b: R) => number;
  className?: string;
}

export function Table<R>({ rows, columns, rowKey, onRowClick, rowClassName, caption, footer, selected }: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (r: R) => string;
  onRowClick?: (r: R) => void;
  rowClassName?: (r: R) => string | undefined;
  caption?: string;
  footer?: ReactNode;
  selected?: string | null;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    return [...rows].sort((a, b) => col.sort!(a, b) * sort.dir);
  }, [rows, columns, sort]);

  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cx(c.numeric && "n", c.className)} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                {c.sort ? (
                  <button
                    type="button"
                    className="btn-quiet"
                    style={{ border: 0, background: "none", font: "inherit", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                  >
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const key = rowKey(r);
            return (
              <tr
                key={key}
                className={cx(onRowClick && "clickable", selected === key && "is-selected", rowClassName?.(r))}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(r) : undefined) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx(c.numeric && "n", c.className)} data-label={c.label ?? (typeof c.header === "string" ? c.header : "")}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

export function LoadMore({ hasNext, loading, onClick }: { hasNext: boolean; loading: boolean; onClick: () => void }) {
  const t = useT();
  if (!hasNext) return null;
  return (
    <div className="table-foot">
      <Button variant="quiet" onClick={onClick} loading={loading}>{t("common.loadMore")}</Button>
    </div>
  );
}

export function Tabs<V extends string>({ value, onChange, tabs, label }: { value: V; onChange: (v: V) => void; tabs: { value: V; label: string }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.value === value);
            if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length]!.value);
            if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length]!.value);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** A tab choice kept in the URL, so links and the back button work. */
export function useTabParam<V extends string>(allowed: readonly V[], fallback: V): [V, (v: V) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as V | null;
  const value = raw && allowed.includes(raw) ? raw : fallback;
  const set = (v: V) =>
    setParams(
      (p) => {
        p.set("tab", v);
        return p;
      },
      { replace: true },
    );
  return [value, set];
}

/** Key numbers in a single bordered row, not floating cards (7.2). */
export function KpiRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="kpi-row">
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <div className="label">{k.label}</div>
          <div className="value">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Who recorded it and from which device, for the absentee owner's trust (7.2). */
export function RecordedBy({ by, conflict, onReview }: { by: Recorder; conflict?: boolean; onReview?: () => void }) {
  const t = useT();
  return (
    <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      {by.device === "phone" ? <Smartphone size={14} aria-hidden className="muted" /> : <Monitor size={14} aria-hidden className="muted" />}
      <span>
        {by.name} <span className="muted small">({t(by.device === "phone" ? "common.device.phone" : "common.device.web")})</span>
        {by.synced_at && <span className="visually-hidden">, {t("common.synced", { time: `${formatDate(by.synced_at, t.locale, { year: false })} ${formatTime(by.synced_at, t.locale)}` })}</span>}
      </span>
      {conflict && (
        <button type="button" onClick={onReview} style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}>
          <Chip tone="lavender">{t("rec.review")}</Chip>
        </button>
      )}
    </span>
  );
}
