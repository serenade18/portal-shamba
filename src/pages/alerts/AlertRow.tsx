import { AlertTriangle, CloudRain, Info, Syringe, TrendingDown, Wallet, Warehouse } from "lucide-react";
import { Link } from "react-router";
import type { Alert } from "@/api/types";
import { useCurrency } from "@/components/ui/data";
import { useT, type Translator } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";

const ICON: Record<Alert["type"], typeof AlertTriangle> = {
  low_stock: Warehouse,
  negative_stock: Warehouse,
  mortality_spike: TrendingDown,
  vaccination_due: Syringe,
  heavy_rain: CloudRain,
  overdue_debt: Wallet,
  sync_conflict: Info,
};

export function alertLink(a: Alert): string {
  switch (a.type) {
    case "low_stock":
    case "negative_stock":
      return `/purchases?new=1&item=${a.subject_id}`;
    case "mortality_spike":
    case "vaccination_due":
    case "sync_conflict":
      return `/poultry/${a.subject_id}`;
    case "heavy_rain":
      return "/weather";
    case "overdue_debt":
      return "/sales?tab=owed";
  }
}

/** Alerts arrive as a type code plus parameters and are worded in the reader's language (backend 14). */
export function alertText(a: Alert, t: Translator, currency: string): string {
  const p = { ...a.params };
  // Item names come in each language as item_sw, item_fr; `item` is English.
  if (p[`item_${t.locale}`]) p.item = p[`item_${t.locale}`];
  if (typeof p.date === "string") p.date = formatDate(p.date, t.locale, { year: false, weekday: a.type === "heavy_rain" });
  if (p.unit) p.unit = t.unit(String(p.unit), Number(p.qty) === 1 ? 1 : 2);
  if (p.amount != null) p.amount = formatMoney(p.amount, currency);
  if (p.rain_mm != null) p.rain = Math.round(Number(p.rain_mm));
  return t.dyn(`alert.${a.type}`, a.type, p);
}

export function AlertRow({ alert, onAction }: { alert: Alert; onAction?: () => void }) {
  const t = useT();
  const currency = useCurrency();
  const Icon = ICON[alert.type];
  const dot = alert.type === "heavy_rain" ? "sky" : alert.severity;
  return (
    <div className="alert-item">
      <span className={`alert-dot ${dot}`} aria-hidden>
        <Icon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p>
          <span className="visually-hidden">{t.dyn(`alert.severity.${alert.severity}`, alert.severity)}: </span>
          {alertText(alert, t, currency)}
        </p>
        <Link to={alertLink(alert)} className="small strong" onClick={onAction} style={{ color: "var(--green-600)" }}>
          {t.dyn(`alert.action.${alert.type}`, t("common.view"))}
        </Link>
      </div>
    </div>
  );
}
