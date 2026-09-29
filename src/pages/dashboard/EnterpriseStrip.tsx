import { useNavigate } from "react-router";
import { useCatalogue } from "@/api/hooks";
import type { EnterpriseProfit } from "@/api/types";
import { Chip } from "@/components/ui/feedback";
import { Money } from "@/components/ui/data";
import { useT } from "@/i18n";
import { enterprisePath } from "../enterprise/paths";

/**
 * The signature element (7.1): one row per enterprise, a cost bar and a
 * revenue bar on one shared scale, then profit or loss with its word.
 */
export function EnterpriseStrip({ rows }: { rows: EnterpriseProfit[] }) {
  const t = useT();
  const navigate = useNavigate();
  const catalogue = useCatalogue();
  const max = Math.max(1, ...rows.flatMap((r) => [Number(r.cost), Number(r.revenue)]));
  const moduleOf = (type: EnterpriseProfit["type"]) => catalogue.data?.enterprise_types.find((x) => x.code === type)?.module;

  return (
    <table className="strip">
      <caption className="visually-hidden">{t("dash.enterprises")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("common.enterprise")}</th>
          <th scope="col">
            <span className="legend">
              <span><i style={{ background: "var(--cost)" }} />{t("common.costs")}</span>
              <span><i style={{ background: "var(--revenue)" }} />{t("common.revenue")}</span>
            </span>
          </th>
          <th scope="col" style={{ textAlign: "right" }}>{t("common.profit")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const module = moduleOf(r.type);
          const open = r.enterprise_id && module ? () => navigate(enterprisePath(module, r.enterprise_id!)) : undefined;
          return (
            <tr key={r.enterprise_id ?? "farm"} className={open ? "link" : undefined} onClick={open} onKeyDown={(e) => e.key === "Enter" && open?.()} tabIndex={open ? 0 : undefined}>
              <td className="name">
                <span className="row" style={{ gap: 8 }}>
                  {r.enterprise_id ? r.name : t("common.wholeFarm")}
                  {r.status === "closed" && <Chip tone="health">{t("common.closed")}</Chip>}
                </span>
              </td>
              <td className="bars">
                <div className="bar-pair">
                  <div className="bar-track" title={`${t("common.costs")}`}>
                    <div className="bar cost" style={{ width: `${(Number(r.cost) / max) * 100}%` }} />
                  </div>
                  <div className="bar-track" title={`${t("common.revenue")}`}>
                    <div className="bar revenue" style={{ width: `${(Number(r.revenue) / max) * 100}%` }} />
                  </div>
                </div>
                <span className="visually-hidden">
                  {t("common.costs")} <Money value={r.cost} />, {t("common.revenue")} <Money value={r.revenue} />
                </span>
              </td>
              <td className="profit">
                <Money value={r.profit} kind="profit" word />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
