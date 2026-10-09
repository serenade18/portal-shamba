import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import * as api from "@/api/endpoints";
import { useErrorText } from "@/api/hooks";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/feedback";
import { useT } from "@/i18n";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { Heading } from "./SignIn";
import { SplitLayout } from "./SplitLayout";

/** Opened from the confirmation email: /confirm-email?token=…. The first time, it starts the
 * account and signs in, then on to setting up the farm. */
export function ConfirmEmail() {
  const t = useT();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const installId = useSession((s) => s.installId);
  const signedIn = useSession((s) => !!s.refresh);
  const setUser = useSession((s) => s.setUser);
  const setLocale = useUi((s) => s.setLocale);
  const confirm = useMutation({
    mutationFn: () => api.auth.confirmEmail(token, installId),
    onSuccess: (res) => {
      if ("access" in res) {
        useSession.getState().signIn(res);
        if (res.user.preferred_locale) setLocale(res.user.preferred_locale);
        navigate("/", { replace: true });
        return;
      }
      // A changed email confirmed from an account that is already signed in.
      const user = useSession.getState().user;
      if (user && user.email === res.email) setUser({ ...user, email_verified: true });
    },
  });
  // Only once: the first use of the link signs in; a second call would not.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !token) return;
    sent.current = true;
    confirm.mutate();
  }, [token, confirm]);

  if (!token || confirm.isError) {
    return (
      <SplitLayout>
        <div className="stack-lg">
          <Heading title={t("auth.linkBrokenTitle")} help={token ? errorText(confirm.error) : t("confirm.noToken")} />
          <ButtonLink variant="primary" to="/sign-in">{t("auth.backToSignIn")}</ButtonLink>
        </div>
      </SplitLayout>
    );
  }
  if (confirm.isSuccess && !("access" in confirm.data)) {
    return (
      <SplitLayout>
        <div className="stack-lg" role="status">
          <MailCheck size={40} className="ink-health" aria-hidden />
          <Heading title={t("confirm.doneTitle")} help={t("confirm.doneHelp", { email: confirm.data.email })} />
          <ButtonLink variant="primary" to={signedIn ? "/" : "/sign-in"}>{signedIn ? t("common.continue") : t("auth.signIn")}</ButtonLink>
        </div>
      </SplitLayout>
    );
  }
  return (
    <SplitLayout>
      <div className="stack-lg" aria-busy="true">
        <Heading title={t("confirm.working")} />
        <Skeleton height={40} />
      </div>
    </SplitLayout>
  );
}
