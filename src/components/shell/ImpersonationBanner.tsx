import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useNavigate } from "react-router";
import * as api from "@/api/endpoints";
import { useT } from "@/i18n";
import { formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useSession } from "@/stores/session";
import { Button } from "../ui/Button";

/** Shown on every page while Shamba OS staff view the portal as a farmer. Changes are refused by the server. */
export function ImpersonationBanner() {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const impersonation = useSession((s) => s.impersonation);
  const user = useSession((s) => s.user);
  if (!impersonation || !user) return null;

  const stop = async () => {
    const { refresh, signOut } = useSession.getState();
    try {
      await api.auth.logout(refresh);
    } catch {
      /* the session ends locally either way, and on the server within the hour */
    }
    signOut();
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "admin" });
    navigate(`/admin/farmers/${user.id}`, { replace: true });
  };

  return (
    <div className="impersonation-banner" role="status">
      <Eye size={18} aria-hidden />
      <span>
        {t("impersonation.banner", { name: user.name || formatPhone(user.phone), time: formatTime(impersonation.expires_at, t.locale) })}
      </span>
      <Button size="sm" variant="primary" onClick={stop}>{t("impersonation.stop")}</Button>
    </div>
  );
}
