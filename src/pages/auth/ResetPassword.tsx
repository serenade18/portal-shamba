import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText } from "@/api/hooks";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormError } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { PasswordField } from "./PasswordField";
import { Heading } from "./SignIn";
import { SplitLayout } from "./SplitLayout";

/** Opened from the reset email: /reset-password?uid=…&token=… (7.7). */
export function ResetPassword() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: () => api.auth.resetPassword(uid, token, password),
    onSuccess: () => navigate("/sign-in", { replace: true, state: { passwordReset: true } }),
    onError: (e) => setError(fieldErrors(e).password),
  });
  const linkBroken = !uid || !token || (save.error instanceof ApiError && save.error.code === "auth.reset_link_invalid");

  const submit = () => {
    if (password.length < 8) return setError(t("auth.shortPassword"));
    setError(undefined);
    save.mutate();
  };

  if (linkBroken) {
    return (
      <SplitLayout>
        <div className="stack-lg">
          <Heading title={t("auth.linkBrokenTitle")} help={t("error.auth.reset_link_invalid")} />
          <ButtonLink variant="primary" to="/sign-in?mode=forgot">{t("auth.newLink")}</ButtonLink>
        </div>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout>
      <form className="stack-lg" noValidate onSubmit={(e) => (e.preventDefault(), submit())}>
        <Heading title={t("auth.newPasswordTitle")} help={t("auth.newPasswordHelp")} />
        <PasswordField label={t("auth.newPassword")} hint={t("auth.passwordHint")} value={password} onChange={setPassword} autoComplete="new-password" error={error} />
        <FormError message={save.error && !fieldErrors(save.error).password ? errorText(save.error) : null} />
        <Button type="submit" variant="primary" block loading={save.isPending}>{t("auth.savePassword")}</Button>
      </form>
    </SplitLayout>
  );
}
