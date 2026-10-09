import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, KeyRound, LogOut, Menu, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import * as api from "@/api/endpoints";
import { Brand } from "@/components/shell/Brand";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/forms";
import { useT, type MsgKey } from "@/i18n";
import { cx, initials } from "@/lib/format";
import { useAdminSession } from "@/stores/adminSession";
import { useUi } from "@/stores/ui";

/** Anything under /admin needs a staff session; farmers' sessions don't count. Staff sign in at /sign-in too. */
export function RequireAdmin() {
  const refresh = useAdminSession((s) => s.refresh);
  const location = useLocation();
  if (!refresh) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Staff pages, in sidebar order. Add a page here and it appears in the sidebar. */
const NAV: { to: string; label: MsgKey; icon: LucideIcon }[] = [
  { to: "/admin", label: "admin.analytics", icon: BarChart3 },
  { to: "/admin/farmers", label: "admin.farmers", icon: Users },
  { to: "/admin/keys", label: "admin.keys", icon: KeyRound },
];

/** The staff area: the farmer app's sidebar layout in Charcoal, so it never looks like a farm account. */
export function AdminLayout() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const user = useAdminSession((s) => s.user);
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const close = () => setDrawerOpen(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const signOut = async () => {
    const { refresh, signOut } = useAdminSession.getState();
    try {
      await api.staff.logout(refresh);
    } catch {
      /* the session ends locally either way */
    }
    signOut();
    qc.removeQueries({ queryKey: ["admin"] });
    navigate("/sign-in", { replace: true });
  };

  const name = user?.name || user?.email || "";

  return (
    <div className="shell admin-shell">
      {drawerOpen && <div className="overlay" onClick={close} style={{ zIndex: 54 }} />}
      <nav className={cx("sidebar", drawerOpen && "open")} aria-label={t("admin.title")}>
        <NavLink to="/admin" className="brand" end onClick={close}>
          <Brand />
        </NavLink>
        <span className="admin-badge"><ShieldCheck size={14} aria-hidden /> <span className="nav-text">{t("admin.title")}</span></span>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => cx("nav-link", isActive && "active")} onClick={close} aria-label={t(label)}>
            <Icon size={20} aria-hidden />
            <span className="nav-text">{t(label)}</span>
            <span className="nav-tip" aria-hidden>{t(label)}</span>
          </NavLink>
        ))}
        <div className="nav-spacer" />
        {user && (
          <div className="admin-user" title={user.email ?? undefined}>
            <span className="avatar" aria-hidden>{initials(name || "S")}</span>
            <span className="nav-text">
              <span className="admin-user-name">{name}</span>
              {user.name && user.email && <span className="admin-user-email">{user.email}</span>}
            </span>
          </div>
        )}
        <button type="button" className="nav-link" onClick={signOut} aria-label={t("admin.signOut")}>
          <LogOut size={20} aria-hidden />
          <span className="nav-text">{t("admin.signOut")}</span>
          <span className="nav-tip" aria-hidden>{t("admin.signOut")}</span>
        </button>
      </nav>
      <div className="main">
        <header className="topbar">
          <Button variant="quiet" className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label={t("nav.menu")} icon={<Menu size={22} />} />
          <span className="grow" />
          <Segmented label={t("settings.language")} value={locale} onChange={setLocale} options={[{ value: "en", label: "EN" }, { value: "sw", label: "SW" }, { value: "fr", label: "FR" }]} />
        </header>
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
