import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiError, MOCK_MODE } from "@/api/client";
import * as api from "@/api/endpoints";
import { useErrorText } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/feedback";
import { FormError, Segmented, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { installId, useAdminSession } from "@/stores/adminSession";
import { useUi } from "@/stores/ui";
import { PasswordField } from "../auth/PasswordField";
import { Heading } from "../auth/SignIn";
import { SplitLayout } from "../auth/SplitLayout";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Staff only, at /admin/sign-in: email and password against /auth/staff/login. */
export function AdminSignIn() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = useAdminSession((s) => !!s.refresh);
  const signIn = useAdminSession((s) => s.signIn);
  const locale = useUi((s) => s.locale);
  const setLocale = useUi((s) => s.setLocale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const login = useMutation({
    mutationFn: () => api.staff.login(email.trim(), password, installId()),
    onSuccess: (res) => {
      signIn(res);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith("/admin") && from !== "/admin/sign-in" ? from : "/admin", { replace: true });
    },
  });

  if (signedIn) return <Navigate to="/admin" replace />;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!EMAIL.test(email.trim())) e.email = t("auth.invalidEmail");
    if (!password) e.password = t("auth.passwordRequired");
    setErrors(e);
    if (!Object.keys(e).length) login.mutate();
  };

  return (
    <SplitLayout variant="admin">
      <div className="auth-lang">
        <Segmented label={t("settings.language")} value={locale} onChange={setLocale} options={[{ value: "en", label: "English" }, { value: "sw", label: "Kiswahili" }]} />
      </div>
      <form className="stack-lg" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
        <span className="chip chip-lavender admin-chip"><ShieldCheck size={14} aria-hidden /> {t("admin.title")}</span>
        <Heading title={t("admin.signInTitle")} help={t("admin.signInHelp")} />
        <TextField label={t("admin.email")} value={email} onChange={setEmail} type="email" autoComplete="username" autoCapitalize="none" error={errors.email} autoFocus />
        <PasswordField label={t("auth.password")} value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} />
        <FormError message={login.error instanceof ApiError && login.error.code === "auth.invalid_credentials" ? t("admin.invalid") : login.error ? errorText(login.error) : null} />
        <Button type="submit" variant="primary" block loading={login.isPending}>{t("auth.signIn")}</Button>
        {MOCK_MODE === "all" && <Notice tone="info">{t("admin.demoHint")}</Notice>}
        <p className="auth-switch"><Link to="/sign-in">{t("admin.farmerLink")}</Link></p>
      </form>
    </SplitLayout>
  );
}
