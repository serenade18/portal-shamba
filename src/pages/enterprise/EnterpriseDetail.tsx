import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import * as api from "@/api/endpoints";
import { useCatalogue, useKey, usePaged } from "@/api/hooks";
import type { Animal, DailyRecord, EnterpriseDetail as Detail, Module, VaccinationPlanStep } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { BarsChart, ChartFrame } from "@/components/ui/charts";
import { KpiRow, LoadMore, Money, PageHead, RecordedBy, Table, Tabs, useCurrency, useTabParam, type Column } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, ModuleHidden, Skeleton, SkeletonRows } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatDate, formatNumber, formatMoney, daysSince } from "@/lib/format";
import { useCan } from "@/stores/session";
import { EntriesTable } from "../../pages/money/EntriesTable";
import { SalesTable } from "../../pages/sales/SalesTable";
import { MovementsTable } from "../../pages/stock/MovementsTable";
import {
  AddAnimalPanel, AnimalExitPanel, ClosePanel, RecordActivityPanel, RecordDayPanel, RecordFeedPanel, RecordHarvestPanel, RecordMilkPanel,
  RecordTreatmentPanel,
} from "./forms";
import { AnimalPanel } from "./AnimalPanel";
import { BatchWeightsTab, SampleWeightPanel, SchedulePanel, VaccinationsTab } from "./BatchPanels";
import { MODULE_PATH } from "./paths";

type Action = "day" | "milk" | "feed" | "treatment" | "animal" | "activity" | "harvest" | "close" | "sample" | "schedule";
type Tab = "records" | "animals" | "health" | "vaccinations" | "weights" | "stock" | "sales" | "money" | "activities" | "harvests";

function Meta({ ent }: { ent: Detail }) {
  const t = useT();
  const qty = useQty();
  const parts = [
    ent.status === "closed" && ent.closed_on ? t("ent.closedOn", { date: formatDate(ent.closed_on, t.locale) }) : t("ent.started", { date: formatDate(ent.started_on, t.locale) }),
    ent.structure_name,
    ent.plot_name,
    ent.module === "batches" && t(ent.type === "fish" ? "ent.fish" : "ent.birds", { n: ent.head_count ?? 0, total: ent.start_count ?? 0 }),
    ent.module === "crops" && ent.area_acres && `${qty(ent.area_acres, "acres", 2)}${ent.variety ? `, ${ent.variety}` : ""}`,
  ].filter(Boolean) as string[];
  return (
    <span className="row" style={{ gap: 16, rowGap: 4 }}>
      {parts.map((p) => (
        <span key={p}>{p}</span>
      ))}
      {ent.status === "closed" && <Chip tone="health">{t("common.closed")}</Chip>}
    </span>
  );
}

function kpiValue(t: ReturnType<typeof useT>, k: Detail["kpis"][number], currency: string) {
  if (k.money) return formatMoney(k.value, currency);
  if (k.unit === "%") return `${formatNumber(k.value)}%`;
  if (!k.unit) return formatNumber(k.value);
  return `${formatNumber(k.value)} ${t.unit(k.unit, Number(k.value) === 1 ? 1 : 2)}`;
}

function Production({ ent }: { ent: Detail }) {
  const t = useT();
  const key = useKey();
  const q = useQuery({ queryKey: key("production", ent.id), queryFn: () => api.enterprises.production(ent.id) });
  if (!q.data) return <Skeleton height={280} />;
  const unit = ent.type === "layers" ? "tray" : "l";
  const last = q.data.slice(-7).reduce((s, d) => s + d.qty, 0) / 7;
  const prev = q.data.slice(-14, -7).reduce((s, d) => s + d.qty, 0) / 7;
  const trend = prev === 0 || Math.abs(last - prev) / prev < 0.03 ? "flat" : last > prev ? "up" : "down";
  const summary = t("ent.productionSummary", { avg: formatNumber(last), unit: t.unit(unit), trend: t(`ent.trend.${trend}`) }) + ` ${formatNumber(prev)} ${t.unit(unit)}.`;
  return (
    <section className="panel panel-body stack">
      <h2>{t("ent.productionChart")}</h2>
      <ChartFrame
        summary={summary}
        table={
          <Table
            rows={q.data.slice().reverse()}
            rowKey={(r) => r.date}
            columns={[
              { key: "d", header: t("common.date"), render: (r) => formatDate(r.date, t.locale) },
              { key: "q", header: t.unit(unit), numeric: true, render: (r) => formatNumber(r.qty) },
            ]}
          />
        }
      >
        <BarsChart
          data={q.data}
          x="date"
          xFormat={(d) => formatDate(d, t.locale, { year: false })}
          series={[{ key: "qty", label: t.unit(unit), color: "var(--green-400)" }]}
          format={(v) => formatNumber(v)}
          height={200}
        />
      </ChartFrame>
    </section>
  );
}

function RecordsTab({ ent }: { ent: Detail }) {
  const t = useT();
  const qty = useQty();
  const key = useKey();
  const [review, setReview] = useState<DailyRecord | null>(null);
  const q = usePaged(key("records", ent.id), (cursor) => api.enterprises.records(ent.id, cursor));
  if (q.isLoading) return <SkeletonRows />;
  if (!q.rows.length) return <div className="panel"><EmptyState text={t("rec.empty")} /></div>;
  const produced = q.rows.find((r) => r.produced_unit)?.produced_unit;
  const columns: Column<DailyRecord>[] = [
    { key: "date", header: t("common.date"), render: (r) => formatDate(r.date, t.locale) },
    ...(produced ? [{ key: "p", header: t.dyn(`rec.produced.${produced}`, produced), numeric: true, render: (r: DailyRecord) => (r.produced != null ? formatNumber(r.produced) : "–") }] : []),
    { key: "feed", header: t("rec.feed"), numeric: true, render: (r) => (r.feed_qty && Number(r.feed_qty) > 0 ? qty(r.feed_qty, r.feed_unit ?? "bag") : "–") },
    ...(ent.module === "batches" ? [{ key: "deaths", header: t("rec.deaths"), numeric: true, render: (r: DailyRecord) => <span className={r.deaths && r.deaths >= 3 ? "ink-cost" : ""}>{r.deaths ?? 0}</span> }] : []),
    { key: "note", header: t("common.note"), render: (r) => <span className="small muted">{r.note}</span> },
    { key: "by", header: t("common.recordedBy"), render: (r) => <RecordedBy by={r.recorded_by} conflict={r.conflict} onReview={() => setReview(r)} /> },
  ];
  return (
    <>
      <Table rows={q.rows} columns={columns} rowKey={(r) => r.id} footer={<LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} />} />
      {review && (
        <Dialog title={t("rec.conflictTitle")} onClose={() => setReview(null)} footer={<Button variant="primary" onClick={() => setReview(null)}>{t("rec.conflictDone")}</Button>}>
          <div className="stack">
            <p className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Info size={18} className="ink-cost" style={{ color: "var(--lavender-ink)", flex: "none", marginTop: 3 }} aria-hidden />
              {t("rec.conflictHelp")}
            </p>
            <div className="panel panel-body small">
              <RecordedBy by={review.recorded_by} />
              <p>{formatDate(review.date, t.locale)}</p>
              {review.produced && <p>{qty(review.produced, review.produced_unit ?? "tray")}</p>}
              {review.feed_qty && <p>{qty(review.feed_qty, review.feed_unit ?? "bag")}</p>}
              <p>{t("rec.deaths")}: {review.deaths ?? 0}</p>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}

function AnimalsTab({ animals, loading, onOpen, onExit }: { animals: Animal[]; loading: boolean; onOpen: (a: Animal) => void; onExit: (a: Animal) => void }) {
  const t = useT();
  const canRecord = useCan("records.write");
  if (loading) return <SkeletonRows />;
  if (!animals.length) return <div className="panel"><EmptyState text={t("animal.empty")} /></div>;
  const age = (d: string | null) => {
    if (!d) return "–";
    const days = daysSince(d);
    return days >= 365 ? t("animal.ageYears", { n: formatNumber(days / 365) }) : t("animal.ageMonths", { n: Math.max(0, Math.round(days / 30)) });
  };
  const columns: Column<Animal>[] = [
    { key: "tag", header: t("animal.tag"), render: (a) => <span className="strong num">{a.tag}</span>, sort: (a, b) => a.tag.localeCompare(b.tag) },
    { key: "name", header: t("animal.name"), render: (a) => a.name || "–" },
    { key: "sex", header: t("animal.sex"), render: (a) => t(`sex.${a.sex}`) },
    { key: "breed", header: t("animal.breed"), render: (a) => a.breed || "–" },
    { key: "age", header: t("animal.age"), numeric: true, render: (a) => age(a.birth_date) },
    { key: "mother", header: t("animal.mother"), render: (a) => animals.find((m) => m.id === a.mother_id)?.name ?? "–" },
    { key: "status", header: t("common.status"), render: (a) => <Chip tone={a.status === "active" ? "health" : "neutral"}>{t(`animalStatus.${a.status}`)}</Chip> },
    ...(canRecord ? [{ key: "exit", header: <span className="visually-hidden">{t("animal.exit")}</span>, label: "", render: (a: Animal) => (a.status === "active" ? <Button variant="quiet" size="sm" onClick={(e) => (e.stopPropagation(), onExit(a))}>{t("animal.exit")}</Button> : null) }] : []),
  ];
  return <Table rows={animals} columns={columns} rowKey={(a) => a.id} onRowClick={onOpen} />;
}

function HealthTab({ ent }: { ent: Detail }) {
  const t = useT();
  const key = useKey();
  const money = useCan("money.read");
  const q = usePaged(key("health", ent.id), (cursor) => api.enterprises.health(ent.id, cursor));
  if (q.isLoading) return <SkeletonRows />;
  if (!q.rows.length) return <div className="panel"><EmptyState text={t("treat.empty")} /></div>;
  return (
    <Table
      rows={q.rows}
      rowKey={(h) => h.id}
      columns={[
        { key: "d", header: t("common.date"), render: (h) => formatDate(h.date, t.locale) },
        { key: "p", header: t("treat.col.product"), render: (h) => <span><span className="strong">{h.product}</span>{h.dose_note && <span className="small muted" style={{ display: "block" }}>{h.dose_note}</span>}</span> },
        { key: "s", header: t("treat.col.subject"), render: (h) => h.subject },
        ...(money ? [{ key: "c", header: t("treat.col.cost"), numeric: true, render: (h: { cost: string | null }) => <Money value={h.cost} kind="cost" /> }] : []),
        { key: "by", header: t("common.recordedBy"), render: (h) => <RecordedBy by={h.recorded_by} /> },
      ]}
    />
  );
}

function ActivitiesTab({ ent }: { ent: Detail }) {
  const t = useT();
  const key = useKey();
  const qty = useQty();
  const money = useCan("money.read");
  const q = usePaged(key("activities", ent.id), (cursor) => api.crops.activities(ent.id, cursor));
  if (q.isLoading) return <SkeletonRows />;
  if (!q.rows.length) return <div className="panel"><EmptyState text={t("act.empty")} /></div>;
  return (
    <Table
      rows={q.rows}
      rowKey={(a) => a.id}
      columns={[
        { key: "d", header: t("common.date"), render: (a) => formatDate(a.date, t.locale) },
        { key: "t", header: t("act.col.activity"), render: (a) => <span><span className="strong">{t(`activity.${a.type}`)}</span>{a.note && <span className="small muted" style={{ display: "block" }}>{a.note}</span>}</span> },
        { key: "i", header: t("act.col.inputs"), render: (a) => a.inputs.map((i) => `${qty(i.qty, i.unit)} ${i.item_name.toLowerCase()}`).join(", ") || "–" },
        ...(money ? [{ key: "c", header: t("act.col.labour"), numeric: true, render: (a: { labour_cost: string | null; service_cost: string | null }) => { const sum = Number(a.labour_cost ?? 0) + Number(a.service_cost ?? 0); return sum > 0 ? <Money value={sum} kind="cost" /> : "–"; } }] : []),
        { key: "by", header: t("common.recordedBy"), render: (a) => <RecordedBy by={a.recorded_by} /> },
      ]}
    />
  );
}

function HarvestsTab({ ent }: { ent: Detail }) {
  const t = useT();
  const key = useKey();
  const qty = useQty();
  const q = usePaged(key("harvests", ent.id), (cursor) => api.crops.harvests(ent.id, cursor));
  if (q.isLoading) return <SkeletonRows />;
  if (!q.rows.length) return <div className="panel"><EmptyState text={t("harv.empty")} /></div>;
  return (
    <Table
      rows={q.rows}
      rowKey={(h) => h.id}
      columns={[
        { key: "d", header: t("common.date"), render: (h) => formatDate(h.date, t.locale) },
        { key: "q", header: t("common.quantity"), numeric: true, render: (h) => qty(h.qty, h.unit) },
        { key: "m", header: t("harv.condition"), render: (h) => t(`moisture.${h.moisture}`) },
        { key: "by", header: t("common.recordedBy"), render: (h) => <RecordedBy by={h.recorded_by} /> },
      ]}
    />
  );
}

function StockTab({ ent }: { ent: Detail }) {
  const key = useKey();
  const q = usePaged(key("movements", "enterprise", ent.id), (cursor) => api.stock.movements({ enterprise_id: ent.id, cursor }));
  if (q.isLoading) return <SkeletonRows />;
  return <MovementsTable rows={q.rows} hasNext={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />;
}

function SalesTab({ ent }: { ent: Detail }) {
  const key = useKey();
  const q = usePaged(key("sales", "enterprise", ent.id), (cursor) => api.sales.list({ enterprise_id: ent.id, cursor }));
  if (q.isLoading) return <SkeletonRows />;
  return <SalesTable rows={q.rows} hasNext={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />;
}

function MoneyTab({ ent }: { ent: Detail }) {
  const key = useKey();
  const q = usePaged(key("finance", "enterprise", ent.id), (cursor) => api.finance.entries({ enterprise_id: ent.id, cursor }));
  if (q.isLoading) return <SkeletonRows />;
  return <EntriesTable rows={q.rows} showEnterprise={false} hasNext={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />;
}

/** A batch, herd or season: key numbers, records with who recorded them, and its money (7.2). */
export function EnterpriseDetail({ module }: { module: Module }) {
  const t = useT();
  const key = useKey();
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const catalogue = useCatalogue();
  const money = useCan("money.read");
  const canRecord = useCan("records.write");
  const canStock = useCan("stock.write");
  const currency = useCurrency();
  const [action, setAction] = useState<Action | null>(null);
  const [exiting, setExiting] = useState<Animal | null>(null);
  const [openAnimal, setOpenAnimal] = useState<string | null>(null);
  const [vaccStep, setVaccStep] = useState<VaccinationPlanStep | null>(null);
  const q = useQuery({ queryKey: key("enterprise", id), queryFn: () => api.enterprises.get(id) });
  const weighs = module === "batches" && (q.data?.type === "broilers" || q.data?.type === "fish");
  const animals = useQuery({ queryKey: key("animals", id), queryFn: () => api.livestock.animals(id), enabled: module === "livestock", select: (p) => p.results });

  // Links such as the dashboard's first step open a form directly: ?action=milk
  useEffect(() => {
    const a = params.get("action") as Action | null;
    if (a && q.data) {
      setAction(a);
      setParams((p) => (p.delete("action"), p), { replace: true });
    }
  }, [params, q.data, setParams]);

  const tabs: { value: Tab; label: string }[] = [
    ...(module === "crops"
      ? [
          { value: "activities" as Tab, label: t("tab.activities") },
          { value: "harvests" as Tab, label: t("tab.harvests") },
        ]
      : [{ value: "records" as Tab, label: t("tab.records") }]),
    ...(module === "livestock" ? [{ value: "animals" as Tab, label: t("tab.animals") }] : []),
    ...(module !== "crops" ? [{ value: "health" as Tab, label: t("tab.health") }] : []),
    ...(module === "batches" ? [{ value: "vaccinations" as Tab, label: t("tab.vaccinations") }] : []),
    ...(weighs ? [{ value: "weights" as Tab, label: t("tab.weights") }] : []),
    { value: "stock", label: t("tab.stock") },
    ...(money
      ? [
          { value: "sales" as Tab, label: t("tab.sales") },
          { value: "money" as Tab, label: t("tab.money") },
        ]
      : []),
  ];
  const [tab, setTab] = useTabParam(tabs.map((x) => x.value), tabs[0]!.value);

  if (q.error instanceof ApiError && q.error.code === "module.disabled") {
    return <ModuleHidden typeLabel={t(`nav.${module === "livestock" ? "animals" : module === "batches" ? "poultry" : "crops"}`)} />;
  }
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <div className="stack-lg" aria-busy="true">
        <Skeleton height={48} width="50%" />
        <Skeleton height={88} />
        <SkeletonRows />
      </div>
    );
  }

  const ent = q.data;
  const active = ent.status === "active";
  const type = catalogue.data?.enterprise_types.find((x) => x.code === ent.type);
  const milks = ent.type === "dairy_cattle" || ent.type === "dairy_goats";

  const actions = active && canRecord && (
    <>
      {module === "batches" && <Button variant="primary" onClick={() => setAction("day")}>{t("ent.recordDay")}</Button>}
      {module === "livestock" && milks && <Button variant="primary" onClick={() => setAction("milk")}>{t("ent.recordMilk")}</Button>}
      {module === "livestock" && <Button variant={milks ? "secondary" : "primary"} onClick={() => setAction("feed")}>{t("ent.recordFeed")}</Button>}
      {weighs && <Button onClick={() => setAction("sample")}>{t("sample.title")}</Button>}
      {module !== "crops" && <Button onClick={() => setAction("treatment")}>{t("ent.recordTreatment")}</Button>}
      {module === "livestock" && <Button onClick={() => setAction("animal")}>{t("ent.addAnimal")}</Button>}
      {module === "crops" && <Button variant="primary" onClick={() => setAction("activity")}>{t("ent.recordActivity")}</Button>}
      {module === "crops" && <Button onClick={() => setAction("harvest")}>{t("ent.recordHarvest")}</Button>}
      {module !== "livestock" && canStock && money && <Button onClick={() => setAction("close")}>{module === "crops" ? t("ent.closeSeason") : t("ent.closeBatch")}</Button>}
    </>
  );

  const close = () => setAction(null);
  const animalRows = animals.data ?? [];

  return (
    <>
      <Link to={MODULE_PATH[module]} className="small strong row" style={{ gap: 4, marginBottom: 8, textDecoration: "none" }}>
        <ChevronLeft size={16} aria-hidden /> {t(`nav.${module === "livestock" ? "animals" : module === "batches" ? "poultry" : "crops"}`)}
      </Link>
      <PageHead
        title={
          <span className="row" style={{ gap: 10 }}>
            <span aria-hidden>{type?.icon}</span>
            {ent.name}
          </span>
        }
        sub={<Meta ent={ent} />}
        actions={actions}
      />
      <div className="stack-lg">
        <KpiRow items={ent.kpis.map((k) => ({ label: t.dyn(`kpi.${k.code}`, k.code), value: kpiValue(t, k, currency) }))} />
        {(milks || ent.type === "layers") && <Production ent={ent} />}
        <div>
          <Tabs label={ent.name} value={tab} onChange={setTab} tabs={tabs} />
          {tab === "records" && <RecordsTab ent={ent} />}
          {tab === "animals" && <AnimalsTab animals={animalRows} loading={animals.isLoading} onOpen={(a) => setOpenAnimal(a.id)} onExit={setExiting} />}
          {tab === "health" && <HealthTab ent={ent} />}
          {tab === "vaccinations" && <VaccinationsTab ent={ent} onRecord={setVaccStep} onEditSchedule={() => setAction("schedule")} />}
          {tab === "weights" && <BatchWeightsTab ent={ent} />}
          {tab === "activities" && <ActivitiesTab ent={ent} />}
          {tab === "harvests" && <HarvestsTab ent={ent} />}
          {tab === "stock" && <StockTab ent={ent} />}
          {tab === "sales" && money && <SalesTab ent={ent} />}
          {tab === "money" && money && <MoneyTab ent={ent} />}
        </div>
      </div>

      {action === "day" && <RecordDayPanel ent={ent} onClose={close} />}
      {action === "milk" && <RecordMilkPanel ent={ent} animals={animalRows} onClose={close} />}
      {action === "feed" && <RecordFeedPanel ent={ent} onClose={close} />}
      {action === "treatment" && <RecordTreatmentPanel ent={ent} animals={animalRows} onClose={close} />}
      {action === "animal" && <AddAnimalPanel ent={ent} animals={animalRows} onClose={close} />}
      {action === "activity" && <RecordActivityPanel ent={ent} onClose={close} />}
      {action === "harvest" && <RecordHarvestPanel ent={ent} onClose={close} />}
      {action === "close" && <ClosePanel ent={ent} onClose={close} />}
      {action === "sample" && <SampleWeightPanel ent={ent} onClose={close} />}
      {action === "schedule" && <SchedulePanel types={[ent.type]} onClose={close} />}
      {vaccStep && <RecordTreatmentPanel ent={ent} animals={[]} step={vaccStep} onClose={() => setVaccStep(null)} />}
      {openAnimal && <AnimalPanel animalId={openAnimal} ent={ent} herd={animalRows} onExit={setExiting} onClose={() => setOpenAnimal(null)} />}
      {exiting && <AnimalExitPanel animal={exiting} onClose={() => setExiting(null)} />}
    </>
  );
}
