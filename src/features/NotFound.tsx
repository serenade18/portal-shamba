import { ButtonLink } from "@/components/ui/Button";
import { useT } from "@/i18n";

export function NotFound() {
  const t = useT();
  return (
    <div className="panel">
      <div className="empty">
        <p>{t("state.notFound")}</p>
        <ButtonLink to="/" variant="primary">{t("state.goHome")}</ButtonLink>
      </div>
    </div>
  );
}
