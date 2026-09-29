import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useEnterprises, useErrorText, useFarmId, useKey, usePaged, useRange } from "@/api/hooks";
import type { CostPerUnit } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { BarsChart, ChartFrame } from "@/components/ui/charts";
import { Money, PageHead, Panel, Table, Tabs, useCurrency, useTabParam } from "@/components/ui/data";
import { EmptyState, ErrorState, NoPermission, Notice, Skeleton, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError, MoneyField, Segmented, SelectField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatMoney, formatMonth, percentChange, today } from "@/lib/format";
import { useCan } from "@/stores/session";
import { toast } from "@/stores/toast";
import { EnterpriseStrip } from "../dashboard/EnterpriseStrip";
import { useInvalidateOrg } from "../../features/enterprise/forms";
import { EntriesTable } from "./EntriesTable";

const COST_CATS = ["labour", "transport", "vet", "utilities", "rent", "repairs", "other"];
const INCOME_CATS = ["grants", "other"];

/** Casual labour, transport, vet fees: to an enterprise or the whole farm (FIN-01). */
function EntryPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const farmId = useFarmId();
  const currency = useCurrency();
  const enterprises = useEnterprises();
  const invalidate = useInvalidateOrg();
  const [kind, setKind] = useState<"cost" | "revenue">("cost");
  const [category, setCategory] = useState("labour");
  const [enterpriseId, setEnterpriseId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.finance.create({ farm_id: farmId, kind, category, amount, occurred_on: date, enterprise_id: enterpriseId || null, note }),
    onSuccess: () => (invalidate(), toast(t(kind === "cost" ? "entry.savedCost" : "entry.savedRevenue")), onClose()),
  });
  const cats = kind === "cost" ? COST_CATS : INCOME_CATS;
  return (
    <SidePanel
      title={t("entry.title")}
      onClose={onClose}
      onSubmit={() => (Number(amount) > 0 ? (setError(null), save.mutate()) : setError(t("entry.amountError")))}
      footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("common.save")}</Button></>}
    >
      <div className="stack">
        <ChoiceCards label={t("entry.kind")} value={kind} onChange={(k) => (setKind(k), setCategory(k === "cost" ? "labour" : "grants"))} options={[{ value: "cost", label: t("entry.cost") }, { value: "revenue", label: t("entry.revenue") }]} />
        <SelectField label={t("entry.category")} value={category} onChange={setCategory} options={cats.map((c) => ({ value: c, label: t.dyn(`cat.${c}`, c) }))} />
        <SelectField label={t("entry.for")} value={enterpriseId} onChange={setEnterpriseId} placeholder={t("common.wholeFarm")} options={(enterprises.data ?? []).filter((e) => e.status === "active").map((e) => ({ value: e.id, label: e.name }))} />
        <MoneyField label={t("entry.amount")} value={amount} onChange={setAmount} currency={currency} error={error ?? fieldErrors(save.error).amount} />
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <TextField label={t("common.note")} value={note} onChange={setNote} optional />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

function ProfitTab() {
  const t = useT();
  const key = useKey();
  const farmId = useFarmId();
  const range = useRange();
  const currency = useCurrency();
  const q = useQuery({ queryKey: key("profit", farmId, range.from, range.to), queryFn: () => api.finance.profit({ farm_id: farmId, from: range.from, to: range.to }), enabled: !!farmId });
  if (q.isLoading) return <Skeleton height={420} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const profit = Number(r.profit);
  const change = percentChange(profit, Number(r.previous_profit));
  const summary = change === null || Math.abs(change) < 2 ? t("money.summary.flat") : t(change > 0 ? "money.summary.up" : "money.summary.down", { pct: Math.abs(change) });
  const monthly = r.monthly.map((m) => ({ month: m.month, revenue: Number(m.revenue), cost: Number(m.cost), profit: Number(m.profit) }));
  const best = monthly.slice().sort((a, b) => b.profit - a.profit)[0];
  const series = [
    { key: "revenue", label: t("common.revenue"), color: "var(--revenue)" },
    { key: "cost", label: t("common.costs"), color: "var(--cost)" },
  ];
  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="headline">
          <div>
            <p className="muted">{profit < 0 ? t("common.loss") : t("common.profit")}</p>
            <p className={`display ${profit < 0 ? "ink-loss" : "ink-profit"}`}>{formatMoney(profit, currency)}</p>
            <p className="small muted">{summary}</p>
          </div>
          <div className="side">
            <div><p className="small muted">{t("common.revenue")}</p><Money value={r.revenue} kind="revenue" className="strong" /></div>
            <div><p className="small muted">{t("common.costs")}</p><Money value={r.cost} kind="cost" className="strong" /></div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {r.enterprises.length ? <EnterpriseStrip rows={r.enterprises} /> : <EmptyState text={t("dash.noActivity")} />}
        </div>
      </section>
      <Panel title={t("money.monthly")}>
        <ChartFrame
          summary={best ? t("money.summary.monthly", { month: formatMonth(best.month, t.locale), profit: formatMoney(best.profit, currency) }) : ""}
          legend={series}
          table={
            <Table
              rows={monthly}
              rowKey={(m) => m.month}
              columns={[
                { key: "m", header: t("common.date"), render: (m) => formatMonth(m.month, t.locale) },
                { key: "r", header: t("common.revenue"), numeric: true, render: (m) => <Money value={m.revenue} kind="revenue" /> },
                { key: "c", header: t("common.costs"), numeric: true, render: (m) => <Money value={m.cost} kind="cost" /> },
                { key: "p", header: t("common.profit"), numeric: true, render: (m) => <Money value={m.profit} kind="profit" word /> },
              ]}
            />
          }
        >
          <BarsChart data={monthly} x="month" xFormat={(m) => formatMonth(m, t.locale)} series={series} format={(v) => formatMoney(v, currency)} axisFormat={(v) => `${currency} ${Intl.NumberFormat("en", { notation: "compact" }).format(v)}`} />
        </ChartFrame>
      </Panel>
    </div>
  );
}

function EntriesTab() {
  const t = useT();
  const key = useKey();
  const farmId = useFarmId();
  const range = useRange();
  const [kind, setKind] = useState<"all" | "cost" | "revenue">("all");
  const q = usePaged(key("finance", farmId, range.from, range.to, kind), (cursor) => api.finance.entries({ farm_id: farmId, from: range.from, to: range.to, kind: kind === "all" ? undefined : kind, cursor }), !!farmId);
  return (
    <div className="stack">
      <Segmented label={t("money.col.category")} value={kind} onChange={setKind} options={[{ value: "all", label: t("money.filter.all") }, { value: "cost", label: t("money.filter.cost") }, { value: "revenue", label: t("money.filter.revenue") }]} />
      {q.isLoading ? <SkeletonRows /> : <EntriesTable rows={q.rows} hasNext={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />}
    </div>
  );
}

function CostPerUnitTab() {
  const t = useT();
  const qty = useQty();
  const key = useKey();
  const farmId = useFarmId();
  const range = useRange();
  const q = useQuery({ queryKey: key("cpu", farmId, range.from, range.to), queryFn: () => api.finance.costPerUnit({ farm_id: farmId, from: range.from, to: range.to }), enabled: !!farmId });
  if (q.isLoading) return <SkeletonRows rows={3} />;
  if (!q.data?.length) return <div className="panel"><EmptyState text={t("cpu.none")} /></div>;
  return (
    <div className="stack">
      <p className="muted">{t("cpu.help")}</p>
      <Table
        rows={q.data}
        rowKey={(r: CostPerUnit) => r.enterprise_id}
        columns={[
          { key: "n", header: t("common.enterprise"), render: (r) => <span className="strong">{r.name}</span> },
          { key: "p", header: t("cpu.produced"), numeric: true, render: (r) => qty(r.produced_qty, r.unit, 0) },
          { key: "c", header: t("common.costs"), numeric: true, render: (r) => <Money value={r.cost} kind="cost" /> },
          { key: "u", header: t("cpu.perUnit"), numeric: true, render: (r) => (r.cost_per_unit ? <span className="strong"><Money value={r.cost_per_unit} /> / {t.unit(r.unit, 1)}</span> : <span className="muted">{t("cpu.nothing")}</span>) },
        ]}
      />
    </div>
  );
}

function ExportTab() {
  const t = useT();
  const errorText = useErrorText();
  const farmId = useFarmId();
  const range = useRange();
  const [kinds, setKinds] = useState<string[]>(["sales", "expenses", "stock"]);
  const run = useMutation({ mutationFn: () => api.finance.export({ farm_id: farmId, from: range.from, to: range.to, kinds }) });
  const toggle = (k: string) => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);
  return (
    <Panel>
      <div className="stack">
        <p className="muted">{t("export.help")}</p>
        {(["sales", "expenses", "stock"] as const).map((k) => (
          <label key={k} className="row" style={{ gap: 8, minHeight: 40 }}>
            <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggle(k)} style={{ width: 20, height: 20 }} />
            {t(`export.${k}`)}
          </label>
        ))}
        {kinds.length === 0 && <p className="small ink-cost">{t("export.chooseOne")}</p>}
        <div>
          <Button variant="primary" icon={<Download size={16} />} disabled={!kinds.length} loading={run.isPending} onClick={() => run.mutate()}>{t("export.submit")}</Button>
        </div>
        <FormError message={run.error ? errorText(run.error) : null} />
        {run.data && (
          <Notice tone="health">
            <p className="strong">{t("export.ready")}</p>
            <ul className="list-plain stack" style={{ gap: 4, marginTop: 8 }}>
              {run.data.files.map((f) => (
                <li key={f.name}>
                  <a href={f.url} download={f.name}>{t("export.download", { name: f.name })}</a>
                </li>
              ))}
            </ul>
          </Notice>
        )}
      </div>
    </Panel>
  );
}

export function MoneyPage() {
  const t = useT();
  const money = useCan("money.read");
  const canWrite = useCan("finance.write");
  const [tab, setTab] = useTabParam(["profit", "entries", "cpu", "export"] as const, "profit");
  const [adding, setAdding] = useState(false);
  if (!money) return <NoPermission />;
  return (
    <>
      <PageHead title={t("money.title")} actions={canWrite && <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>{t("money.record")}</Button>} />
      <Tabs
        label={t("money.title")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "profit", label: t("money.tab.profit") },
          { value: "entries", label: t("money.tab.entries") },
          { value: "cpu", label: t("money.tab.cpu") },
          { value: "export", label: t("money.tab.export") },
        ]}
      />
      {tab === "profit" && <ProfitTab />}
      {tab === "entries" && <EntriesTab />}
      {tab === "cpu" && <CostPerUnitTab />}
      {tab === "export" && <ExportTab />}
      {adding && <EntryPanel onClose={() => setAdding(false)} />}
    </>
  );
}
