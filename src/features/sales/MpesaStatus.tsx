import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as api from "@/api/endpoints";
import { useErrorText, useKey } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/feedback";
import { FormError, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { formatPhone } from "@/lib/phone";
import { useInvalidateOrg } from "../enterprise/forms";

type Shown = "sending" | "waiting" | "otp" | "paid" | "failed" | "expired";

/**
 * M-Pesa payment states (7.4), shown inline and on the sale afterwards. The
 * sale is polled; the server settles it when the provider calls back.
 */
export function MpesaStatus({ saleId, onRetry, onCash, onCredit }: { saleId: string; onRetry: () => void; onCash: () => void; onCredit: () => void }) {
  const t = useT();
  const key = useKey();
  const errorText = useErrorText();
  const invalidate = useInvalidateOrg();
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [otp, setOtp] = useState("");

  const sale = useQuery({
    queryKey: key("sale", saleId),
    queryFn: () => api.sales.get(saleId),
    refetchInterval: (q) => {
      const s = q.state.data?.payment_request?.status;
      return s === "pending" || s === "awaiting_otp" ? 3000 : false;
    },
  });
  const p = sale.data?.payment_request;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (p && (p.status === "succeeded" || p.status === "failed" || p.status === "expired")) invalidate();
  }, [p?.status]);

  const submitOtp = useMutation({ mutationFn: () => api.payments.submitOtp(p!.id, otp), onSuccess: () => sale.refetch() });

  if (!p) return null;
  const shown: Shown =
    p.status === "succeeded" ? "paid" : p.status === "failed" ? "failed" : p.status === "expired" ? "expired" : p.status === "awaiting_otp" ? "otp" : now - started > 60_000 ? "waiting" : "sending";

  const chip = {
    sending: <Chip tone="amber">{t("mpesa.chip.sending")}</Chip>,
    waiting: <Chip tone="amber">{t("mpesa.chip.waiting")}</Chip>,
    otp: <Chip tone="amber">{t("mpesa.chip.sending")}</Chip>,
    paid: <Chip tone="health">{t("mpesa.chip.paid")}</Chip>,
    failed: <Chip tone="terracotta">{t("mpesa.chip.failed")}</Chip>,
    expired: <Chip tone="terracotta">{t("mpesa.chip.waiting")}</Chip>,
  }[shown];

  const message = {
    sending: t("mpesa.sending", { phone: formatPhone(p.phone) }),
    waiting: t("mpesa.waiting"),
    otp: t("mpesa.otp"),
    paid: t("mpesa.paid", { code: p.transaction_code }),
    failed: t("mpesa.failed"),
    expired: t("mpesa.expired"),
  }[shown];

  return (
    <div className="stack" aria-live="polite">
      <div className={`notice ${shown === "paid" ? "notice-health" : shown === "failed" || shown === "expired" ? "notice-error" : "notice-amber"}`}>
        <div className="stack" style={{ gap: 8 }}>
          {chip}
          <p>{message}</p>
        </div>
      </div>
      {shown === "otp" && (
        <form
          className="row"
          style={{ alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            submitOtp.mutate();
          }}
        >
          <TextField label={t("mpesa.otpLabel")} value={otp} onChange={setOtp} inputMode="numeric" autoComplete="one-time-code" />
          <Button type="submit" variant="primary" loading={submitOtp.isPending}>{t("mpesa.submitOtp")}</Button>
        </form>
      )}
      <FormError message={submitOtp.error ? errorText(submitOtp.error) : null} />
      {(shown === "failed" || shown === "expired") && (
        <div className="row">
          <Button variant="primary" onClick={onRetry}>{t("mpesa.retry")}</Button>
          <Button onClick={onCash}>{t("mpesa.takeCash")}</Button>
          <Button variant="quiet" onClick={onCredit}>{t("mpesa.leaveCredit")}</Button>
        </div>
      )}
    </div>
  );
}

