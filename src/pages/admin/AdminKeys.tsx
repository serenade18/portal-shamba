import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import { useErrorText } from "@/api/hooks";
import type { KeyGroup, ManagedKey } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { PageHead, Panel, Table } from "@/components/ui/data";
import { Chip, ErrorState, NoPermission, Notice, SkeletonRows } from "@/components/ui/feedback";
import { FormError, SelectField, TextField } from "@/components/ui/forms";
import { ConfirmDialog, SidePanel } from "@/components/ui/overlay";
import { useT } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useAdminSession } from "@/stores/adminSession";
import { toast } from "@/stores/toast";

/*
 * /admin/keys: the platform's integration keys (SMS, email, M-Pesa, SasaPay,
 * weather, maps). Super admins only. A key saved here overrides the server's
 * environment variable; "Use server setting" forgets it again. Secrets are
 * write-only: the server only ever sends their last few characters.
 */

const GROUPS: KeyGroup[] = ["sms", "email", "mpesa", "sasapay", "weather", "maps", "staff"];

export function AdminKeys() {
  const t = useT();
  const staffId = useAdminSession((s) => s.user?.id);
  const q = useQuery({ queryKey: ["admin", staffId, "keys"], queryFn: api.staff.keys });
  const [editing, setEditing] = useState<ManagedKey | null>(null);
  const [resetting, setResetting] = useState<ManagedKey | null>(null);

  return (
    <>
      <PageHead title={t("admin.keys")} sub={t("admin.keys.sub")} />
      {q.isLoading ? (
        <SkeletonRows rows={8} />
      ) : q.error instanceof ApiError && q.error.status === 403 ? (
        <NoPermission text={t("admin.keys.forbidden")} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="stack">
          {GROUPS.map((group) => {
            const rows = q.data!.keys.filter((k) => k.group === group);
            if (!rows.length) return null;
            return (
              <Panel key={group} title={t(`admin.keys.group.${group}`)} bodyless>
                <Table
                  rows={rows}
                  rowKey={(k) => k.name}
                  caption={t(`admin.keys.group.${group}`)}
                  columns={[
                    {
                      key: "k", header: t("admin.keys.col.key"), label: t("admin.keys.col.key"),
                      render: (k) => (
                        <span className="admin-key-name">
                          <span className="strong">{t(`admin.keys.label.${k.name}`)}</span>
                          <code className="small muted">{k.name}</code>
                        </span>
                      ),
                    },
                    { key: "s", header: t("admin.keys.col.source"), label: t("admin.keys.col.source"), render: (k) => <SourceChip k={k} /> },
                    { key: "v", header: t("admin.col.value"), label: t("admin.col.value"), render: (k) => (k.preview ? <code className="admin-key-preview">{k.preview}</code> : <span className="muted">–</span>) },
                    {
                      key: "u", header: t("admin.keys.col.updated"), label: t("admin.keys.col.updated"),
                      render: (k) => (k.updated_at ? <span className="small">{formatDate(k.updated_at, t.locale)}{k.updated_by && <><br /><span className="muted">{k.updated_by}</span></>}</span> : <span className="muted">–</span>),
                    },
                    {
                      key: "a", header: <span className="visually-hidden">{t("admin.keys.col.actions")}</span>, label: t("admin.keys.col.actions"),
                      render: (k) => (
                        <span className="admin-key-actions">
                          <Button size="sm" icon={<KeyRound size={16} aria-hidden />} onClick={() => setEditing(k)}>{t("admin.keys.change")}</Button>
                          {k.source === "admin" && (
                            <Button size="sm" variant="quiet" icon={<RotateCcw size={16} aria-hidden />} onClick={() => setResetting(k)}>{t("admin.keys.reset")}</Button>
                          )}
                        </span>
                      ),
                    },
                  ]}
                />
              </Panel>
            );
          })}
        </div>
      )}
      {editing && <EditKey k={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetKey k={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function SourceChip({ k }: { k: ManagedKey }) {
  const t = useT();
  if (k.source === "admin") return <Chip tone="health">{t("admin.keys.source.admin")}</Chip>;
  if (k.source === "environment") return <Chip tone="neutral">{t("admin.keys.source.environment")}</Chip>;
  return <Chip tone="amber">{t("admin.keys.source.unset")}</Chip>;
}

function useSaved() {
  const qc = useQueryClient();
  const staffId = useAdminSession((s) => s.user?.id);
  return (row: ManagedKey) =>
    qc.setQueryData<{ keys: ManagedKey[] }>(["admin", staffId, "keys"], (d) => d && { keys: d.keys.map((k) => (k.name === row.name ? row : k)) });
}

function EditKey({ k, onClose }: { k: ManagedKey; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const saved = useSaved();
  // Secrets start empty (the server never sends them); other values start as they are.
  const [value, setValue] = useState(k.kind === "secret" ? "" : k.preview || k.choices[0] || "");
  const save = useMutation({
    mutationFn: () => api.staff.setKey(k.name, value),
    onSuccess: (row) => {
      saved(row);
      toast(t("admin.keys.saved", { key: t(`admin.keys.label.${k.name}`) }));
      onClose();
    },
  });
  const label = t(`admin.keys.label.${k.name}`);
  const help = k.name in HELP ? t(HELP[k.name as keyof typeof HELP]) : undefined;

  return (
    <SidePanel
      title={t("admin.keys.changeTitle", { key: label })}
      onClose={onClose}
      onSubmit={() => value.trim() && save.mutate()}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!value.trim()}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted"><code>{k.name}</code></p>
        {k.kind === "choice" ? (
          <SelectField label={label} hint={help} value={value} onChange={setValue} options={k.choices.map((c) => ({ value: c, label: c }))} />
        ) : (
          <TextField
            label={label}
            hint={k.kind === "secret" && k.preview ? t("admin.keys.secretHint", { preview: k.preview }) : help}
            value={value}
            onChange={setValue}
            type={k.kind === "secret" ? "password" : "text"}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        )}
        {k.kind === "secret" && help && <p className="small muted">{help}</p>}
        {k.name.endsWith("_ENV") && value === "production" && <Notice tone="amber">{t("admin.keys.productionWarning")}</Notice>}
        <Notice tone="info">{t(k.has_environment_value ? "admin.keys.overridesEnv" : "admin.keys.noEnv")}</Notice>
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

function ResetKey({ k, onClose }: { k: ManagedKey; onClose: () => void }) {
  const t = useT();
  const saved = useSaved();
  const label = t(`admin.keys.label.${k.name}`);
  const reset = useMutation({
    mutationFn: () => api.staff.resetKey(k.name),
    onSuccess: (row) => {
      saved(row);
      toast(t("admin.keys.resetDone", { key: label }));
      onClose();
    },
    onError: () => toast(t("admin.keys.resetFailed"), "error"),
  });
  return (
    <ConfirmDialog
      title={t("admin.keys.resetTitle", { key: label })}
      body={<p>{t(k.has_environment_value ? "admin.keys.resetBody" : "admin.keys.resetBodyUnset")}</p>}
      confirmLabel={t("admin.keys.reset")}
      onConfirm={() => reset.mutate()}
      onClose={onClose}
      loading={reset.isPending}
    />
  );
}

const HELP = {
  SMS_SENDER_ID: "admin.keys.help.SMS_SENDER_ID",
  OPENWEATHER_API_KEY: "admin.keys.help.OPENWEATHER_API_KEY",
  AGRO_MONITORING_API_KEY: "admin.keys.help.AGRO_MONITORING_API_KEY",
  CESIUM_ION_TOKEN: "admin.keys.help.CESIUM_ION_TOKEN",
  STAFF_SIGNUP_KEY: "admin.keys.help.STAFF_SIGNUP_KEY",
  MPESA_CALLBACK_URL: "admin.keys.help.MPESA_CALLBACK_URL",
} as const;
