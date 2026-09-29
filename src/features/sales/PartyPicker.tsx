import { useState } from "react";
import type { Party } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/forms";
import { useT } from "@/i18n";
import { formatPhone } from "@/lib/phone";

export interface NewParty {
  name: string;
  phone: string;
}

/**
 * Pick an existing customer or supplier, or type a new one in place. The new
 * one is created when the form is saved, so the owner never leaves the panel.
 */
export function PartyPicker({ label, parties, value, onChange, newParty, onNewParty, addLabel, error }: {
  label: string;
  parties: Party[];
  value: string;
  onChange: (id: string) => void;
  newParty: NewParty | null;
  onNewParty: (p: NewParty | null) => void;
  addLabel: string;
  error?: string;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  if (adding || newParty) {
    const p = newParty ?? { name: "", phone: "" };
    return (
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 12 }}>
        <legend className="field-label" style={{ marginBottom: 4 }}>{addLabel}</legend>
        <div className="form-grid">
          <TextField label={t("common.name")} value={p.name} onChange={(name) => onNewParty({ ...p, name })} error={error} autoFocus />
          <TextField label={t("common.phone")} value={p.phone} onChange={(phone) => onNewParty({ ...p, phone })} type="tel" inputMode="tel" placeholder="0712 345 678" optional />
        </div>
        <div>
          <Button variant="quiet" size="sm" onClick={() => (setAdding(false), onNewParty(null))}>{t("common.cancel")}</Button>
        </div>
      </fieldset>
    );
  }
  return (
    <div className="stack" style={{ gap: 4 }}>
      <SelectField
        label={label}
        value={value}
        onChange={onChange}
        placeholder=""
        options={parties.map((c) => ({ value: c.id, label: c.phone ? `${c.name}, ${formatPhone(c.phone)}` : c.name }))}
        error={error}
      />
      <div>
        <Button variant="quiet" size="sm" onClick={() => (setAdding(true), onNewParty({ name: "", phone: "" }))}>+ {addLabel}</Button>
      </div>
    </div>
  );
}
