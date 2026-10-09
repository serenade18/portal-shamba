import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText, useKey } from "@/api/hooks";
import type { Item, ItemCategory, ItemSuggestion } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { FormError, SelectField, TextField } from "@/components/ui/forms";
import { ConfirmDialog, SidePanel } from "@/components/ui/overlay";
import { useT } from "@/i18n";
import { toast } from "@/stores/toast";
import { useInvalidateOrg } from "../enterprise/forms";

const CATEGORIES: ItemCategory[] = ["feed", "drug", "seed", "fertiliser", "chemical", "other"];
const BASE_UNITS = ["kg", "g", "l", "ml", "piece", "dose", "sachet", "bird"];

type Pack = { code: string; factor: string };

/** Add a stock item (one of the suggestions, or the farmer's own), or edit or remove one. */
export function ItemPanel({ item, onClose }: { item?: Item; onClose: () => void }) {
  const t = useT();
  const key = useKey();
  const errorText = useErrorText();
  const invalidate = useInvalidateOrg();
  const editing = !!item;
  const [name, setName] = useState(item ? item.name[t.locale] : "");
  const [category, setCategory] = useState<ItemCategory>(item && item.category !== "produce" ? item.category : "feed");
  const [base, setBase] = useState(item?.base_unit ?? "kg");
  const [packs, setPacks] = useState<Pack[]>(
    (item?.units ?? []).filter((u) => u.code !== item?.base_unit).map((u) => ({ code: u.code, factor: String(u.factor) })),
  );
  const [low, setLow] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const suggestions = useQuery({ queryKey: key("item-suggestions"), queryFn: api.stock.itemSuggestions, enabled: !editing, select: (r) => r.results });
  const addSuggested = useMutation({
    mutationFn: (s: ItemSuggestion) => api.stock.createItem({ suggestion: s.code }),
    onSuccess: (added) => (invalidate(), toast(t("item.added", { name: added.name[t.locale] }))),
  });
  const cleanPacks = packs.filter((p) => p.code.trim() || p.factor.trim()).map((p) => ({ code: p.code.trim().toLowerCase(), factor: p.factor }));
  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.stock.updateItem(item!.id, { name: name.trim(), category, packs: cleanPacks })
        : api.stock.createItem({ name: name.trim(), category, base_unit: base, packs: cleanPacks, low_stock_level: low || null }),
    onSuccess: (saved) => (invalidate(), toast(editing ? t("item.saved") : t("item.added", { name: saved.name[t.locale] })), onClose()),
  });
  const remove = useMutation({
    mutationFn: () => api.stock.removeItem(item!.id),
    onSuccess: () => (invalidate(), toast(t("item.removed", { name: item!.name[t.locale] })), onClose()),
  });
  const errors = fieldErrors(save.error);
  const setPack = (i: number, patch: Partial<Pack>) => setPacks(packs.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const baseLabel = t.unit(base, 2);

  return (
    <SidePanel
      title={editing ? t("item.editTitle", { name: item!.name[t.locale] }) : t("item.newTitle")}
      onClose={onClose}
      onSubmit={() => save.mutate()}
      footer={
        <>
          {editing && item!.removable && (
            <Button variant="destructive" icon={<Trash2 size={16} aria-hidden />} onClick={() => setConfirmRemove(true)} style={{ marginRight: "auto" }}>
              {t("item.remove")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" loading={save.isPending}>{editing ? t("common.save") : t("item.save")}</Button>
        </>
      }
    >
      <div className="stack-lg">
        {!editing && !!suggestions.data?.length && (
          <section className="stack">
            <div>
              <h3 className="strong" style={{ margin: 0 }}>{t("item.suggestions")}</h3>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{t("item.suggestionsHelp")}</p>
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {suggestions.data.map((s) => {
                const pack = s.units.find((u) => u.code === s.display_unit && u.code !== s.base_unit);
                return (
                  <Button key={s.code} variant="secondary" size="sm" icon={<Plus size={14} aria-hidden />} loading={addSuggested.isPending && addSuggested.variables?.code === s.code}
                    onClick={() => addSuggested.mutate(s)}>
                    {s.name[t.locale]}
                    {pack && <span className="muted"> · {t.unit(pack.code, 1)} {pack.factor} {t.unit(s.base_unit, pack.factor)}</span>}
                  </Button>
                );
              })}
            </div>
            <FormError message={addSuggested.error ? errorText(addSuggested.error) : null} />
            <h3 className="strong" style={{ margin: "8px 0 0" }}>{t("item.ownTitle")}</h3>
          </section>
        )}

        <div className="stack">
          <TextField label={t("item.name")} value={name} onChange={setName} placeholder={t("item.namePlaceholder")} error={errors.name} autoFocus={editing || !suggestions.data?.length} />
          <SelectField label={t("item.category")} value={category} onChange={(v) => setCategory(v as ItemCategory)}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`itemCategory.${c}`) }))} />
          <SelectField label={t("item.baseUnit")} hint={editing ? t("item.baseUnitFixed") : t("item.baseUnitHelp")} value={base} onChange={setBase} disabled={editing}
            options={(BASE_UNITS.includes(base) ? BASE_UNITS : [base, ...BASE_UNITS]).map((u) => ({ value: u, label: t.unit(u, 2) }))} error={errors.base_unit} />

          <div className="stack" style={{ gap: 8 }}>
            <div>
              <span className="strong">{t("item.packs")}</span>
              <p className="small muted" style={{ margin: "2px 0 0" }}>{t("item.packsHelp", { unit: baseLabel })}</p>
            </div>
            {packs.map((p, i) => (
              <div key={i} className="pack-row">
                <TextField label={t("item.packName")} value={p.code} onChange={(v) => setPack(i, { code: v })} placeholder={t("item.packPlaceholder")} />
                <TextField label={t("item.packSize", { unit: baseLabel })} value={p.factor} onChange={(v) => setPack(i, { factor: v.replace(/[^\d.]/g, "") })} inputMode="decimal" />
                <Button variant="quiet" icon={<X size={16} aria-hidden />} aria-label={t("item.removePack")} onClick={() => setPacks(packs.filter((_, j) => j !== i))} />
              </div>
            ))}
            <div>
              <Button variant="quiet" size="sm" className="flush" icon={<Plus size={14} aria-hidden />} onClick={() => setPacks([...packs, { code: "", factor: "" }])}>{t("item.addPack")}</Button>
            </div>
            {errors.packs && <div className="field"><span className="error" role="alert">{errors.packs}</span></div>}
          </div>

          {!editing && (
            <TextField label={t("item.lowLevel", { unit: baseLabel })} value={low} onChange={(v) => setLow(v.replace(/[^\d.]/g, ""))} inputMode="decimal" optional />
          )}
          <FormError message={save.error && !Object.keys(errors).length ? errorText(save.error) : null} />
        </div>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title={t("item.removeConfirmTitle", { name: item!.name[t.locale] })}
          body={<div className="stack"><p>{t("item.removeConfirm")}</p><FormError message={remove.error ? errorText(remove.error) : null} /></div>}
          confirmLabel={t("item.remove")}
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </SidePanel>
  );
}
