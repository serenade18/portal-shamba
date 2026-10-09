import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, MessageSquare, Pencil, Plus, Send, Share2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import * as api from "@/api/endpoints";
import { fieldErrors, useEnterprises, useErrorText, useFarm, useFarmId, useItems, useKey, usePaged, useRange } from "@/api/hooks";
import type { NewSaleInput, Party, PaymentMethod, Receipt, ReceiptChannel, Sale } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Money, PageHead, RecordedBy, Table, Tabs, useCurrency, useTabParam, type Column } from "@/components/ui/data";
import { Chip, EmptyState, ErrorState, NoPermission, SkeletonRows } from "@/components/ui/feedback";
import { ChoiceCards, DateField, FormError, MoneyField, QuantityField, SelectField, TextField } from "@/components/ui/forms";
import { SidePanel } from "@/components/ui/overlay";
import { useQty, useT } from "@/i18n";
import { formatDate, formatMoney, today } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useCan } from "@/stores/session";
import { toast } from "@/stores/toast";
import { useInvalidateOrg } from "../enterprise/forms";
import { MpesaStatus } from "./MpesaStatus";
import { PartyPicker, type NewParty } from "./PartyPicker";
import { canSharePdf, downloadFile, receiptPdf } from "./receiptPdf";
import { SaleStatusChip, SalesTable } from "./SalesTable";

interface Line {
  item_id: string;
  qty: string;
  unit: string;
  unit_price: string;
  enterprise_id: string;
}

const NETWORKS = ["mpesa", "airtel", "tkash", "sasapay"] as const;

function PaymentChoice({ method, setMethod }: { method: PaymentMethod; setMethod: (m: PaymentMethod) => void }) {
  const t = useT();
  return (
    <ChoiceCards
      label={t("sale.payment")}
      value={method}
      onChange={setMethod}
      options={[
        { value: "mpesa", label: t("pay.mpesa"), help: t("pay.mpesaHelp") },
        { value: "mpesa_code", label: t("pay.mpesa_code"), help: t("pay.mpesaCodeHelp") },
        { value: "cash", label: t("pay.cash"), help: t("pay.cashHelp") },
        { value: "credit", label: t("pay.credit"), help: t("pay.creditHelp") },
      ]}
    />
  );
}

/** New sale in a side panel over the list, so the owner keeps context (7.4, J4). */
function NewSalePanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const qty = useQty();
  const key = useKey();
  const errorText = useErrorText();
  const farmId = useFarmId();
  const currency = useCurrency();
  const invalidate = useInvalidateOrg();
  const items = useItems();
  const enterprises = useEnterprises();
  const customers = useQuery({ queryKey: key("customers"), queryFn: api.sales.customers, select: (p) => p.results });
  const balances = useQuery({ queryKey: key("balances", farmId), queryFn: () => api.stock.balances(farmId), select: (p) => p.results });

  const products = (items.data ?? []).filter((i) => i.kind === "output");
  const active = (enterprises.data ?? []).filter((e) => e.status === "active");
  const ownerOf = (itemId: string) => {
    const item = products.find((i) => i.id === itemId);
    return active.find((e) => item?.produced_by.includes(e.type))?.id ?? "";
  };
  const newLine = (itemId = products[0]?.id ?? ""): Line => ({ item_id: itemId, qty: "", unit: products.find((i) => i.id === itemId)?.display_unit ?? "", unit_price: "", enterprise_id: ownerOf(itemId) });

  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState<NewParty | null>(null);
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("mpesa");
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<Sale | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lines.length && products.length && enterprises.data) setLines([newLine()]);
  }, [products.length, enterprises.data]);

  const customer = customers.data?.find((c) => c.id === customerId);
  useEffect(() => {
    if (customer?.phone) setPhone(formatPhone(customer.phone));
  }, [customer?.phone]);

  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0);

  const create = useMutation({
    mutationFn: async () => {
      let cid = customerId;
      if (newCustomer) cid = (await api.sales.createCustomer(newCustomer)).id;
      const body: NewSaleInput = {
        id: crypto.randomUUID(),
        farm_id: farmId,
        customer_id: cid,
        date,
        lines: lines.map((l) => ({ ...l, enterprise_id: l.enterprise_id || null })),
        payment: { method, phone: method === "mpesa" ? phone : undefined, network: method === "mpesa" ? network : undefined, code: method === "mpesa_code" ? code.trim().toUpperCase() : undefined },
      };
      return api.sales.create(body);
    },
    onSuccess: (sale) => {
      invalidate();
      toast(t("sale.saved"));
      if (sale.method === "mpesa") setCreated(sale);
      else onClose();
    },
  });

  const followUp = useMutation({
    mutationFn: (m: "mpesa" | "cash") => api.sales.addPayment(created!.id, { method: m, amount: created!.balance_due, phone }),
    onSuccess: () => invalidate(),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId && !newCustomer?.name.trim()) e.customer = t("sale.customerError");
    lines.forEach((l, i) => {
      if (!(Number(l.qty) > 0)) e[`lines.${i}.qty`] = t("sale.qtyError");
      if (!(Number(l.unit_price) > 0)) e[`lines.${i}.unit_price`] = t("sale.priceError");
    });
    if (method === "mpesa_code" && !/^[A-Z0-9]{10}$/i.test(code.trim())) e.code = t("pay.codeError");
    setErrors(e);
    return !Object.keys(e).length;
  };

  const server = fieldErrors(create.error);
  const err = { ...server, ...errors };

  if (created) {
    return (
      <SidePanel title={t("sale.detail", { number: created.number })} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>{t("mpesa.done")}</Button>}>
        <div className="stack-lg">
          <p>
            {created.customer_name}: <Money value={created.total} kind="revenue" className="strong" />
          </p>
          <MpesaStatus
            key={followUp.submittedAt}
            saleId={created.id}
            onRetry={() => followUp.mutate("mpesa")}
            onCash={() => followUp.mutate("cash", { onSuccess: () => (toast(t("sale.paymentSaved")), onClose()) })}
            onCredit={onClose}
          />
          <FormError message={followUp.error ? errorText(followUp.error) : null} />
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel
      wide
      title={t("sales.new")}
      onClose={onClose}
      onSubmit={() => validate() && create.mutate()}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>{t("sale.submit")}</Button>
        </>
      }
    >
      <div className="stack-lg">
        <div className="form-grid">
          <div className="span-2">
            <PartyPicker label={t("sale.customer")} parties={customers.data ?? []} value={customerId} onChange={setCustomerId} newParty={newCustomer} onNewParty={setNewCustomer} addLabel={t("sale.addCustomer")} error={err.customer ?? err.customer_id} />
          </div>
          <DateField label={t("common.date")} value={date} onChange={setDate} max={today()} />
        </div>

        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend className="field-label" style={{ marginBottom: 4 }}>{t("sale.products")}</legend>
          <div className="lines">
            {lines.map((l, i) => {
              const item = products.find((p) => p.id === l.item_id);
              const bal = balances.data?.find((b) => b.item_id === l.item_id);
              const upd = (patch: Partial<Line>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="line-card">
                  <SelectField label={t("sale.product")} value={l.item_id} onChange={(v) => upd({ item_id: v, unit: products.find((p) => p.id === v)?.display_unit ?? "", enterprise_id: ownerOf(v) })} options={products.map((p) => ({ value: p.id, label: p.name[t.locale] }))} />
                  <SelectField label={t("sale.from")} value={l.enterprise_id} onChange={(v) => upd({ enterprise_id: v })} placeholder={t("common.wholeFarm")} options={active.map((e) => ({ value: e.id, label: e.name }))} />
                  <QuantityField
                    label={t("common.quantity")}
                    value={l.qty}
                    onChange={(v) => upd({ qty: v })}
                    unit={l.unit}
                    onUnitChange={(u) => upd({ unit: u })}
                    units={item?.units ?? [l.unit]}
                    hint={bal ? t("sale.inStock", { qty: qty(Number(bal.qty_base) / (item?.units.find((u) => u.code === l.unit)?.factor ?? 1), l.unit) }) : undefined}
                    error={err[`lines.${i}.qty`]}
                  />
                  <MoneyField label={t("common.pricePer", { unit: t.unit(l.unit, 1) })} value={l.unit_price} onChange={(v) => upd({ unit_price: v })} error={err[`lines.${i}.unit_price`]} currency={currency} />
                  {lines.length > 1 && (
                    <div className="span-2 spread">
                      <span className="small muted">{Number(l.qty) > 0 && Number(l.unit_price) > 0 && formatMoney(Number(l.qty) * Number(l.unit_price), currency)}</span>
                      <Button variant="quiet" size="sm" icon={<Trash2 size={14} />} onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t("common.remove")}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <Button variant="quiet" icon={<Plus size={16} />} onClick={() => setLines([...lines, newLine()])}>{t("sale.addLine")}</Button>
          </div>
        </fieldset>

        <div className="spread" style={{ alignItems: "baseline" }}>
          <span className="muted">{t("sale.total")}</span>
          <span className="display ink-revenue" aria-live="polite">{formatMoney(total, currency)}</span>
        </div>

        <PaymentChoice method={method} setMethod={setMethod} />
        {method === "mpesa" && (
          <div className="form-grid">
            <TextField label={t("pay.phone")} value={phone} onChange={setPhone} type="tel" inputMode="tel" placeholder="0712 345 678" error={err.phone} />
            <SelectField label={t("pay.network")} value={network} onChange={(v) => setNetwork(v as typeof network)} options={NETWORKS.map((n) => ({ value: n, label: t(`network.${n}`) }))} />
          </div>
        )}
        {method === "mpesa_code" && <TextField label={t("pay.code")} value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder={t("pay.codePlaceholder")} maxLength={10} error={err.code} />}
        <FormError message={create.error ? errorText(create.error) : null} />
      </div>
    </SidePanel>
  );
}

/**
 * Sends the customer a receipt (SAL-05): by SMS from the server, or on WhatsApp as a PDF.
 * WhatsApp chat links carry text only, so the PDF goes through the device's share sheet,
 * or is downloaded for attaching by hand where the browser can't share files.
 */
function ReceiptForm({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const currency = useCurrency();
  const { farm } = useFarm();
  const [channel, setChannel] = useState<ReceiptChannel>("sms");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<{ receipt: Receipt; pdf: File } | null>(null);
  const send = useMutation({
    mutationFn: async () => {
      const receipt = await api.sales.sendReceipt(sale.id, { channel, phone });
      return { receipt, pdf: receipt.channel === "whatsapp" ? await receiptPdf(t, sale, farm?.name ?? "", currency) : null };
    },
    onSuccess: ({ receipt, pdf }) => {
      if (!pdf) {
        toast(t("receipt.sentSms", { phone: formatPhone(receipt.phone) }));
        onDone();
      } else setSent({ receipt, pdf });
    },
  });
  const share = async (pdf: File) => {
    try {
      await navigator.share({ files: [pdf], title: pdf.name });
      toast(t("receipt.shared"));
      onDone();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // closed the share sheet
      downloadFile(pdf);
    }
  };
  const err = fieldErrors(send.error);
  if (sent) {
    const sharable = canSharePdf(sent.pdf);
    return (
      <div className="stack panel panel-body">
        <p className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <FileText size={20} aria-hidden style={{ flex: "none" }} />
          <span>{t("receipt.pdfReady", { phone: formatPhone(sent.receipt.phone) })}</span>
        </p>
        <p className="small muted">{sharable ? t("receipt.shareHelp") : t("receipt.downloadHelp")}</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button onClick={onDone}>{t("common.close")}</Button>
          <Button icon={<Download size={16} />} onClick={() => downloadFile(sent.pdf)}>{t("receipt.downloadPdf")}</Button>
          {sharable ? (
            <Button variant="primary" icon={<Share2 size={16} />} onClick={() => share(sent.pdf)}>{t("receipt.sharePdf")}</Button>
          ) : (
            sent.receipt.url && (
              <a className="btn btn-primary" href={sent.receipt.url} target="_blank" rel="noreferrer">
                <MessageSquare size={16} aria-hidden />
                {t("receipt.openWhatsapp")}
              </a>
            )
          )}
        </div>
      </div>
    );
  }
  return (
    <form
      className="stack panel panel-body"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <ChoiceCards<ReceiptChannel> label={t("receipt.channel")} value={channel} onChange={setChannel} options={[{ value: "sms", label: t("receipt.sms") }, { value: "whatsapp", label: t("receipt.whatsappPdf") }]} />
      <TextField label={t("common.phone")} value={phone} onChange={setPhone} type="tel" placeholder="0712 345 678" hint={t("receipt.phoneHint")} error={err.phone} optional />
      <FormError message={send.error && !Object.keys(err).length ? errorText(send.error) : null} />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button onClick={onDone}>{t("common.cancel")}</Button>
        <Button type="submit" variant="primary" icon={<Send size={16} />} loading={send.isPending}>{t(channel === "sms" ? "receipt.send" : "receipt.makePdf")}</Button>
      </div>
    </form>
  );
}

/** One sale: lines, who recorded it, payments and the receipt (SAL-04, SAL-05). */
function SaleDetailPanel({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const t = useT();
  const qty = useQty();
  const key = useKey();
  const errorText = useErrorText();
  const currency = useCurrency();
  const invalidate = useInvalidateOrg();
  const canWrite = useCan("sales.write");
  const sale = useQuery({ queryKey: key("sale", saleId), queryFn: () => api.sales.get(saleId) });
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const pay = useMutation({
    mutationFn: () => api.sales.addPayment(saleId, { method, amount: amount || sale.data!.balance_due, phone, code }),
    onSuccess: () => {
      invalidate();
      toast(t("sale.paymentSaved"));
      setPaying(false);
    },
  });

  const s = sale.data;
  const pending = s?.payment_request && (s.payment_request.status === "pending" || s.payment_request.status === "awaiting_otp");

  return (
    <SidePanel
      title={s ? t("sale.detail", { number: s.number }) : "…"}
      onClose={onClose}
      footer={
        s && (
          <>
            {canWrite && !sending && <Button icon={<Send size={16} />} onClick={() => (setPaying(false), setSending(true))}>{t("sale.shareReceipt")}</Button>}
            {canWrite && Number(s.balance_due) > 0 && !paying && !pending && <Button variant="primary" onClick={() => (setAmount(s.balance_due), setPaying(true))}>{t("sale.recordPayment")}</Button>}
          </>
        )
      }
    >
      {!s ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="stack-lg">
          <div className="spread">
            <div>
              <p className="strong">{s.customer_name}</p>
              <p className="small muted">{formatDate(s.date, t.locale)}</p>
            </div>
            <SaleStatusChip status={s.status} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {s.lines.map((l, i) => (
                  <tr key={i}>
                    <td data-label={t("sale.product")}>
                      <span className="strong">{qty(l.qty, l.unit)} {l.item_name[t.locale].toLowerCase()}</span>
                      <span className="small muted" style={{ display: "block" }}>{l.enterprise_name ?? t("common.wholeFarm")}</span>
                    </td>
                    <td className="n" data-label={t("common.total")}><Money value={Number(l.qty) * Number(l.unit_price)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="summary-list">
            <dt>{t("common.total")}</dt>
            <dd><Money value={s.total} kind="revenue" /></dd>
            <dt>{t("sales.col.paid")}</dt>
            <dd><Money value={s.paid} /></dd>
            <dt className="total strong">{t("sale.balance")}</dt>
            <dd className="total"><Money value={s.balance_due} /></dd>
          </dl>
          {s.payment_request && (
            <MpesaStatus saleId={s.id} onRetry={() => (setMethod("mpesa"), setPaying(true))} onCash={() => (setMethod("cash"), setAmount(s.balance_due), setPaying(true))} onCredit={onClose} />
          )}
          {sending && <ReceiptForm sale={s} onDone={() => setSending(false)} />}
          {paying && (
            <form
              className="stack panel panel-body"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                pay.mutate();
              }}
            >
              <PaymentChoice method={method} setMethod={setMethod} />
              {method !== "credit" && <MoneyField label={t("sale.amount")} value={amount} onChange={setAmount} currency={currency} />}
              {method === "mpesa" && <TextField label={t("pay.phone")} value={phone} onChange={setPhone} type="tel" placeholder="0712 345 678" />}
              {method === "mpesa_code" && <TextField label={t("pay.code")} value={code} onChange={(v) => setCode(v.toUpperCase())} maxLength={10} placeholder={t("pay.codePlaceholder")} error={fieldErrors(pay.error).code} />}
              <FormError message={pay.error ? errorText(pay.error) : null} />
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button onClick={() => setPaying(false)}>{t("common.cancel")}</Button>
                <Button type="submit" variant="primary" loading={pay.isPending} disabled={method === "credit"}>{t("sale.recordPayment")}</Button>
              </div>
            </form>
          )}
          <p className="small muted row">{t("common.recordedBy")}: <RecordedBy by={s.recorded_by} /></p>
        </div>
      )}
    </SidePanel>
  );
}

/** Add a customer or supplier, or with `party` change their name or phone. */
export function PartyPanel({ kind, party, onClose }: { kind: "customer" | "supplier"; party?: Party; onClose: () => void }) {
  const t = useT();
  const errorText = useErrorText();
  const invalidate = useInvalidateOrg();
  const [name, setName] = useState(party?.name ?? "");
  const [phone, setPhone] = useState(party?.phone ?? "");
  const customer = kind === "customer";
  const save = useMutation({
    mutationFn: () => {
      const body = { name, phone };
      if (party) return customer ? api.sales.updateCustomer(party.id, body) : api.purchases.updateSupplier(party.id, body);
      return customer ? api.sales.createCustomer(body) : api.purchases.createSupplier(body);
    },
    onSuccess: () => (invalidate(), toast(t(party ? "party.updated" : customer ? "cust.saved" : "supp.saved")), onClose()),
  });
  const err = fieldErrors(save.error);
  const title = party ? t("party.editTitle", { name: party.name }) : t(customer ? "cust.new" : "supp.new");
  return (
    <SidePanel title={title} onClose={onClose} onSubmit={() => save.mutate()} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" loading={save.isPending}>{t("common.save")}</Button></>}>
      <div className="stack">
        <TextField label={t("common.name")} value={name} onChange={setName} error={err.name} autoFocus />
        <TextField label={t("common.phone")} value={phone} onChange={setPhone} type="tel" placeholder="0712 345 678" error={err.phone} optional />
        <FormError message={save.error && !Object.keys(err).length ? errorText(save.error) : null} />
      </div>
    </SidePanel>
  );
}

export function PartiesTable({ rows, balanceLabel, onOpen, onEdit }: { rows: Party[]; balanceLabel: string; onOpen?: (p: Party) => void; onEdit?: (p: Party) => void }) {
  const t = useT();
  const columns: Column<Party>[] = [
    { key: "name", header: t("common.name"), render: (c) => <span className="strong">{c.name}</span>, sort: (a, b) => a.name.localeCompare(b.name) },
    { key: "phone", header: t("common.phone"), render: (c) => formatPhone(c.phone) || "–" },
    { key: "bal", header: balanceLabel, numeric: true, render: (c) => (Number(c.balance) > 0 ? <Money value={c.balance} /> : "–"), sort: (a, b) => Number(a.balance) - Number(b.balance) },
    {
      key: "age",
      header: t("cust.oldest"),
      numeric: true,
      render: (c) => (c.oldest_days == null ? "–" : <Chip tone={c.oldest_days > 30 ? "terracotta" : c.oldest_days > 14 ? "amber" : "neutral"}>{t("common.days", { n: c.oldest_days })}</Chip>),
      sort: (a, b) => (a.oldest_days ?? -1) - (b.oldest_days ?? -1),
    },
    ...(onEdit ? [{ key: "edit", header: <span className="visually-hidden">{t("common.edit")}</span>, label: "", render: (c: Party) => <Button variant="quiet" size="sm" icon={<Pencil size={14} />} onClick={(e) => (e.stopPropagation(), onEdit(c))}>{t("common.edit")}</Button> }] : []),
  ];
  return <Table rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={onOpen} />;
}

export function SalesPage() {
  const t = useT();
  const key = useKey();
  const farmId = useFarmId();
  const range = useRange();
  const money = useCan("money.read");
  const canWrite = useCan("sales.write");
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useTabParam(["list", "customers", "owed"] as const, "list");
  const [panel, setPanel] = useState<"new" | "customer" | null>(params.get("new") ? "new" : null);
  const [openSale, setOpenSale] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<Party | null>(null);
  const [editing, setEditing] = useState<Party | null>(null);

  useEffect(() => {
    if (params.get("new")) setParams((p) => (p.delete("new"), p), { replace: true });
  }, [params, setParams]);

  const list = usePaged(key("sales", farmId, range.from, range.to, customerFilter?.id), (cursor) => api.sales.list({ farm_id: farmId, from: range.from, to: range.to, customer_id: customerFilter?.id, cursor }), money && !!farmId && tab === "list");
  const unpaid = usePaged(key("sales", farmId, "unpaid"), (cursor) => api.sales.list({ farm_id: farmId, unpaid: true, cursor }), money && !!farmId && tab === "owed");
  const customers = useQuery({ queryKey: key("customers"), queryFn: api.sales.customers, select: (p) => p.results, enabled: money });
  const owing = useMemo(() => (customers.data ?? []).filter((c) => Number(c.balance) > 0).sort((a, b) => (b.oldest_days ?? 0) - (a.oldest_days ?? 0)), [customers.data]);
  const owedTotal = owing.reduce((s, c) => s + Number(c.balance), 0);
  const currency = useCurrency();

  if (!money) return <NoPermission />;

  return (
    <>
      <PageHead
        title={t("sales.title")}
        actions={canWrite && (
          <>
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setPanel("new")}>{t("sales.new")}</Button>
            {tab === "customers" && <Button onClick={() => setPanel("customer")}>{t("cust.new")}</Button>}
          </>
        )}
      />
      <Tabs
        label={t("sales.title")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "list", label: t("sales.tab.list") },
          { value: "customers", label: t("sales.tab.customers") },
          { value: "owed", label: t("sales.tab.owed") },
        ]}
      />
      {tab === "list" && (
        <div className="stack">
          {customerFilter && (
            <div className="row">
              <Chip tone="neutral">{customerFilter.name}</Chip>
              <Button variant="quiet" size="sm" onClick={() => setCustomerFilter(null)}>{t("common.all")}</Button>
            </div>
          )}
          {list.isLoading ? <SkeletonRows /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
            <SalesTable rows={list.rows} hasNext={!!list.hasNextPage} loadingMore={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} onOpen={(s) => setOpenSale(s.id)} />
          )}
        </div>
      )}
      {tab === "customers" && (customers.isLoading ? <SkeletonRows /> : customers.data?.length ? (
        <PartiesTable rows={customers.data} balanceLabel={t("cust.owes")} onOpen={(c) => (setCustomerFilter(c), setTab("list"))} onEdit={canWrite ? setEditing : undefined} />
      ) : (
        <div className="panel"><EmptyState text={t("cust.empty")} /></div>
      ))}
      {tab === "owed" && (
        <div className="stack-lg">
          {owing.length === 0 ? (
            <div className="panel"><EmptyState text={t("owed.empty")} /></div>
          ) : (
            <>
              <p>{t("owed.summary", { amount: formatMoney(owedTotal, currency), n: owing.length })}</p>
              <PartiesTable rows={owing} balanceLabel={t("cust.owes")} onOpen={(c) => (setCustomerFilter(c), setTab("list"))} />
              <h2>{t("sales.col.owed")}</h2>
              {unpaid.isLoading ? <SkeletonRows /> : <SalesTable rows={unpaid.rows} hasNext={!!unpaid.hasNextPage} loadingMore={unpaid.isFetchingNextPage} onMore={() => unpaid.fetchNextPage()} onOpen={(s) => setOpenSale(s.id)} />}
            </>
          )}
        </div>
      )}
      {panel === "new" && <NewSalePanel onClose={() => setPanel(null)} />}
      {panel === "customer" && <PartyPanel kind="customer" onClose={() => setPanel(null)} />}
      {editing && <PartyPanel kind="customer" party={editing} onClose={() => setEditing(null)} />}
      {openSale && <SaleDetailPanel saleId={openSale} onClose={() => setOpenSale(null)} />}
    </>
  );
}
