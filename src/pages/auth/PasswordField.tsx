import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/forms";
import { useT } from "@/i18n";

/** A password input with a show/hide button, for sign-in, sign-up and reset. */
export function PasswordField({ label, value, onChange, error, hint, autoComplete }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; autoComplete: string }) {
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
