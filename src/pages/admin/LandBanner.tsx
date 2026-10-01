import { LandPlot } from "lucide-react";
import type { StaffLand } from "@/api/types";
import { useT } from "@/i18n";

/** Land on Shamba OS: one big figure, and how much of it was measured from drawn boundaries. */
export function LandBanner({ land, title }: { land: StaffLand; title: string }) {
  const t = useT();
  const acres = Number(land.acres);
  const mappedShare = acres > 0 ? (Number(land.mapped_acres) / acres) * 100 : 0;
  const n = (v: string | number) => Math.round(Number(v)).toLocaleString("en");
  return (
    <section className="land-banner" aria-label={title}>
      <div className="land-banner-figure">
        <p className="kpi-label"><span className="kpi-icon" aria-hidden><LandPlot size={18} /></span>{title}</p>
        <p className="land-banner-value num">{t("admin.land.acres", { n: n(acres) })}</p>
        <p className="small muted">{t("admin.land.hectares", { n: n(land.hectares) })} · {t("admin.land.farms", { n: n(land.farms) })}</p>
      </div>
      <div className="land-banner-split">
        <div className="land-bar" role="img" aria-label={t("admin.land.split", { mapped: n(land.mapped_acres), declared: n(land.declared_acres) })}>
          <span className="land-bar-mapped" style={{ width: `${mappedShare}%` }} />
          <span className="land-bar-declared" style={{ width: `${100 - mappedShare}%` }} />
        </div>
        <ul className="list-plain land-legend">
          <li><i className="land-bar-mapped" />{t("admin.land.mapped", { acres: n(land.mapped_acres), farms: n(land.mapped_farms) })}</li>
          <li><i className="land-bar-declared" />{t("admin.land.declared", { acres: n(land.declared_acres), farms: n(land.declared_farms) })}</li>
          {land.unknown_farms > 0 && <li className="muted">{t("admin.land.unknown", { farms: n(land.unknown_farms) })}</li>}
        </ul>
      </div>
    </section>
  );
}
