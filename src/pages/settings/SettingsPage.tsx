import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Save, UserPlus } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import * as api from "@/api/endpoints";
import { fieldErrors, useCatalogue, useErrorText, useFarm, useKey, useNavigation } from "@/api/hooks";
import type { Invitation, Locale, Member, Role, TypeCode } from "@/api/types";
import { useSetLocale, useSignOut } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { PageHead, Panel, Table, Tabs, useTabParam } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, Notice, Skeleton, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, FormError, SelectField, TextField } from "@/components/ui/forms";
import { ConfirmDialog, SidePanel } from "@/components/ui/overlay";
import { useT } from "@/i18n";
import { COUNTIES } from "@/lib/counties";
import { acres, boundaryProblem, fromPolygon, toPolygon, type LngLat } from "@/lib/geo";
import { formatDate, initials } from "@/lib/format";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { useCan, useMembership, useSession } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useUi } from "@/stores/ui";
import { BoundaryEditor, FarmForm } from "../../pages/auth/FarmSetup";
import { PasswordField } from "../auth/PasswordField";
import { PlotsSettings, StructuresSettings } from "../farm/LandSettings";
import { useInvalidateOrg } from "../enterprise/forms";
import { TypeTiles } from "../onboarding/TypeTiles";

/** The farm's drawn boundary (FRM-01/03), used for weather and, later, satellite data. */
function FarmBoundary() {
  const t = useT();
  const errorText = useErrorText();
  const { farm } = useFarm();
  const invalidate = useInvalidateOrg();
  const [ring, setRing] = useState<LngLat[]>(() => fromPolygon(farm?.boundary));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setRing(fromPolygon(farm?.boundary));
    setEditing(false);
  }, [farm?.id, farm?.boundary]);
  const save = useMutation({
    mutationFn: () => api.farms.update(farm!.id, { boundary: toPolygon(ring) }),
    onSuccess: () => (invalidate(), setEditing(false), toast(t("boundary.saved"))),
  });
  if (!farm) return null;

  const problem = boundaryProblem(ring);
  const saved = fromPolygon(farm.boundary);
  const sync = farm.weather_sync?.status ?? "none";

  return (
    <Panel title={t("boundary.title")}>
      <div className="stack" style={{ maxWidth: 720 }}>
        <p className="small muted">{t("boundary.help")}</p>
        {saved.length >= 3 && !editing && (
          <p>
            <strong>{t("boundary.area", { acres: acres(saved).toFixed(2), ha: Number(farm.area_ha ?? 0).toFixed(2) })}</strong>
            {sync !== "none" && <span className="small muted"> · {t(`boundary.sync.${sync}`)}</span>}
          </p>
        )}
        {editing ? (
          <>
            <Suspense fallback={<Skeleton height={360} />}>
              <BoundaryEditor value={ring} onChange={setRing} center={farm.location} />
            </Suspense>
            <FormError message={save.error ? fieldErrors(save.error).boundary || errorText(save.error) : null} />
            <div className="row" style={{ gap: 8 }}>
              <Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!!problem}>{t("common.save")}</Button>
              <Button variant="quiet" onClick={() => (setRing(saved), setEditing(false))}>{t("common.cancel")}</Button>
            </div>
          </>
        ) : (
          <div>
            <Button onClick={() => setEditing(true)}>{saved.length >= 3 ? t("boundary.redraw") : t("boundary.start")}</Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function FarmDetails() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { farm } = useFarm();
  const orgId = useSession((s) => s.activeOrgId);
  const setFarm = useUi((s) => s.setFarm);
  const invalidate = useInvalidateOrg();
  const [params] = useSearchParams();
  const [adding, setAdding] = useState(!!params.get("new"));
  const [name, setName] = useState(farm?.name ?? "");
  const [county, setCounty] = useState(farm?.county ?? "");
  useEffect(() => {
    setName(farm?.name ?? "");
    setCounty(farm?.county ?? "");
  }, [farm?.id, farm?.name, farm?.county]);
  const save = useMutation({ mutationFn: () => api.farms.update(farm!.id, { name, county }), onSuccess: () => (invalidate(), toast(t("settings.farmSaved"))) });

  return (
    <div className="stack-lg">
      <Panel title={t("settings.tab.farm")}>
        <form
          className="stack"
          style={{ maxWidth: 480 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <TextField label={t("setup.farmName")} value={name} onChange={setName} error={fieldErrors(save.error).name} />
          <SelectField label={t("setup.county")} value={county} onChange={setCounty} placeholder={t("setup.countyPlaceholder")} options={COUNTIES.map((c) => ({ value: c, label: c }))} />
          {farm?.location && <p className="small muted">{t("setup.gpsFound")}: {farm.location.lat.toFixed(3)}, {farm.location.lng.toFixed(3)}</p>}
          <FormError message={save.error ? errorText(save.error) : null} />
          <div>
            <Button type="submit" variant="primary" loading={save.isPending}>{t("common.save")}</Button>
          </div>
        </form>
      </Panel>
      <FarmBoundary />
      <Panel title={t("settings.newFarm")}>
        <div className="stack">
          <p className="muted">{t("settings.newFarmHelp")}</p>
          {adding ? (
            <div style={{ maxWidth: 480 }}>
              <FarmForm
                submitLabel={t("common.continue")}
                onDone={(f) => {
                  if (orgId) setFarm(orgId, f.id);
                  qc.invalidateQueries();
                  navigate("/setup/choose");
                }}
              />
            </div>
          ) : (
            <div>
              <Button onClick={() => setAdding(true)}>{t("settings.newFarm")}</Button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** The same tiles as onboarding. Hiding a type keeps its history (ONB-05). */
function WhatYouKeep() {
  const t = useT();
  const errorText = useErrorText();
  const catalogue = useCatalogue();
  const nav = useNavigation();
  const { farm } = useFarm();
  const invalidate = useInvalidateOrg();
  const [picks, setPicks] = useState<TypeCode[]>([]);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (nav.data) setPicks(nav.data.types);
  }, [nav.data]);
  const save = useMutation({ mutationFn: () => api.farms.setTypes(farm!.id, picks), onSuccess: () => (invalidate(), toast(t("settings.keepSaved")), setConfirm(false)) });
  const removed = (nav.data?.types ?? []).filter((c) => !picks.includes(c));
  const label = (c: TypeCode) => catalogue.data?.enterprise_types.find((x) => x.code === c)?.labels[t.locale] ?? c;
  const changed = removed.length > 0 || picks.some((p) => !nav.data?.types.includes(p));

  return (
    <div className="stack-lg">
      <p className="muted">{t("settings.keepHelp")}</p>
      {catalogue.data && <TypeTiles types={catalogue.data.enterprise_types} value={picks} onChange={setPicks} />}
      <FormError message={save.error ? errorText(save.error) : null} />
      <div>
        <Button variant="primary" disabled={!changed || picks.length === 0} loading={save.isPending} onClick={() => (removed.length ? setConfirm(true) : save.mutate())}>
          {picks.length === 0 ? t("choose.pickOne") : t("settings.keepSave")}
        </Button>
      </div>
      {confirm && (
        <ConfirmDialog
          title={t("settings.hideConfirm", { types: removed.map(label).join(", ") })}
          body={<p className="muted">{t("settings.keepHelp")}</p>}
          confirmLabel={t("settings.hide")}
          destructive={false}
          loading={save.isPending}
          onConfirm={() => save.mutate()}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

function InvitePanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const invalidate = useInvalidateOrg();
  const isOwner = useMembership()?.role === "owner";
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("field_worker");
  const save = useMutation({ mutationFn: () => api.org.invite(phone, role), onSuccess: (inv) => (invalidate(), toast(t("members.invited", { phone: formatPhone(inv.phone) })), onClose()) });
  const err = fieldErrors(save.error);
  const roles: Role[] = isOwner ? ["field_worker", "manager"] : ["field_worker"];
  return (
    <SidePanel title={t("members.inviteTitle")} onClose={onClose} onSubmit={() => save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("members.invite")}</Button></>}>
      <div className="stack">
        <p className="muted">{t("members.inviteHelp")}</p>
        <TextField label={t("common.phone")} value={phone} onChange={setPhone} type="tel" inputMode="tel" placeholder="0712 345 678" error={err.phone} autoFocus />
        <ChoiceCards label={t("members.role")} value={role} onChange={setRole} options={roles.map((r) => ({ value: r, label: t(`role.${r}`), help: t(`members.roleHelp.${r as "manager" | "field_worker"}`) }))} />
        <FormError message={save.error && !err.phone ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** Members and invitations (ACC-03, ACC-05), against the live tenancy API. */
function Members() {
  const t = useT();
  const key = useKey();
  const errorText = useErrorText();
  const me = useSession((s) => s.user);
  const role = useMembership()?.role;
  const canManage = useCan("members.manage");
  const invalidate = useInvalidateOrg();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const members = useQuery({ queryKey: key("members"), queryFn: api.org.members, select: (p) => p.results, enabled: canManage });
  const invitations = useQuery({ queryKey: key("invitations"), queryFn: api.org.invitations, select: (p) => p.results, enabled: canManage });
  const remove = useMutation({
    mutationFn: (m: Member) => api.org.removeMember(m.id),
    onSuccess: (_, m) => (invalidate(), toast(t("members.removed", { name: m.name || formatPhone(m.phone) })), setRemoving(null)),
    onError: (e) => (toast(errorText(e), "error"), setRemoving(null)),
  });
  const revoke = useMutation({ mutationFn: (i: Invitation) => api.org.revokeInvitation(i.id), onSuccess: () => (invalidate(), toast(t("members.revoked"))) });
  const changeRole = useMutation({ mutationFn: ({ id, role: r }: { id: string; role: Role }) => api.org.changeRole(id, r), onSuccess: () => (invalidate(), toast(t("members.roleChanged"))), onError: (e) => toast(errorText(e), "error") });

  if (!canManage) return <Notice>{t("members.onlyOwner")}</Notice>;
  if (members.isLoading) return <SkeletonRows rows={3} />;
  if (members.error) return <ErrorState error={members.error} onRetry={() => members.refetch()} />;

  return (
    <div className="stack-lg">
      <div>
        <Button variant="primary" icon={<UserPlus size={18} />} onClick={() => setInviting(true)}>{t("members.invite")}</Button>
      </div>
      <Table
        rows={members.data ?? []}
        rowKey={(m) => m.id}
        columns={[
          { key: "n", header: t("common.name"), render: (m) => <span className="strong">{m.name || formatPhone(m.phone)}{m.user_id === me?.id && <span className="muted small"> ({t("members.you")})</span>}</span> },
          { key: "p", header: t("common.phone"), render: (m) => formatPhone(m.phone) },
          {
            key: "r",
            header: t("members.role"),
            render: (m) =>
              role === "owner" && m.role !== "owner" ? (
                <select className="select" style={{ width: "auto", minHeight: 32 }} aria-label={`${t("members.changeRole")}, ${m.name}`} value={m.role} onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value as Role })}>
                  <option value="manager">{t("role.manager")}</option>
                  <option value="field_worker">{t("role.field_worker")}</option>
                </select>
              ) : (
                t(`role.${m.role}`)
              ),
          },
          { key: "since", header: t("list.col.started"), render: (m) => formatDate(m.created_at, t.locale) },
          {
            key: "x",
            header: <span className="visually-hidden">{t("members.remove")}</span>,
            label: "",
            render: (m) => (m.role !== "owner" && m.user_id !== me?.id && (role === "owner" || m.role === "field_worker") ? <Button variant="destructive" size="sm" onClick={() => setRemoving(m)}>{t("members.remove")}</Button> : null),
          },
        ]}
      />
      {!!invitations.data?.length && (
        <section className="stack" style={{ gap: 12 }}>
          <h2>{t("members.pending")}</h2>
          <Table
            rows={invitations.data}
            rowKey={(i) => i.id}
            columns={[
              { key: "p", header: t("common.phone"), render: (i) => <span className="strong">{formatPhone(i.phone)}</span> },
              { key: "r", header: t("members.role"), render: (i) => t(`role.${i.role}`) },
              { key: "d", header: t("common.status"), render: (i) => <Chip tone="amber">{t("members.pendingSince", { date: formatDate(i.created_at, t.locale, { year: false }) })}</Chip> },
              { key: "x", header: <span className="visually-hidden">{t("members.revoke")}</span>, label: "", render: (i) => <Button variant="quiet" size="sm" onClick={() => revoke.mutate(i)}>{t("members.revoke")}</Button> },
            ]}
          />
        </section>
      )}
      {inviting && <InvitePanel onClose={() => setInviting(false)} />}
      {removing && (
        <ConfirmDialog
          title={t("members.removeTitle", { name: removing.name || formatPhone(removing.phone) })}
          body={<p>{t("members.removeHelp", { name: removing.name || formatPhone(removing.phone) })}</p>}
          confirmLabel={t("members.remove")}
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

/** Change your password, or set a first one if you only ever signed in with SMS codes. */
function ChangePassword() {
  const t = useT();
  const errorText = useErrorText();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const hasPassword = user?.has_password !== false;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationFn: () => api.me.changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
      if (user && !hasPassword) setUser({ ...user, has_password: true });
      toast(t("settings.passwordChanged"));
    },
  });
  const errors = fieldErrors(change.error);
  return (
    <Panel title={hasPassword ? t("settings.passwordTitle") : t("settings.passwordSetTitle")}>
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const differ = next !== again;
          setMismatch(differ);
          if (!differ) change.mutate();
        }}
      >
        {!hasPassword && <p className="small muted">{t("settings.passwordSetHelp")}</p>}
        {hasPassword && (
          <PasswordField label={t("settings.currentPassword")} value={current} onChange={setCurrent} autoComplete="current-password" error={errors.current_password} />
        )}
        <PasswordField label={t("auth.newPassword")} hint={t("auth.passwordHint")} value={next} onChange={setNext} autoComplete="new-password" error={errors.new_password} />
        <PasswordField label={t("settings.confirmPassword")} value={again} onChange={setAgain} autoComplete="new-password" error={mismatch ? t("settings.passwordMismatch") : undefined} />
        <p className="small muted">{t("settings.passwordSignsOut")}</p>
        <FormError message={change.error && !errors.current_password && !errors.new_password ? errorText(change.error) : null} />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary" loading={change.isPending} disabled={!next || !again || (hasPassword && !current)}>
            {hasPassword ? t("settings.changePassword") : t("settings.setPassword")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** A copy of everything kept about you, and erasing your account (NFR-11). */
function YourData() {
  const t = useT();
  const errorText = useErrorText();
  const signOut = useSignOut();
  const [confirming, setConfirming] = useState(false);
  const download = useMutation({
    mutationFn: api.me.exportData,
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `shamba-os-my-data-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  const erase = useMutation({ mutationFn: api.me.deleteAccount, onSuccess: () => (toast(t("account.deleted")), signOut()) });
  return (
    <>
      <Panel title={t("account.dataTitle")}>
        <div className="stack">
          <p className="small muted">{t("account.dataHelp")}</p>
          <FormError message={download.error ? errorText(download.error) : null} />
          <div>
            <Button icon={<Download size={16} />} loading={download.isPending} onClick={() => download.mutate()}>{t("account.download")}</Button>
          </div>
        </div>
      </Panel>
      <Panel title={t("account.deleteTitle")}>
        <div className="stack">
          <p className="small muted">{t("account.deleteHelp")}</p>
          <div>
            <Button variant="destructive" onClick={() => (erase.reset(), setConfirming(true))}>{t("account.delete")}</Button>
          </div>
        </div>
      </Panel>
      {confirming && (
        <ConfirmDialog
          title={t("account.deleteConfirmTitle")}
          body={
            <div className="stack">
              <p>{t("account.deleteConfirm")}</p>
              <FormError message={erase.error ? errorText(erase.error) : null} />
            </div>
          }
          confirmLabel={t("account.delete")}
          loading={erase.isPending}
          onConfirm={() => erase.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function You() {
  const t = useT();
  const errorText = useErrorText();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const role = useMembership()?.role;
  const locale = useUi((s) => s.locale);
  const setLocale = useSetLocale();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(formatPhone(user?.phone));
  const [email, setEmail] = useState(user?.email ?? "");
  const changes = {
    ...(name.trim() !== (user?.name ?? "") && { name: name.trim() }),
    ...(normalizePhone(phone) !== user?.phone && { phone: normalizePhone(phone) ?? phone.trim() }),
    ...(email.trim().toLowerCase() !== (user?.email ?? "") && { email: email.trim() }),
  };
  const save = useMutation({
    mutationFn: () => api.me.update(changes),
    onSuccess: (u) => {
      setUser(u);
      setPhone(formatPhone(u.phone));
      setEmail(u.email ?? "");
      toast(t("settings.saved"));
    },
  });
  const errors = fieldErrors(save.error);
  const displayName = name.trim() || user?.name || formatPhone(user?.phone);
  return (
    <div className="stack-lg">
      <Panel title={t("settings.profileTitle")}>
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="profile-head">
            <span className="avatar avatar-lg" aria-hidden>{initials(displayName || "?")}</span>
            <div>
              <p className="strong">{displayName}</p>
              <p className="small muted">
                {[role && t(`role.${role}`), user?.date_joined && t("settings.joined", { date: formatDate(user.date_joined, t.locale) })].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="form-grid">
            <TextField label={t("settings.name")} value={name} onChange={setName} autoComplete="name" error={errors.name} />
            <SelectField
              label={t("settings.language")}
              value={locale}
              onChange={(v) => setLocale(v as Locale)}
              hint={t("settings.languageHelp")}
              options={[{ value: "sw", label: "Kiswahili" }, { value: "en", label: "English" }, { value: "fr", label: "Français" }]}
            />
            <TextField label={t("auth.phone")} type="tel" value={phone} onChange={setPhone} autoComplete="tel" error={errors.phone} />
            <TextField label={t("auth.email")} type="email" value={email} onChange={setEmail} autoComplete="email" error={errors.email} optional />
          </div>
          <p className="small muted">{t("settings.contactHelp")}</p>
          <FormError message={save.error ? errorText(save.error) : null} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" icon={<Save size={16} aria-hidden />} loading={save.isPending} disabled={!Object.keys(changes).length}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Panel>
      <div className="grid-2">
        <ChangePassword />
        <div className="stack-lg">
          <YourData />
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const t = useT();
  const role = useMembership()?.role;
  const isOwner = role === "owner";
  const worker = role === "field_worker";
  const tabs = worker
    ? [{ value: "you" as const, label: t("settings.tab.you") }]
    : [
        { value: "farm" as const, label: t("settings.tab.farm") },
        { value: "keep" as const, label: t("settings.tab.keep") },
        { value: "plots" as const, label: t("farm.plots") },
        { value: "structures" as const, label: t("farm.structures") },
        { value: "members" as const, label: t("settings.tab.members") },
        { value: "you" as const, label: t("settings.tab.you") },
      ];
  const [tab, setTab] = useTabParam(tabs.map((x) => x.value), tabs[0]!.value);
  return (
    <>
      <PageHead title={t("settings.title")} />
      <Tabs label={t("settings.title")} value={tab} onChange={setTab} tabs={tabs} />
      {(tab === "farm" || tab === "keep") && !isOwner ? (
        <div className="panel"><EmptyState text={t("settings.managerFarm")} /></div>
      ) : (
        <>
          {tab === "farm" && <FarmDetails />}
          {tab === "keep" && <WhatYouKeep />}
          {tab === "plots" && <PlotsSettings />}
          {tab === "structures" && <StructuresSettings />}
          {tab === "members" && <Members />}
          {tab === "you" && <You />}
        </>
      )}
    </>
  );
}
