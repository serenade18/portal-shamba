import { useMutation } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { MOCK_MODE } from "@/api/client";
import * as api from "@/api/endpoints";
import { useErrorText } from "@/api/hooks";
import type { Locale } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/feedback";
import { Field, FormError, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { SplitLayout } from "./SplitLayout";

type Step = "language" | "phone" | "code";

export function SignIn() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = useSession((s) => !!s.refresh);
  const installId = useSession((s) => s.installId);
  const signIn = useSession((s) => s.signIn);
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);

  const [step, setStep] = useState<Step>("language");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const request = useMutation({
    mutationFn: (p: string) => api.auth.requestOtp(p, locale),
    onSuccess: (res) => {
      setPhone(res.phone);
      setDebugCode(res.debug_code ?? null);
      setCode("");
      setCooldown(30);
      setStep("code");
    },
  });

  const verify = useMutation({
    mutationFn: () => api.auth.verifyOtp(phone, code, locale, installId),
    onSuccess: (res) => {
      signIn(res);
      if (!res.is_new_user && res.user.preferred_locale) setLocale(res.user.preferred_locale);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/sign-in" ? from : "/", { replace: true });
    },
  });

  if (signedIn) return <Navigate to="/" replace />;

  const submitPhone = () => {
    const p = normalizePhone(phoneRaw);
    if (!p) return setFieldError(t("auth.invalidPhone"));
    setFieldError(null);
    request.mutate(p);
  };

  const submitCode = () => {
    if (!/^\d{6}$/.test(code)) return setFieldError(t("auth.invalidCode"));
    setFieldError(null);
    verify.mutate();
  };

  const chooseLanguage = (l: Locale) => {
    setLocale(l);
    setStep("phone");
  };

  return (
    <SplitLayout>
      {step === "language" && (
        <div className="stack-lg">
          <div className="stack" style={{ gap: 4 }}>
            <h1>{t("auth.chooseLanguage")}</h1>
            <p className="muted">{t("auth.languageHelp")}</p>
          </div>
          <div className="lang-choice">
            <button type="button" onClick={() => chooseLanguage("sw")} lang="sw">
              Kiswahili <ChevronRight size={20} aria-hidden />
            </button>
            <button type="button" onClick={() => chooseLanguage("en")} lang="en">
              English <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {step === "phone" && (
        <form
          className="stack-lg"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitPhone();
          }}
        >
          <div className="stack" style={{ gap: 4 }}>
            <h1>{t("auth.phoneTitle")}</h1>
            <p className="muted">{t("auth.phoneHelp")}</p>
          </div>
          <TextField
            label={t("auth.phoneLabel")}
            value={phoneRaw}
            onChange={setPhoneRaw}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            error={fieldError ?? undefined}
            autoFocus
          />
          <FormError message={request.error ? errorText(request.error) : null} />
          <Button type="submit" variant="primary" block loading={request.isPending}>
            {t("auth.sendCode")}
          </Button>
          {MOCK_MODE === "all" && <Notice tone="info">{t("auth.demoHint")}</Notice>}
          <Button variant="quiet" onClick={() => setStep("language")}>{t("common.back")}</Button>
        </form>
      )}

      {step === "code" && (
        <form
          className="stack-lg"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
        >
          <div className="stack" style={{ gap: 4 }}>
            <h1>{t("auth.codeTitle")}</h1>
            <p className="muted">{t("auth.codeHelp", { phone: formatPhone(phone) })}</p>
          </div>
          <Field label={t("auth.codeLabel")} error={fieldError ?? undefined}>
            {(id, describedBy, invalid) => (
              <input
                id={id}
                className="input otp-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                autoFocus
              />
            )}
          </Field>
          {debugCode && <Notice tone="info">{t("auth.devCode", { code: debugCode })}</Notice>}
          <FormError message={verify.error ? errorText(verify.error) : null} />
          <Button type="submit" variant="primary" block loading={verify.isPending}>
            {t("auth.verify")}
          </Button>
          <div className="spread">
            <Button variant="quiet" onClick={() => (setStep("phone"), setFieldError(null))}>
              {t("auth.changeNumber")}
            </Button>
            {cooldown > 0 ? (
              <span className="small muted" aria-live="polite">{t("auth.resendIn", { s: cooldown })}</span>
            ) : (
              <Button variant="quiet" onClick={() => request.mutate(phone)} loading={request.isPending}>
                {t("auth.resend")}
              </Button>
            )}
          </div>
        </form>
      )}
    </SplitLayout>
  );
}
