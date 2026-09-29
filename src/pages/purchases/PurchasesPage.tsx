import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import * as api from "@/api/endpoints";
import { fieldErrors, useErrorText, useFarmId, useItems, useKey, usePaged, useRange } from "@/api/hooks";
import type { Purchase } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { LoadMore, Money, PageHead, RecordedBy, Table, Tabs, useCurrency, useTabParam, type Column } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, NoPermission, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError, MoneyField, QuantityField, SelectField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatDate, formatMoney, today } from "@/lib/format";
import { useCan } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useInvalidateOrg } from "../enterprise/forms";
import { PartiesTable } from "../sales/SalesPage";
import { PartyPicker, type NewParty } from "../sales/PartyPicker";

interface Line {
  item_id: string;
  qty: string;
  unit: string;
  unit_price: string;
}

/** Stock enters the ledger at the price paid, and average cost updates (J3, PRO-02). */
function NewPurchasePanel({ initialItem, onClose }: { initialItem: string | null; onClose: () => void }) {
  const t = useT();
  const key = useKey();
  const errorText = useErrorText();
  const farmId = useFarmId();
  const currency = useCurrency();
  const invalidate = useInvalidateOrg();
  const items = useItems();
  const suppliers = useQuery({ queryKey: key("suppliers"), queryFn: api.purchases.suppliers, select: (p) => p.results });
  const inputs = (items.data ?? []).filter((i) => i.kind === "input");
  const newLine = (id = inputs[0]?.id ?? ""): Line => ({ item_id: id, qty: "", unit: inputs.find((i) => i.id === id)?.display_unit ?? "", unit_price: "" });

  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState<NewParty | null>(null);
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState<"full" | "credit">("full");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lines.length && inputs.length) setLines([newLine(initialItem && inputs.some((i) => i.id === initialItem) ? initialItem : undefined)]);
  }, [inputs.length]); // eslint-disable-line

  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0);
  const save = useMutation({
    mutationFn: async () => {
      let sid = supplierId;
      if (newSupplier) sid = (await api.purchases.createSupplier(newSupplier)).id;
      return api.purchases.create({ farm_id: farmId, supplier_id: sid, date, lines, paid });
    },
    onSuccess: () => (invalidate(), toast(t("purch.saved")), onClose()),
  });
  const validate = () => {
    const e: Record<string, string> = {};
    if (!supplierId && !newSupplier?.name.trim()) e.supplier = t("purch.chooseSupplier");
    lines.forEach((l, i) => {
      if (!(Number(l.qty) > 0)) e[`lines.${i}.qty`] = t("sale.qtyError");
      if (l.unit_price === "" || Number(l.unit_price) < 0) e[`lines.${i}.unit_price`] = t("sale.priceError");
    });
    setErrors(e);
    return !Object.keys(e).length;
  };
  const err = { ...fieldErrors(save.error), ...errors };

  return (
    <SidePanel wide title={t("purch.new")} onClose={onClose} onSubmit={() => validate() && save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("purch.new")}</Button></>}>
      <div className="stack-lg">
        <div className="form-grid">
          <div className="span-2">
            <PartyPicker label={t("purch.supplier")} parties={suppliers.data ?? []} value={supplierId} onChange={setSupplierId} newParty={newSupplier} onNewParty={setNewSupplier} addLabel={t("purch.addSupplier")} error={err.supplier ?? err.supplier_id} />
          </div>
          <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        </div>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend className="field-label" style={{ marginBottom: 4 }}>{t("purch.col.items")}</legend>
          <div className="lines">
            {lines.map((l, i) => {
              const item = inputs.find((x) => x.id === l.item_id);
              const upd = (patch: Partial<Line>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="line-card">
                  <SelectField className="span-2" label={t("purch.item")} value={l.item_id} onChange={(v) => upd({ item_id: v, unit: inputs.find((x) => x.id === v)?.display_unit ?? "" })} options={inputs.map((x) => ({ value: x.id, label: x.name[t.locale] }))} />
                  <QuantityField label={t("common.quantity")} value={l.qty} onChange={(v) => upd({ qty: v })} unit={l.unit} onUnitChange={(u) => upd({ unit: u })} units={item?.units ?? [l.unit]} error={err[`lines.${i}.qty`]} />
                  <MoneyField label={t("common.pricePer", { unit: t.unit(l.unit, 1) })} value={l.unit_price} onChange={(v) => upd({ unit_price: v })} error={err[`lines.${i}.unit_price`]} currency={currency} />
                  {lines.length > 1 && (
                    <div className="span-2" style={{ textAlign: "right" }}>
                      <Button variant="quiet" size="sm" icon={<Trash2 size={14} />} onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t("common.remove")}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <Button variant="quiet" icon={<Plus size={16} />} onClick={() => setLines([...lines, newLine()])}>{t("purch.addLine")}</Button>
          </div>
        </fieldset>
        <div className="spread" style={{ alignItems: "baseline" }}>
          <span className="muted">{t("common.total")}</span>
          <span className="display ink-cost">{formatMoney(total, currency)}</span>
        </div>
        <ChoiceCards label={t("purch.paid")} value={paid} onChange={setPaid} options={[{ value: "full", label: t("purch.paidFull") }, { value: "credit", label: t("purch.onCredit") }]} />
        <FormError message={save.error ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

function PurchaseDetailPanel({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const t = useT();
  const qty = useQty();
  const errorText = useErrorText();
  const currency = useCurrency();
  const invalidate = useInvalidateOrg();
  const canWrite = useCan("procurement.write");
  const [amount, setAmount] = useState(purchase.balance_due);
  const pay = useMutation({ mutationFn: () => api.purchases.pay(purchase.id, amount), onSuccess: () => (invalidate(), toast(t("purch.paySaved")), onClose()) });
  const owes = Number(purchase.balance_due) > 0;
  return (
    <SidePanel
      title={`${purchase.number}, ${purchase.supplier_name}`}
      onClose={onClose}
      onSubmit={owes && canWrite ? () => pay.mutate() : undefined}
      footer={owes && canWrite ? <><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={pay.isPending}>{t("purch.pay")}</Button></> : undefined}
    >
      <div className="stack-lg">
        <p className="muted">{formatDate(purchase.date, t.locale)}</p>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {purchase.lines.map((l, i) => (
                <tr key={i}>
                  <td data-label={t("purch.item")} className="strong">{qty(l.qty, l.unit)} {l.item_name[t.locale].toLowerCase()}</td>
                  <td className="n" data-label={t("common.total")}><Money value={Number(l.qty) * Number(l.unit_price)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="summary-list">
          <dt>{t("common.total")}</dt>
          <dd><Money value={purchase.total} kind="cost" /></dd>
          <dt>{t("sales.col.paid")}</dt>
          <dd><Money value={purchase.paid} /></dd>
          <dt className="total strong">{t("supp.owed")}</dt>
          <dd className="total"><Money value={purchase.balance_due} /></dd>
        </dl>
        {owes && canWrite && <MoneyField label={t("sale.amount")} value={amount} onChange={setAmount} currency={currency} />}
        <FormError message={pay.error ? errorText(pay.error) : null} />
        <p className="small muted row">{t("common.recordedBy")}: <RecordedBy by={purchase.recorded_by} /></p>
      </div>
    </SidePanel>
  );
}

function SupplierPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const invalidate = useInvalidateOrg();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const save = useMutation({ mutationFn: () => api.purchases.createSupplier({ name, phone }), onSuccess: () => (invalidate(), toast(t("supp.saved")), onClose()) });
  const err = fieldErrors(save.error);
  return (
    <SidePanel title={t("supp.new")} onClose={onClose} onSubmit={() => save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("common.save")}</Button></>}>
      <div className="stack">
        <TextField label={t("common.name")} value={name} onChange={setName} error={err.name} autoFocus />
        <TextField label={t("common.phone")} value={phone} onChange={setPhone} type="tel" placeholder="0712 345 678" error={err.phone} optional />
        <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

export function PurchasesPage() {
  const t = useT();
  const key = useKey();
  const qty = useQty();
  const farmId = useFarmId();
  const range = useRange();
  const currency = useCurrency();
  const money = useCan("money.read");
  const canWrite = useCan("procurement.write");
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useTabParam(["list", "suppliers", "owe"] as const, "list");
  const [panel, setPanel] = useState<"new" | "supplier" | null>(params.get("new") ? "new" : null);
  const [initialItem] = useState(params.get("item"));
  const [open, setOpen] = useState<Purchase | null>(null);

  useEffect(() => {
    if (params.get("new")) setParams((p) => (p.delete("new"), p.delete("item"), p), { replace: true });
  }, [params, setParams]);

  const list = usePaged(key("purchases", farmId, range.from, range.to, tab), (cursor) => api.purchases.list({ farm_id: farmId, ...(tab === "owe" ? { unpaid: true } : { from: range.from, to: range.to }), cursor }), money && !!farmId && tab !== "suppliers");
  const suppliers = useQuery({ queryKey: key("suppliers"), queryFn: api.purchases.suppliers, select: (p) => p.results, enabled: money });
  const owing = useMemo(() => (suppliers.data ?? []).filter((s) => Number(s.balance) > 0), [suppliers.data]);

  if (!money) return <NoPermission />;

  const columns: Column<Purchase>[] = [
    { key: "no", header: t("purch.col.number"), render: (p) => <span className="strong num">{p.number}</span> },
    { key: "date", header: t("common.date"), render: (p) => formatDate(p.date, t.locale), sort: (a, b) => a.date.localeCompare(b.date) },
    { key: "sup", header: t("purch.col.supplier"), render: (p) => p.supplier_name },
    { key: "items", header: t("purch.col.items"), render: (p) => p.lines.map((l) => `${qty(l.qty, l.unit)} ${l.item_name[t.locale].toLowerCase()}`).join(", ") },
    { key: "total", header: t("common.total"), numeric: true, render: (p) => <Money value={p.total} kind="cost" />, sort: (a, b) => Number(a.total) - Number(b.total) },
    { key: "status", header: t("common.status"), render: (p) => <Chip tone={p.status === "paid" ? "health" : "amber"}>{t(p.status === "paid" ? "saleStatus.paid" : p.status === "partial" ? "saleStatus.partial" : "saleStatus.credit")}</Chip> },
  ];

  const listView = list.isLoading ? <SkeletonRows /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.rows.length ? (
    <Table rows={list.rows} columns={columns} rowKey={(p) => p.id} onRowClick={setOpen} footer={<LoadMore hasNext={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()} />} />
  ) : (
    <div className="panel"><EmptyState text={tab === "owe" ? t("purch.oweEmpty") : t("purch.empty")} /></div>
  );

  return (
    <>
      <PageHead
        title={t("purch.title")}
        actions={canWrite && (
          <>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setPanel("new")}>{t("purch.new")}</Button>
            {tab === "suppliers" && <Button onClick={() => setPanel("supplier")}>{t("supp.new")}</Button>}
          </>
        )}
      />
      <Tabs
        label={t("purch.title")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "list", label: t("purch.tab.list") },
          { value: "suppliers", label: t("purch.tab.suppliers") },
          { value: "owe", label: t("purch.tab.owe") },
        ]}
      />
      {tab === "list" && listView}
      {tab === "suppliers" && (suppliers.isLoading ? <SkeletonRows /> : suppliers.data?.length ? <PartiesTable rows={suppliers.data} balanceLabel={t("supp.owed")} /> : <div className="panel"><EmptyState text={t("supp.empty")} /></div>)}
      {tab === "owe" && (
        <div className="stack">
          {owing.length > 0 && <p>{t("purch.oweSummary", { amount: formatMoney(owing.reduce((s, x) => s + Number(x.balance), 0), currency), n: owing.length })}</p>}
          {listView}
        </div>
      )}
      {panel === "new" && <NewPurchasePanel initialItem={initialItem} onClose={() => setPanel(null)} />}
      {panel === "supplier" && <SupplierPanel onClose={() => setPanel(null)} />}
      {open && <PurchaseDetailPanel purchase={open} onClose={() => setOpen(null)} />}
    </>
  );
}
