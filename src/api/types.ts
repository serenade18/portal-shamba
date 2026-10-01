/*
 * API shapes. The identity, tenancy and payments types mirror the Django
 * serializers that exist today; once the backend is running, `npm run gen:api`
 * writes the generated equivalents to schema.d.ts. The rest follow
 * backend-architecture.md sections 6 to 15 and are served by the mock until
 * the backend ships them. Decimals arrive as strings (API conventions).
 */

export type Locale = "en" | "sw";
export type Role = "owner" | "manager" | "field_worker";
export type Capability =
  | "records.write"
  | "stock.read"
  | "stock.write"
  | "money.read"
  | "sales.write"
  | "procurement.write"
  | "finance.write"
  | "members.read"
  | "members.manage"
  | "org.settings"
  | "billing";

export interface ApiErrorBody {
  code: string;
  message: string;
  params: Record<string, unknown>;
  fields: Record<string, string[]>;
}

export interface Page<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ---------- Identity and tenancy (implemented) ---------- */

export interface User {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  username: string | null;
  preferred_locale: Locale;
  date_joined: string;
}

export interface MembershipSummary {
  organisation_id: string;
  organisation_name: string;
  currency: string;
  role: Role;
  capabilities: Capability[];
  epoch: number;
}

export interface SignInResponse {
  access: string;
  refresh: string;
  is_new_user: boolean;
  device_id: string;
  user: User;
  memberships: MembershipSummary[];
}

export interface RegisterInput {
  name: string;
  email: string;
  username: string;
  phone: string;
  password: string;
  locale: Locale;
}

export type StaffRegisterInput = Omit<RegisterInput, "username">;

export interface Organisation {
  id: string;
  name: string;
  country: string;
  currency: string;
  default_locale: Locale;
  created_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  removed_at: string | null;
}

export interface Invitation {
  id: string;
  phone: string;
  role: Role;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface MyInvitation {
  id: string;
  organisation_id: string;
  organisation_name: string;
  invited_by_name: string | null;
  role: Role;
  expires_at: string;
}

export type PaymentStatus = "pending" | "awaiting_otp" | "succeeded" | "failed" | "expired";

export interface PaymentRequest {
  id: string;
  provider: string;
  network: string;
  phone: string;
  amount: string;
  currency: string;
  reference: string;
  description: string;
  status: PaymentStatus;
  subject_type: string;
  subject_id: string | null;
  transaction_code: string;
  amount_paid: string | null;
  payer_phone: string;
  channel: string;
  failure_reason: string;
  completed_at: string | null;
  created_at: string;
}

/* ---------- Catalogue and onboarding (planned) ---------- */

export type Module = "livestock" | "batches" | "crops";
export type TrackingMode = "individual" | "batch" | "crop_season";
export type TypeCode =
  | "dairy_cattle"
  | "beef_cattle"
  | "dairy_goats"
  | "sheep"
  | "layers"
  | "broilers"
  | "fish"
  | "maize"
  | "beans"
  | "rice"
  | "wheat";

export interface EnterpriseType {
  code: TypeCode;
  module: Module;
  tracking_mode: TrackingMode;
  icon: string;
  labels: Record<Locale, string>;
}

export interface ComingSoonType {
  code: string;
  labels: Record<Locale, string>;
}

export interface Catalogue {
  version: number;
  enterprise_types: EnterpriseType[];
  coming_soon: ComingSoonType[];
}

export interface Navigation {
  farm_id: string;
  modules: Module[];
  types: TypeCode[];
  setup_complete: boolean;
}

export interface OnboardingInput {
  farm_id: string;
  picks: TypeCode[];
  coming_soon: string[];
  other_text: string;
  counts: Partial<Record<TypeCode, number>>;
}

/* ---------- Farms (planned) ---------- */

/** GeoJSON Polygon: one closed ring of [lng, lat]. */
export interface Boundary {
  type: "Polygon";
  coordinates: [number, number][][];
}

/** Whether the farm's boundary is registered with the OpenWeather Agro API. */
export interface WeatherSync {
  status: "none" | "pending" | "registered" | "failed" | "skipped";
  /** Under 1 ha: registered grown to the API's 1 ha minimum. */
  scaled: boolean;
}

export interface Farm {
  id: string;
  name: string;
  county: string;
  location: { lat: number; lng: number } | null;
  /** The farm's drawn edge, if the farmer has drawn it. */
  boundary?: Boundary | null;
  area_ha?: string | null;
  weather_sync?: WeatherSync;
  setup_complete: boolean;
  created_at: string;
}

export type Tenure = "owned" | "leased" | "family";

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  area_acres: string;
  tenure: Tenure;
  lease_cost: string | null;
  growing_now: string | null;
}

export type StructureType = "shed" | "poultry_house" | "pen" | "pond" | "store";

export interface Structure {
  id: string;
  farm_id: string;
  name: string;
  type: StructureType;
  capacity: number | null;
}

export interface PlotSeasonHistory {
  enterprise_id: string;
  name: string;
  crop: TypeCode;
  started_on: string;
  closed_on: string | null;
  yield_per_acre: string | null;
  yield_unit: string;
  profit: string | null;
}

/* ---------- Enterprises (planned) ---------- */

export type EnterpriseStatus = "active" | "closed";

export interface Enterprise {
  id: string;
  farm_id: string;
  type: TypeCode;
  module: Module;
  name: string;
  status: EnterpriseStatus;
  started_on: string;
  closed_on: string | null;
  structure_id: string | null;
  plot_id: string | null;
  /** Module-specific headline facts, e.g. current count for a batch. */
  head_count: number | null;
  start_count: number | null;
  variety: string | null;
  area_acres: string | null;
}

export interface Kpi {
  code: string;
  value: string;
  unit: string;
  money?: boolean;
}

export interface EnterpriseDetail extends Enterprise {
  kpis: Kpi[];
  structure_name: string | null;
  plot_name: string | null;
}

export interface Recorder {
  name: string;
  device: "phone" | "web";
  synced_at: string | null;
}

export interface DailyRecord {
  id: string;
  date: string;
  /** eggs (trays), milk (litres), harvest (kg) depending on the type */
  produced: string | null;
  produced_unit: string | null;
  feed_qty: string | null;
  feed_unit: string | null;
  deaths: number | null;
  note: string;
  recorded_by: Recorder;
  conflict: boolean;
}

export interface HealthRecord {
  id: string;
  date: string;
  product: string;
  dose_note: string;
  subject: string;
  cost: string | null;
  recorded_by: Recorder;
}

export type ActivityType = "land_preparation" | "planting" | "weeding" | "spraying" | "fertilising" | "other";

export interface Activity {
  id: string;
  date: string;
  type: ActivityType;
  inputs: { item_name: string; qty: string; unit: string }[];
  labour_cost: string | null;
  service_cost: string | null;
  note: string;
  recorded_by: Recorder;
}

export interface Harvest {
  id: string;
  date: string;
  qty: string;
  unit: string;
  moisture: "green" | "dry";
  recorded_by: Recorder;
}

export type Sex = "female" | "male";
export type AnimalStatus = "active" | "sold" | "dead";

export interface Animal {
  id: string;
  enterprise_id: string;
  tag: string;
  name: string;
  sex: Sex;
  breed: string;
  birth_date: string | null;
  source: "born" | "bought";
  cost: string | null;
  status: AnimalStatus;
  mother_id: string | null;
  milk_7d: string | null;
}

export interface CloseSummary {
  enterprise_id: string;
  cost: string;
  revenue: string;
  profit: string;
  ratios: Kpi[];
}

/* ---------- Stock (planned) ---------- */

export interface UnitOption {
  code: string;
  factor: number; // how many base units in one of this unit
}

export type ItemCategory = "produce" | "feed" | "drug" | "seed" | "fertiliser" | "chemical";

export interface Item {
  id: string;
  name: Record<Locale, string>;
  kind: "input" | "output";
  category: ItemCategory;
  /** Enterprise types that produce this item; a sale line defaults to one of them. */
  produced_by: TypeCode[];
  base_unit: string;
  display_unit: string;
  units: UnitOption[];
  low_stock_level: string | null;
}

export interface StockBalance {
  item_id: string;
  item_name: Record<Locale, string>;
  location: string;
  enterprise_id: string | null;
  enterprise_name: string | null;
  qty_base: string;
  base_unit: string;
  display_unit: string;
  display_factor: number;
  value: string | null;
  low_stock_level: string | null;
  status: "ok" | "low" | "negative";
}

export type MovementType =
  | "purchased"
  | "used"
  | "produced"
  | "sold"
  | "lost"
  | "transferred_in"
  | "transferred_out"
  | "count_adjustment"
  | "opening"
  | "reversal";

export interface StockMovement {
  id: string;
  item_id: string;
  item_name: Record<Locale, string>;
  movement_type: MovementType;
  qty_entered: string;
  unit_entered: string;
  qty_base: string;
  base_unit: string;
  unit_cost: string | null;
  total_cost: string | null;
  enterprise_name: string | null;
  reverses_id: string | null;
  reversed_by_id: string | null;
  occurred_at: string;
  recorded_by: Recorder;
}

/* ---------- Sales and procurement (planned) ---------- */

export interface Party {
  id: string;
  name: string;
  phone: string;
  balance: string | null;
  oldest_days: number | null;
}

export type PaymentMethod = "mpesa" | "mpesa_code" | "cash" | "credit";
export type SaleStatus = "paid" | "partial" | "credit" | "awaiting_payment";

export interface SaleLine {
  item_id: string;
  item_name: Record<Locale, string>;
  qty: string;
  unit: string;
  unit_price: string;
  enterprise_id: string | null;
  enterprise_name: string | null;
}

export interface Sale {
  id: string;
  number: string;
  date: string;
  customer_id: string;
  customer_name: string;
  lines: SaleLine[];
  total: string;
  paid: string;
  balance_due: string;
  status: SaleStatus;
  method: PaymentMethod;
  payment_request: PaymentRequest | null;
  recorded_by: Recorder;
}

export interface NewSaleInput {
  id?: string;
  farm_id: string;
  customer_id: string;
  date: string;
  lines: { item_id: string; qty: string; unit: string; unit_price: string; enterprise_id: string | null }[];
  payment: { method: PaymentMethod; phone?: string; network?: string; code?: string };
}

export interface Purchase {
  id: string;
  number: string;
  date: string;
  supplier_id: string;
  supplier_name: string;
  lines: { item_id: string; item_name: Record<Locale, string>; qty: string; unit: string; unit_price: string }[];
  total: string;
  paid: string;
  balance_due: string;
  status: "paid" | "partial" | "credit";
  recorded_by: Recorder;
}

export interface NewPurchaseInput {
  farm_id: string;
  supplier_id: string;
  date: string;
  lines: { item_id: string; qty: string; unit: string; unit_price: string }[];
  paid: "full" | "credit";
}

/* ---------- Finance and reports (planned) ---------- */

export interface FinanceEntry {
  id: string;
  kind: "revenue" | "cost";
  category: string;
  amount: string;
  occurred_on: string;
  enterprise_id: string | null;
  enterprise_name: string | null;
  note: string;
  source_type: string;
  recorded_by: Recorder;
}

export interface EnterpriseProfit {
  enterprise_id: string | null;
  name: string;
  type: TypeCode | null;
  status: EnterpriseStatus;
  revenue: string;
  cost: string;
  profit: string;
}

export interface ProfitReport {
  from: string;
  to: string;
  revenue: string;
  cost: string;
  profit: string;
  previous_profit: string;
  enterprises: EnterpriseProfit[];
  monthly: { month: string; revenue: string; cost: string; profit: string }[];
}

export interface CostPerUnit {
  enterprise_id: string;
  name: string;
  produced_qty: string;
  unit: string;
  cost: string;
  cost_per_unit: string | null;
}

/* ---------- Weather, alerts, dashboard (planned) ---------- */

export interface ForecastDay {
  date: string;
  rain_mm: number;
  rain_probability: number;
  t_min: number;
  t_max: number;
  condition: "sunny" | "cloudy" | "light_rain" | "rain" | "heavy_rain";
}

export interface Weather {
  farm_id: string;
  fetched_at: string;
  forecast: ForecastDay[];
  history: ForecastDay[];
}

export type AlertType =
  | "low_stock"
  | "negative_stock"
  | "mortality_spike"
  | "vaccination_due"
  | "heavy_rain"
  | "overdue_debt"
  | "sync_conflict";

export interface Alert {
  id: string;
  type: AlertType;
  severity: "critical" | "warning" | "info";
  farm_id: string;
  subject_type: "item" | "enterprise" | "customer" | "farm";
  subject_id: string;
  params: Record<string, string | number>;
  status: "open" | "seen" | "resolved";
  money: boolean;
  created_at: string;
}

export interface TodayRecord {
  enterprise_id: string;
  name: string;
  type: TypeCode;
  recorded: boolean;
  summary: { code: string; value: string; unit: string }[];
}

export interface Dashboard {
  farm_id: string;
  from: string;
  to: string;
  profit: ProfitReport | null; // null without money.read
  receivables: { total: string; customers: number; oldest_days: number | null; oldest_customer: string | null } | null;
  alerts: Alert[];
  today: TodayRecord[];
  stock: StockBalance[];
}

/* ---------- Staff admin (GET /staff/analytics) ---------- */

export type AnalyticsDays = 7 | 30 | 90;

/** A farmer as staff see them: their first farm account and latest device. */
export interface StaffFarmer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  username: string | null;
  date_joined: string;
  organisation: string | null;
  role: Role | null;
  platform: "android" | "ios" | "web" | null;
  last_seen_at: string | null;
  is_active: boolean;
}

/**
 * Land under a set of farms, in acres. A farm with a drawn boundary counts its
 * measured area; one without counts the plot sizes its farmer entered; one with
 * neither counts nothing (`unknown_farms`).
 */
export interface StaffLand {
  acres: string;
  hectares: string;
  mapped_acres: string;
  mapped_farms: number;
  declared_acres: string;
  declared_farms: number;
  unknown_farms: number;
  farms: number;
}

/** One farmer in full (GET /staff/farmers/{id}). */
export interface StaffFarmerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  username: string | null;
  preferred_locale: Locale;
  is_active: boolean;
  date_joined: string;
  last_seen_at: string | null;
  /** In the accounts they still belong to. */
  land: StaffLand;
  accounts: {
    id: string;
    name: string;
    country: string;
    currency: string;
    is_active: boolean;
    role: Role;
    membership_active: boolean;
    joined_at: string;
    removed_at: string | null;
    members: number;
    farms: (Farm & { plots_acres: string | null; types: string[]; enterprises: Partial<Record<"livestock" | "batches" | "crops", number>> })[];
    payments: { requests: number; succeeded: number; collected: string };
  }[];
  devices: { id: string; platform: "android" | "ios" | "web"; name: string; app_version: string; created_at: string; last_seen_at: string; revoked: boolean }[];
  activity: { action: string; entity: string; occurred_at: string; organisation: string | null }[];
}

/** One farm on the staff map (GET /staff/farms?country=). */
export interface StaffMapFarm {
  id: string;
  name: string;
  county: string;
  location: { lat: number; lng: number } | null;
  boundary?: Boundary | null;
  area_ha?: string | null;
  weather_sync?: WeatherSync;
  setup_complete: boolean;
  created_at: string;
  organisation: { id: string; name: string };
  owner: { name: string; phone: string } | null;
}

export interface StaffMapFarms {
  country: string;
  farms: StaffMapFarm[];
  /** More farms exist than the map was sent. */
  truncated: boolean;
}

export interface StaffAnalytics {
  days: AnalyticsDays;
  from: string;
  to: string;
  generated_at: string;
  currency: string;
  totals: {
    farmers: { total: number; new: number; previous_new: number };
    organisations: { total: number; new: number; previous_new: number };
    active_farmers: { count: number; previous: number };
    payments: { collected: string; previous_collected: string; requests: number; succeeded: number; success_rate: number | null };
    pending_invitations: number;
    land: StaffLand;
  };
  daily: { date: string; signups: number; organisations: number; active_farmers: number; collected: string }[];
  funnel: { step: "signed_up" | "farm_account" | "added_member" | "requested_payment"; count: number }[];
  platforms: { platform: "android" | "ios" | "web"; devices: number; farmers: number }[];
  languages: { locale: Locale; farmers: number }[];
  roles: { role: Role; members: number }[];
  payment_statuses: { status: "pending" | "awaiting_otp" | "succeeded" | "failed" | "expired"; count: number }[];
  /** Farm accounts per country (ISO alpha-2), most first. */
  countries: { country: string; organisations: number; farmers: number; farms: number }[];
  recent_signups: StaffFarmer[];
  top_organisations: { id: string; name: string; created_at: string; members: number; owner: string | null; collected: string }[];
}

/* ---------- Integration keys (GET /staff/keys, super admins only) ---------- */

export type KeyGroup = "sms" | "email" | "mpesa" | "sasapay" | "weather" | "maps" | "staff";
export type KeyName =
  | "SMS_API_KEY" | "SMS_CLIENT_ID" | "SMS_ACCESS_KEY" | "SMS_SENDER_ID"
  | "RESEND_API_KEY"
  | "MPESA_ENV" | "MPESA_CONSUMER_KEY" | "MPESA_CONSUMER_SECRET" | "MPESA_SHORTCODE" | "MPESA_PASSKEY" | "MPESA_CALLBACK_URL"
  | "SASAPAY_ENV" | "SASAPAY_CLIENT_ID" | "SASAPAY_CLIENT_SECRET" | "SASAPAY_MERCHANT_CODE"
  | "OPENWEATHER_API_KEY" | "AGRO_MONITORING_API_KEY"
  | "CESIUM_ION_TOKEN"
  | "STAFF_SIGNUP_KEY";

/** One integration key. Secret values never leave the server: `preview` shows only their last characters. */
export interface ManagedKey {
  name: KeyName;
  group: KeyGroup;
  /** English, from the server; the portal shows its own translation. */
  label: string;
  kind: "secret" | "text" | "choice";
  choices: string[];
  help: string;
  /** Handed to browsers (GET /config/public). */
  public: boolean;
  /** "admin": saved here, overriding the server's environment. */
  source: "admin" | "environment" | "unset";
  has_environment_value: boolean;
  preview: string;
  updated_at: string | null;
  updated_by: string | null;
}

/** GET /config/public: keys that are safe in any browser. */
export interface PublicConfig {
  cesium_ion_token: string;
}
