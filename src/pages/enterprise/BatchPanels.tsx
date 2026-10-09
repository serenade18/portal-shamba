import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useCatalogue, useErrorText, useKey, usePaged } from "@/api/hooks";
import type { EnterpriseDetail, SampleWeight, TypeCode, VaccinationPlanStep, VaccinationState, VaccinationStep } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { LoadMore, RecordedBy, Table } from "@/components/ui/data";
import { Chip, EmptyState, SkeletonRows, type Tone } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError, QuantityField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatDate, formatNumber, today } from "@/lib/format";
import { useCan } from "@/stores/session";
import { toast } from "@/stores/toast";
import { Footer, useInvalidateOrg, useSave } from "./forms";

const STATE_TONE: Record<VaccinationState, Tone> = { done: "health", due: "amber", overdue: "terracotta", upcoming: "neutral", missed: "neutral" };

/** The batch's vaccination plan by age: done, due, overdue or upcoming (BAT-04). */
export function VaccinationsTab({ ent, onRecord, onEditSchedule }: { ent: EnterpriseDetail; onRecord: (step: VaccinationPlanStep) => void; onEditSchedule: () => void }) {
  const t = useT();
  const key = useKey();
  const canRecord = useCan("records.write");
  const canEdit = useCan("schedules.write");
  const q = useQuery({ queryKey: key("vaccinations", ent.id), queryFn: () => api.batches.vaccinations(ent.id) });
  if (q.isLoading || !q.data) return <SkeletonRows />;
  const v = q.data;
  const head = (
    <div className="spread" style={{ marginBottom: 12 }}>
      <p className="muted">
        {v.age_days != null && t("vacc.age", { n: v.age_days })}
        {v.age_days != null && " · "}
        {v.custom ? t("vacc.custom") : t("vacc.default")}
      </p>
      {canEdit && <Button size="sm" onClick={onEditSchedule}>{t("vacc.editSchedule")}</Button>}
    </div>
  );
  if (v.age_days == null) return <>{head}<div className="panel"><EmptyState text={t("vacc.unknownAge")} /></div></>;
  if (!v.steps.length) return <>{head}<div className="panel"><EmptyState text={t("vacc.empty")} /></div></>;
  const open = ent.status === "active" && canRecord;
  return (
    <>
      {head}
      <Table
        rows={v.steps}
        rowKey={(s) => String(s.day)}
        columns={[
          { key: "day", header: t("vacc.day"), numeric: true, render: (s) => t("vacc.dayN", { n: s.day }) },
          { key: "v", header: t("vacc.vaccine"), render: (s) => <span><span className="strong">{s.vaccine}</span>{s.note && <span className="small muted" style={{ display: "block" }}>{s.note}</span>}</span> },
          { key: "due", header: t("vacc.dueOn"), render: (s) => formatDate(s.due_on, t.locale) },
          { key: "s", header: t("common.status"), render: (s) => <Chip tone={STATE_TONE[s.status]}>{s.status === "done" && s.done_on ? t("vacc.doneOn", { date: formatDate(s.done_on, t.locale) }) : t(`vacc.state.${s.status}`)}</Chip> },
          ...(open
            ? [{ key: "a", header: <span className="visually-hidden">{t("vacc.record")}</span>, label: "", render: (s: VaccinationPlanStep) => (s.status !== "done" && s.status !== "missed" ? <Button variant={s.status === "upcoming" ? "quiet" : "secondary"} size="sm" onClick={() => onRecord(s)}>{t("vacc.record")}</Button> : null) }]
            : []),
        ]}
      />
    </>
  );
}

/** Sample weighings: how many were weighed and their average (BAT-05). Broilers and fish only. */
export function BatchWeightsTab({ ent }: { ent: EnterpriseDetail }) {
  const t = useT();
  const key = useKey();
  const qty = useQty();
  const q = usePaged(key("batch-weights", ent.id), (cursor) => api.batches.weights(ent.id, cursor));
  if (q.isLoading) return <SkeletonRows />;
  if (!q.rows.length) return <div className="panel"><EmptyState text={t("sample.empty")} /></div>;
  return (
    <Table
      rows={q.rows}
      rowKey={(w) => w.id}
      columns={[
        { key: "d", header: t("common.date"), render: (w) => formatDate(w.date, t.locale) },
        { key: "n", header: t("sample.size"), numeric: true, render: (w) => formatNumber(w.sample_size) },
        { key: "a", header: t("sample.avg"), numeric: true, render: (w) => qty(w.avg_kg, "kg", 3) },
        {
          key: "c",
          header: t("weight.change"),
          numeric: true,
          render: (w: SampleWeight) => {
            const prev = q.rows[q.rows.indexOf(w) + 1];
            if (!prev) return "–";
            const diff = Number(w.avg_kg) - Number(prev.avg_kg);
            return <span className={diff < 0 ? "ink-cost" : ""}>{`${diff > 0 ? "+" : ""}${formatNumber(diff, 3)} kg`}</span>;
          },
        },
        { key: "by", header: t("common.recordedBy"), render: (w) => <RecordedBy by={w.recorded_by} /> },
      ]}
      footer={<LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} />}
    />
  );
}

export function SampleWeightPanel({ ent, onClose }: { ent: EnterpriseDetail; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [date, setDate] = useState(today());
  const [size, setSize] = useState("");
  const [avg, setAvg] = useState("");
  const save = useSave(() => api.batches.recordWeight(ent.id, { date, sample_size: Number(size), avg_kg: avg }), "sample.saved", onClose);
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("sample.title")} onClose={onClose} onSubmit={() => save.mutate(undefined)} footer={<Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />}>
      <div className="stack">
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <TextField label={ent.type === "fish" ? t("sample.sizeFish") : t("sample.sizeBirds")} value={size} onChange={(v) => setSize(v.replace(/\D/g, ""))} inputMode="numeric" error={err.sample_size} />
        <QuantityField label={`⚖ ${t("sample.avg")}`} value={avg} onChange={setAvg} unit="kg" units={["kg"]} error={err.avg_kg} hint={t("sample.avgHint")} />
        <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** The farm account's own vaccination schedule per batch type, or the default (BAT-04). */
export function SchedulePanel({ types, initialType, onClose }: { types: TypeCode[]; initialType?: TypeCode; onClose: () => void }) {
  const t = useT();
  const key = useKey();
  const errorText = useErrorText();
  const catalogue = useCatalogue();
  const invalidate = useInvalidateOrg();
  const q = useQuery({ queryKey: key("vaccination-schedules"), queryFn: api.batches.schedules, select: (p) => p.results });
  const [type, setType] = useState<TypeCode>(initialType ?? types[0]!);
  const current = q.data?.find((s) => s.type === type);
  const [steps, setSteps] = useState<(Omit<VaccinationStep, "day"> & { day: string })[]>([]);
  useEffect(() => {
    if (current) setSteps(current.steps.map((s) => ({ ...s, day: String(s.day) })));
  }, [current]);
  const save = useMutation({
    mutationFn: (reset: boolean) => api.batches.setSchedule(type, reset ? null : steps.map((s) => ({ day: Number(s.day), vaccine: s.vaccine, note: s.note }))),
    onSuccess: (_, reset) => (invalidate(), toast(t(reset ? "vacc.scheduleReset" : "vacc.scheduleSaved")), onClose()),
  });
  const err = fieldErrors(save.error);
  const label = (c: TypeCode) => catalogue.data?.enterprise_types.find((x) => x.code === c)?.labels[t.locale] ?? c;
  return (
    <SidePanel
      wide
      title={t("vacc.scheduleTitle")}
      onClose={onClose}
      onSubmit={() => save.mutate(false)}
      footer={
        <>
          {current?.custom && <Button variant="quiet" onClick={() => save.mutate(true)} disabled={save.isPending}>{t("vacc.restore")}</Button>}
          <Footer onClose={onClose} loading={save.isPending} label={t("common.save")} />
        </>
      }
    >
      {!current ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="stack">
          {types.length > 1 && <ChoiceCards label={t("batch.type")} value={type} onChange={setType} options={types.map((c) => ({ value: c, label: label(c) }))} />}
          <p className="small muted">{t("vacc.scheduleHelp")}</p>
          <div className="lines">
            {steps.map((s, i) => {
              const upd = (patch: Partial<typeof s>) => setSteps(steps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="line-card line-row" style={{ gridTemplateColumns: "72px minmax(0, 1.4fr) minmax(0, 1fr) auto" }}>
                  <TextField label={t("vacc.day")} value={s.day} onChange={(v) => upd({ day: v.replace(/\D/g, "") })} inputMode="numeric" />
                  <TextField label={t("vacc.vaccine")} value={s.vaccine} onChange={(v) => upd({ vaccine: v })} />
                  <TextField label={t("common.note")} value={s.note} onChange={(v) => upd({ note: v })} placeholder={t("vacc.notePlaceholder")} optional />
                  <Button variant="quiet" aria-label={t("common.remove")} icon={<Trash2 size={18} />} onClick={() => setSteps(steps.filter((_, j) => j !== i))} />
                </div>
              );
            })}
          </div>
          {!steps.length && <p className="small muted">{t("vacc.noSteps")}</p>}
          <div>
            <Button variant="quiet" icon={<Plus size={16} />} onClick={() => setSteps([...steps, { day: "", vaccine: "", note: "" }])}>{t("vacc.addStep")}</Button>
          </div>
          <FormError message={typeof err.steps === "string" && err.steps ? err.steps : save.error ? errorText(save.error) : null} />
        </div>
      )}
    </SidePanel>
  );
}
