import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { MOCK_MODE } from "@/api/client";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText } from "@/api/hooks";
import type { SignInResponse } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/feedback";
import { Field, FormError, Segmented, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { normalizePhone } from "@/lib/phone";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { SplitLayout } from "./SplitLayout";

type Mode = "signin" | "register" | "forgot" | "sent";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9._]{3,30}$/i;

function PasswordField({ label, value, onChange, error, hint, autoComplete }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; autoComplete: string }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, describedBy, invalid) => (
        <div className="password-wrap">
          <input
            id={id}
            className="input"
            type={shown ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
          <button type="button" className="password-toggle" onClick={() => setShown((s) => !s)} aria-label={shown ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={shown}>
            {shown ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  );
}

function Heading({ title, help }: { title: string; help?: string }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <h1>{title}</h1>
      {help && <p className="muted">{help}</p>}
    </div>
  );
}

/** Email or username and password (7.7). Phone codes stay in the Flutter app. */
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

  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reg, setReg] = useState({ name: "", email: "", username: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const done = (res: SignInResponse) => {
    signIn(res);
    if (!res.is_new_user && res.user.preferred_locale) setLocale(res.user.preferred_locale);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== "/sign-in" ? from : "/", { replace: true });
  };

  const login = useMutation({ mutationFn: () => api.auth.login(identifier.trim(), password, installId), onSuccess: done });
  const register = useMutation({
    mutationFn: () => api.auth.register({ ...reg, name: reg.name.trim(), email: reg.email.trim(), username: reg.username.trim(), phone: normalizePhone(reg.phone) ?? reg.phone, locale }, installId),
    onSuccess: done,
    onError: (e) => setErrors(fieldErrors(e)),
  });
  const forgot = useMutation({ mutationFn: () => api.auth.forgotPassword(reg.email.trim(), locale), onSuccess: () => setMode("sent") });

  if (signedIn) return <Navigate to="/" replace />;

  const go = (m: Mode) => {
    setErrors({});
    login.reset();
    register.reset();
    forgot.reset();
    setMode(m);
  };
  const set = (k: keyof typeof reg) => (v: string) => setReg((r) => ({ ...r, [k]: v }));

  const submitLogin = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = t("auth.identifierRequired");
    if (!password) e.password = t("auth.passwordRequired");
    setErrors(e);
    if (!Object.keys(e).length) login.mutate();
  };

  const submitRegister = () => {
    const e: Record<string, string> = {};
    if (!reg.name.trim()) e.name = t("auth.nameRequired");
    if (!EMAIL.test(reg.email.trim())) e.email = t("auth.invalidEmail");
    if (!USERNAME.test(reg.username.trim())) e.username = t("auth.invalidUsername");
    if (!normalizePhone(reg.phone)) e.phone = t("auth.invalidPhone");
    if (reg.password.length < 8) e.password = t("auth.shortPassword");
    setErrors(e);
    if (!Object.keys(e).length) register.mutate();
  };

  const submitForgot = () => {
    if (!EMAIL.test(reg.email.trim())) return setErrors({ email: t("auth.invalidEmail") });
    setErrors({});
    forgot.mutate();
  };

  const language = (
    <div className="auth-lang">
      <Segmented label={t("settings.language")} value={locale} onChange={setLocale} options={[{ value: "en", label: "English" }, { value: "sw", label: "Kiswahili" }]} />
    </div>
  );

  return (
    <SplitLayout>
      {language}

      {mode === "signin" && (
        <form className="stack-lg" noValidate onSubmit={(e) => (e.preventDefault(), submitLogin())}>
          <Heading title={t("auth.signInTitle")} help={t("auth.signInHelp")} />
          <TextField label={t("auth.identifier")} value={identifier} onChange={setIdentifier} autoComplete="username" autoCapitalize="none" spellCheck={false} error={errors.identifier} autoFocus />
          <div className="stack" style={{ gap: 8 }}>
            <PasswordField label={t("auth.password")} value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} />
            <div>
              <Button variant="quiet" size="sm" className="flush" onClick={() => (setReg((r) => ({ ...r, email: EMAIL.test(identifier.trim()) ? identifier.trim() : r.email })), go("forgot"))}>
                {t("auth.forgot")}
              </Button>
            </div>
          </div>
          <FormError message={login.error ? errorText(login.error) : null} />
          <Button type="submit" variant="primary" block loading={login.isPending}>{t("auth.signIn")}</Button>
          {MOCK_MODE === "all" && <Notice tone="info">{t("auth.demoHint")}</Notice>}
          <p className="auth-switch">
            {t("auth.noAccount")} <Button variant="quiet" onClick={() => go("register")}>{t("auth.createAccount")}</Button>
          </p>
        </form>
      )}

      {mode === "register" && (
        <form className="stack-lg" noValidate onSubmit={(e) => (e.preventDefault(), submitRegister())}>
          <Heading title={t("auth.registerTitle")} help={t("auth.registerHelp")} />
          <div className="stack">
            <TextField label={t("auth.name")} value={reg.name} onChange={set("name")} autoComplete="name" error={errors.name} autoFocus />
            <TextField label={t("auth.email")} value={reg.email} onChange={set("email")} type="email" autoComplete="email" autoCapitalize="none" error={errors.email} />
            <TextField label={t("auth.username")} hint={t("auth.usernameHint")} value={reg.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" spellCheck={false} error={errors.username} />
            <TextField label={t("auth.phone")} hint={t("auth.phoneHint")} value={reg.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" error={errors.phone} />
            <PasswordField label={t("auth.password")} hint={t("auth.passwordHint")} value={reg.password} onChange={set("password")} autoComplete="new-password" error={errors.password} />
          </div>
          <FormError message={register.error && !Object.keys(fieldErrors(register.error)).length ? errorText(register.error) : null} />
          <Button type="submit" variant="primary" block loading={register.isPending}>{t("auth.createAccount")}</Button>
          <p className="auth-switch">
            {t("auth.haveAccount")} <Button variant="quiet" onClick={() => go("signin")}>{t("auth.signIn")}</Button>
          </p>
        </form>
      )}

      {mode === "forgot" && (
        <form className="stack-lg" noValidate onSubmit={(e) => (e.preventDefault(), submitForgot())}>
          <Heading title={t("auth.forgotTitle")} help={t("auth.forgotHelp")} />
          <TextField label={t("auth.email")} value={reg.email} onChange={set("email")} type="email" autoComplete="email" autoCapitalize="none" error={errors.email} autoFocus />
          <FormError message={forgot.error ? errorText(forgot.error) : null} />
          <Button type="submit" variant="primary" block loading={forgot.isPending}>{t("auth.sendLink")}</Button>
          <Button variant="quiet" onClick={() => go("signin")}>{t("auth.backToSignIn")}</Button>
        </form>
      )}

      {mode === "sent" && (
        <div className="stack-lg" role="status">
          <MailCheck size={40} className="ink-health" aria-hidden />
          <Heading title={t("auth.checkEmail")} help={t("auth.linkSent", { email: reg.email.trim() })} />
          <Button variant="primary" block onClick={() => go("signin")}>{t("auth.backToSignIn")}</Button>
        </div>
      )}
    </SplitLayout>
  );
}
