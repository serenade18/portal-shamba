import { useMutation, useQuery } from "@tanstack/react-query";
import { History, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText, useFarm, useKey } from "@/api/hooks";
import type { Plot, Structure, StructureType, Tenure } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Money, PageHead, Table, Tabs, useCurrency, useTabParam } from "@/components/ui/data";
import { Chip, EmptyState, NoPermission, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, FormError, MoneyField, SelectField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { useCan, useMembership } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useInvalidateOrg } from "../enterprise/forms";

const TENURES: Tenure[] = ["owned", "leased", "family"];
const STRUCTURES: StructureType[] = ["shed", "poultry_house", "pen", "pond", "store"];

/** Add a plot, or with `plot` rename it and correct its area or tenure (FRM-02, FRM-04). */
function PlotPanel({ plot, onClose }: { plot?: Plot; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const { farm } = useFarm();
  const currency = useCurrency();
  const money = useCan("money.read");
  const invalidate = useInvalidateOrg();
  const [f, setF] = useState({ name: plot?.name ?? "", area_acres: plot?.area_acres ?? "", tenure: plot?.tenure ?? ("owned" as Tenure), lease_cost: plot?.lease_cost ?? "" });
  const [areaError, setAreaError] = useState<string>();
  const save = useMutation({
    mutationFn: () => {
      const body = { name: f.name, area_acres: f.area_acres, tenure: f.tenure, lease_cost: f.tenure === "leased" ? f.lease_cost || null : null };
      return plot ? api.farms.updatePlot(plot.id, money ? body : { name: body.name, area_acres: body.area_acres, tenure: body.tenure }) : api.farms.createPlot({ farm_id: farm!.id, ...body });
    },
    onSuccess: () => (invalidate(), toast(t(plot ? "plot.updated" : "plot.saved")), onClose()),
  });
  const err = fieldErrors(save.error);
  return (
    <SidePanel
      title={plot ? t("plot.editTitle", { name: plot.name }) : t("farm.addPlot")}
      onClose={onClose}
      onSubmit={() => (Number(f.area_acres) > 0 ? (setAreaError(undefined), save.mutate()) : setAreaError(t("plot.areaError")))}
      footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("common.save")}</Button></>}
    >
      <div className="stack">
        <TextField label={t("plot.name")} value={f.name} onChange={(name) => setF({ ...f, name })} error={err.name} autoFocus />
        <TextField label={t("plot.area")} value={f.area_acres} onChange={(v) => setF({ ...f, area_acres: v.replace(/[^\d.]/g, "") })} inputMode="decimal" error={areaError ?? err.area_acres} />
        <ChoiceCards label={t("plot.tenure")} value={f.tenure} onChange={(tenure) => setF({ ...f, tenure })} options={TENURES.map((x) => ({ value: x, label: t(`tenure.${x}`) }))} />
        {f.tenure === "leased" && money && <MoneyField label={t("plot.lease")} value={f.lease_cost} onChange={(lease_cost) => setF({ ...f, lease_cost })} currency={currency} optional />}
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** Add a structure, or with `structure` rename it or change its type or capacity (FRM-05). */
function StructurePanel({ structure, onClose }: { structure?: Structure; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const { farm } = useFarm();
  const invalidate = useInvalidateOrg();
  const [f, setF] = useState({ name: structure?.name ?? "", type: structure?.type ?? ("shed" as StructureType), capacity: structure?.capacity != null ? String(structure.capacity) : "" });
  const save = useMutation({
    mutationFn: () => {
      const body = { name: f.name, type: f.type, capacity: f.capacity ? Number(f.capacity) : null };
      return structure ? api.farms.updateStructure(structure.id, body) : api.farms.createStructure({ farm_id: farm!.id, ...body });
    },
    onSuccess: () => (invalidate(), toast(t(structure ? "structure.updated" : "structure.saved")), onClose()),
  });
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={structure ? t("structure.editTitle", { name: structure.name }) : t("farm.addStructure")} onClose={onClose} onSubmit={() => save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("common.save")}</Button></>}>
      <div className="stack">
        <SelectField label={t("structure.type")} value={f.type} onChange={(v) => setF({ ...f, type: v as StructureType })} options={STRUCTURES.map((x) => ({ value: x, label: t(`stype.${x}`) }))} />
        <TextField label={t("structure.name")} value={f.name} onChange={(name) => setF({ ...f, name })} error={err.name} />
        <TextField label={t("structure.capacity")} value={f.capacity} onChange={(v) => setF({ ...f, capacity: v.replace(/\D/g, "") })} inputMode="numeric" optional />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** Past seasons and yields on one plot (FRM-06). */
function PlotHistoryPanel({ plot, onClose }: { plot: Plot; onClose: () => void }) {
  const t = useT();
  const key = useKey();
  const money = useCan("money.read");
  const q = useQuery({ queryKey: key("plot-history", plot.id), queryFn: () => api.farms.plotHistory(plot.id) });
  return (
    <SidePanel wide title={t("plot.historyTitle", { name: plot.name })} onClose={onClose}>
      {q.isLoading ? <SkeletonRows rows={3} /> : !q.data?.length ? <p className="muted">{t("plot.historyEmpty")}</p> : (
        <Table
          rows={q.data}
          rowKey={(s) => s.enterprise_id}
          columns={[
            { key: "n", header: t("season.name"), render: (s) => <span className="strong">{s.name}</span> },
            { key: "d", header: t("list.col.started"), render: (s) => formatDate(s.started_on, t.locale) },
            { key: "y", header: t("plot.yield"), numeric: true, render: (s) => (s.yield_per_acre ? `${s.yield_per_acre} ${t.unit(s.yield_unit)} / ${t.unit("acres", 1)}` : "–") },
            ...(money ? [{ key: "p", header: t("common.profit"), numeric: true, render: (s: { profit: string | null }) => <Money value={s.profit} kind="profit" word /> }] : []),
            { key: "s", header: t("common.status"), render: (s) => <Chip tone={s.closed_on ? "health" : "amber"}>{s.closed_on ? t("common.closed") : t("common.active")}</Chip> },
          ]}
        />
      )}
    </SidePanel>
  );
}

export function FarmPage() {
  const t = useT();
  const key = useKey();
  const qty = useQty();
  const { farm } = useFarm();
  const role = useMembership()?.role;
  const money = useCan("money.read");
  const currency = useCurrency();
  const canWrite = useCan("stock.write");
  const [tab, setTab] = useTabParam(["plots", "structures"] as const, "plots");
  const [panel, setPanel] = useState<"plot" | "structure" | null>(null);
  const [history, setHistory] = useState<Plot | null>(null);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);
  const [editStructure, setEditStructure] = useState<Structure | null>(null);
  const plots = useQuery({ queryKey: key("plots", farm?.id), queryFn: () => api.farms.plots(farm!.id), enabled: !!farm, select: (p) => p.results });
  const structures = useQuery({ queryKey: key("structures", farm?.id), queryFn: () => api.farms.structures(farm!.id), enabled: !!farm, select: (p) => p.results });

  if (role === "field_worker") return <NoPermission />;
  const acres = (plots.data ?? []).reduce((s, p) => s + Number(p.area_acres), 0);

  return (
    <>
      <PageHead
        title={farm?.name ?? t("farm.title")}
        sub={farm && [farm.county, farm.location && `${farm.location.lat.toFixed(3)}, ${farm.location.lng.toFixed(3)}`].filter(Boolean).join(", ")}
        actions={canWrite && (tab === "plots"
          ? <Button variant="primary" icon={<Plus size={18} />} onClick={() => setPanel("plot")}>{t("farm.addPlot")}</Button>
          : <Button variant="primary" icon={<Plus size={18} />} onClick={() => setPanel("structure")}>{t("farm.addStructure")}</Button>)}
      />
      <Tabs label={t("farm.title")} value={tab} onChange={setTab} tabs={[{ value: "plots", label: t("farm.plots") }, { value: "structures", label: t("farm.structures") }]} />
      {tab === "plots" && (plots.isLoading ? <SkeletonRows /> : !plots.data?.length ? <div className="panel"><EmptyState text={t("farm.plotsEmpty")} /></div> : (
        <div className="stack">
          <p className="muted">{t("farm.plotsSummary", { acres: acres.toFixed(2), n: plots.data.length })}</p>
          <Table
            rows={plots.data}
            rowKey={(p) => p.id}
            columns={[
              { key: "n", header: t("plot.name"), render: (p) => <span className="strong">{p.name}</span>, sort: (a, b) => a.name.localeCompare(b.name) },
              { key: "a", header: t("plot.area"), numeric: true, render: (p) => qty(p.area_acres, "acres", 2), sort: (a, b) => Number(a.area_acres) - Number(b.area_acres) },
              { key: "t", header: t("plot.tenure"), render: (p) => <span>{t(`tenure.${p.tenure}`)}{money && p.lease_cost && <span className="small muted" style={{ display: "block" }}>{t("plot.perYear", { amount: formatMoney(p.lease_cost, currency) })}</span>}</span> },
              { key: "g", header: t("plot.growing"), render: (p) => p.growing_now ?? <span className="muted">{t("plot.nothing")}</span> },
              {
                key: "h",
                header: <span className="visually-hidden">{t("plot.history")}</span>,
                label: "",
                render: (p) => (
                  <span className="row" style={{ gap: 4, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                    <Button variant="quiet" size="sm" icon={<History size={14} />} onClick={() => setHistory(p)}>{t("plot.history")}</Button>
                    {canWrite && <Button variant="quiet" size="sm" icon={<Pencil size={14} />} onClick={() => setEditPlot(p)}>{t("common.edit")}</Button>}
                  </span>
                ),
              },
            ]}
          />
        </div>
      ))}
      {tab === "structures" && (structures.isLoading ? <SkeletonRows /> : !structures.data?.length ? <div className="panel"><EmptyState text={t("farm.structuresEmpty")} /></div> : (
        <Table
          rows={structures.data}
          rowKey={(s) => s.id}
          columns={[
            { key: "n", header: t("structure.name"), render: (s) => <span className="strong">{s.name}</span> },
            { key: "t", header: t("structure.type"), render: (s) => t(`stype.${s.type}`) },
            { key: "c", header: t("structure.capacity"), numeric: true, render: (s) => s.capacity ?? "–" },
            ...(canWrite ? [{ key: "e", header: <span className="visually-hidden">{t("common.edit")}</span>, label: "", render: (s: Structure) => <Button variant="quiet" size="sm" icon={<Pencil size={14} />} onClick={() => setEditStructure(s)}>{t("common.edit")}</Button> }] : []),
          ]}
        />
      ))}
      {panel === "plot" && <PlotPanel onClose={() => setPanel(null)} />}
      {panel === "structure" && <StructurePanel onClose={() => setPanel(null)} />}
      {editPlot && <PlotPanel plot={editPlot} onClose={() => setEditPlot(null)} />}
      {editStructure && <StructurePanel structure={editStructure} onClose={() => setEditStructure(null)} />}
      {history && <PlotHistoryPanel plot={history} onClose={() => setHistory(null)} />}
    </>
  );
}
