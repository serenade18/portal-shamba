import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useCatalogue, useEnterprises, useErrorText, useFarmId, useItems, useKey } from "@/api/hooks";
import type { ActivityType, Animal, EnterpriseDetail, Item, ItemCategory, TypeCode, VaccinationPlanStep } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/data";
import { Skeleton } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError, MoneyField, QuantityField, SelectField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useT, type MsgKey } from "@/i18n";
import { GRAINS, HEAD_UNIT, isMixed, isPerennial } from "@/lib/enterpriseTypes";
import { today } from "@/lib/format";
import { useCan, useSession } from "@/stores/session";
import { toast } from "@/stores/toast";

/** After any write, refetch everything for this organisation: the ledger touches stock, money and alerts. */
export function useInvalidateOrg() {
  const qc = useQueryClient();
  const orgId = useSession((s) => s.activeOrgId);
  const userId = useSession((s) => s.user?.id);
  return () => qc.invalidateQueries({ queryKey: [userId, orgId] });
}

export function useSave<TArgs>(fn: (a: TArgs) => Promise<unknown>, done: MsgKey, onClose: () => void) {
  const t = useT();
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate();
      toast(t(done));
      onClose();
    },
  });
}

function itemsIn(items: Item[] | undefined, ...cats: ItemCategory[]) {
  return (items ?? []).filter((i) => cats.includes(i.category));
}

export function Footer({ onClose, loading, label }: { onClose: () => void; loading: boolean; label: string }) {
  const t = useT();
  return (
    <>
      <Button onClick={onClose}>{t("common.cancel")}</Button>
      <Button type="submit" variant="primary" loading={loading}>{label}</Button>
    </>
  );
}

/** Feed, deaths and eggs on one screen (BAT-02). */
export function RecordDayPanel({ ent, onClose }: { ent: EnterpriseDetail; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const items = useItems();
  const feeds = itemsIn(items.data, "feed");
  const [date, setDate] = useState(today());
  const [eggs, setEggs] = useState("");
  const [feedId, setFeedId] = useState("");
  const feed = feeds.find((f) => f.id === feedId) ?? feeds[0];
  const [feedQty, setFeedQty] = useState("");
  const [feedUnit, setFeedUnit] = useState("bag");
  const [deaths, setDeaths] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const save = useSave(
    () => api.batches.recordDay(ent.id, { date, feed_item_id: feedQty ? (feed?.id ?? null) : null, feed_qty: feedQty || "0", feed_unit: feedUnit, deaths: Number(deaths || 0), eggs_trays: eggs || "0", note }),
    "day.saved",
    onClose,
  );
  const submit = () => {
    const d = Number(deaths || 0);
    if (d < 0 || d > (ent.head_count ?? 0)) return setErr({ deaths: t("day.deathsError", { max: ent.head_count ?? 0 }) });
    setErr({});
    save.mutate(undefined);
  };
  const server = fieldErrors(save.error);
  return (
    <SidePanel title={`${t("day.title")}: ${ent.name}`} onClose={onClose} onSubmit={submit} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        {ent.type === "layers" && <QuantityField label={`🥚 ${t("day.eggs")}`} value={eggs} onChange={setEggs} unit="tray" units={["tray"]} />}
        <div className="form-grid">
          <SelectField label={t("feed.item")} value={feed?.id ?? ""} onChange={(v) => setFeedId(v)} options={feeds.map((f) => ({ value: f.id, label: f.name[t.locale] }))} />
          <QuantityField label={`🌾 ${t("day.feed")}`} value={feedQty} onChange={setFeedQty} unit={feedUnit} onUnitChange={setFeedUnit} units={feed?.units ?? ["bag"]} />
        </div>
        <QuantityField label={`✝ ${ent.type === "fish" ? t("day.deathsFish") : HEAD_UNIT[ent.type] === "bird" ? t("day.deaths") : t("day.deathsAnimals")}`} value={deaths} onChange={setDeaths} unit={HEAD_UNIT[ent.type] ?? "bird"} units={[HEAD_UNIT[ent.type] ?? "bird"]} error={err.deaths ?? server.deaths} />
        <TextField label={t("common.note")} value={note} onChange={setNote} optional />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

export function RecordMilkPanel({ ent, animals, onClose }: { ent: EnterpriseDetail; animals: Animal[]; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<"herd" | "animal">("herd");
  const [animalId, setAnimalId] = useState("");
  const [litres, setLitres] = useState("");
  const milking = animals.filter((a) => a.status === "active" && a.sex === "female");
  const save = useSave(() => api.livestock.recordMilk({ enterprise_id: ent.id, date, litres, animal_id: mode === "animal" ? animalId || null : null }), "milk.saved", onClose);
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("milk.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <ChoiceCards
          label={t("milk.mode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "herd", label: t("milk.herd") },
            { value: "animal", label: t("milk.animal") },
          ]}
        />
        {mode === "animal" && (
          <SelectField label={t("milk.which")} value={animalId} onChange={setAnimalId} placeholder="" options={milking.map((a) => ({ value: a.id, label: `${a.tag} ${a.name}` }))} />
        )}
        <QuantityField label={`🥛 ${t("milk.litres")}`} value={litres} onChange={setLitres} unit="l" units={["l"]} error={err.litres ? t("sale.qtyError") : undefined} />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

export function RecordFeedPanel({ ent, onClose }: { ent: EnterpriseDetail; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const items = useItems();
  const feeds = itemsIn(items.data, "feed");
  const [date, setDate] = useState(today());
  const [itemId, setItemId] = useState("");
  const item = feeds.find((f) => f.id === itemId) ?? feeds[0];
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("bag");
  const save = useSave(() => api.livestock.recordFeed({ enterprise_id: ent.id, date, item_id: item!.id, qty, unit }), "feed.saved", onClose);
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("feed.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <SelectField label={t("feed.item")} value={item?.id ?? ""} onChange={setItemId} options={feeds.map((f) => ({ value: f.id, label: f.name[t.locale] }))} />
        <QuantityField label={t("common.quantity")} value={qty} onChange={setQty} unit={unit} onUnitChange={setUnit} units={item?.units ?? ["bag"]} error={err.qty ? t("sale.qtyError") : undefined} />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/**
 * With `step`, the dose is that step of the vaccination schedule (BAT-04, LIV-04): a batch's
 * step by its day, a herd's by its key, given to the step's animal or the whole herd.
 */
export function RecordTreatmentPanel({ ent, animals, step, onClose }: { ent: EnterpriseDetail; animals: Animal[]; step?: VaccinationPlanStep; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const items = useItems();
  const drugs = itemsIn(items.data, "drug");
  const [date, setDate] = useState(today());
  const [itemId, setItemId] = useState("");
  const item = drugs.find((f) => f.id === itemId) ?? drugs[0];
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(item?.display_unit ?? "dose");
  const [dose, setDose] = useState(step ? step.vaccine : "");
  const [animalId, setAnimalId] = useState(step?.animal_id ?? "");
  const animal = animals.find((a) => a.id === animalId);
  const save = useSave(
    () =>
      api.livestock.recordTreatment({
        enterprise_id: ent.id, date, item_id: item!.id, qty, unit, dose_note: dose,
        subject: animal ? `${animal.tag} ${animal.name}`.trim() : step?.animal_tag ?? "",
        ...(step?.key ? { schedule_key: step.key } : { schedule_day: step?.day ?? null }),
        animal_id: animalId || null,
      }),
    "treat.saved",
    onClose,
  );
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={step ? t("vacc.recordTitle", { vaccine: step.vaccine }) : t("treat.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <SelectField label={`💉 ${t("treat.product")}`} value={item?.id ?? ""} onChange={(v) => (setItemId(v), setUnit(drugs.find((d) => d.id === v)?.display_unit ?? "dose"))} options={drugs.map((f) => ({ value: f.id, label: f.name[t.locale] }))} />
        <QuantityField label={t("common.quantity")} value={qty} onChange={setQty} unit={unit} onUnitChange={setUnit} units={item?.units ?? ["dose"]} error={err.qty ? t("sale.qtyError") : undefined} />
        <TextField label={t("treat.dose")} value={dose} onChange={setDose} placeholder={t("treat.dosePlaceholder")} optional />
        {step?.animal_tag ? (
          <p className="small">{t("treat.forAnimal", { tag: step.animal_tag })}</p>
        ) : animals.length > 0 && step?.kind !== "every" ? (
          <SelectField label={t("treat.subject")} value={animalId} onChange={setAnimalId} placeholder={t("treat.wholeGroup")} options={animals.filter((a) => a.status === "active").map((a) => ({ value: a.id, label: `${a.tag} ${a.name}`.trim() }))} />
        ) : null}
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** Pigs and rabbits can also join from a batch of growers: kept for breeding, they leave that batch. */
export function AddAnimalPanel({ ent, animals, onClose }: { ent: EnterpriseDetail; animals: Animal[]; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const money = useCan("money.read");
  const catalogue = useCatalogue();
  const mixed = isMixed(catalogue.data?.enterprise_types.find((x) => x.code === ent.type));
  const batches = useEnterprises("batches");
  const growers = (batches.data ?? []).filter((b) => mixed && b.type === ent.type && b.status === "active" && (b.head_count ?? 0) > 0);
  const [f, setF] = useState({ tag: "", name: "", sex: "female" as "female" | "male", breed: "", birth_date: "", source: "bought" as "born" | "bought" | "batch", cost: "", mother_id: "", from_batch_id: "" });
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const fromBatch = f.source === "batch";
  const save = useSave(
    () =>
      api.livestock.createAnimal({
        enterprise_id: ent.id, ...f, source: f.source === "batch" ? "born" : f.source, birth_date: f.birth_date || null, cost: fromBatch ? null : f.cost || null,
        mother_id: f.source !== "bought" ? f.mother_id || null : null, from_batch_id: fromBatch ? f.from_batch_id || null : null,
      }),
    "animal.saved",
    onClose,
  );
  const err = fieldErrors(save.error);
  const mothers = animals.filter((a) => a.sex === "female" && a.status === "active");
  return (
    <SidePanel title={t("animal.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="form-grid">
        <TextField label={t("animal.tag")} value={f.tag} onChange={set("tag")} error={err.tag} autoFocus />
        <TextField label={t("animal.name")} value={f.name} onChange={set("name")} optional />
        <ChoiceCards label={t("animal.sex")} value={f.sex} onChange={set("sex")} options={[{ value: "female", label: t("sex.female") }, { value: "male", label: t("sex.male") }]} />
        <TextField label={t("animal.breed")} value={f.breed} onChange={set("breed")} optional />
        <DateField label={t("animal.birth")} value={f.birth_date} onChange={set("birth_date")} max={today()} />
        <ChoiceCards label={t("animal.source")} value={f.source} onChange={set("source")} options={[{ value: "bought", label: t("source.bought") }, { value: "born", label: t("source.born") }, ...(growers.length ? [{ value: "batch" as const, label: t("source.batch") }] : [])]} />
        {fromBatch && (
          <SelectField className="span-2" label={t("animal.fromBatch")} value={f.from_batch_id} onChange={set("from_batch_id")} placeholder="" options={growers.map((b) => ({ value: b.id, label: t("animal.fromBatchOption", { name: b.name, n: b.head_count ?? 0 }) }))} error={err.from_batch_id} hint={t("animal.fromBatchHint")} />
        )}
        {f.source !== "bought" && mothers.length > 0 && (
          <SelectField className="span-2" label={t("animal.mother")} value={f.mother_id} onChange={set("mother_id")} placeholder="" options={mothers.map((a) => ({ value: a.id, label: `${a.tag} ${a.name}` }))} optional />
        )}
        {f.source === "bought" && money && <MoneyField className="span-2" label={t("animal.cost")} value={f.cost} onChange={set("cost")} optional />}
        <div className="span-2">
          <FormError message={save.error ? errorText(save.error) : null} />
        </div>
      </div>
    </SidePanel>
  );
}

export function AnimalExitPanel({ animal, onClose }: { animal: Animal; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const money = useCan("money.read");
  const [reason, setReason] = useState<"sold" | "dead">("sold");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today());
  const save = useSave(() => api.livestock.exitAnimal(animal.id, { reason, value: value || "0", date }), "animal.exitSaved", onClose);
  return (
    <SidePanel title={t("animal.exitTitle", { name: `${animal.tag} ${animal.name}`.trim() })} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <ChoiceCards label={t("animal.exitReason")} value={reason} onChange={setReason} options={[{ value: "sold", label: t("exit.sold") }, { value: "dead", label: t("exit.dead") }]} />
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        {reason === "sold" && money && <MoneyField label={t("animal.exitValue")} value={value} onChange={setValue} />}
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

const ACTIVITIES: ActivityType[] = ["land_preparation", "planting", "transplanting", "weeding", "spraying", "fertilising", "irrigation", "pruning", "other"];

export function RecordActivityPanel({ ent, onClose }: { ent: EnterpriseDetail; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const money = useCan("money.read");
  const items = useItems();
  const inputs = itemsIn(items.data, "seed", "fertiliser", "chemical");
  const [date, setDate] = useState(today());
  const [type, setType] = useState<ActivityType>("weeding");
  const [lines, setLines] = useState<{ item_id: string; qty: string; unit: string }[]>([]);
  const [labour, setLabour] = useState("");
  const [service, setService] = useState("");
  const [note, setNote] = useState("");
  const save = useSave(() => api.crops.recordActivity(ent.id, { date, type, inputs: lines.filter((l) => l.item_id && l.qty), labour_cost: labour || "0", service_cost: service || "0", note }), "act.saved", onClose);
  return (
    <SidePanel wide title={t("act.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <div className="form-grid">
          <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
          <SelectField label={t("act.type")} value={type} onChange={(v) => setType(v as ActivityType)} options={ACTIVITIES.map((a) => ({ value: a, label: t(`activity.${a}`) }))} />
        </div>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend className="field-label">{t("act.inputs")}</legend>
          <div className="lines">
            {lines.map((l, i) => {
              const it = inputs.find((x) => x.id === l.item_id);
              const upd = (patch: Partial<typeof l>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="line-card">
                  <SelectField label={t("stock.item")} value={l.item_id} onChange={(v) => upd({ item_id: v, unit: inputs.find((x) => x.id === v)?.display_unit ?? "kg" })} options={inputs.map((x) => ({ value: x.id, label: x.name[t.locale] }))} />
                  <div className="row" style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
                    <QuantityField label={t("common.quantity")} value={l.qty} onChange={(v) => upd({ qty: v })} unit={l.unit} onUnitChange={(u) => upd({ unit: u })} units={it?.units ?? [l.unit]} />
                    <Button variant="quiet" aria-label={t("common.remove")} icon={<Trash2 size={18} />} onClick={() => setLines(lines.filter((_, j) => j !== i))} />
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <Button variant="quiet" icon={<Plus size={16} />} onClick={() => setLines([...lines, { item_id: inputs[0]?.id ?? "", qty: "", unit: inputs[0]?.display_unit ?? "kg" }])}>
              {t("act.addInput")}
            </Button>
          </div>
        </fieldset>
        {money && (
          <div className="form-grid">
            <MoneyField label={t("act.labour")} value={labour} onChange={setLabour} optional />
            <MoneyField label={t("act.service")} value={service} onChange={setService} optional />
          </div>
        )}
        <TextField label={t("common.note")} value={note} onChange={setNote} optional />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** Counted in the crop's own units: bags of grain, crates of tomatoes, bunches of bananas. */
export function RecordHarvestPanel({ ent, onClose }: { ent: EnterpriseDetail; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const items = useItems();
  const output = items.data?.find((i) => i.kind === "output" && i.produced_by.includes(ent.type));
  const grain = GRAINS.includes(ent.type);
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState("");
  const [chosenUnit, setUnit] = useState<string | null>(null);
  const unit = chosenUnit ?? output?.display_unit ?? "kg";
  const [moisture, setMoisture] = useState<"green" | "dry">("dry");
  const save = useSave(() => api.crops.recordHarvest(ent.id, { date, qty, unit, moisture }), "harv.saved", onClose);
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("harv.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <QuantityField label={t("common.quantity")} value={qty} onChange={setQty} unit={unit} onUnitChange={setUnit} units={output?.units ?? ["bag", "kg"]} error={err.qty ? t("sale.qtyError") : err.unit} />
        {grain && <ChoiceCards label={t("harv.condition")} value={moisture} onChange={setMoisture} options={[{ value: "dry", label: t("moisture.dry") }, { value: "green", label: t("moisture.green") }]} />}
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

export function StartBatchPanel({ types, onClose, onStarted }: { types: TypeCode[]; onClose: () => void; onStarted: (id: string) => void }) {
  const t = useT();
  const errorText = useErrorText();
  const key = useKey();
  const farmId = useFarmId();
  const money = useCan("money.read");
  const catalogue = useCatalogue();
  const invalidate = useInvalidateOrg();
  const structures = useQuery({ queryKey: key("structures", farmId), queryFn: () => api.farms.structures(farmId), select: (p) => p.results });
  const [type, setType] = useState<TypeCode>(types[0]!);
  const label = catalogue.data?.enterprise_types.find((x) => x.code === type)?.labels.en ?? type;
  const [f, setF] = useState({ name: "", count: "", date: today(), source: "", cost: "", structure_id: "", age_days: "" });
  const set = <K extends keyof typeof f>(k: K) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => api.batches.start({ farm_id: farmId, type, name: f.name || `${label}, ${f.date}`, count: Number(f.count), date: f.date, source: f.source, cost: f.cost || "0", structure_id: f.structure_id || null, age_days: Number(f.age_days || 0) }),
    onSuccess: (e) => {
      invalidate();
      toast(t("batch.started"));
      onStarted(e.id);
    },
  });
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("batch.title")} onClose={onClose} onSubmit={() => save.mutate()} footer={<Footer onClose={onClose} loading={save.isPending} label={t("list.poultry.start")} />}>
      <div className="form-grid">
        {types.length > 1 && (
          <div className="span-2">
            <ChoiceCards label={t("batch.type")} value={type} onChange={setType} options={types.map((c) => { const x = catalogue.data?.enterprise_types.find((e) => e.code === c); return { value: c, label: x?.labels[t.locale] ?? c, icon: <span aria-hidden>{x?.icon}</span> }; })} />
          </div>
        )}
        <TextField className="span-2" label={t("batch.name")} value={f.name} onChange={set("name")} placeholder={`${label}, …`} optional />
        <TextField label={type === "fish" ? t("batch.countFish") : HEAD_UNIT[type] === "bird" ? t("batch.count") : t("batch.countAnimals")} value={f.count} onChange={(v) => set("count")(v.replace(/\D/g, ""))} inputMode="numeric" error={err.count} />
        <DateField label={t("batch.date")} value={f.date} onChange={set("date")} max={today()} />
        <TextField label={t("batch.age")} value={f.age_days} onChange={(v) => set("age_days")(v.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" hint={HEAD_UNIT[type] === "bird" ? t("batch.ageHint") : t("batch.ageHintAnimals")} error={err.age_days} optional />
        <TextField label={t("batch.source")} value={f.source} onChange={set("source")} placeholder={t("batch.sourcePlaceholder")} optional />
        <SelectField label={t("batch.structure")} value={f.structure_id} onChange={set("structure_id")} placeholder="" options={(structures.data ?? []).filter((s) => (HEAD_UNIT[type] === "bird" || type === "fish" ? s.type === "poultry_house" || s.type === "pond" : s.type === "pen" || s.type === "shed")).map((s) => ({ value: s.id, label: s.name }))} optional />
        {money && <MoneyField className="span-2" label={t("batch.cost")} value={f.cost} onChange={set("cost")} optional />}
        <div className="span-2">
          <FormError message={save.error ? errorText(save.error) : null} />
        </div>
      </div>
    </SidePanel>
  );
}

export function StartSeasonPanel({ types, onClose, onStarted }: { types: TypeCode[]; onClose: () => void; onStarted: (id: string) => void }) {
  const t = useT();
  const errorText = useErrorText();
  const key = useKey();
  const farmId = useFarmId();
  const catalogue = useCatalogue();
  const invalidate = useInvalidateOrg();
  const plots = useQuery({ queryKey: key("plots", farmId), queryFn: () => api.farms.plots(farmId), select: (p) => p.results });
  const [type, setType] = useState<TypeCode>(types[0]!);
  const [f, setF] = useState({ plot_id: "", variety: "", area_acres: "", date: today(), name: "", plant_count: "" });
  const set = <K extends keyof typeof f>(k: K) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const plot = plots.data?.find((p) => p.id === f.plot_id);
  const orchard = isPerennial(catalogue.data?.enterprise_types.find((x) => x.code === type));
  const cropName = catalogue.data?.enterprise_types.find((x) => x.code === type)?.labels.en ?? type;
  const defaultName = useMemo(() => `${cropName}, ${new Date(f.date).toLocaleString("en", { month: "short", year: "numeric" })}`, [cropName, f.date]);
  const save = useMutation({
    mutationFn: () => api.crops.start({ farm_id: farmId, type, plot_id: f.plot_id, variety: f.variety, area_acres: f.area_acres || plot?.area_acres || "", date: f.date, name: f.name || defaultName, plant_count: f.plant_count ? Number(f.plant_count) : null }),
    onSuccess: (e) => {
      invalidate();
      toast(t("season.started"));
      onStarted(e.id);
    },
  });
  const err = fieldErrors(save.error);
  if (plots.isLoading) return <SidePanel title={t("season.title")} onClose={onClose}><Skeleton height={300} /></SidePanel>;
  return (
    <SidePanel title={t("season.title")} onClose={onClose} onSubmit={() => save.mutate()} footer={plots.data?.length ? <Footer onClose={onClose} loading={save.isPending} label={t("list.crops.start")} /> : undefined}>
      {!plots.data?.length ? (
        <p>{t("season.noPlots")}</p>
      ) : (
        <div className="form-grid">
          {types.length > 1 && (
            <div className="span-2">
              <ChoiceCards label={t("season.crop")} value={type} onChange={setType} options={types.map((c) => { const x = catalogue.data?.enterprise_types.find((e) => e.code === c); return { value: c, label: x?.labels[t.locale] ?? c, icon: <span aria-hidden>{x?.icon}</span> }; })} />
            </div>
          )}
          <SelectField label={t("season.plot")} value={f.plot_id} onChange={set("plot_id")} placeholder="" options={plots.data.map((p) => ({ value: p.id, label: `${p.name} (${p.area_acres} ac)` }))} error={err.plot_id} />
          <TextField label={t("season.area")} value={f.area_acres} onChange={(v) => set("area_acres")(v.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={plot?.area_acres} error={err.area_acres} />
          <TextField label={t("season.variety")} value={f.variety} onChange={set("variety")} optional />
          <TextField label={orchard ? t("season.trees") : t("season.plants")} value={f.plant_count} onChange={(v) => set("plant_count")(v.replace(/\D/g, ""))} inputMode="numeric" hint={orchard ? t("season.treesHint") : undefined} error={err.plant_count} optional />
          <DateField label={t("season.date")} value={f.date} onChange={set("date")} max={today()} />
          <TextField className="span-2" label={t("season.name")} value={f.name} onChange={set("name")} placeholder={defaultName} optional />
          <div className="span-2">
            <FormError message={save.error ? errorText(save.error) : null} />
          </div>
        </div>
      )}
    </SidePanel>
  );
}

/** Shows cost, revenue, profit and the type's key ratios before confirming (7.2, BAT-07, CRP-05). */
export function ClosePanel({ ent, onClose }: { ent: EnterpriseDetail; onClose: () => void }) {
  const t = useT();
  const key = useKey();
  const errorText = useErrorText();
  const summary = useQuery({ queryKey: key("close-summary", ent.id), queryFn: () => api.enterprises.closeSummary(ent.id) });
  const isSeason = ent.module === "crops";
  const catalogue = useCatalogue();
  const orchard = isPerennial(catalogue.data?.enterprise_types.find((x) => x.code === ent.type));
  const save = useSave(() => api.enterprises.close(ent.id), orchard ? "close.doneOrchard" : isSeason ? "close.doneSeason" : "close.doneBatch", onClose);
  const s = summary.data;
  return (
    <SidePanel
      title={t("close.titleBatch", { name: ent.name })}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)} disabled={!s}>
            {orchard ? t("close.confirmOrchard") : isSeason ? t("close.confirmSeason") : t("close.confirmBatch")}
          </Button>
        </>
      }
    >
      <div className="stack-lg">
        <p className="muted">{orchard ? t("close.helpOrchard") : t("close.help")}</p>
        {!s ? (
          <Skeleton height={200} />
        ) : (
          <dl className="summary-list">
            <dt>{t("common.costs")}</dt>
            <dd><Money value={s.cost} kind="cost" /></dd>
            <dt>{t("common.revenue")}</dt>
            <dd><Money value={s.revenue} kind="revenue" /></dd>
            <dt className="total strong">{Number(s.profit) < 0 ? t("common.loss") : t("common.profit")}</dt>
            <dd className="total"><Money value={s.profit} kind="profit" /></dd>
            {s.ratios.filter((r) => !r.money).map((r) => (
              <KpiLine key={r.code} code={r.code} value={r.value} unit={r.unit} />
            ))}
          </dl>
        )}
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

function KpiLine({ code, value, unit }: { code: string; value: string; unit: string }) {
  const t = useT();
  return (
    <>
      <dt>{t.dyn(`kpi.${code}`, code)}</dt>
      <dd>{unit === "%" ? `${value}%` : `${value} ${unit ? t.unit(unit) : ""}`}</dd>
    </>
  );
}
