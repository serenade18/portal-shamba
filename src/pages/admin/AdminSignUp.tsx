import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { ApiError, MOCK_MODE } from "@/api/client";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/feedback";
import { FormError, Segmented, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { normalizePhone } from "@/lib/phone";
import { installId, useAdminSession } from "@/stores/adminSession";
import { useUi } from "@/stores/ui";
import { PasswordField } from "../auth/PasswordField";
import { Heading } from "../auth/SignIn";
import { SplitLayout } from "../auth/SplitLayout";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Super admin sign-up at /admin/sign-up. Not linked from anywhere; the backend
 * only accepts it with the STAFF_SIGNUP_KEY secret and answers 404 otherwise.
 */
export function AdminSignUp() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const signedIn = useAdminSession((s) => !!s.refresh);
  const signIn = useAdminSession((s) => s.signIn);
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const [form, setForm] = useState({ key: "", name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const register = useMutation({
    mutationFn: () =>
      api.staff.register(
        { name: form.name.trim(), email: form.email.trim(), phone: normalizePhone(form.phone) ?? form.phone, password: form.password, locale },
        form.key.trim(),
        installId(),
      ),
    onSuccess: (res) => {
      signIn(res);
      navigate("/admin", { replace: true });
    },
    onError: (e) => setErrors(e instanceof ApiError && e.status === 404 ? { key: t("admin.signupKeyInvalid") } : fieldErrors(e)),
  });

  if (signedIn) return <Navigate to="/admin" replace />;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.key.trim()) e.key = t("admin.signupKeyRequired");
    if (!form.name.trim()) e.name = t("auth.nameRequired");
    if (!EMAIL.test(form.email.trim())) e.email = t("auth.invalidEmail");
    if (!normalizePhone(form.phone)) e.phone = t("auth.invalidPhone");
    if (form.password.length < 8) e.password = t("auth.shortPassword");
    setErrors(e);
    if (!Object.keys(e).length) register.mutate();
  };

  const formError = register.error && !(register.error instanceof ApiError && register.error.status === 404) && !Object.keys(fieldErrors(register.error)).length;

  return (
    <SplitLayout variant="admin">
      <div className="auth-lang">
        <Segmented label={t("settings.language")} value={locale} onChange={setLocale} options={[{ value: "en", label: "English" }, { value: "sw", label: "Kiswahili" }]} />
      </div>
      <form className="stack-lg" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
        <span className="chip chip-lavender admin-chip"><ShieldCheck size={14} aria-hidden /> {t("admin.title")}</span>
        <Heading title={t("admin.signUpTitle")} help={t("admin.signUpHelp")} />
        <div className="stack">
          <PasswordField label={t("admin.signupKey")} hint={t("admin.signupKeyHint")} value={form.key} onChange={set("key")} autoComplete="off" error={errors.key} />
          <TextField label={t("auth.name")} value={form.name} onChange={set("name")} autoComplete="name" error={errors.name} autoFocus />
          <TextField label={t("admin.email")} value={form.email} onChange={set("email")} type="email" autoComplete="username" autoCapitalize="none" error={errors.email} />
          <TextField label={t("auth.phone")} value={form.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" error={errors.phone} />
          <PasswordField label={t("auth.password")} hint={t("auth.passwordHint")} value={form.password} onChange={set("password")} autoComplete="new-password" error={errors.password} />
        </div>
        <FormError message={formError ? errorText(register.error) : null} />
        <Button type="submit" variant="primary" block loading={register.isPending}>{t("auth.createAccount")}</Button>
        {MOCK_MODE === "all" && <Notice tone="info">{t("admin.signUpDemoHint")}</Notice>}
        <p className="auth-switch">{t("auth.haveAccount")} <Link to="/admin/sign-in">{t("auth.signIn")}</Link></p>
      </form>
    </SplitLayout>
  );
}
