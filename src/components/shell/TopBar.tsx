import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Calendar, Check, ChevronDown, LogOut, Menu, Plus, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useFarm, useKey } from "@/api/hooks";
import * as api from "@/api/endpoints";
import type { Locale } from "@/api/types";
import { AlertRow } from "@/pages/alerts/AlertRow";
import { useT } from "@/i18n";
import { formatPhone } from "@/lib/phone";
import { initials } from "@/lib/format";
import { useCan, useMembership, useSession } from "@/stores/session";
import { useUi, type RangePreset } from "@/stores/ui";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/forms";
import { useDismiss } from "../ui/overlay";

function Dropdown({ trigger, children, align = "left", label }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={`menu ${align === "right" ? "right" : ""}`} role="menu" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Switching organisation clears cached data (12); every key is org-scoped as well. */
export function useSwitchOrg() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const switchOrg = useSession((s) => s.switchOrg);
  return (orgId: string) => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "catalogue" });
    switchOrg(orgId);
    navigate("/");
  };
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    const { refresh, signOut } = useSession.getState();
    try {
      await api.auth.logout(refresh);
    } catch {
      /* the session ends locally either way */
    }
    signOut();
    qc.clear();
    navigate("/sign-in", { replace: true });
  };
}

function FarmSwitcher() {
  const t = useT();
  const { farm, farms } = useFarm();
  const memberships = useSession((s) => s.memberships);
  const activeOrgId = useSession((s) => s.activeOrgId);
  const setFarm = useUi((s) => s.setFarm);
  const canAdd = useCan("org.settings");
  const switchOrg = useSwitchOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();

  return (
    <Dropdown
      label={t("top.farm")}
      trigger={(open, toggle) => (
        <button type="button" className="top-trigger" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
          <span className="label">{farm?.name ?? "…"}</span>
          <ChevronDown size={16} aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <>
          {farms.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitemradio"
              aria-checked={f.id === farm?.id}
              className="menu-item"
              onClick={() => {
                setFarm(activeOrgId!, f.id);
                qc.invalidateQueries();
                close();
              }}
            >
              <span style={{ width: 16 }}>{f.id === farm?.id && <Check size={16} aria-hidden />}</span>
              {f.name}
            </button>
          ))}
          {canAdd && (
            <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), navigate("/settings?tab=farm&new=1"))}>
              <Plus size={16} aria-hidden />
              {t("top.addFarm")}
            </button>
          )}
          {memberships.length > 1 && (
            <>
              <div className="menu-sep" />
              <p className="small muted" style={{ padding: "4px 12px" }}>{t("top.accounts")}</p>
              {memberships.map((m) => (
                <button key={m.organisation_id} type="button" role="menuitemradio" aria-checked={m.organisation_id === activeOrgId} className="menu-item" onClick={() => (close(), m.organisation_id !== activeOrgId && switchOrg(m.organisation_id))}>
                  <span style={{ width: 16 }}>{m.organisation_id === activeOrgId && <Check size={16} aria-hidden />}</span>
                  <span>
                    {m.organisation_name}
                    <span className="small muted" style={{ display: "block" }}>{t.dyn(`role.${m.role}`, m.role)}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </>
      )}
    </Dropdown>
  );
}

const RANGES: RangePreset[] = ["this_month", "last_month", "last_30", "this_year"];

function RangePicker() {
  const t = useT();
  const range = useUi((s) => s.range);
  const setRange = useUi((s) => s.setRange);
  return (
    <Dropdown
      label={t("range.label")}
      trigger={(open, toggle) => (
        <button type="button" className="top-trigger icon-sm" aria-haspopup="menu" aria-expanded={open} onClick={toggle} aria-label={t(`range.${range}`)}>
          <Calendar size={16} aria-hidden className="muted" />
          <span className="label">{t(`range.${range}`)}</span>
          <ChevronDown size={16} aria-hidden />
        </button>
      )}
    >
      {(close) =>
        RANGES.map((r) => (
          <button key={r} type="button" role="menuitemradio" aria-checked={r === range} className="menu-item" onClick={() => (setRange(r), close())}>
            <span style={{ width: 16 }}>{r === range && <Check size={16} aria-hidden />}</span>
            {t(`range.${r}`)}
          </button>
        ))
      }
    </Dropdown>
  );
}

export function useSetLocale() {
  const setLocale = useUi((s) => s.setLocale);
  const setUser = useSession((s) => s.setUser);
  return (locale: Locale) => {
    setLocale(locale);
    // Language is a personal setting, stored on the user (ONB-01).
    if (useSession.getState().user) api.me.update({ preferred_locale: locale }).then(setUser).catch(() => undefined);
  };
}

function Alerts() {
  const t = useT();
  const key = useKey();
  const { farm } = useFarm();
  const alerts = useQuery({ queryKey: key("alerts", farm?.id), queryFn: () => api.alerts.list(farm!.id), enabled: !!farm, refetchInterval: 60_000 });
  const open = alerts.data?.results.filter((a) => a.status === "open") ?? [];
  return (
    <Dropdown
      align="right"
      label={t("nav.alerts")}
      trigger={(isOpen, toggle) => (
        <Button variant="quiet" className="bell" onClick={toggle} aria-haspopup="menu" aria-expanded={isOpen} aria-label={t("top.alerts", { n: open.length })} icon={<Bell size={20} />}>
          {open.length > 0 && <span className="count" aria-hidden>{open.length}</span>}
        </Button>
      )}
    >
      {(close) => (
        <div style={{ width: "min(360px, 86vw)", padding: "4px 8px" }}>
          {open.length === 0 ? (
            <p className="muted" style={{ padding: 8 }}>{t("alerts.none")}</p>
          ) : (
            <div className="alert-list">
              {open.slice(0, 5).map((a) => (
                <AlertRow key={a.id} alert={a} onAction={close} />
              ))}
            </div>
          )}
          <div className="menu-sep" />
          <Link to="/alerts" className="menu-item" onClick={close} style={{ textDecoration: "none", color: "var(--green-800)", fontWeight: 500 }}>
            {t("alerts.viewAll")}
          </Link>
        </div>
      )}
    </Dropdown>
  );
}

function UserMenu() {
  const t = useT();
  const user = useSession((s) => s.user);
  const membership = useMembership();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const name = user?.name || formatPhone(user?.phone);
  return (
    <Dropdown
      align="right"
      label={t("top.user")}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={t("top.user")} style={{ border: 0, background: "none", padding: 2, cursor: "pointer", borderRadius: "50%" }}>
          <span className="avatar">{initials(user?.name || "?")}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div style={{ padding: "8px 12px" }}>
            <p className="strong">{name}</p>
            <p className="small muted">{formatPhone(user?.phone)}</p>
            {membership && <p className="small muted">{t.dyn(`role.${membership.role}`, membership.role)}</p>}
          </div>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), navigate("/settings?tab=you"))}>
            <SettingsIcon size={16} aria-hidden />
            {t("top.settings")}
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => (close(), signOut())}>
            <LogOut size={16} aria-hidden />
            {t("top.signOut")}
          </button>
        </>
      )}
    </Dropdown>
  );
}

export function TopBar() {
  const t = useT();
  const locale = useUi((s) => s.locale);
  const setLocale = useSetLocale();
  const setDrawer = useUi((s) => s.setDrawer);
  const money = useCan("money.read");
  return (
    <header className="topbar">
      <Button variant="quiet" className="menu-btn" onClick={() => setDrawer(true)} aria-label={t("nav.menu")} icon={<Menu size={22} />} />
      <FarmSwitcher />
      {money && <RangePicker />}
      <div className="grow" />
      <span className="hide-sm">
        <Segmented<Locale>
          label={t("top.language")}
          value={locale}
          onChange={setLocale}
          options={[
            { value: "en", label: "EN" },
            { value: "sw", label: "SW" },
          ]}
        />
      </span>
      <Alerts />
      <UserMenu />
    </header>
  );
}
