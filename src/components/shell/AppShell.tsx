import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useT } from "@/i18n";
import { cx } from "@/lib/format";
import { useUi } from "@/stores/ui";
import { useNavItems, type NavItem } from "./nav";
import { Brand } from "./Brand";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { TopBar } from "./TopBar";

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const t = useT();
  const Icon = item.icon;
  const label = t(item.label);
  return (
    <NavLink to={item.to} end={item.to === "/"} className={({ isActive }) => cx("nav-link", isActive && "active")} onClick={onNavigate} aria-label={label}>
      <Icon size={20} aria-hidden />
      <span className="nav-text">{label}</span>
      <span className="nav-tip" aria-hidden>{label}</span>
    </NavLink>
  );
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function AppShell() {
  const t = useT();
  const { main, bottom } = useNavItems();
  const drawerOpen = useUi((s) => s.drawerOpen);
  const setDrawer = useUi((s) => s.setDrawer);
  const online = useOnline();
  const location = useLocation();
  const close = () => setDrawer(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="shell">
      {drawerOpen && <div className="overlay" onClick={close} style={{ zIndex: 54 }} />}
      <nav className={cx("sidebar", drawerOpen && "open")} aria-label={t("nav.main")}>
        <NavLink to="/" className="brand" onClick={close}>
          <Brand />
        </NavLink>
        {main.map((item) => (
          <NavEntry key={item.to} item={item} onNavigate={close} />
        ))}
        <div className="nav-spacer" />
        {bottom.map((item) => (
          <NavEntry key={item.to} item={item} onNavigate={close} />
        ))}
      </nav>
      <div className="main">
        <TopBar />
        <ImpersonationBanner />
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={18} aria-hidden />
            {t("state.offline")}
          </div>
        )}
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
