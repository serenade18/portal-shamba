import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText, useKey } from "@/api/hooks";
import type { Animal, BreedingCalendarEvent, BreedingEvent, EnterpriseDetail, VaccinationPlanStep } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/data";
import { Chip, EmptyState, SkeletonRows, type Tone } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useT, type Translator } from "@/i18n";
import { formatDate, today } from "@/lib/format";
import { useCan } from "@/stores/session";
import { STATE_TONE } from "./BatchPanels";
import { Footer, useSave } from "./forms";

const WHEN_TONE: Record<BreedingCalendarEvent["status"], Tone> = { due: "amber", overdue: "terracotta", upcoming: "neutral" };

/** "Day 90", "Every 180 days", "28 days before birth": when a step is given. */
export function stepWhen(t: Translator, s: VaccinationPlanStep): string {
  if (s.kind === "every") return t("vacc.everyN", { n: s.every_days });
  if (s.kind === "before_birth") return t("vacc.beforeBirthN", { n: s.days });
  return t("vacc.dayN", { n: s.day });
}

export function stepStatus(t: Translator, s: VaccinationPlanStep) {
  const text = s.status === "done" && s.done_on ? t("vacc.doneOn", { date: formatDate(s.done_on, t.locale) }) : t.dyn(`vacc.state.${s.status}`, s.status);
  return <Chip tone={STATE_TONE[s.status]}>{text}</Chip>;
}

/** What the herd and its animals are due for in the next 60 days (LIV-04). */
export function HerdVaccinationsTab({ ent, onRecord, onEditSchedule }: { ent: EnterpriseDetail; onRecord: (step: VaccinationPlanStep) => void; onEditSchedule: () => void }) {
  const t = useT();
  const key = useKey();
  const canRecord = useCan("records.write");
  const canEdit = useCan("schedules.write");
  const q = useQuery({ queryKey: key("herd-vaccinations", ent.id), queryFn: () => api.livestock.herdVaccinations(ent.id) });
  if (q.isLoading || !q.data) return <SkeletonRows />;
  const v = q.data;
  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <p className="muted">{v.custom ? t("vacc.custom") : t("vacc.default")} · {t("vacc.herdHorizon")}</p>
        {canEdit && <Button size="sm" onClick={onEditSchedule}>{t("vacc.editSchedule")}</Button>}
      </div>
      {!v.steps.length ? (
        <div className="panel"><EmptyState text={t("vacc.herdEmpty")} /></div>
      ) : (
        <Table
          rows={v.steps}
          rowKey={(s) => `${s.key}:${s.animal_id ?? "herd"}:${s.due_on ?? ""}`}
          columns={[
            { key: "v", header: t("vacc.vaccine"), render: (s) => <span><span className="strong">{s.vaccine}</span>{s.note && <span className="small muted" style={{ display: "block" }}>{s.note}</span>}</span> },
            { key: "who", header: t("treat.col.subject"), render: (s) => s.animal_tag ?? t("vacc.wholeHerd") },
            { key: "when", header: t("vacc.when"), render: (s) => stepWhen(t, s) },
            { key: "due", header: t("vacc.dueOn"), render: (s) => (s.due_on ? formatDate(s.due_on, t.locale) : t("vacc.lastDoseUnknown")) },
            { key: "s", header: t("common.status"), render: (s) => stepStatus(t, s) },
            ...(ent.status === "active" && canRecord
              ? [{ key: "a", header: <span className="visually-hidden">{t("vacc.record")}</span>, label: "", render: (s: VaccinationPlanStep) => <Button variant={s.status === "upcoming" ? "quiet" : "secondary"} size="sm" onClick={() => onRecord(s)}>{s.status === "not_recorded" ? t("vacc.recordLast") : t("vacc.record")}</Button> }]
              : []),
          ]}
        />
      )}
    </>
  );
}

export function breedingStatus(t: Translator, e: BreedingCalendarEvent) {
  return <Chip tone={WHEN_TONE[e.status]}>{t(`vacc.state.${e.status}`)}</Chip>;
}

/** Each female's next breeding steps in the next 60 days (LIV-05). */
export function HerdBreedingTab({ ent, onOpenAnimal, onCheck }: { ent: EnterpriseDetail; onOpenAnimal: (id: string) => void; onCheck: (e: BreedingCalendarEvent) => void }) {
  const t = useT();
  const key = useKey();
  const canRecord = useCan("records.write");
  const q = useQuery({ queryKey: key("herd-breeding", ent.id), queryFn: () => api.livestock.herdBreedingCalendar(ent.id) });
  if (q.isLoading || !q.data) return <SkeletonRows />;
  if (!q.data.events.length) return <div className="panel"><EmptyState text={t("cal.empty")} /></div>;
  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>{t("cal.help")}</p>
      <Table
        rows={q.data.events}
        rowKey={(e) => `${e.animal_id}:${e.code}:${e.date}`}
        onRowClick={(e) => onOpenAnimal(e.animal_id)}
        columns={[
          { key: "d", header: t("common.date"), render: (e) => formatDate(e.date, t.locale) },
          { key: "a", header: t("animal.tag"), render: (e) => <span className="strong num">{e.animal_tag}</span> },
          { key: "c", header: t("cal.step"), render: (e) => t.dyn(`cal.code.${e.code}.${ent.type}`, t(`cal.code.${e.code}`)) },
          { key: "s", header: t("common.status"), render: (e) => breedingStatus(t, e) },
          ...(ent.status === "active" && canRecord
            ? [{ key: "x", header: <span className="visually-hidden">{t("check.record")}</span>, label: "", render: (e: BreedingCalendarEvent) => (e.code === "pregnancy_check" || e.code === "heat_check") && e.breeding_event_id ? <Button size="sm" onClick={(ev) => (ev.stopPropagation(), onCheck(e))}>{t("check.record")}</Button> : null }]
            : []),
        ]}
      />
    </>
  );
}

/** She was checked: pregnant, or the service didn't take (LIV-05). */
export function PregnancyCheckPanel({ breedingId, animal, onClose }: { breedingId: string; animal: Pick<Animal, "tag" | "name"> | { tag: string; name?: string }; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [date, setDate] = useState(today());
  const [result, setResult] = useState<"yes" | "no">("yes");
  const save = useSave(() => api.livestock.pregnancyCheck(breedingId, { date, pregnant: result === "yes" }), result === "yes" ? "check.savedYes" : "check.savedNo", onClose);
  const err = fieldErrors(save.error);
  const name = `${animal.tag} ${animal.name ?? ""}`.trim();
  return (
    <SidePanel title={t("check.title", { name })} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("check.date")} value={date} onChange={setDate} max={today()} error={err.date} />
        <ChoiceCards label={t("check.result")} value={result} onChange={setResult} options={[{ value: "yes", label: t("check.pregnant"), help: t("check.pregnantHelp") }, { value: "no", label: t("check.notPregnant"), help: t("check.notPregnantHelp") }]} />
        <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** The open service a check would be for: not yet checked. */
export const uncheckedService = (events: BreedingEvent[]) => events.find((b) => !b.outcome && b.pregnant == null);
