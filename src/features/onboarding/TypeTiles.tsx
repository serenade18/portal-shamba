import { Check } from "lucide-react";
import type { EnterpriseType, Module, TypeCode } from "@/api/types";
import { useT } from "@/i18n";

const GROUPS: Module[] = ["livestock", "batches", "crops"];

/**
 * Picture tiles grouped under Animals, Poultry and fish, Crops (7.8). Each is a
 * toggle button; Tab moves between tiles and Space toggles.
 * The art is a placeholder until tile images are tested with farmers.
 */
export function TypeTiles({ types, value, onChange }: { types: EnterpriseType[]; value: TypeCode[]; onChange: (v: TypeCode[]) => void }) {
  const t = useT();
  const toggle = (code: TypeCode) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div className="stack-lg">
      {GROUPS.map((g) => (
        <section key={g} className="stack" style={{ gap: 12 }}>
          <h2>{t(`choose.group.${g}`)}</h2>
          <div className="tile-grid">
            {types
              .filter((x) => x.module === g)
              .map((x) => {
                const name = x.labels[t.locale];
                const on = value.includes(x.code);
                return (
                  <button key={x.code} type="button" className="tile" aria-pressed={on} aria-label={on ? t("choose.selected", { name }) : name} onClick={() => toggle(x.code)}>
                    <span className="art" aria-hidden>{x.icon}</span>
                    <span>{name}</span>
                    <span className="check" aria-hidden>
                      <Check size={16} />
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
