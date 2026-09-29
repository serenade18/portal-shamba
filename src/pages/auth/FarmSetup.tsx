import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LocateFixed } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import * as api from "@/api/endpoints";
import { useErrorText, useFarms, useKey } from "@/api/hooks";
import type { Farm } from "@/api/types";
import { Brand } from "@/components/shell/Brand";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/feedback";
import { FormError, SelectField, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { COUNTIES } from "@/lib/counties";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";

/** Farm name and location (FRM-01): GPS, or the county as a fallback. */
export function FarmForm({ onDone, submitLabel }: { onDone: (farm: Farm) => void; submitLabel: string }) {
  const t = useT();
  const errorText = useErrorText();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const [name, setName] = useState("");
  const [county, setCounty] = useState("");
  const [yourName, setYourName] = useState(user?.name ?? "");
  const [location, setLocation] = useState<Farm["location"]>(null);
  const [gps, setGps] = useState<"idle" | "busy" | "failed">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => {
      if (yourName.trim() && yourName.trim() !== user?.name) setUser(await api.me.update({ name: yourName.trim() }));
      return api.farms.create({ name: name.trim(), county, location });
    },
    onSuccess: onDone,
  });

  const locate = () => {
    if (!navigator.geolocation) return setGps("failed");
    setGps("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5 });
        setGps("idle");
      },
      () => setGps("failed"),
      { timeout: 10_000 },
    );
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t("setup.farmNameRequired");
    if (!county && !location) e.county = t("setup.countyRequired");
    setErrors(e);
    if (!Object.keys(e).length) create.mutate();
  };

  return (
    <form
      className="stack-lg"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField label={t("setup.farmName")} value={name} onChange={setName} placeholder={t("setup.farmNamePlaceholder")} error={errors.name} autoFocus />
      {!user?.name && <TextField label={t("setup.yourName")} hint={t("setup.yourNameHelp")} value={yourName} onChange={setYourName} optional autoComplete="name" />}
      <div className="stack" style={{ gap: 8 }}>
        <span className="field-label">{t("setup.location")}</span>
        {location ? (
          <Notice tone="health" icon={<CheckCircle2 size={18} aria-hidden />}>
            {t("setup.gpsFound")} ({location.lat.toFixed(3)}, {location.lng.toFixed(3)})
          </Notice>
        ) : (
          <Button onClick={locate} loading={gps === "busy"} icon={<LocateFixed size={18} />}>
            {t("setup.useGps")}
          </Button>
        )}
        {gps === "failed" && <p className="small ink-cost">{t("setup.gpsFailed")}</p>}
        <p className="small muted">{t("setup.gpsHelp")}</p>
      </div>
      <SelectField
        label={t("setup.county")}
        value={county}
        onChange={setCounty}
        placeholder={t("setup.countyPlaceholder")}
        options={COUNTIES.map((c) => ({ value: c, label: c }))}
        error={errors.county}
        optional={!!location}
      />
      <FormError message={create.error ? errorText(create.error) : null} />
      <Button type="submit" variant="primary" block loading={create.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function FarmSetup() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = useKey();
  const farms = useFarms();
  const orgId = useSession((s) => s.activeOrgId);
  const setFarm = useUi((s) => s.setFarm);
  const [done, setDone] = useState(false);

  if (farms.data && farms.data.length > 0 && !done) return <Navigate to="/" replace />;

  // Full page, no photo panel: the logo and the form in one centred column.
  return (
    <main className="setup-page">
      <div className="setup-brand">
        <Brand />
      </div>
      <div className="setup-body">
        {done ? (
          <div className="stack-lg">
            <CheckCircle2 size={40} className="ink-health setup-center" aria-hidden />
            <div className="stack setup-heading" style={{ gap: 4 }}>
              <h1>{t("setup.done")}</h1>
              <p className="muted">{t("setup.doneHelp")}</p>
            </div>
            <Button variant="primary" block onClick={() => navigate("/setup/choose", { replace: true })} autoFocus>
              {t("common.continue")}
            </Button>
          </div>
        ) : (
          <div className="stack-lg">
            <div className="stack setup-heading" style={{ gap: 4 }}>
              <h1>{t("setup.farmTitle")}</h1>
              <p className="muted">{t("setup.farmHelp")}</p>
            </div>
            <FarmForm
              submitLabel={t("common.continue")}
              onDone={(farm) => {
                if (orgId) setFarm(orgId, farm.id);
                qc.invalidateQueries({ queryKey: key("farms") });
                setDone(true);
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
