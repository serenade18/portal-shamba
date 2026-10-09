import { api, http } from "./client";
import type * as T from "./types";

type Q = Record<string, string | number | boolean | null | undefined>;

const device = (installId: string) => ({ install_id: installId, platform: "web", app_version: "portal-0.1", name: navigator.userAgent.slice(0, 100) });

export const auth = {
  /** The portal signs in with email or username and a password; the Flutter app keeps phone codes. */
  login: (identifier: string, password: string, installId: string) =>
    http.post<T.SignInResponse>("/auth/login", { identifier, password, device: device(installId) }, { auth: false, org: false }),
  register: (body: T.RegisterInput, installId: string) =>
    http.post<T.SignInResponse>("/auth/register", { ...body, device: device(installId) }, { auth: false, org: false }),
  forgotPassword: (email: string, locale: T.Locale) =>
    http.post<void>("/auth/password/forgot", { email, locale }, { auth: false, org: false }),
  resetPassword: (uid: string, token: string, password: string) =>
    http.post<void>("/auth/password/reset", { uid, token, password }, { auth: false, org: false }),
  logout: (refresh: string | null) => http.post<void>("/auth/logout", { refresh: refresh ?? "" }, { org: false }),
};

export const me = {
  get: () => http.get<T.User>("/me", undefined, { org: false }),
  update: (body: Partial<Pick<T.User, "name" | "preferred_locale" | "phone" | "email">>) => http.patch<T.User>("/me", body, { org: false }),
  organisations: () =>
    http.get<{ memberships: T.MembershipSummary[]; invitations: T.MyInvitation[] }>("/me/organisations", undefined, { org: false }),
  acceptInvitation: (id: string) =>
    http.post<{ memberships: T.MembershipSummary[] }>(`/me/invitations/${id}/accept`, undefined, { org: false }),
  /** Everything kept about the signed-in person, as JSON (NFR-11). */
  exportData: () => http.get<Record<string, unknown>>("/me/export", undefined, { org: false }),
  /** Erases the account. Refused (409 account.last_owner) while they are the last owner of a farm account others use. */
  deleteAccount: () => api<void>("DELETE", "/me", { body: { confirm: true }, org: false }),
  changePassword: (body: { current_password: string; new_password: string }) => http.post<void>("/me/password", body, { org: false }),
};

export const org = {
  get: () => http.get<T.Organisation>("/organisation"),
  update: (body: Partial<Pick<T.Organisation, "name" | "currency" | "default_locale">>) =>
    http.patch<T.Organisation>("/organisation", body),
  members: () => http.get<T.Page<T.Member>>("/members"),
  changeRole: (id: string, role: T.Role) => http.patch<T.Member>(`/members/${id}`, { role }),
  removeMember: (id: string) => http.del(`/members/${id}`),
  invitations: () => http.get<T.Page<T.Invitation>>("/invitations"),
  invite: (phone: string, role: T.Role) => http.post<T.Invitation>("/invitations", { phone, role }),
  revokeInvitation: (id: string) => http.del(`/invitations/${id}`),
};

export const payments = {
  get: (id: string) => http.get<T.PaymentRequest>(`/payments/requests/${id}`),
  submitOtp: (id: string, code: string) => http.post<T.PaymentRequest>(`/payments/requests/${id}/otp`, { code }),
};

export const catalogue = {
  get: () => http.get<T.Catalogue>("/catalogue", undefined, { org: false }),
};

export const farms = {
  list: () => http.get<T.Page<T.Farm>>("/farms"),
  create: (body: { name: string; county: string; location: T.Farm["location"]; boundary?: T.Boundary | null }) => http.post<T.Farm>("/farms", body),
  update: (id: string, body: Partial<Pick<T.Farm, "name" | "county" | "location" | "boundary">>) => http.patch<T.Farm>(`/farms/${id}`, body),
  navigation: (farmId: string) => http.get<T.Navigation>("/navigation", { farm_id: farmId }),
  onboard: (body: T.OnboardingInput) => http.post<T.Navigation>("/onboarding", body),
  setTypes: (farmId: string, picks: T.TypeCode[]) => http.post<T.Navigation>(`/farms/${farmId}/types`, { picks }),
  plots: (farmId: string) => http.get<T.Page<T.Plot>>("/plots", { farm_id: farmId }),
  createPlot: (body: Omit<T.Plot, "id" | "growing_now">) => http.post<T.Plot>("/plots", body),
  updatePlot: (id: string, body: Partial<Pick<T.Plot, "name" | "area_acres" | "tenure" | "lease_cost">>) =>
    http.patch<T.Plot & T.Edited>(`/plots/${id}`, body),
  plotHistory: (plotId: string) => http.get<T.PlotSeasonHistory[]>(`/plots/${plotId}/history`),
  structures: (farmId: string) => http.get<T.Page<T.Structure>>("/structures", { farm_id: farmId }),
  createStructure: (body: Omit<T.Structure, "id">) => http.post<T.Structure>("/structures", body),
  updateStructure: (id: string, body: Partial<Pick<T.Structure, "name" | "type" | "capacity">>) =>
    http.patch<T.Structure & T.Edited>(`/structures/${id}`, body),
};

export const enterprises = {
  list: (q: Q) => http.get<T.Page<T.Enterprise>>("/enterprises", q),
  get: (id: string) => http.get<T.EnterpriseDetail>(`/enterprises/${id}`),
  records: (id: string, cursor?: string) => http.get<T.Page<T.DailyRecord>>(`/enterprises/${id}/records`, { cursor }),
  health: (id: string, cursor?: string) => http.get<T.Page<T.HealthRecord>>(`/enterprises/${id}/health`, { cursor }),
  movements: (id: string) => http.get<T.Page<T.StockMovement>>("/stock/movements", { enterprise_id: id }),
  sales: (id: string) => http.get<T.Page<T.Sale>>("/sales", { enterprise_id: id }),
  finance: (id: string) => http.get<T.Page<T.FinanceEntry>>("/finance/entries", { enterprise_id: id }),
  closeSummary: (id: string) => http.get<T.CloseSummary>(`/enterprises/${id}/close-summary`),
  close: (id: string) => http.post<T.CloseSummary>(`/enterprises/${id}/close`),
  production: (id: string) => http.get<{ date: string; qty: number }[]>(`/enterprises/${id}/production`),
};

export const livestock = {
  animals: (enterpriseId: string) => http.get<T.Page<T.Animal>>("/animals", { enterprise_id: enterpriseId }),
  createAnimal: (body: Omit<T.Animal, "id" | "status" | "milk_7d">) => http.post<T.Animal>("/animals", body),
  animal: (id: string) => http.get<T.Animal & T.Edited>(`/animals/${id}`),
  updateAnimal: (id: string, body: Partial<Pick<T.Animal, "tag" | "name" | "sex" | "breed" | "birth_date" | "mother_id">>) =>
    http.patch<T.Animal & T.Edited>(`/animals/${id}`, body),
  breeding: (id: string) => http.get<T.Page<T.BreedingEvent>>(`/animals/${id}/breeding`),
  recordService: (id: string, body: { service_date: string; method: T.BreedingMethod; sire: string; note: string }) =>
    http.post<T.BreedingEvent>(`/animals/${id}/breeding`, body),
  recordBirth: (id: string, body: { date: string; offspring: { tag: string; sex: T.Sex; name: string }[]; breeding_event_id: string | null }) =>
    http.post<T.BirthResult>(`/animals/${id}/births`, body),
  weights: (id: string, cursor?: string) => http.get<T.Page<T.AnimalWeight>>(`/animals/${id}/weights`, { cursor }),
  recordWeight: (id: string, body: { date: string; kg: string }) => http.post<T.AnimalWeight>(`/animals/${id}/weights`, body),
  exitAnimal: (id: string, body: { reason: "sold" | "dead"; value: string; date: string }) =>
    http.post<T.Animal>(`/animals/${id}/exit`, body),
  recordMilk: (body: { enterprise_id: string; date: string; litres: string; animal_id?: string | null }) =>
    http.post<T.DailyRecord>("/milk-records", body),
  recordFeed: (body: { enterprise_id: string; date: string; item_id: string; qty: string; unit: string }) =>
    http.post<T.DailyRecord>("/feeding-records", body),
  recordTreatment: (body: { enterprise_id: string; date: string; item_id: string; qty: string; unit: string; dose_note: string; subject: string; schedule_day?: number | null }) =>
    http.post<T.HealthRecord>("/treatments", body),
};

export const batches = {
  start: (body: { farm_id: string; type: T.TypeCode; name: string; count: number; date: string; source: string; cost: string; structure_id: string | null; age_days: number }) =>
    http.post<T.Enterprise>("/batches", body),
  recordDay: (id: string, body: { date: string; feed_item_id: string | null; feed_qty: string; feed_unit: string; deaths: number; eggs_trays: string; note: string }) =>
    http.post<T.DailyRecord>(`/batches/${id}/days`, body),
  /** Sample weighings, broilers and fish only (BAT-05). */
  weights: (id: string, cursor?: string) => http.get<T.Page<T.SampleWeight>>(`/batches/${id}/weights`, { cursor }),
  recordWeight: (id: string, body: { date: string; sample_size: number; avg_kg: string }) =>
    http.post<T.SampleWeight>(`/batches/${id}/weights`, body),
  vaccinations: (id: string) => http.get<T.BatchVaccinations>(`/batches/${id}/vaccinations`),
  schedules: () => http.get<T.Page<T.VaccinationSchedule>>("/vaccination-schedules"),
  /** steps null puts the catalogue's default back. */
  setSchedule: (type: T.TypeCode, steps: T.VaccinationStep[] | null) =>
    http.put<T.VaccinationSchedule>("/vaccination-schedules", { type, steps }),
};

export const crops = {
  start: (body: { farm_id: string; type: T.TypeCode; plot_id: string; variety: string; area_acres: string; date: string; name: string }) =>
    http.post<T.Enterprise>("/seasons", body),
  activities: (id: string, cursor?: string) => http.get<T.Page<T.Activity>>(`/seasons/${id}/activities`, { cursor }),
  recordActivity: (id: string, body: { date: string; type: T.ActivityType; inputs: { item_id: string; qty: string; unit: string }[]; labour_cost: string; service_cost: string; note: string }) =>
    http.post<T.Activity>(`/seasons/${id}/activities`, body),
  harvests: (id: string, cursor?: string) => http.get<T.Page<T.Harvest>>(`/seasons/${id}/harvests`, { cursor }),
  recordHarvest: (id: string, body: { date: string; qty: string; unit: string; moisture: "green" | "dry" }) =>
    http.post<T.Harvest>(`/seasons/${id}/harvests`, body),
};

export const stock = {
  items: () => http.get<T.Page<T.Item>>("/items"),
  updateItem: (id: string, body: { low_stock_level: string | null }) => http.patch<T.Item>(`/items/${id}`, body),
  balances: (farmId: string) => http.get<T.Page<T.StockBalance>>("/stock/balances", { farm_id: farmId }),
  movements: (q: Q) => http.get<T.Page<T.StockMovement>>("/stock/movements", q),
  reverse: (id: string) => http.post<T.StockMovement>(`/stock/movements/${id}/reverse`),
  count: (body: { farm_id: string; date: string; lines: { item_id: string; counted: string; unit: string }[] }) =>
    http.post<{ adjustments: number }>("/stock/counts", body),
  transfer: (body: { farm_id: string; item_id: string; qty: string; unit: string; from_enterprise_id: string | null; to_enterprise_id: string; unit_price: string; date: string }) =>
    http.post<void>("/stock/transfers", body),
};

export const sales = {
  list: (q: Q) => http.get<T.Page<T.Sale>>("/sales", q),
  get: (id: string) => http.get<T.Sale>(`/sales/${id}`),
  create: (body: T.NewSaleInput) => http.post<T.Sale>("/sales", body),
  addPayment: (id: string, body: { method: T.PaymentMethod; amount: string; phone?: string; code?: string }) =>
    http.post<T.Sale>(`/sales/${id}/payments`, body),
  customers: () => http.get<T.Page<T.Party>>("/customers"),
  createCustomer: (body: { name: string; phone: string }) => http.post<T.Party>("/customers", body),
  updateCustomer: (id: string, body: { name: string; phone: string }) => http.patch<T.Party & T.Edited>(`/customers/${id}`, body),
  /** SMS goes from the server; WhatsApp comes back as a link to open (SAL-05). */
  sendReceipt: (id: string, body: { channel: T.ReceiptChannel; phone: string }) => http.post<T.Receipt>(`/sales/${id}/receipt`, body),
};

export const purchases = {
  list: (q: Q) => http.get<T.Page<T.Purchase>>("/purchases", q),
  create: (body: T.NewPurchaseInput) => http.post<T.Purchase>("/purchases", body),
  pay: (id: string, amount: string) => http.post<T.Purchase>(`/purchases/${id}/payments`, { amount }),
  suppliers: () => http.get<T.Page<T.Party>>("/suppliers"),
  createSupplier: (body: { name: string; phone: string }) => http.post<T.Party>("/suppliers", body),
  updateSupplier: (id: string, body: { name: string; phone: string }) => http.patch<T.Party & T.Edited>(`/suppliers/${id}`, body),
};

export const finance = {
  entries: (q: Q) => http.get<T.Page<T.FinanceEntry>>("/finance/entries", q),
  create: (body: { farm_id: string; kind: "revenue" | "cost"; category: string; amount: string; occurred_on: string; enterprise_id: string | null; note: string }) =>
    http.post<T.FinanceEntry>("/finance/entries", body),
  profit: (q: Q) => http.get<T.ProfitReport>("/reports/profit", q),
  costPerUnit: (q: Q) => http.get<T.CostPerUnit[]>("/reports/cost-per-unit", q),
  export: (body: { farm_id: string; from: string; to: string; kinds: string[] }) =>
    http.post<{ files: { name: string; url: string }[] }>("/exports", body),
};

export const weather = {
  get: (farmId: string) => http.get<T.Weather>("/weather", { farm_id: farmId }),
};

export const alerts = {
  list: (farmId: string) => http.get<T.Page<T.Alert>>("/alerts", { farm_id: farmId }),
  seen: (id: string) => http.post<T.Alert>(`/alerts/${id}/seen`),
};

export const dashboard = {
  get: (q: { farm_id: string; from: string; to: string }) => http.get<T.Dashboard>("/dashboard", q),
};

/** Shamba OS staff. Uses the separate admin session (never the farmer's tokens or X-Org-Id). */
export const staff = {
  login: (email: string, password: string, installId: string) =>
    http.post<T.SignInResponse>("/auth/staff/login", { email, password, device: device(installId) }, { auth: false, org: false }),
  /** Super admin sign-up. Not linked anywhere; the backend answers 404 without the right signup key. */
  register: (body: T.StaffRegisterInput, signupKey: string, installId: string) =>
    http.post<T.SignInResponse>("/auth/staff/register", { ...body, device: device(installId) }, { auth: false, org: false, headers: { "X-Signup-Key": signupKey } }),
  logout: (refresh: string | null) => http.post<void>("/auth/logout", { refresh: refresh ?? "" }, { as: "admin", org: false }),
  analytics: (days: T.AnalyticsDays) => http.get<T.StaffAnalytics>("/staff/analytics", { days }, { as: "admin", org: false }),
  mapFarms: (country: string) => http.get<T.StaffMapFarms>("/staff/farms", { country }, { as: "admin", org: false }),
  farmer: (id: string) => http.get<T.StaffFarmerDetail>(`/staff/farmers/${id}`, undefined, { as: "admin", org: false }),
  impersonate: (id: string) =>
    http.post<T.ImpersonationResponse>(`/staff/farmers/${id}/impersonate`, undefined, { as: "admin", org: false }),
  farmers: (q: string, cursor?: string) => http.get<T.Page<T.StaffFarmer>>("/staff/farmers", { q, cursor }, { as: "admin", org: false }),
  /** Integration keys. Super admins only; other staff get 403. */
  keys: () => http.get<{ keys: T.ManagedKey[] }>("/staff/keys", undefined, { as: "admin", org: false }),
  setKey: (name: T.KeyName, value: string) => http.put<T.ManagedKey>(`/staff/keys/${name}`, { value }, { as: "admin", org: false }),
  /** A key's full value, for the eye button. Audited on the server. */
  revealKey: (name: T.KeyName) => http.post<{ name: T.KeyName; value: string }>(`/staff/keys/${name}/reveal`, undefined, { as: "admin", org: false }),
  /** Forget the value saved here, so the server's environment applies again. */
  resetKey: (name: T.KeyName) => http.del<T.ManagedKey>(`/staff/keys/${name}`, { as: "admin", org: false }),
  /** Email to farmers: drafts, preview, test, send (apps/broadcasts). */
  emails: (cursor?: string) => http.get<T.Page<T.StaffEmail>>("/staff/emails", { cursor }, { as: "admin", org: false }),
  email: (id: string) => http.get<T.StaffEmailDetail>(`/staff/emails/${id}`, undefined, { as: "admin", org: false }),
  createEmail: (body: T.StaffEmailInput) => http.post<T.StaffEmailDetail>("/staff/emails", body, { as: "admin", org: false }),
  updateEmail: (id: string, body: T.StaffEmailInput) => http.patch<T.StaffEmailDetail>(`/staff/emails/${id}`, body, { as: "admin", org: false }),
  deleteEmail: (id: string) => http.del(`/staff/emails/${id}`, { as: "admin", org: false }),
  previewEmail: (body: T.StaffEmailInput) =>
    http.post<{ subject: string; text: string; html: string }>("/staff/emails/preview", body, { as: "admin", org: false }),
  /** How many farmers "all" or "owners" reaches. Chosen farmers are counted in the browser. */
  emailAudience: (audience: Exclude<T.EmailAudience, "selected">) =>
    http.get<T.StaffEmailAudienceCount>("/staff/emails/audience", { audience }, { as: "admin", org: false }),
  testEmail: (id: string) => http.post<{ to: string }>(`/staff/emails/${id}/test`, undefined, { as: "admin", org: false }),
  sendEmail: (id: string) => http.post<T.StaffEmailDetail>(`/staff/emails/${id}/send`, undefined, { as: "admin", org: false }),
};

/** Settings any browser may see, signed in or not. */
export const config = {
  public: () => http.get<T.PublicConfig>("/config/public", undefined, { auth: false, org: false }),
};
