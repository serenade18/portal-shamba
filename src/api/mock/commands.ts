/*
 * Mock versions of the backend write commands. Each writes its source record,
 * stock movements and finance entries together, as the real services will.
 */
import type * as T from "../types";
import { ITEM_DEFS, TYPE_ITEMS, TYPE_OUTPUT, typeInfo } from "./catalogue";
import type { TypeCode } from "../types";
import { at, averageCosts, factorFor, type MEnterprise, type MRecorder, type OrgData } from "./db";

const uid = (): string => crypto.randomUUID();
export const itemId = (code: string) => `item_${code}`;

export function ensureItems(data: OrgData, codes: string[]) {
  for (const code of codes) {
    if (data.items.some((i) => i.id === itemId(code))) continue;
    const def = ITEM_DEFS[code];
    if (!def) continue;
    const { code: _code, low, ...rest } = def;
    const producedBy = (Object.entries(TYPE_OUTPUT) as [TypeCode, { item: string }][]).filter(([, o]) => o.item === code).map(([type]) => type);
    data.items.push({ ...rest, id: itemId(code), produced_by: producedBy, low_stock_level: low != null ? String(low) : null });
  }
}

export function item(data: OrgData, id: string): T.Item {
  const found = data.items.find((i) => i.id === id);
  if (!found) throw new Error(`Unknown item ${id}`);
  return found;
}

interface MoveInput {
  farm: string;
  item: string;
  qty: number;
  unit: string;
  enterprise: string | null;
  date: string;
  by: MRecorder;
  hour?: number;
  location?: string;
}

function move(data: OrgData, type: T.MovementType, sign: 1 | -1, m: MoveInput, unitCost: number | null) {
  const it = item(data, m.item);
  const row = {
    id: uid(),
    farm_id: m.farm,
    item_id: m.item,
    enterprise_id: m.enterprise,
    movement_type: type,
    qty_entered: m.qty,
    unit_entered: m.unit,
    qty_base: sign * m.qty * factorFor(it, m.unit),
    unit_cost: unitCost,
    location: m.location ?? (it.kind === "output" ? "Farm store" : "Feed store"),
    reverses_id: null,
    occurred_at: at(m.date, m.hour ?? 8),
    recorded_by: m.by,
  };
  data.movements.push(row);
  return row;
}

export function financeEntry(
  data: OrgData,
  e: { farm: string; enterprise: string | null; kind: "revenue" | "cost"; category: string; amount: number; date: string; note?: string; source: string; sourceId?: string | null; by: MRecorder; internal?: boolean },
) {
  const row = {
    id: uid(),
    farm_id: e.farm,
    enterprise_id: e.enterprise,
    kind: e.kind,
    category: e.category,
    amount: Math.round(e.amount), // whole shillings, like the real ledger
    occurred_on: e.date,
    note: e.note ?? "",
    source_type: e.source,
    source_id: e.sourceId ?? null,
    internal: e.internal ?? false,
    recorded_by: e.by,
  };
  data.finance.push(row);
  return row;
}

/** Inputs used on an enterprise: leaves stock at average cost, cost to the enterprise. */
export function useInput(data: OrgData, m: MoveInput, category = "inputs", source = "stock_use") {
  const { avg } = averageCosts(data, m.item);
  const mv = move(data, "used", -1, m, avg);
  const cost = -mv.qty_base * avg;
  if (cost > 0 && m.enterprise) {
    financeEntry(data, { farm: m.farm, enterprise: m.enterprise, kind: "cost", category, amount: cost, date: m.date, source, sourceId: mv.id, by: m.by });
  }
  return mv;
}

export function produce(data: OrgData, m: MoveInput) {
  return move(data, "produced", 1, m, 0);
}

export function purchase(
  data: OrgData,
  p: { farm: string; supplier: string; date: string; lines: { item: string; qty: number; unit: string; price: number }[]; paid: number | "full"; by: MRecorder },
) {
  data.seq.purchase += 1;
  const total = p.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const row = {
    id: uid(),
    number: data.seq.purchase,
    farm_id: p.farm,
    date: p.date,
    supplier_id: p.supplier,
    lines: p.lines.map((l) => ({ item_id: l.item, qty: l.qty, unit: l.unit, unit_price: l.price })),
    total,
    paid: p.paid === "full" ? total : p.paid,
    recorded_by: p.by,
  };
  data.purchases.push(row);
  for (const l of p.lines) {
    const it = item(data, l.item);
    move(data, "purchased", 1, { farm: p.farm, item: l.item, qty: l.qty, unit: l.unit, enterprise: null, date: p.date, by: p.by, hour: 7 }, l.price / factorFor(it, l.unit));
  }
  return row;
}

export function sell(
  data: OrgData,
  s: { farm: string; customer: string; date: string; lines: { item: string; qty: number; unit: string; price: number; enterprise: string | null }[]; method: T.PaymentMethod; paid: number; by: MRecorder; paymentRequestId?: string | null },
) {
  data.seq.sale += 1;
  const total = s.lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const row = {
    id: uid(),
    number: data.seq.sale,
    farm_id: s.farm,
    date: s.date,
    customer_id: s.customer,
    lines: s.lines.map((l) => ({ item_id: l.item, qty: l.qty, unit: l.unit, unit_price: l.price, enterprise_id: l.enterprise })),
    total,
    paid: s.paid,
    method: s.method,
    payment_request_id: s.paymentRequestId ?? null,
    recorded_by: s.by,
  };
  data.sales.push(row);
  for (const l of s.lines) {
    if (l.item === itemId("live_broilers")) {
      // Birds sold straight from a batch (BAT-06) reduce its count instead of stock.
      const ent = data.enterprises.find((e) => e.id === l.enterprise);
      if (ent) ent.head_count = Math.max(0, (ent.head_count ?? 0) - l.qty);
    } else if (item(data, l.item).kind === "output") {
      move(data, "sold", -1, { farm: s.farm, item: l.item, qty: l.qty, unit: l.unit, enterprise: l.enterprise, date: s.date, by: s.by, hour: 11 }, null);
    }
    financeEntry(data, { farm: s.farm, enterprise: l.enterprise, kind: "revenue", category: "sales", amount: l.qty * l.price, date: s.date, source: "sale", sourceId: row.id, by: s.by });
  }
  return row;
}

export function startEnterprise(
  data: OrgData,
  e: { farm: string; type: T.TypeCode; name: string; date: string; count?: number | null; cost?: number; source?: string; structure?: string | null; plot?: string | null; variety?: string | null; area?: number | null; by: MRecorder },
): MEnterprise {
  const info = typeInfo(e.type);
  ensureItems(data, TYPE_ITEMS[e.type]);
  const row: MEnterprise = {
    id: uid(),
    farm_id: e.farm,
    type: e.type,
    module: info.module,
    name: e.name,
    status: "active",
    started_on: e.date,
    closed_on: null,
    structure_id: e.structure ?? null,
    plot_id: e.plot ?? null,
    head_count: e.count ?? null,
    start_count: e.count ?? null,
    variety: e.variety ?? null,
    area_acres: e.area != null ? String(e.area) : null,
    cost: e.cost ?? null,
    source: e.source ?? "",
  };
  data.enterprises.push(row);
  if (e.cost) {
    financeEntry(data, { farm: e.farm, enterprise: row.id, kind: "cost", category: "acquisition", amount: e.cost, date: e.date, source: "acquisition", sourceId: row.id, by: e.by });
  }
  return row;
}

export function batchDay(
  data: OrgData,
  ent: MEnterprise,
  d: { date: string; feedItem: string | null; feedQty: number; feedUnit: string; deaths: number; eggsTrays: number; note?: string; by: MRecorder; conflict?: boolean },
) {
  const out = TYPE_OUTPUT[ent.type];
  if (d.feedItem && d.feedQty > 0) {
    useInput(data, { farm: ent.farm_id, item: d.feedItem, qty: d.feedQty, unit: d.feedUnit, enterprise: ent.id, date: d.date, by: d.by, hour: 7 }, "feed", "batch_day");
  }
  if (ent.type === "layers" && d.eggsTrays > 0) {
    produce(data, { farm: ent.farm_id, item: itemId("eggs"), qty: d.eggsTrays, unit: "tray", enterprise: ent.id, date: d.date, by: d.by, hour: 17 });
  }
  if (d.deaths > 0) ent.head_count = Math.max(0, (ent.head_count ?? 0) - d.deaths);
  const rec = {
    id: uid(),
    enterprise_id: ent.id,
    date: d.date,
    produced: ent.type === "layers" ? d.eggsTrays : null,
    produced_unit: ent.type === "layers" ? (out?.unit ?? null) : null,
    feed_item_id: d.feedItem,
    feed_qty: d.feedQty,
    feed_unit: d.feedUnit,
    deaths: d.deaths,
    note: d.note ?? "",
    recorded_by: d.by,
    conflict: d.conflict ?? false,
  };
  data.records.push(rec);
  return rec;
}

export function milkDay(data: OrgData, ent: MEnterprise, d: { date: string; litres: number; by: MRecorder }) {
  const out = TYPE_OUTPUT[ent.type] ?? { item: "milk", unit: "l" };
  produce(data, { farm: ent.farm_id, item: itemId(out.item), qty: d.litres, unit: "l", enterprise: ent.id, date: d.date, by: d.by, hour: 18 });
  const rec = {
    id: uid(),
    enterprise_id: ent.id,
    date: d.date,
    produced: d.litres,
    produced_unit: "l",
    feed_item_id: null,
    feed_qty: null,
    feed_unit: null,
    deaths: null,
    note: "",
    recorded_by: d.by,
    conflict: false,
  };
  data.records.push(rec);
  return rec;
}

export function feedDay(data: OrgData, ent: MEnterprise, d: { date: string; item: string; qty: number; unit: string; by: MRecorder }) {
  useInput(data, { farm: ent.farm_id, item: d.item, qty: d.qty, unit: d.unit, enterprise: ent.id, date: d.date, by: d.by, hour: 7 }, "feed", "feeding");
  const existing = data.records.find((r) => r.enterprise_id === ent.id && r.date === d.date);
  if (existing) {
    existing.feed_item_id = d.item;
    existing.feed_qty = (existing.feed_qty ?? 0) + d.qty;
    existing.feed_unit = d.unit;
    return existing;
  }
  const rec = {
    id: uid(),
    enterprise_id: ent.id,
    date: d.date,
    produced: null,
    produced_unit: null,
    feed_item_id: d.item,
    feed_qty: d.qty,
    feed_unit: d.unit,
    deaths: null,
    note: "",
    recorded_by: d.by,
    conflict: false,
  };
  data.records.push(rec);
  return rec;
}

export function treatment(
  data: OrgData,
  ent: MEnterprise,
  t: { date: string; item: string; qty: number; unit: string; dose: string; subject: string; scheduleDay?: number | null; by: MRecorder },
) {
  const mv = useInput(data, { farm: ent.farm_id, item: t.item, qty: t.qty, unit: t.unit, enterprise: ent.id, date: t.date, by: t.by }, "health", "treatment");
  const rec = {
    id: uid(),
    enterprise_id: ent.id,
    date: t.date,
    product: item(data, t.item).name.en,
    dose_note: t.dose,
    subject: t.subject,
    cost: -mv.qty_base * (mv.unit_cost ?? 0),
    schedule_day: t.scheduleDay ?? null,
    recorded_by: t.by,
  };
  data.health.push(rec);
  return rec;
}

export function activity(
  data: OrgData,
  ent: MEnterprise,
  a: { date: string; type: T.ActivityType; inputs: { item: string; qty: number; unit: string }[]; labour: number; service: number; note?: string; by: MRecorder },
) {
  for (const i of a.inputs) {
    useInput(data, { farm: ent.farm_id, item: i.item, qty: i.qty, unit: i.unit, enterprise: ent.id, date: a.date, by: a.by }, "inputs", "activity");
  }
  if (a.labour > 0) financeEntry(data, { farm: ent.farm_id, enterprise: ent.id, kind: "cost", category: "labour", amount: a.labour, date: a.date, source: "activity", by: a.by });
  if (a.service > 0) financeEntry(data, { farm: ent.farm_id, enterprise: ent.id, kind: "cost", category: "services", amount: a.service, date: a.date, source: "activity", by: a.by });
  const rec = {
    id: uid(),
    enterprise_id: ent.id,
    date: a.date,
    type: a.type,
    inputs: a.inputs.map((i) => ({ item_id: i.item, qty: i.qty, unit: i.unit })),
    labour_cost: a.labour,
    service_cost: a.service,
    note: a.note ?? "",
    recorded_by: a.by,
  };
  data.activities.push(rec);
  return rec;
}

export function harvest(data: OrgData, ent: MEnterprise, h: { date: string; qty: number; unit: string; moisture: "green" | "dry"; by: MRecorder }) {
  const out = TYPE_OUTPUT[ent.type];
  if (out) produce(data, { farm: ent.farm_id, item: itemId(out.item), qty: h.qty, unit: h.unit, enterprise: ent.id, date: h.date, by: h.by, hour: 16 });
  const rec = { id: uid(), enterprise_id: ent.id, ...h, recorded_by: h.by };
  data.harvests.push(rec);
  return rec;
}

/** INV-04: corrections by reversal, never by editing. */
export function reverse(data: OrgData, movementId: string, by: MRecorder) {
  const orig = data.movements.find((m) => m.id === movementId);
  if (!orig) return null;
  const row = {
    ...orig,
    id: uid(),
    movement_type: "reversal" as const,
    qty_base: -orig.qty_base,
    reverses_id: orig.id,
    occurred_at: new Date().toISOString(),
    recorded_by: by,
  };
  data.movements.push(row);
  for (const f of data.finance.filter((f) => f.source_id === orig.id)) {
    financeEntry(data, { farm: f.farm_id, enterprise: f.enterprise_id, kind: f.kind, category: f.category, amount: -f.amount, date: row.occurred_at.slice(0, 10), note: "Reversal", source: "reversal", sourceId: row.id, by });
  }
  return row;
}

export function countAdjust(data: OrgData, farm: string, itemIdValue: string, diffBase: number, date: string, by: MRecorder) {
  const { avg } = averageCosts(data, itemIdValue);
  const it = item(data, itemIdValue);
  const row = {
    id: uid(),
    farm_id: farm,
    item_id: itemIdValue,
    enterprise_id: null,
    movement_type: "count_adjustment" as const,
    qty_entered: Math.abs(diffBase),
    unit_entered: it.base_unit,
    qty_base: diffBase,
    unit_cost: avg,
    location: it.kind === "output" ? "Farm store" : "Feed store",
    reverses_id: null,
    occurred_at: at(date, 19),
    recorded_by: by,
  };
  data.movements.push(row);
  if (diffBase < 0 && avg > 0) {
    financeEntry(data, { farm, enterprise: null, kind: "cost", category: "stock_loss", amount: -diffBase * avg, date, source: "stock_count", sourceId: row.id, by });
  }
  return row;
}

export function transfer(
  data: OrgData,
  t: { farm: string; item: string; qty: number; unit: string; from: string | null; to: string; price: number; date: string; by: MRecorder },
) {
  const it = item(data, t.item);
  const perBase = t.price / factorFor(it, t.unit);
  move(data, "transferred_out", -1, { farm: t.farm, item: t.item, qty: t.qty, unit: t.unit, enterprise: t.from, date: t.date, by: t.by }, perBase);
  move(data, "transferred_in", 1, { farm: t.farm, item: t.item, qty: t.qty, unit: t.unit, enterprise: t.to, date: t.date, by: t.by }, perBase);
  const amount = t.qty * t.price;
  if (amount > 0) {
    if (t.from) financeEntry(data, { farm: t.farm, enterprise: t.from, kind: "revenue", category: "transfer", amount, date: t.date, source: "transfer", by: t.by, internal: true });
    financeEntry(data, { farm: t.farm, enterprise: t.to, kind: "cost", category: "transfer", amount, date: t.date, source: "transfer", by: t.by, internal: true });
  }
}
