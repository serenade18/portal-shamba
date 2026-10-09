import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText, useKey, usePaged } from "@/api/hooks";
import type { Animal, AnimalWeight, BreedingEvent, BreedingMethod, EnterpriseDetail, Sex } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { LoadMore, Money, RecordedBy, Table } from "@/components/ui/data";
import { Chip, Notice, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError, QuantityField, SelectField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { daysSince, formatDate, formatNumber, today } from "@/lib/format";
import { useCan } from "@/stores/session";
import { Footer, useSave } from "./forms";

type Mode = "view" | "edit" | "service" | "birth" | "weight";

/** Correct an animal's tag, name, sex, breed, birth date or mother (LIV-01). */
function EditAnimalPanel({ animal, herd, onClose }: { animal: Animal; herd: Animal[]; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [f, setF] = useState({ tag: animal.tag, name: animal.name, sex: animal.sex, breed: animal.breed, birth_date: animal.birth_date ?? "", mother_id: animal.mother_id ?? "" });
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useSave(() => api.livestock.updateAnimal(animal.id, { ...f, birth_date: f.birth_date || null, mother_id: f.mother_id || null }), "animal.updated", onClose);
  const err = fieldErrors(save.error);
  const mothers = herd.filter((a) => a.sex === "female" && a.id !== animal.id);
  return (
    <SidePanel title={t("animal.editTitle", { name: `${animal.tag} ${animal.name}`.trim() })} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="form-grid">
        <TextField label={t("animal.tag")} value={f.tag} onChange={set("tag")} error={err.tag} autoFocus />
        <TextField label={t("animal.name")} value={f.name} onChange={set("name")} optional />
        <ChoiceCards<Sex> label={t("animal.sex")} value={f.sex} onChange={set("sex")} options={[{ value: "female", label: t("sex.female") }, { value: "male", label: t("sex.male") }]} />
        <TextField label={t("animal.breed")} value={f.breed} onChange={set("breed")} optional />
        <DateField label={t("animal.birth")} value={f.birth_date} onChange={set("birth_date")} max={today()} error={err.birth_date} />
        <SelectField label={t("animal.mother")} value={f.mother_id} onChange={set("mother_id")} placeholder="" options={mothers.map((a) => ({ value: a.id, label: `${a.tag} ${a.name}`.trim() }))} error={err.mother_id} optional />
        <div className="span-2">
          <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
        </div>
      </div>
    </SidePanel>
  );
}

/** She was served, naturally or by AI; the due date follows from the type's gestation (LIV-05). */
function ServicePanel({ animal, onClose }: { animal: Animal; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<BreedingMethod>("natural");
  const [sire, setSire] = useState("");
  const [note, setNote] = useState("");
  const save = useSave(() => api.livestock.recordService(animal.id, { service_date: date, method, sire, note }), "breeding.saved", onClose);
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("breeding.title", { name: `${animal.tag} ${animal.name}`.trim() })} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("breeding.date")} value={date} onChange={setDate} max={today()} error={err.service_date} />
        <ChoiceCards<BreedingMethod> label={t("breeding.method")} value={method} onChange={setMethod} options={[{ value: "natural", label: t("breeding.natural") }, { value: "ai", label: t("breeding.ai") }]} />
        <TextField label={method === "ai" ? t("breeding.sireAi") : t("breeding.sire")} value={sire} onChange={setSire} optional />
        <TextField label={t("common.note")} value={note} onChange={setNote} optional />
        <p className="small muted">{t("breeding.dueHelp")}</p>
        <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** She gave birth: each of the young joins the herd linked to its mother (LIV-05). */
function BirthPanel({ animal, open, onClose }: { animal: Animal; open: BreedingEvent[]; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [date, setDate] = useState(today());
  const [eventId, setEventId] = useState(open[0]?.id ?? "");
  const [young, setYoung] = useState<{ tag: string; sex: Sex; name: string }[]>([{ tag: "", sex: "female", name: "" }]);
  const save = useSave(
    () => api.livestock.recordBirth(animal.id, { date, offspring: young.filter((y) => y.tag.trim()), breeding_event_id: eventId || null }),
    "birth.saved",
    onClose,
  );
  const err = fieldErrors(save.error);
  return (
    <SidePanel wide title={t("birth.title", { name: `${animal.tag} ${animal.name}`.trim() })} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <div className="form-grid">
          <DateField label={t("birth.date")} value={date} onChange={setDate} max={today()} error={err.date} />
          {open.length > 0 && (
            <SelectField label={t("birth.service")} value={eventId} onChange={setEventId} placeholder={t("birth.noService")} options={open.map((b) => ({ value: b.id, label: t("birth.serviceOption", { date: formatDate(b.service_date, t.locale), due: formatDate(b.expected_due, t.locale) }) }))} error={err.breeding_event_id} />
          )}
        </div>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend className="field-label">{t("birth.young")}</legend>
          <div className="lines">
            {young.map((y, i) => {
              const upd = (patch: Partial<typeof y>) => setYoung(young.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="line-card line-row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) auto" }}>
                  <TextField label={t("animal.tag")} value={y.tag} onChange={(v) => upd({ tag: v })} />
                  <TextField label={t("animal.name")} value={y.name} onChange={(v) => upd({ name: v })} optional />
                  <SelectField label={t("animal.sex")} value={y.sex} onChange={(v) => upd({ sex: v as Sex })} options={[{ value: "female", label: t("sex.female") }, { value: "male", label: t("sex.male") }]} />
                  <Button variant="quiet" aria-label={t("common.remove")} icon={<Trash2 size={18} />} onClick={() => setYoung(young.filter((_, j) => j !== i))} />
                </div>
              );
            })}
          </div>
          {young.length < 6 && (
            <div>
              <Button variant="quiet" icon={<Plus size={16} />} onClick={() => setYoung([...young, { tag: "", sex: "female", name: "" }])}>{t("birth.addYoung")}</Button>
            </div>
          )}
          {!young.length && <p className="small muted">{t("birth.noneSurvived")}</p>}
        </fieldset>
        <FormError message={err.offspring ?? (save.error && !Object.keys(err).length ? errorText(save.error) : null)} />
      </div>
    </SidePanel>
  );
}

function WeightPanel({ animal, onClose }: { animal: Animal; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [date, setDate] = useState(today());
  const [kg, setKg] = useState("");
  const save = useSave(() => api.livestock.recordWeight(animal.id, { date, kg }), "weight.saved", onClose);
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("weight.title", { name: `${animal.tag} ${animal.name}`.trim() })} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <QuantityField label={`⚖ ${t("weight.kg")}`} value={kg} onChange={setKg} unit="kg" units={["kg"]} error={err.kg} />
        <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

function outcomeChip(t: ReturnType<typeof useT>, b: BreedingEvent) {
  if (b.outcome === "born") return <Chip tone="health">{t("breeding.outcome.born", { date: formatDate(b.birth_date, t.locale) })}</Chip>;
  if (b.outcome === "failed") return <Chip tone="neutral">{t("breeding.outcome.failed")}</Chip>;
  return <Chip tone={daysSince(b.expected_due) > 0 ? "amber" : "lavender"}>{t("breeding.outcome.waiting")}</Chip>;
}

/**
 * One animal: what's known about it, its services and births, and its weights
 * (LIV-01, LIV-05, LIV-06). Opened from a row of the herd's animals.
 */
export function AnimalPanel({ animalId, ent, herd, onExit, onClose }: { animalId: string; ent: EnterpriseDetail; herd: Animal[]; onExit: (a: Animal) => void; onClose: () => void }) {
  const t = useT();
  const key = useKey();
  const qty = useQty();
  const money = useCan("money.read");
  const canRecord = useCan("records.write");
  const [mode, setMode] = useState<Mode>("view");
  const q = useQuery({ queryKey: key("animal", animalId), queryFn: () => api.livestock.animal(animalId) });
  const a = q.data;
  const female = a?.sex === "female";
  const breeding = useQuery({ queryKey: key("breeding", animalId), queryFn: () => api.livestock.breeding(animalId), select: (p) => p.results, enabled: female });
  const weights = usePaged(key("weights", animalId), (cursor) => api.livestock.weights(animalId, cursor));

  const back = () => setMode("view");
  if (a && mode === "edit") return <EditAnimalPanel animal={a} herd={herd} onClose={back} />;
  if (a && mode === "service") return <ServicePanel animal={a} onClose={back} />;
  if (a && mode === "birth") return <BirthPanel animal={a} open={(breeding.data ?? []).filter((b) => !b.outcome)} onClose={back} />;
  if (a && mode === "weight") return <WeightPanel animal={a} onClose={back} />;

  const inHerd = a?.status === "active" && ent.status === "active";
  const mother = herd.find((m) => m.id === a?.mother_id);
  const young = herd.filter((x) => x.mother_id === animalId);
  const weightColumns = [
    { key: "d", header: t("common.date"), render: (w: AnimalWeight) => formatDate(w.date, t.locale) },
    { key: "k", header: t("weight.kg"), numeric: true, render: (w: AnimalWeight) => qty(w.kg, "kg") },
    {
      key: "c",
      header: t("weight.change"),
      numeric: true,
      render: (w: AnimalWeight) => {
        const prev = weights.rows[weights.rows.indexOf(w) + 1];
        if (!prev) return "–";
        const diff = Number(w.kg) - Number(prev.kg);
        return <span className={diff < 0 ? "ink-cost" : ""}>{`${diff > 0 ? "+" : ""}${formatNumber(diff)} kg`}</span>;
      },
    },
    { key: "by", header: t("common.recordedBy"), render: (w: AnimalWeight) => <RecordedBy by={w.recorded_by} /> },
  ];

  return (
    <SidePanel
      wide
      title={a ? `${a.tag} ${a.name}`.trim() : "…"}
      onClose={onClose}
      footer={
        a && inHerd && canRecord && (
          <>
            <Button onClick={() => setMode("edit")}>{t("common.edit")}</Button>
            <Button onClick={() => setMode("weight")}>{t("weight.record")}</Button>
            {female && <Button onClick={() => setMode("service")}>{t("breeding.record")}</Button>}
            {female && <Button variant="primary" onClick={() => setMode("birth")}>{t("birth.record")}</Button>}
            <Button variant="quiet" onClick={() => (onClose(), onExit(a))}>{t("animal.exit")}</Button>
          </>
        )
      }
    >
      {!a ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="stack-lg">
          {a.conflicts.length > 0 && <Notice tone="amber">{t("animal.conflicts", { fields: a.conflicts.map((f) => t.dyn(`animal.field.${f}`, f)).join(", ") })}</Notice>}
          <dl className="summary-list">
            <dt>{t("animal.sex")}</dt>
            <dd>{t(`sex.${a.sex}`)}</dd>
            <dt>{t("animal.breed")}</dt>
            <dd>{a.breed || "–"}</dd>
            <dt>{t("animal.birth")}</dt>
            <dd>{a.birth_date ? formatDate(a.birth_date, t.locale) : "–"}</dd>
            <dt>{t("animal.source")}</dt>
            <dd>{t(`source.${a.source}`)}</dd>
            <dt>{t("animal.mother")}</dt>
            <dd>{mother ? `${mother.tag} ${mother.name}`.trim() : "–"}</dd>
            {money && a.cost != null && (
              <>
                <dt>{t("animal.cost")}</dt>
                <dd><Money value={a.cost} kind="cost" /></dd>
              </>
            )}
            <dt>{t("common.status")}</dt>
            <dd>
              <Chip tone={a.status === "active" ? "health" : "neutral"}>{t(`animalStatus.${a.status}`)}</Chip>
              {a.exited_on && <span className="small muted"> {formatDate(a.exited_on, t.locale)}</span>}
            </dd>
          </dl>

          {female && (
            <section className="stack" style={{ gap: 8 }}>
              <h3>{t("breeding.heading")}</h3>
              {breeding.isLoading ? (
                <SkeletonRows rows={2} />
              ) : !breeding.data?.length ? (
                <p className="small muted">{t("breeding.empty")}</p>
              ) : (
                <Table
                  rows={breeding.data}
                  rowKey={(b) => b.id}
                  columns={[
                    { key: "d", header: t("breeding.date"), render: (b) => formatDate(b.service_date, t.locale) },
                    { key: "m", header: t("breeding.method"), render: (b) => <span>{t(b.method === "ai" ? "breeding.ai" : "breeding.natural")}{b.sire && <span className="small muted" style={{ display: "block" }}>{b.sire}</span>}</span> },
                    { key: "due", header: t("breeding.due"), render: (b) => formatDate(b.expected_due, t.locale) },
                    { key: "o", header: t("common.status"), render: (b) => outcomeChip(t, b) },
                  ]}
                />
              )}
              {young.length > 0 && <p className="small">{t("breeding.young", { list: young.map((y) => `${y.tag} ${y.name}`.trim()).join(", ") })}</p>}
            </section>
          )}

          <section className="stack" style={{ gap: 8 }}>
            <h3>{t("weight.heading")}</h3>
            {weights.isLoading ? (
              <SkeletonRows rows={2} />
            ) : !weights.rows.length ? (
              <p className="small muted">{t("weight.empty")}</p>
            ) : (
              <Table rows={weights.rows} rowKey={(w) => w.id} columns={weightColumns} footer={<LoadMore hasNext={!!weights.hasNextPage} loading={weights.isFetchingNextPage} onClick={() => weights.fetchNextPage()} />} />
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}
