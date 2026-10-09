import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCatalogue, useEnterprises, useNavigation } from "@/api/hooks";
import type { Enterprise, Module, TypeCode } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { PageHead, Table, type Column } from "@/components/ui/data";
import { EmptyState, ErrorState, ModuleHidden, SkeletonRows } from "@/components/ui/feedback";
import { useQty, useT, type MsgKey } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useCan } from "@/stores/session";
import { SchedulePanel } from "./BatchPanels";
import { StartBatchPanel, StartSeasonPanel } from "./forms";
import { enterprisePath } from "./paths";

const TITLES: Record<Module, { title: MsgKey; empty: MsgKey; start?: MsgKey }> = {
  livestock: { title: "list.animals.title", empty: "list.animals.empty" },
  batches: { title: "list.poultry.title", empty: "list.poultry.empty", start: "list.poultry.start" },
  crops: { title: "list.crops.title", empty: "list.crops.empty", start: "list.crops.start" },
};

export function EnterpriseList({ module }: { module: Module }) {
  const t = useT();
  const qty = useQty();
  const navigate = useNavigate();
  const nav = useNavigation();
  const catalogue = useCatalogue();
  const list = useEnterprises(module);
  const canRecord = useCan("records.write");
  const canSchedule = useCan("schedules.write");
  const [starting, setStarting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const meta = TITLES[module];

  if (nav.data && !nav.data.modules.includes(module)) return <ModuleHidden typeLabel={t(meta.title)} />;

  const types = (nav.data?.types ?? []).filter((c) => catalogue.data?.enterprise_types.find((x) => x.code === c)?.module === module) as TypeCode[];
  const typeInfo = (code: TypeCode) => catalogue.data?.enterprise_types.find((x) => x.code === code);

  const columns: Column<Enterprise>[] = [
    {
      key: "name",
      header: t("common.name"),
      render: (e) => (
        <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <span aria-hidden style={{ fontSize: 20 }}>{typeInfo(e.type)?.icon}</span>
          <span className="strong">{e.name}</span>
        </span>
      ),
      sort: (a, b) => a.name.localeCompare(b.name),
    },
    { key: "started", header: t("list.col.started"), render: (e) => formatDate(e.started_on, t.locale), sort: (a, b) => a.started_on.localeCompare(b.started_on) },
    {
      key: "count",
      header: module === "crops" ? t("kpi.area") : t("list.col.headcount"),
      numeric: true,
      render: (e) =>
        module === "crops"
          ? qty(e.area_acres, "acres", 2)
          : module === "batches"
            ? t("list.birdsOf", { n: e.head_count ?? 0, total: e.start_count ?? 0 })
            : t.n("ent.animals", e.head_count ?? 0),
    },
  ];

  const active = (list.data ?? []).filter((e) => e.status === "active");
  const closed = (list.data ?? []).filter((e) => e.status === "closed");
  const open = (e: Enterprise) => navigate(enterprisePath(module, e.id));

  return (
    <>
      <PageHead
        title={t(meta.title)}
        actions={types.length > 0 && (
          <>
            {module === "batches" && canSchedule && <Button onClick={() => setScheduling(true)}>{t("vacc.scheduleTitle")}</Button>}
            {meta.start && canRecord && (
              <Button variant="primary" icon={<Plus size={18} />} onClick={() => setStarting(true)}>
                {t(meta.start)}
              </Button>
            )}
          </>
        )}
      />
      {list.isLoading ? (
        <SkeletonRows rows={4} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <div className="panel">
          <EmptyState text={t(meta.empty)} />
        </div>
      ) : (
        <div className="stack-lg">
          <section className="stack" style={{ gap: 12 }}>
            <h2>{t("list.active")}</h2>
            {active.length ? <Table rows={active} columns={columns} rowKey={(e) => e.id} onRowClick={open} caption={t("list.active")} /> : <div className="panel"><EmptyState text={t(meta.empty)} /></div>}
          </section>
          {closed.length > 0 && (
            <section className="stack" style={{ gap: 12 }}>
              <h2>{t("list.closed")}</h2>
              <Table rows={closed} columns={columns} rowKey={(e) => e.id} onRowClick={open} caption={t("list.closed")} />
            </section>
          )}
        </div>
      )}
      {starting && module === "batches" && <StartBatchPanel types={types} onClose={() => setStarting(false)} onStarted={(id) => navigate(enterprisePath(module, id))} />}
      {scheduling && <SchedulePanel types={types.filter((c) => c !== "fish").length ? types.filter((c) => c !== "fish") : types} onClose={() => setScheduling(false)} />}
      {starting && module === "crops" && <StartSeasonPanel types={types} onClose={() => setStarting(false)} onStarted={(id) => navigate(enterprisePath(module, id))} />}
    </>
  );
}
