import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText } from "@/api/hooks";
import type { EmailAudience, StaffEmailDetail, StaffEmailInput, StaffEmailPerson } from "@/api/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, Notice, NoPermission, Skeleton, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, Field, FormError, TextField } from "@/components/ui/forms";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useT } from "@/i18n";
import { formatDate, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useAdminSession } from "@/stores/adminSession";
import { toast } from "@/stores/toast";
import { audienceLabel, StatusChip } from "./AdminEmails";

const EMPTY: StaffEmailInput = { subject: "", heading: "", body: "", button_label: "", button_url: "", audience: "selected", recipient_ids: [] };

/** The email as farmers will see it, rendered by the server as they type (a short pause first). */
function Preview({ draft }: { draft: StaffEmailInput }) {
  const t = useT();
  const [shown, setShown] = useState(draft);
  useEffect(() => {
    const id = setTimeout(() => setShown(draft), 500);
    return () => clearTimeout(id);
  }, [draft]);
  const ready = !!shown.subject.trim() && !!shown.body.trim();
  const q = useQuery({
    queryKey: ["admin", "email-preview", shown.subject, shown.heading, shown.body, shown.button_label, shown.button_url],
    queryFn: () => api.staff.previewEmail({ ...shown, recipient_ids: [] }),
    enabled: ready,
    placeholderData: (prev) => prev,
    retry: false,
  });
  return (
    <Panel title={t("email.preview")} className="email-preview" bodyless>
      {!ready ? (
        <EmptyState text={t("email.previewEmpty")} />
      ) : !q.data ? (
        <div className="panel-body"><Skeleton height={480} /></div>
      ) : (
        <>
          <p className="small email-preview-subject">
            <span className="muted">{t("email.subject")}:</span> <span className="strong">{q.data.subject}</span>
            {shown.body.includes("{name}") && <span className="muted" style={{ display: "block" }}>{t("email.previewName")}</span>}
          </p>
          <iframe title={t("email.preview")} srcDoc={q.data.html} sandbox="" className="email-preview-frame" />
        </>
      )}
    </Panel>
  );
}

/** Search farmers and pick one or more. Farmers without an email address are shown but won't get it. */
function RecipientPicker({ chosen, onChange }: { chosen: StaffEmailPerson[]; onChange: (p: StaffEmailPerson[]) => void }) {
  const t = useT();
  const staffId = useAdminSession((s) => s.user?.id);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const results = useQuery({ queryKey: ["admin", staffId, "farmers", q], queryFn: () => api.staff.farmers(q), enabled: q.length > 0 });
  const ids = new Set(chosen.map((c) => c.id));
  const matches = (results.data?.results ?? []).filter((r) => !ids.has(r.id)).slice(0, 8);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {chosen.length > 0 && (
        <ul className="recipient-chips list-plain" aria-label={t("email.chosen")}>
          {chosen.map((p) => (
            <li key={p.id} className={p.email ? "" : "no-email"}>
              <span>
                <span className="strong">{p.name || formatPhone(p.phone)}</span>
                <span className="small muted"> {p.email ?? t("email.noEmail")}</span>
              </span>
              <button type="button" aria-label={t("email.removeRecipient", { name: p.name || p.phone })} onClick={() => onChange(chosen.filter((c) => c.id !== p.id))}>
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="recipient-search">
        <span className="admin-search">
          <Search size={18} aria-hidden />
          <TextField label={<span className="visually-hidden">{t("email.findFarmer")}</span>} value={search} onChange={setSearch} type="search" placeholder={t("admin.farmersSearchHint")} autoComplete="off" />
        </span>
        {q && (
          <ul className="recipient-results list-plain" role="listbox" aria-label={t("email.findFarmer")}>
            {results.isLoading ? (
              <li className="muted small">…</li>
            ) : !matches.length ? (
              <li className="muted small">{t("admin.farmersNoMatch", { q })}</li>
            ) : (
              matches.map((r) => (
                <li key={r.id}>
                  <button type="button" role="option" aria-selected={false} onClick={() => (onChange([...chosen, { id: r.id, name: r.name, email: r.email, phone: r.phone }]), setSearch(""))}>
                    <span className="strong">{r.name || t("admin.noName")}</span>
                    <span className="small muted">{r.email ?? t("email.noEmail")} · {formatPhone(r.phone)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Who will get it: counted by the server for everyone or owners, here for chosen farmers. */
function Reach({ audience, chosen }: { audience: EmailAudience; chosen: StaffEmailPerson[] }) {
  const t = useT();
  const staffId = useAdminSession((s) => s.user?.id);
  const q = useQuery({ queryKey: ["admin", staffId, "email-audience", audience], queryFn: () => api.staff.emailAudience(audience as "all" | "owners"), enabled: audience !== "selected" });
  const counts = audience === "selected"
    ? { with_email: chosen.filter((c) => c.email).length, without_email: chosen.filter((c) => !c.email).length }
    : q.data;
  if (!counts) return <Skeleton height={20} width="60%" />;
  return (
    <p className="small">
      <span className="strong">{t.n("email.reaches", counts.with_email)}</span>
      {counts.without_email > 0 && <span className="muted"> {t.n("email.skipped", counts.without_email)}</span>}
    </p>
  );
}

function Editor({ saved }: { saved: StaffEmailDetail | null }) {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const staffId = useAdminSession((s) => s.user?.id);
  const staffEmail = useAdminSession((s) => s.user?.email);
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState<StaffEmailInput>(() => saved ? { subject: saved.subject, heading: saved.heading, body: saved.body, button_label: saved.button_label, button_url: saved.button_url, audience: saved.audience, recipient_ids: [] } : EMPTY);
  const [chosen, setChosen] = useState<StaffEmailPerson[]>(saved?.recipients ?? []);
  // A new draft saved by "Send…" opens here again with ?send=1, so the confirmation follows it.
  const [confirming, setConfirming] = useState(() => !!saved && params.get("send") === "1");
  useEffect(() => {
    if (params.get("send")) setParams((p) => (p.delete("send"), p), { replace: true });
  }, [params, setParams]);
  const set = <K extends keyof StaffEmailInput>(k: K) => (v: StaffEmailInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const draft = useMemo(() => ({ ...f, recipient_ids: chosen.map((c) => c.id) }), [f, chosen]);

  // "Email this farmer" from a farmer's page: /admin/emails/new?to=<id>
  const to = params.get("to");
  const prefill = useQuery({ queryKey: ["admin", staffId, "farmer", to], queryFn: () => api.staff.farmer(to!), enabled: !saved && !!to });
  useEffect(() => {
    const p = prefill.data;
    if (p) setChosen((c) => (c.some((x) => x.id === p.id) ? c : [...c, { id: p.id, name: p.name, email: p.email, phone: p.phone }]));
  }, [prefill.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", staffId, "emails"] });
  /** Saves the draft (creating it the first time) and returns it. */
  const persist = async (then = "") => {
    const out = saved ? await api.staff.updateEmail(saved.id, draft) : await api.staff.createEmail(draft);
    qc.setQueryData(["admin", staffId, "email", out.id], out);
    refresh();
    if (!saved) navigate(`/admin/emails/${out.id}${then}`, { replace: true });
    return out;
  };
  const save = useMutation({ mutationFn: () => persist(), onSuccess: () => toast(t("email.saved")) });
  const test = useMutation({ mutationFn: async () => api.staff.testEmail((await persist()).id), onSuccess: (r) => toast(t("email.testSent", { email: r.to })) });
  const check = useMutation({ mutationFn: () => persist("?send=1"), onSuccess: () => saved && setConfirming(true) });
  const send = useMutation({
    mutationFn: () => api.staff.sendEmail(saved!.id),
    onSuccess: (out) => {
      qc.setQueryData(["admin", staffId, "email", out.id], out);
      refresh();
      setConfirming(false);
      toast(t.n("email.sending", out.counts.total));
    },
  });
  const discard = useMutation({
    mutationFn: () => api.staff.deleteEmail(saved!.id),
    onSuccess: () => (refresh(), toast(t("email.discarded")), navigate("/admin/emails")),
  });
  const [discarding, setDiscarding] = useState(false);
  const busy = save.isPending || test.isPending || check.isPending;
  const failed = save.error ?? test.error ?? check.error;
  const err = fieldErrors(failed);
  const reachable = f.audience === "selected" ? chosen.filter((c) => c.email).length : null;

  return (
    <div className="email-editor">
      <form className="stack" noValidate onSubmit={(e) => (e.preventDefault(), save.mutate())}>
        <Panel title={t("email.to")}>
          <div className="stack">
            <ChoiceCards<EmailAudience>
              label={t("email.audience")}
              value={f.audience}
              onChange={set("audience")}
              options={[
                { value: "selected", label: t("email.audience.selected"), help: t("email.audience.selectedHelp") },
                { value: "owners", label: t("email.audience.owners"), help: t("email.audience.ownersHelp") },
                { value: "all", label: t("email.audience.all"), help: t("email.audience.allHelp") },
              ]}
            />
            {f.audience === "selected" && <RecipientPicker chosen={chosen} onChange={setChosen} />}
            {err.recipient_ids && <p className="error small" role="alert">{err.recipient_ids}</p>}
            <Reach audience={f.audience} chosen={chosen} />
          </div>
        </Panel>
        <Panel title={t("email.message")}>
          <div className="stack">
            <TextField label={t("email.subject")} value={f.subject} onChange={set("subject")} maxLength={200} error={err.subject} />
            <TextField label={t("email.heading")} value={f.heading} onChange={set("heading")} maxLength={200} placeholder={f.subject} hint={t("email.headingHint")} optional />
            <Field label={t("email.body")} hint={t("email.bodyHint")} error={err.body}>
              {(id, describedBy, invalid) => (
                <textarea id={id} className="textarea" rows={12} value={f.body} onChange={(e) => set("body")(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} placeholder={t("email.bodyPlaceholder")} />
              )}
            </Field>
            <div className="form-grid">
              <TextField label={t("email.buttonLabel")} value={f.button_label} onChange={set("button_label")} maxLength={60} placeholder={t("email.buttonLabelPlaceholder")} optional />
              <TextField label={t("email.buttonUrl")} value={f.button_url} onChange={set("button_url")} type="url" placeholder="https://shambaos.com" error={err.button_url} optional />
            </div>
          </div>
        </Panel>
        <FormError message={failed && !Object.keys(err).length ? errorText(failed) : null} />
        <div className="row email-actions">
          {saved && <Button variant="destructive" onClick={() => setDiscarding(true)}>{t("email.discard")}</Button>}
          <span className="grow" />
          <Button type="submit" loading={save.isPending} disabled={busy}>{t("email.saveDraft")}</Button>
          <Button onClick={() => test.mutate()} loading={test.isPending} disabled={busy || !staffEmail}>{t("email.sendTest")}</Button>
          <Button variant="primary" icon={<Send size={16} aria-hidden />} onClick={() => check.mutate()} loading={check.isPending} disabled={busy || reachable === 0}>{t("email.send")}</Button>
        </div>
      </form>
      <Preview draft={draft} />
      {confirming && saved && (
        <ConfirmDialog
          title={t("email.confirmTitle")}
          destructive={false}
          body={
            <div className="stack">
              <p><span className="strong">{saved.subject}</span></p>
              <Reach audience={saved.audience} chosen={saved.recipients} />
              <p className="small muted">{t("email.confirmHelp")}</p>
              <FormError message={send.error ? errorText(send.error) : null} />
            </div>
          }
          confirmLabel={t("email.sendNow")}
          loading={send.isPending}
          onConfirm={() => send.mutate()}
          onClose={() => (setConfirming(false), send.reset())}
        />
      )}
      {discarding && (
        <ConfirmDialog title={t("email.discardTitle")} body={<p>{t("email.discardHelp")}</p>} confirmLabel={t("email.discard")} loading={discard.isPending} onConfirm={() => discard.mutate()} onClose={() => setDiscarding(false)} />
      )}
    </div>
  );
}

/** A sent email: who got it, who didn't and why, and what it said. */
function Sent({ e }: { e: StaffEmailDetail }) {
  const t = useT();
  const draft = { subject: e.subject, heading: e.heading, body: e.body, button_label: e.button_label, button_url: e.button_url, audience: e.audience, recipient_ids: [] };
  return (
    <div className="email-editor">
      <div className="stack">
        <Panel title={t("email.delivery")}>
          <div className="stack">
            <dl className="summary-list">
              <dt>{t("email.to")}</dt>
              <dd>{audienceLabel(t, e)}</dd>
              <dt>{t("email.sentBy")}</dt>
              <dd>{e.sent_by?.name || e.sent_by?.email || "–"}{e.sent_at && <span className="small muted"> · {formatDate(e.sent_at, t.locale)} {formatTime(e.sent_at, t.locale)}</span>}</dd>
              <dt>{t("email.delivered")}</dt>
              <dd className="num">{t("email.sentOf", { sent: e.counts.sent, total: e.counts.total })}</dd>
              {e.counts.queued > 0 && (
                <>
                  <dt>{t("email.queued")}</dt>
                  <dd className="num">{e.counts.queued}</dd>
                </>
              )}
              {e.counts.failed > 0 && (
                <>
                  <dt>{t("email.failed")}</dt>
                  <dd className="num ink-cost">{e.counts.failed}</dd>
                </>
              )}
            </dl>
            {e.status === "sending" && <Notice tone="info">{t("email.stillSending")}</Notice>}
          </div>
        </Panel>
        {e.failures.length > 0 && (
          <Panel title={t("email.failures")} bodyless>
            <Table rows={e.failures} rowKey={(r) => r.email} columns={[
              { key: "e", header: t("email.address"), render: (r) => r.email },
              { key: "r", header: t("email.reason"), render: (r) => <span className="small muted">{r.error}</span> },
            ]} />
          </Panel>
        )}
        {e.audience === "selected" && e.recipients.length > 0 && (
          <Panel title={t("email.chosen")} bodyless>
            <Table rows={e.recipients} rowKey={(r) => r.id} columns={[
              { key: "n", header: t("admin.col.farmer"), render: (r) => <span className="strong">{r.name || formatPhone(r.phone)}</span> },
              { key: "e", header: t("email.address"), render: (r) => r.email ?? <Chip tone="neutral">{t("email.noEmail")}</Chip> },
            ]} />
          </Panel>
        )}
      </div>
      <Preview draft={draft} />
    </div>
  );
}

/** /admin/emails/new and /admin/emails/:id: write, preview, test and send an email to farmers. */
export function AdminEmail() {
  const t = useT();
  const { id } = useParams();
  const staffId = useAdminSession((s) => s.user?.id);
  const q = useQuery({
    queryKey: ["admin", staffId, "email", id],
    queryFn: () => api.staff.email(id!),
    enabled: !!id,
    // While sending, check back until it's done.
    refetchInterval: (query) => (query.state.data?.status === "sending" ? 3000 : false),
  });

  const back = (
    <ButtonLink to="/admin/emails" variant="quiet" size="sm" className="flush" icon={<ArrowLeft size={16} aria-hidden />}>
      {t("admin.emails")}
    </ButtonLink>
  );
  if (!id) return <>{back}<PageHead title={t("email.new")} /><Editor saved={null} /></>;
  if (q.isLoading) return <>{back}<SkeletonRows rows={6} height={64} /></>;
  if (q.error instanceof ApiError && q.error.status === 403) return <>{back}<NoPermission text={t("admin.forbidden")} /></>;
  if (q.error instanceof ApiError && q.error.status === 404) return <>{back}<EmptyState text={t("email.notFound")} /></>;
  if (q.error || !q.data) return <>{back}<ErrorState error={q.error} onRetry={() => q.refetch()} /></>;
  const e = q.data;
  return (
    <>
      {back}
      <PageHead title={e.subject} sub={<span className="row" style={{ gap: 8 }}><StatusChip status={e.status} />{e.status === "draft" && <span className="small muted">{t("email.lastSaved", { date: formatDate(e.updated_at, t.locale) })}</span>}</span>} />
      {e.status === "draft" ? <Editor key={e.id} saved={e} /> : <Sent e={e} />}
    </>
  );
}
