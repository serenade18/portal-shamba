import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import type { UnitOption } from "@/api/types";
import { useT } from "@/i18n";
import { formatNumber } from "@/lib/format";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode;
}

/** Label, control, help and error in one place. Errors say how to fix it (8.2). */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const t = useT();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="muted small"> ({t("common.optional").toLowerCase()})</span>}
      </label>
      {children(id, describedBy, !!error)}
      {hint && !error && <span id={hintId} className="hint">{hint}</span>}
      {error && <span id={errId} className="error" role="alert">{error}</span>}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

export function TextField({ label, hint, error, optional, value, onChange, className, ...rest }: InputProps & { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy, invalid) => (
        <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...rest} />
      )}
    </Field>
  );
}

export function DateField(props: { label: ReactNode; value: string; onChange: (v: string) => void; error?: string; max?: string; min?: string; className?: string }) {
  return (
    <Field label={props.label} error={props.error} className={props.className}>
      {(id, describedBy, invalid) => (
        <input id={id} type="date" className="input" value={props.value} max={props.max} min={props.min} onChange={(e) => props.onChange(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} required />
      )}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({ label, hint, error, optional, value, onChange, options, placeholder, className, ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy, invalid) => (
        <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** "KES" prefix, right-aligned tabular figures, thousands separators on blur (8.2). */
export function MoneyField({ label, hint, error, optional, value, onChange, currency = "KES", className }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const shown = !focused && value !== "" && !Number.isNaN(Number(value)) ? formatNumber(value, 2) : value;
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy, invalid) => (
        <div className="input-group">
          <span className="prefix" aria-hidden>{currency}</span>
          <input
            id={id}
            className="input money"
            inputMode="decimal"
            value={shown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        </div>
      )}
    </Field>
  );
}

/** A number plus a selector of only the units valid for this product (8.2). */
export function QuantityField({ label, hint, error, optional, value, onChange, unit, onUnitChange, units, className }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  onUnitChange?: (u: string) => void;
  units: UnitOption[] | string[];
  className?: string;
}) {
  const t = useT();
  const codes = units.map((u) => (typeof u === "string" ? u : u.code));
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {(id, describedBy, invalid) => (
        <div className="input-group">
          <input id={id} className="input money" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          {codes.length > 1 && onUnitChange ? (
            <select className="select unit" value={unit} onChange={(e) => onUnitChange(e.target.value)} aria-label={t("common.unit")}>
              {codes.map((c) => (
                <option key={c} value={c}>{t.unit(c)}</option>
              ))}
            </select>
          ) : (
            <span className="prefix" style={{ paddingRight: 12 }}>{t.unit(unit)}</span>
          )}
        </div>
      )}
    </Field>
  );
}

export function Segmented<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChoiceCards<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string; help?: string; icon?: ReactNode }[]; label: string }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field-label" style={{ marginBottom: 4 }}>{label}</legend>
      <div className="choice-cards">
        {options.map((o) => (
          <button key={o.value} type="button" className="choice-card" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            <span className="row" style={{ gap: 6 }}>
              {o.icon}
              <span className="strong">{o.label}</span>
            </span>
            {o.help && <span className="small muted">{o.help}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="notice notice-error" role="alert">
      {message}
    </div>
  );
}
