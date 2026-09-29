import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import * as api from "@/api/endpoints";
import { useCatalogue, useErrorText, useFarm, useKey, useNavigation } from "@/api/hooks";
import type { EnterpriseType, TypeCode } from "@/api/types";
import { useSignOut } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/forms";
import { useT, type MsgKey } from "@/i18n";
import { useMembership } from "@/stores/session";
import { TypeTiles } from "./TypeTiles";

function countQuestion(type: EnterpriseType): MsgKey {
  if (type.module === "livestock") return "counts.animals";
  if (type.code === "fish") return "counts.fish";
  if (type.module === "batches") return "counts.birds";
  return "counts.acres";
}

/** Choose what you're dealing with, then quick counts (7.8, ONB-02, ONB-03). */
export function Onboarding() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = useKey();
  const catalogue = useCatalogue();
  const { farm } = useFarm();
  const nav = useNavigation();
  const role = useMembership()?.role;
  const signOut = useSignOut();

  const [step, setStep] = useState<"choose" | "counts">("choose");
  const [picks, setPicks] = useState<TypeCode[]>([]);
  const [soon, setSoon] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [counts, setCounts] = useState<Partial<Record<TypeCode, string>>>({});

  const finish = useMutation({
    mutationFn: (withCounts: boolean) =>
      api.farms.onboard({
        farm_id: farm!.id,
        picks,
        coming_soon: soon,
        other_text: other.trim(),
        counts: withCounts ? Object.fromEntries(Object.entries(counts).filter(([, v]) => v && Number(v) > 0).map(([k, v]) => [k, Number(v)])) : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key("navigation") });
      qc.invalidateQueries({ queryKey: key("farms") });
      qc.invalidateQueries({ queryKey: key("enterprises") });
      navigate("/", { replace: true });
    },
  });

  if (role && role !== "owner") return <Navigate to="/" replace />;
  if (nav.data?.setup_complete && !finish.isPending) return <Navigate to="/" replace />;

  const types = catalogue.data?.enterprise_types ?? [];
  const unsupportedOnly = picks.length === 0 && (soon.length > 0 || other.trim().length > 0);

  return (
    <div className="onboard">
      <div className="onboard-top">
        <img src="/logo.svg" alt="" />
        Shamba OS
        <span style={{ flex: 1 }} />
        <span className="small" style={{ fontWeight: 500, opacity: 0.85 }}>{farm?.name}</span>
      </div>
      <main className="onboard-body">
        {step === "choose" ? (
          <div className="stack-lg">
            <div className="stack" style={{ gap: 4 }}>
              <h1>{t("choose.title")}</h1>
              <p className="muted">{t("choose.help")}</p>
            </div>
            {catalogue.isLoading ? (
              <Skeleton height={400} />
            ) : (
              <TypeTiles types={types} value={picks} onChange={setPicks} />
            )}

            <section className="stack" style={{ gap: 12 }}>
              <h2>{t("choose.comingSoon")}</h2>
              <p className="small muted">{t("choose.comingSoonHelp")}</p>
              <div className="row">
                {catalogue.data?.coming_soon.map((c) => {
                  const on = soon.includes(c.code);
                  return (
                    <Button
                      key={c.code}
                      size="sm"
                      variant={on ? "primary" : "secondary"}
                      aria-pressed={on}
                      icon={on ? <Check size={14} /> : undefined}
                      onClick={() => setSoon(on ? soon.filter((x) => x !== c.code) : [...soon, c.code])}
                    >
                      {c.labels[t.locale]}
                    </Button>
                  );
                })}
              </div>
            </section>

            <Field label={t("choose.other")} optional>
              {(id) => <input id={id} className="input" value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("choose.otherPlaceholder")} maxLength={120} />}
            </Field>

            {unsupportedOnly && (
              <Notice tone="amber">
                <p>{t("choose.unsupported")}</p>
                <Button variant="quiet" size="sm" onClick={signOut} style={{ marginTop: 8, paddingLeft: 0 }}>
                  {t("choose.signOutLater")}
                </Button>
              </Notice>
            )}

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button variant="primary" disabled={picks.length === 0} onClick={() => setStep("counts")}>
                {picks.length === 0 ? t("choose.pickOne") : t.n("choose.continue", picks.length)}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="stack-lg"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              finish.mutate(true);
            }}
          >
            <div className="stack" style={{ gap: 4 }}>
              <h1>{t("counts.title")}</h1>
              <p className="muted">{t("counts.help")}</p>
            </div>
            <div className="panel">
              {picks.map((code, i) => {
                const type = types.find((x) => x.code === code)!;
                return (
                  <div key={code} className="spread" style={{ padding: "16px 20px", borderTop: i ? "1px solid var(--border)" : undefined }}>
                    <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
                      <span style={{ fontSize: 32 }} aria-hidden>{type.icon}</span>
                      <div>
                        <p className="strong">{type.labels[t.locale]}</p>
                        <label htmlFor={`count-${code}`} className="small muted">{t(countQuestion(type))}</label>
                      </div>
                    </div>
                    <input
                      id={`count-${code}`}
                      className="input tabular"
                      style={{ width: 120, textAlign: "right" }}
                      inputMode="decimal"
                      value={counts[code] ?? ""}
                      onChange={(e) => setCounts({ ...counts, [code]: e.target.value.replace(/[^\d.]/g, "") })}
                    />
                  </div>
                );
              })}
            </div>
            <FormError message={finish.error ? errorText(finish.error) : null} />
            <div className="spread">
              <Button variant="quiet" onClick={() => setStep("choose")}>{t("common.back")}</Button>
              <div className="row">
                <Button variant="quiet" onClick={() => finish.mutate(false)} disabled={finish.isPending}>{t("counts.skip")}</Button>
                <Button type="submit" variant="primary" loading={finish.isPending}>{t("counts.start")}</Button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
