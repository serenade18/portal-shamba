import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, BellRing, ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import * as api from "@/api/endpoints";
import { fieldErrors, useEnterprises, useErrorText, useFarmId, useItems, useKey, usePaged } from "@/api/hooks";
import type { StockBalance } from "@/api/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Money, PageHead, Table, Tabs, useTabParam, type Column } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, SkeletonRows } from "@/components/ui/feedback";
import { DateField, FormError, MoneyField, QuantityField, SelectField } from "@/components/ui/forms";
import { Dialog, SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatNumber, today } from "@/lib/format";
import { useCan } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useInvalidateOrg } from "../../features/enterprise/forms";
import { MovementsTable } from "./MovementsTable";

const display = (b: StockBalance) => Number(b.qty_base) / b.display_factor;

function AlertLevelDialog({ balance, onClose }: { balance: StockBalance; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const invalidate = useInvalidateOrg();
  const [value, setValue] = useState(balance.low_stock_level ? formatNumber(Number(balance.low_stock_level) / balance.display_factor, 2) : "");
  const save = useMutation({
    mutationFn: () => api.stock.updateItem(balance.item_id, { low_stock_level: value ? String(Number(value) * balance.display_factor) : null }),
    onSuccess: () => (invalidate(), toast(t("stock.alertLevelSaved")), onClose()),
  });
  return (
    <Dialog
      title={balance.item_name[t.locale]}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="stack">
        <QuantityField label={t("stock.alertLevel")} value={value} onChange={setValue} unit={balance.display_unit} units={[balance.display_unit]} optional />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </Dialog>
  );
}

function Balances({ rows, onAlert }: { rows: StockBalance[]; onAlert: (b: StockBalance) => void }) {
  const t = useT();
  const qty = useQty();
  const money = useCan("money.read");
  const canWrite = useCan("stock.write");
  if (!rows.length) return <div className="panel"><EmptyState text={t("stock.empty")} action={money && <ButtonLink to="/purchases?new=1" variant="primary">{t("stock.recordPurchase")}</ButtonLink>} /></div>;
  const columns: Column<StockBalance>[] = [
    {
      key: "item",
      header: t("stock.item"),
      render: (b) => (
        <span>
          <span className="strong">{b.item_name[t.locale]}</span>
          {b.status === "negative" && <span className="small ink-cost" style={{ display: "block", maxWidth: 420 }}>{t("stock.negativeNote")}</span>}
        </span>
      ),
      sort: (a, b) => a.item_name[t.locale].localeCompare(b.item_name[t.locale]),
    },
    { key: "store", header: t("stock.store"), render: (b) => b.location },
    {
      key: "qty",
      header: t("stock.qty"),
      numeric: true,
      render: (b) => (
        <span className={b.status === "negative" ? "ink-cost" : ""} title={t("stock.baseQty", { qty: formatNumber(b.qty_base, 2), unit: t.unit(b.base_unit) })}>
          {qty(display(b), b.display_unit)}
        </span>
      ),
      sort: (a, b) => display(a) - display(b),
    },
    ...(money ? [{ key: "value", header: t("common.value"), numeric: true, render: (b: StockBalance) => (b.value && Number(b.value) > 0 ? <Money value={b.value} /> : "–"), sort: (a: StockBalance, b: StockBalance) => Number(a.value ?? 0) - Number(b.value ?? 0) }] : []),
    {
      key: "status",
      header: t("common.status"),
      render: (b) => (b.status === "ok" ? <Chip tone="health">{t("stock.status.ok")}</Chip> : <Chip tone="terracotta">{t(`stock.status.${b.status}`)}</Chip>),
    },
    ...(canWrite
      ? [{
          key: "alert",
          header: t("stock.alertLevel"),
          numeric: true,
          render: (b: StockBalance) => (
            <Button variant="quiet" size="sm" icon={<BellRing size={14} />} onClick={() => onAlert(b)}>
              {b.low_stock_level ? qty(Number(b.low_stock_level) / b.display_factor, b.display_unit) : "–"}
            </Button>
          ),
        }]
      : []),
  ];
  return <Table rows={rows} columns={columns} rowKey={(b) => b.item_id} caption={t("stock.balances")} />;
}

function History() {
  const t = useT();
  const key = useKey();
  const farmId = useFarmId();
  const items = useItems();
  const [itemId, setItemId] = useState("");
  const q = usePaged(key("movements", farmId, itemId), (cursor) => api.stock.movements({ farm_id: farmId, item_id: itemId || undefined, cursor }), !!farmId);
  return (
    <div className="stack">
      <div style={{ maxWidth: 320 }}>
        <SelectField label={t("stock.item")} value={itemId} onChange={setItemId} placeholder={t("stock.allItems")} options={(items.data ?? []).map((i) => ({ value: i.id, label: i.name[t.locale] }))} />
      </div>
      {q.isLoading ? <SkeletonRows /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <MovementsTable rows={q.rows} showItem={!itemId} hasNext={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />}
    </div>
  );
}

function CountPanel({ rows, onClose }: { rows: StockBalance[]; onClose: () => void }) {
  const t = useT();
  const qty = useQty();
  const errorText = useErrorText();
  const farmId = useFarmId();
  const invalidate = useInvalidateOrg();
  const [date, setDate] = useState(today());
  const [counted, setCounted] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => api.stock.count({ farm_id: farmId, date, lines: rows.filter((b) => counted[b.item_id] !== undefined && counted[b.item_id] !== "").map((b) => ({ item_id: b.item_id, counted: counted[b.item_id]!, unit: b.display_unit })) }),
    onSuccess: (res) => {
      invalidate();
      toast(res.adjustments ? t.n("count.saved", res.adjustments) : t("count.none"));
      onClose();
    },
  });
  return (
    <SidePanel wide title={t("count.title")} onClose={onClose} onSubmit={() => save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("count.submit")}</Button></>}>
      <div className="stack">
        <p className="muted">{t("count.help")}</p>
        <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("stock.item")}</th>
                <th className="n">{t("count.recorded")}</th>
                <th className="n">{t("count.counted")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.item_id}>
                  <td data-label={t("stock.item")} className="strong">{b.item_name[t.locale]}</td>
                  <td data-label={t("count.recorded")} className="n">{qty(display(b), b.display_unit)}</td>
                  <td data-label={t("count.counted")} className="n">
                    <div className="input-group" style={{ width: 170, marginLeft: "auto" }}>
                      <input
                        className="input money"
                        inputMode="decimal"
                        aria-label={`${t("count.counted")}, ${b.item_name[t.locale]}`}
                        value={counted[b.item_id] ?? ""}
                        onChange={(e) => setCounted({ ...counted, [b.item_id]: e.target.value.replace(/[^\d.]/g, "") })}
                      />
                      <span className="prefix" style={{ paddingRight: 12 }}>{t.unit(b.display_unit)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

/** Two movements at zero or a set price, like maize stover to the dairy herd (INV-07). */
function TransferPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const farmId = useFarmId();
  const items = useItems();
  const enterprises = useEnterprises();
  const money = useCan("money.read");
  const invalidate = useInvalidateOrg();
  const [f, setF] = useState({ item_id: "", qty: "", unit: "", from: "", to: "", price: "0", date: today() });
  const item = items.data?.find((i) => i.id === f.item_id) ?? items.data?.[0];
  const unit = f.unit || item?.display_unit || "kg";
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const active = (enterprises.data ?? []).filter((e) => e.status === "active");
  const save = useMutation({
    mutationFn: () => api.stock.transfer({ farm_id: farmId, item_id: item!.id, qty: f.qty, unit, from_enterprise_id: f.from || null, to_enterprise_id: f.to, unit_price: f.price || "0", date: f.date }),
    onSuccess: () => (invalidate(), toast(t("transfer.saved")), onClose()),
  });
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("transfer.title")} onClose={onClose} onSubmit={() => save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("transfer.submit")}</Button></>}>
      <div className="stack">
        <SelectField label={t("stock.item")} value={item?.id ?? ""} onChange={(v) => setF((s) => ({ ...s, item_id: v, unit: "" }))} options={(items.data ?? []).map((i) => ({ value: i.id, label: i.name[t.locale] }))} />
        <QuantityField label={t("common.quantity")} value={f.qty} onChange={set("qty")} unit={unit} onUnitChange={set("unit")} units={item?.units ?? [unit]} error={err.qty ? t("sale.qtyError") : undefined} />
        <SelectField label={t("transfer.from")} value={f.from} onChange={set("from")} placeholder={t("transfer.unassigned")} options={active.map((e) => ({ value: e.id, label: e.name }))} />
        <SelectField label={t("transfer.to")} value={f.to} onChange={set("to")} placeholder="" options={active.filter((e) => e.id !== f.from).map((e) => ({ value: e.id, label: e.name }))} error={err.to_enterprise_id} />
        {money && <MoneyField label={t("common.pricePer", { unit: t.unit(unit, 1) })} hint={t("transfer.priceHelp")} value={f.price} onChange={set("price")} />}
        <DateField label={t("common.date")} value={f.date} onChange={set("date")} max={today()} />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

export function StockPage() {
  const t = useT();
  const key = useKey();
  const farmId = useFarmId();
  const canWrite = useCan("stock.write");
  const money = useCan("money.read");
  const [tab, setTab] = useTabParam(["balances", "history"] as const, "balances");
  const [panel, setPanel] = useState<"count" | "transfer" | null>(null);
  const [alertFor, setAlertFor] = useState<StockBalance | null>(null);
  const balances = useQuery({ queryKey: key("balances", farmId), queryFn: () => api.stock.balances(farmId), enabled: !!farmId, select: (p) => p.results });

  return (
    <>
      <PageHead
        title={t("stock.title")}
        actions={canWrite && (
          <>
            {money && <ButtonLink to="/purchases?new=1" variant="primary" icon={<Plus size={18} />}>{t("stock.recordPurchase")}</ButtonLink>}
            <Button icon={<ClipboardList size={18} />} onClick={() => setPanel("count")}>{t("stock.count")}</Button>
            <Button icon={<ArrowRightLeft size={18} />} onClick={() => setPanel("transfer")}>{t("stock.transfer")}</Button>
          </>
        )}
      />
      <Tabs
        label={t("stock.title")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "balances", label: t("stock.balances") },
          { value: "history", label: t("stock.history") },
        ]}
      />
      {tab === "balances" ? (
        balances.isLoading ? <SkeletonRows /> : balances.error ? <ErrorState error={balances.error} onRetry={() => balances.refetch()} /> : <Balances rows={balances.data ?? []} onAlert={setAlertFor} />
      ) : (
        <History />
      )}
      {panel === "count" && <CountPanel rows={balances.data ?? []} onClose={() => setPanel(null)} />}
      {panel === "transfer" && <TransferPanel onClose={() => setPanel(null)} />}
      {alertFor && <AlertLevelDialog balance={alertFor} onClose={() => setAlertFor(null)} />}
    </>
  );
}
