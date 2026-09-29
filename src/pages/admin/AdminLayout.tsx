import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, LogOut } from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import * as api from "@/api/endpoints";
import { Brand } from "@/components/shell/Brand";
import { Segmented } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { initials } from "@/lib/format";
import { useAdminSession } from "@/stores/adminSession";
import { useUi } from "@/stores/ui";

/** Anything under /admin needs a staff session; farmers' sessions don't count. */
export function RequireAdmin() {
  const refresh = useAdminSession((s) => s.refresh);
  const location = useLocation();
  if (!refresh) return <Navigate to="/admin/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** The staff area: a Charcoal top bar so it never looks like a farm account. */
export function AdminLayout() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAdminSession((s) => s.user);
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);

  const signOut = async () => {
    const { refresh, signOut } = useAdminSession.getState();
    try {
      await api.staff.logout(refresh);
    } catch {
      /* the session ends locally either way */
    }
    signOut();
    qc.removeQueries({ queryKey: ["admin"] });
    navigate("/admin/sign-in", { replace: true });
  };

  return (
    <div className="admin">
      <header className="admin-bar">
        <NavLink to="/admin" className="brand" end>
          <Brand />
        </NavLink>
        <span className="admin-badge">{t("admin.title")}</span>
        <nav className="admin-nav" aria-label={t("admin.title")}>
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? "active" : undefined)}>
            <BarChart3 size={18} aria-hidden /> {t("admin.analytics")}
          </NavLink>
        </nav>
        <span style={{ flex: 1 }} />
        <Segmented label={t("settings.language")} value={locale} onChange={setLocale} options={[{ value: "en", label: "EN" }, { value: "sw", label: "SW" }]} />
        {user && (
          <span className="admin-user" title={user.email ?? undefined}>
            <span className="avatar" aria-hidden>{initials(user.name || user.email || "S")}</span>
            <span className="hide-sm">{user.name || user.email}</span>
          </span>
        )}
        <button type="button" className="admin-signout" onClick={signOut}>
          <LogOut size={18} aria-hidden /> <span className="hide-sm">{t("admin.signOut")}</span>
        </button>
      </header>
      <main className="admin-content" id="main">
        <Outlet />
      </main>
    </div>
  );
}
