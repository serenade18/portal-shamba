/*
 * In-browser stand-in for the parts of the backend that are not built yet.
 * It follows backend-architecture.md: an append-only stock ledger, finance
 * entries written alongside every source record, profit as a sum of entries.
 * Delete this folder once the backend serves every route.
 */
import type * as T from "../types";

export interface MUser extends T.User {}
export interface MOrg extends T.Organisation {
  payment_mode: "request" | "manual";
}
export interface MMembership {
  id: string;
  user_id: string;
  org_id: string;
  role: T.Role;
  is_active: boolean;
  epoch: number;
  created_at: string;
  removed_at: string | null;
}
export interface MInvitation extends T.Invitation {
  org_id: string;
  invited_by: string;
}

export interface MRecorder {
  user_id: string;
  device: "phone" | "web";
  synced_at: string | null;
}

export interface MEnterprise extends T.Enterprise {
  cost: number | null; // acquisition cost
  source: string;
}

export interface MAnimal extends T.Animal {}

export interface MRecord {
  id: string;
  enterprise_id: string;
  date: string;
  produced: number | null;
  produced_unit: string | null;
  feed_item_id: string | null;
  feed_qty: number | null;
  feed_unit: string | null;
  deaths: number | null;
  note: string;
  recorded_by: MRecorder;
  conflict: boolean;
}

export interface MHealth {
  id: string;
  enterprise_id: string;
  date: string;
  product: string;
  dose_note: string;
  subject: string;
  cost: number | null;
  recorded_by: MRecorder;
}

export interface MActivity {
  id: string;
  enterprise_id: string;
  date: string;
  type: T.ActivityType;
  inputs: { item_id: string; qty: number; unit: string }[];
  labour_cost: number;
  service_cost: number;
  note: string;
  recorded_by: MRecorder;
}

export interface MHarvest {
  id: string;
  enterprise_id: string;
  date: string;
  qty: number;
  unit: string;
  moisture: "green" | "dry";
  recorded_by: MRecorder;
}

export interface MMovement {
  id: string;
  farm_id: string;
  item_id: string;
  enterprise_id: string | null;
  movement_type: T.MovementType;
  qty_entered: number;
  unit_entered: string;
  qty_base: number; // signed
  unit_cost: number | null; // per base unit
  location: string;
  reverses_id: string | null;
  occurred_at: string;
  recorded_by: MRecorder;
}

export interface MFinance {
  id: string;
  farm_id: string;
  enterprise_id: string | null;
  kind: "revenue" | "cost";
  category: string;
  amount: number;
  occurred_on: string;
  note: string;
  source_type: string;
  source_id: string | null;
  internal: boolean;
  recorded_by: MRecorder;
}

export interface MParty {
  id: string;
  name: string;
  phone: string;
}

export interface MSale {
  id: string;
  number: number;
  farm_id: string;
  date: string;
  customer_id: string;
  lines: { item_id: string; qty: number; unit: string; unit_price: number; enterprise_id: string | null }[];
  total: number;
  paid: number;
  method: T.PaymentMethod;
  payment_request_id: string | null;
  recorded_by: MRecorder;
}

export interface MPurchase {
  id: string;
  number: number;
  farm_id: string;
  date: string;
  supplier_id: string;
  lines: { item_id: string; qty: number; unit: string; unit_price: number }[];
  total: number;
  paid: number;
  recorded_by: MRecorder;
}

export interface OrgData {
  farms: T.Farm[];
  picks: Record<string, T.TypeCode[]>;
  interest: { farm_id: string; coming_soon: string[]; other_text: string }[];
  plots: T.Plot[];
  structures: T.Structure[];
  enterprises: MEnterprise[];
  animals: MAnimal[];
  records: MRecord[];
  health: MHealth[];
  activities: MActivity[];
  harvests: MHarvest[];
  items: T.Item[];
  movements: MMovement[];
  finance: MFinance[];
  customers: MParty[];
  suppliers: MParty[];
  sales: MSale[];
  purchases: MPurchase[];
  payments: T.PaymentRequest[];
  alertsSeen: string[];
  seq: { sale: number; purchase: number };
}

export interface MockDb {
  version: number;
  users: MUser[];
  orgs: MOrg[];
  memberships: MMembership[];
  invitations: MInvitation[];
  data: Record<string, OrgData>;
}

const KEY = "shamba-mock-db";
const VERSION = 4;

let db: MockDb | null = null;

export function getDb(seed: () => MockDb): MockDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === VERSION) db = parsed;
    }
  } catch {
    /* fall through to seed */
  }
  if (!db) {
    db = seed();
    db.version = VERSION;
    save();
  }
  return db;
}

export function save() {
  try {
    if (db) localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export function resetMockDb() {
  localStorage.removeItem(KEY);
  db = null;
}

export function emptyOrgData(): OrgData {
  return {
    farms: [],
    picks: {},
    interest: [],
    plots: [],
    structures: [],
    enterprises: [],
    animals: [],
    records: [],
    health: [],
    activities: [],
    harvests: [],
    items: [],
    movements: [],
    finance: [],
    customers: [],
    suppliers: [],
    sales: [],
    purchases: [],
    payments: [],
    alertsSeen: [],
    seq: { sale: 0, purchase: 0 },
  };
}

/* ---------- Dates ---------- */

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
}

export function at(date: string, hour = 8): string {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
}

export const money = (n: number) => n.toFixed(2);
export const qty = (n: number) => String(Math.round(n * 1000) / 1000);

/* ---------- Units ---------- */

export function factorFor(item: T.Item, unit: string): number {
  return item.units.find((u) => u.code === unit)?.factor ?? 1;
}

/* ---------- Ledger ---------- */

/**
 * Moving weighted average cost per item (INV-08), walked in time order. Returns
 * the average before each movement so consumption can be costed at occurred_at.
 */
export function averageCosts(data: OrgData, itemId: string): { avg: number; qty: number } {
  let q = 0;
  let avg = 0;
  const moves = data.movements.filter((m) => m.item_id === itemId).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  for (const m of moves) {
    if (m.qty_base > 0 && m.unit_cost != null && (m.movement_type === "purchased" || m.movement_type === "transferred_in" || m.movement_type === "opening")) {
      const held = Math.max(q, 0);
      avg = (held * avg + m.qty_base * m.unit_cost) / (held + m.qty_base);
      q += m.qty_base;
    } else {
      q += m.qty_base;
    }
  }
  return { avg, qty: q };
}

export interface Balance {
  item: T.Item;
  qty: number;
  avg: number;
  location: string;
}

export function balances(data: OrgData, farmId: string): Balance[] {
  return data.items.map((item) => {
    const moves = data.movements.filter((m) => m.item_id === item.id && m.farm_id === farmId);
    const q = moves.reduce((s, m) => s + m.qty_base, 0);
    const { avg } = averageCosts(data, item.id);
    return { item, qty: q, avg, location: moves[moves.length - 1]?.location ?? "Store" };
  });
}

export function balanceOf(data: OrgData, farmId: string, itemId: string): number {
  return data.movements.filter((m) => m.item_id === itemId && m.farm_id === farmId).reduce((s, m) => s + m.qty_base, 0);
}

/* ---------- Finance ---------- */

export function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

export function entriesFor(data: OrgData, farmId: string, from: string, to: string) {
  return data.finance.filter((f) => f.farm_id === farmId && inRange(f.occurred_on, from, to));
}

export function sumBy(entries: MFinance[], kind: "revenue" | "cost", includeInternal = false) {
  return entries.filter((e) => e.kind === kind && (includeInternal || !e.internal)).reduce((s, e) => s + e.amount, 0);
}
