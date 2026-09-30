/*
 * Route handlers for the in-browser mock. Paths, shapes and error codes follow
 * backend-architecture.md so the portal code does not change when a route
 * moves to Django: remove it here and add it to IMPLEMENTED in client.ts.
 */
import { normalizePhone } from "@/lib/phone";
import { useSession } from "@/stores/session";
import { MOCK_MODE, sendNetwork, type RawRequest } from "../client";
import type * as T from "../types";
import { CATALOGUE, TYPE_FEED, TYPE_ITEMS, TYPE_OUTPUT, typeInfo } from "./catalogue";
import * as cmd from "./commands";
import {
  addDays, balanceOf, balances, daysAgo, daysBetween, emptyOrgData, entriesFor, factorFor, getDb, inRange,
  isoDate, money, qty, save, sumBy, type MEnterprise, type MFinance, type MockDb, type MPurchase, type MRecord, type MRecorder, type MSale, type MUser, type OrgData,
} from "./db";
import { seed } from "./seed";

type Result = { status: number; body: unknown };

class MockError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string[]> = {}) {
    super(message);
  }
}

interface Ctx {
  req: RawRequest;
  params: Record<string, string>;
  q: URLSearchParams;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  db: MockDb;
  userId: string | null;
  deviceId: string | null;
  orgId: string | null;
  role: T.Role | null;
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;
interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
  org: boolean;
  auth: boolean;
  status: number;
}

const routes: Route[] = [];

function route(method: string, path: string, handler: Handler, opts: { org?: boolean; auth?: boolean; status?: number } = {}) {
  const keys: string[] = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)"))}$`);
  routes.push({ method, re, keys, handler, org: opts.org ?? true, auth: opts.auth ?? true, status: opts.status ?? 200 });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handle(req: RawRequest): Promise<Result> {
  await delay(120 + Math.random() * 200);
  const db = getDb(seed);
  const match = routes.find((r) => r.method === req.method && r.re.test(req.path));
  if (!match) return err(404, "not_found", `No mock for ${req.method} ${req.path}`);
  const values = match.re.exec(req.path)!.slice(1);
  const params = Object.fromEntries(match.keys.map((k, i) => [k, decodeURIComponent(values[i])]));
  try {
    const ctx: Ctx = { req, params, q: req.query, body: req.body ?? {}, db, userId: null, deviceId: null, orgId: null, role: null };
    if (match.auth) authenticate(ctx);
    if (match.org) resolveOrg(ctx);
    const body = await match.handler(ctx);
    save();
    return { status: body === undefined ? 204 : match.status, body: body ?? null };
  } catch (e) {
    if (e instanceof MockError) return err(e.status, e.code, e.message, e.fields);
    console.error("[mock]", e);
    return err(500, "server_error", "Something went wrong on the server.");
  }
}

function err(status: number, code: string, message: string, fields: Record<string, string[]> = {}): Result {
  return { status, body: { code, message, params: {}, fields } };
}

/* ---------- Auth and tenancy context ---------- */

function authenticate(ctx: Ctx) {
  const header = ctx.req.headers.Authorization ?? "";
  const token = header.replace(/^Bearer /, "");
  if (!token) throw new MockError(401, "auth.not_authenticated", "Sign in to continue.");
  if (token.startsWith("mock.")) {
    const [, userId, deviceId, exp] = token.split(".");
    if (Number(exp) < Date.now()) throw new MockError(401, "auth.failed", "Token expired.");
    ctx.userId = userId;
    ctx.deviceId = deviceId;
    return;
  }
  // A real JWT from Django (VITE_MOCK=missing): read the claims without verifying.
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    ctx.userId = claims.user_id ?? null;
    ctx.deviceId = claims.device_id ?? null;
  } catch {
    throw new MockError(401, "auth.failed", "Token not valid.");
  }
}

function resolveOrg(ctx: Ctx) {
  const orgId = ctx.req.headers["X-Org-Id"];
  if (!orgId) throw new MockError(400, "org.header_required", "Choose a farm account to continue.");
  if (MOCK_MODE === "all") {
    const m = ctx.db.memberships.find((x) => x.org_id === orgId && x.user_id === ctx.userId && x.is_active);
    if (!m) throw new MockError(403, "org.not_member", "You are not a member of this farm account.");
    ctx.role = m.role;
  } else {
    // Django checked membership on its own routes; take the role it reported at sign-in.
    const m = useSession.getState().memberships.find((x) => x.organisation_id === orgId);
    if (!m) throw new MockError(403, "org.not_member", "You are not a member of this farm account.");
    ctx.role = m.role;
  }
  ctx.orgId = orgId;
  ctx.db.data[orgId] ??= emptyOrgData();
}

const CAPS: Record<T.Role, T.Capability[]> = {
  owner: ["records.write", "stock.read", "stock.write", "money.read", "sales.write", "procurement.write", "finance.write", "members.read", "members.manage", "org.settings", "billing"],
  manager: ["records.write", "stock.read", "stock.write", "money.read", "sales.write", "procurement.write", "finance.write", "members.read", "members.manage"],
  field_worker: ["records.write", "stock.read"],
};

const can = (ctx: Ctx, cap: T.Capability) => !!ctx.role && CAPS[ctx.role].includes(cap);
function need(ctx: Ctx, cap: T.Capability) {
  if (!can(ctx, cap)) throw new MockError(403, "permission_denied", "You do not have permission to do this.");
}
const data = (ctx: Ctx): OrgData => ctx.db.data[ctx.orgId!];
const me = (ctx: Ctx, device: "phone" | "web" = "web"): MRecorder => ({ user_id: ctx.userId ?? "", device, synced_at: null });
/** Money fields go to callers with money.read only (backend section 5). */
const m$ = (ctx: Ctx, n: number | null | undefined) => (can(ctx, "money.read") && n != null ? money(n) : null);

function recorder(ctx: Ctx, r: MRecorder): T.Recorder {
  const user = ctx.db.users.find((u) => u.id === r.user_id);
  const self = useSession.getState().user;
  const name = user?.name || user?.phone || (r.user_id === self?.id ? self.name || "You" : "Unknown");
  return { name: name.split(" ")[0], device: r.device, synced_at: r.synced_at };
}

function membershipsPayload(db: MockDb, userId: string): T.MembershipSummary[] {
  return db.memberships
    .filter((m) => m.user_id === userId && m.is_active)
    .map((m) => {
      const o = db.orgs.find((x) => x.id === m.org_id)!;
      return { organisation_id: o.id, organisation_name: o.name, currency: o.currency, role: m.role, capabilities: CAPS[m.role], epoch: m.epoch };
    });
}

function paginate<X>(rows: X[], q: URLSearchParams, size = 25): T.Page<X> {
  const offset = Number(q.get("cursor") ?? 0) || 0;
  const slice = rows.slice(offset, offset + size);
  const next = offset + size < rows.length ? `?cursor=${offset + size}` : null;
  return { next, previous: offset > 0 ? `?cursor=${Math.max(0, offset - size)}` : null, results: slice };
}

function farmOf(ctx: Ctx, farmId: string | null): T.Farm {
  const f = data(ctx).farms.find((x) => x.id === farmId);
  if (!f) throw new MockError(404, "not_found", "Farm not found.");
  return f;
}

function enterprise(ctx: Ctx, id: string): MEnterprise {
  const e = data(ctx).enterprises.find((x) => x.id === id);
  if (!e) throw new MockError(404, "not_found", "Not found.");
  return e;
}

/** ONB-04: modules the farm didn't pick are blocked in the API, not only hidden. */
function moduleEnabled(ctx: Ctx, farmId: string, type: T.TypeCode) {
  const picks = data(ctx).picks[farmId] ?? [];
  if (!picks.includes(type)) {
    throw new MockError(403, "module.disabled", `${typeInfo(type).labels.en} are hidden on this farm. Turn them on in Settings.`);
  }
}

function requireFields(body: Record<string, unknown>, ...names: string[]) {
  const fields: Record<string, string[]> = {};
  for (const n of names) {
    const v = body[n];
    if (v === undefined || v === null || v === "") fields[n] = ["This field is required."];
  }
  if (Object.keys(fields).length) throw new MockError(400, "validation_error", "Check the highlighted fields.", fields);
}

function positive(body: Record<string, unknown>, ...names: string[]) {
  const fields: Record<string, string[]> = {};
  for (const n of names) if (!(Number(body[n]) > 0)) fields[n] = ["Enter a number greater than zero."];
  if (Object.keys(fields).length) throw new MockError(400, "validation_error", "Check the highlighted fields.", fields);
}

/* ---------- Identity (mocked only with VITE_MOCK=all) ---------- */

function issue(userId: string, deviceId: string) {
  return { access: `mock.${userId}.${deviceId}.${Date.now() + 15 * 60_000}`, refresh: `mockr.${userId}.${deviceId}` };
}

route("GET", "/health", () => ({ status: "ok" }), { auth: false, org: false });

const USERNAME = /^[a-z0-9._]{3,30}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signedIn(db: MockDb, user: MUser, isNew: boolean) {
  // Pending invitations for this number join on sign-in.
  for (const inv of db.invitations.filter((i) => i.phone === user.phone && i.status === "pending")) {
    inv.status = "accepted";
    db.memberships.push({ id: crypto.randomUUID(), user_id: user.id, org_id: inv.org_id, role: inv.role, is_active: true, epoch: 1, created_at: new Date().toISOString(), removed_at: null });
  }
  const deviceId = crypto.randomUUID();
  return { ...issue(user.id, deviceId), is_new_user: isNew, device_id: deviceId, user, memberships: membershipsPayload(db, user.id) };
}

route("POST", "/auth/login", (ctx) => {
  const id = String(ctx.body.identifier ?? "").trim().toLowerCase();
  const password = String(ctx.body.password ?? "");
  const user = ctx.db.users.find((u) => u.email?.toLowerCase() === id || u.username?.toLowerCase() === id);
  if (!user || ctx.db.credentials[user.id] !== password) throw new MockError(401, "auth.invalid_credentials", "That email, username or password is not right.");
  return signedIn(ctx.db, user, false);
}, { auth: false, org: false });

route("POST", "/auth/register", (ctx) => {
  const db = ctx.db;
  const b = ctx.body as Record<string, string>;
  const email = String(b.email ?? "").trim().toLowerCase();
  const username = String(b.username ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(b.phone ?? ""));
  const fields: Record<string, string[]> = {};
  if (!String(b.name ?? "").trim()) fields.name = ["Enter your name."];
  if (!EMAIL.test(email)) fields.email = ["Enter a valid email."];
  else if (db.users.some((u) => u.email?.toLowerCase() === email)) fields.email = ["An account already uses this email. Sign in instead."];
  if (!USERNAME.test(username)) fields.username = ["Use 3 to 30 letters, numbers, dots or underscores."];
  else if (db.users.some((u) => u.username?.toLowerCase() === username)) fields.username = ["That username is taken. Try another."];
  if (!phone) fields.phone = ["Enter a valid Kenyan phone number."];
  else if (db.users.some((u) => u.phone === phone)) fields.phone = ["An account already uses this number. Sign in instead."];
  if (String(b.password ?? "").length < 8) fields.password = ["Use at least 8 characters."];
  if (Object.keys(fields).length) throw new MockError(400, "validation_error", "Check the highlighted fields.", fields);
  const user: MUser = { id: crypto.randomUUID(), phone: phone!, name: b.name!.trim(), email, username, preferred_locale: (b.locale as T.Locale) ?? "sw", date_joined: new Date().toISOString() };
  db.users.push(user);
  db.credentials[user.id] = b.password!;
  // ACC-02: an organisation is created at sign-up; the farmer never names it.
  const org = { id: crypto.randomUUID(), name: user.name, country: "KE", currency: "KES", default_locale: user.preferred_locale, created_at: user.date_joined, payment_mode: "request" as const };
  db.orgs.push(org);
  db.memberships.push({ id: crypto.randomUUID(), user_id: user.id, org_id: org.id, role: "owner", is_active: true, epoch: 1, created_at: user.date_joined, removed_at: null });
  db.data[org.id] = emptyOrgData();
  return signedIn(db, user, true);
}, { auth: false, org: false, status: 201 });

// Always accepted, so the response never reveals whether an email has an account.
// The mock has no email: the link goes to the browser console instead.
route("POST", "/auth/password/forgot", (ctx) => {
  const email = String(ctx.body.email ?? "").trim().toLowerCase();
  const user = ctx.db.users.find((u) => u.email?.toLowerCase() === email);
  if (user) console.info(`[mock] password reset link: ${location.origin}/reset-password?uid=${btoa(user.id)}&token=mock`);
  return null;
}, { auth: false, org: false, status: 202 });

route("POST", "/auth/password/reset", (ctx) => {
  let userId = "";
  try {
    userId = atob(String(ctx.body.uid ?? ""));
  } catch {
    /* not base64: invalid link */
  }
  if (ctx.body.token !== "mock" || !ctx.db.users.some((u) => u.id === userId)) {
    throw new MockError(400, "auth.reset_link_invalid", "This reset link has expired or was already used. Ask for a new one.");
  }
  if (String(ctx.body.password ?? "").length < 8) throw new MockError(400, "validation_error", "Check the highlighted fields.", { password: ["Use at least 8 characters."] });
  ctx.db.credentials[userId] = String(ctx.body.password);
  return null;
}, { auth: false, org: false, status: 204 });

route("POST", "/auth/staff/login", (ctx) => {
  const email = String(ctx.body.email ?? "").trim().toLowerCase();
  const user = ctx.db.users.find((u) => u.email?.toLowerCase() === email && ctx.db.staff.includes(u.id));
  if (!user || ctx.db.credentials[user.id] !== String(ctx.body.password ?? "")) {
    throw new MockError(401, "auth.invalid_credentials", "Email or password is not correct.");
  }
  const deviceId = crypto.randomUUID();
  return { ...issue(user.id, deviceId), is_new_user: false, device_id: deviceId, user, memberships: [] };
}, { auth: false, org: false });

// Demo signup key (admin.signUpDemoHint). A wrong key looks like a missing page, as on the backend.
route("POST", "/auth/staff/register", (ctx) => {
  if (ctx.req.headers["X-Signup-Key"] !== "shamba-staff-key") throw new MockError(404, "not_found", "Not found.");
  const db = ctx.db;
  const b = ctx.body as Record<string, string>;
  const email = String(b.email ?? "").trim().toLowerCase();
  const phone = normalizePhone(String(b.phone ?? ""));
  const fields: Record<string, string[]> = {};
  if (!String(b.name ?? "").trim()) fields.name = ["Enter your name."];
  if (!EMAIL.test(email)) fields.email = ["Enter a valid email."];
  else if (db.users.some((u) => u.email?.toLowerCase() === email)) fields.email = ["An account already uses this email. Sign in instead."];
  if (!phone) fields.phone = ["Enter a valid Kenyan phone number."];
  else if (db.users.some((u) => u.phone === phone)) fields.phone = ["An account already uses this number. Sign in instead."];
  if (String(b.password ?? "").length < 8) fields.password = ["Use at least 8 characters."];
  if (Object.keys(fields).length) throw new MockError(400, "validation_error", "Check the highlighted fields.", fields);
  const user: MUser = { id: crypto.randomUUID(), phone: phone!, name: b.name!.trim(), email, username: null, preferred_locale: (b.locale as T.Locale) ?? "en", date_joined: new Date().toISOString() };
  db.users.push(user);
  db.staff.push(user.id);
  db.credentials[user.id] = b.password!;
  const deviceId = crypto.randomUUID();
  return { ...issue(user.id, deviceId), is_new_user: true, device_id: deviceId, user, memberships: [] };
}, { auth: false, org: false, status: 201 });

route("POST", "/auth/token/refresh", (ctx) => {
  const [kind, userId, deviceId] = String(ctx.body.refresh ?? "").split(".");
  if (kind !== "mockr" || !ctx.db.users.some((u) => u.id === userId)) throw new MockError(401, "device_revoked", "This device has been signed out.");
  return issue(userId, deviceId);
}, { auth: false, org: false });

route("POST", "/auth/logout", () => undefined, { org: false });

route("GET", "/me", (ctx) => ctx.db.users.find((u) => u.id === ctx.userId), { org: false });
route("PATCH", "/me", (ctx) => {
  const user = ctx.db.users.find((u) => u.id === ctx.userId)!;
  if (typeof ctx.body.name === "string") user.name = ctx.body.name.trim();
  if (ctx.body.preferred_locale === "en" || ctx.body.preferred_locale === "sw") user.preferred_locale = ctx.body.preferred_locale;
  return user;
}, { org: false });

route("GET", "/me/organisations", (ctx) => {
  const user = ctx.db.users.find((u) => u.id === ctx.userId)!;
  const invitations = ctx.db.invitations
    .filter((i) => i.phone === user.phone && i.status === "pending")
    .map((i) => ({ id: i.id, organisation_id: i.org_id, organisation_name: ctx.db.orgs.find((o) => o.id === i.org_id)?.name ?? "", invited_by_name: ctx.db.users.find((u) => u.id === i.invited_by)?.name ?? null, role: i.role, expires_at: i.expires_at }));
  return { memberships: membershipsPayload(ctx.db, ctx.userId!), invitations };
}, { org: false });

route("GET", "/organisation", (ctx) => {
  const { payment_mode: _p, ...org } = ctx.db.orgs.find((o) => o.id === ctx.orgId)!;
  return org;
});
route("PATCH", "/organisation", (ctx) => {
  need(ctx, "org.settings");
  const org = ctx.db.orgs.find((o) => o.id === ctx.orgId)!;
  if (ctx.body.name) org.name = String(ctx.body.name);
  const { payment_mode: _p, ...rest } = org;
  return rest;
});

route("GET", "/members", (ctx) => {
  need(ctx, "members.read");
  const rows = ctx.db.memberships
    .filter((m) => m.org_id === ctx.orgId && (m.is_active || ctx.q.get("include_removed") === "true"))
    .map((m) => {
      const u = ctx.db.users.find((x) => x.id === m.user_id)!;
      return { id: m.id, user_id: u.id, name: u.name, phone: u.phone, role: m.role, is_active: m.is_active, created_at: m.created_at, removed_at: m.removed_at };
    });
  return paginate(rows, ctx.q, 50);
});
route("PATCH", "/members/:id", (ctx) => {
  need(ctx, "members.manage");
  const m = ctx.db.memberships.find((x) => x.id === ctx.params.id && x.org_id === ctx.orgId);
  if (!m) throw new MockError(404, "not_found", "Not found.");
  if (m.role === "owner") throw new MockError(400, "members.owner_role", "The owner's role can't be changed.");
  if (ctx.role === "manager" && ctx.body.role !== "field_worker") throw new MockError(403, "permission_denied", "Managers can only add field workers.");
  m.role = ctx.body.role;
  m.epoch += 1;
  const u = ctx.db.users.find((x) => x.id === m.user_id)!;
  return { id: m.id, user_id: u.id, name: u.name, phone: u.phone, role: m.role, is_active: m.is_active, created_at: m.created_at, removed_at: m.removed_at };
});
route("DELETE", "/members/:id", (ctx) => {
  need(ctx, "members.manage");
  const m = ctx.db.memberships.find((x) => x.id === ctx.params.id && x.org_id === ctx.orgId);
  if (!m) throw new MockError(404, "not_found", "Not found.");
  if (m.role === "owner") throw new MockError(400, "members.cannot_remove_owner", "The owner can't be removed.");
  m.is_active = false;
  m.removed_at = new Date().toISOString();
  m.epoch += 1;
  return undefined;
});

route("GET", "/invitations", (ctx) => {
  need(ctx, "members.manage");
  return paginate(ctx.db.invitations.filter((i) => i.org_id === ctx.orgId && i.status === "pending").map(({ org_id: _o, invited_by: _b, ...i }) => i), ctx.q, 50);
});
route("POST", "/invitations", (ctx) => {
  need(ctx, "members.manage");
  const phone = normalizePhone(String(ctx.body.phone ?? ""));
  if (!phone) throw new MockError(400, "validation_error", "Enter a valid phone number.", { phone: ["Enter a valid Kenyan phone number."] });
  const role = ctx.body.role as T.Role;
  if (role === "owner") throw new MockError(400, "validation_error", "Invite as a manager or field worker.", { role: ["Choose manager or field worker."] });
  if (ctx.role === "manager" && role !== "field_worker") throw new MockError(403, "permission_denied", "Managers can only invite field workers.");
  const existing = ctx.db.users.find((u) => u.phone === phone);
  if (existing && ctx.db.memberships.some((m) => m.user_id === existing.id && m.org_id === ctx.orgId && m.is_active)) {
    throw new MockError(400, "invitation.already_member", "This person is already a member.", { phone: ["Already a member of this farm."] });
  }
  const inv = { id: crypto.randomUUID(), org_id: ctx.orgId!, invited_by: ctx.userId!, phone, role, status: "pending", expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), created_at: new Date().toISOString() };
  ctx.db.invitations.push(inv);
  const { org_id: _o, invited_by: _b, ...out } = inv;
  return out;
}, { status: 201 });
route("DELETE", "/invitations/:id", (ctx) => {
  need(ctx, "members.manage");
  const inv = ctx.db.invitations.find((i) => i.id === ctx.params.id && i.org_id === ctx.orgId);
  if (!inv) throw new MockError(404, "not_found", "Not found.");
  inv.status = "revoked";
  return undefined;
});
route("POST", "/me/invitations/:id/accept", (ctx) => {
  const inv = ctx.db.invitations.find((i) => i.id === ctx.params.id && i.status === "pending");
  if (!inv) throw new MockError(404, "not_found", "Not found.");
  inv.status = "accepted";
  ctx.db.memberships.push({ id: crypto.randomUUID(), user_id: ctx.userId!, org_id: inv.org_id, role: inv.role, is_active: true, epoch: 1, created_at: new Date().toISOString(), removed_at: null });
  return { memberships: membershipsPayload(ctx.db, ctx.userId!) };
}, { org: false });

/* ---------- Payments (mocked only with VITE_MOCK=all) ---------- */

/** Mock SasaPay: numbers ending 0 cancel, ending 9 never answer, SasaPay wallets ask for a code, the rest pay. */
function progressPayment(p: T.PaymentRequest) {
  if (p.status === "succeeded" || p.status === "failed" || p.status === "expired") return p;
  const age = Date.now() - new Date(p.created_at).getTime();
  if (p.phone.endsWith("0") && age > 6000) Object.assign(p, { status: "failed", failure_reason: "cancelled", completed_at: new Date().toISOString() });
  else if (p.phone.endsWith("9")) {
    if (age > 120_000) Object.assign(p, { status: "expired", completed_at: new Date().toISOString() });
  } else if (p.network === "sasapay" && p.status === "pending") p.status = "awaiting_otp";
  else if (p.network !== "sasapay" && age > 7000) {
    const code = `S${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
    Object.assign(p, { status: "succeeded", transaction_code: code, amount_paid: p.amount, payer_phone: p.phone, channel: p.network, completed_at: new Date().toISOString() });
  }
  return p;
}

function newPayment(phone: string, amount: number, network: string, reference: string, saleId: string): T.PaymentRequest {
  return {
    id: crypto.randomUUID(), provider: "sasapay", network, phone, amount: money(amount), currency: "KES", reference, description: `Sale ${reference}`,
    status: "pending", subject_type: "sale", subject_id: saleId, transaction_code: "", amount_paid: null, payer_phone: "", channel: "",
    failure_reason: "", completed_at: null, created_at: new Date().toISOString(),
  };
}

route("GET", "/payments/requests/:id", (ctx) => {
  need(ctx, "money.read");
  const p = data(ctx).payments.find((x) => x.id === ctx.params.id);
  if (!p) throw new MockError(404, "not_found", "Not found.");
  settleSales(ctx);
  return p;
});
route("POST", "/payments/requests/:id/otp", (ctx) => {
  need(ctx, "sales.write");
  const p = data(ctx).payments.find((x) => x.id === ctx.params.id);
  if (!p) throw new MockError(404, "not_found", "Not found.");
  if (p.status !== "awaiting_otp") throw new MockError(400, "payment.not_awaiting_otp", "This payment is not waiting for a code.");
  Object.assign(p, { status: "succeeded", transaction_code: `SP${Date.now().toString().slice(-8)}`, amount_paid: p.amount, payer_phone: p.phone, channel: "sasapay", completed_at: new Date().toISOString() });
  settleSales(ctx);
  return p;
});

/** Apply finished payment requests to their sales (the real backend does this in the callback). */
function settleSales(ctx: Ctx) {
  const d = data(ctx);
  for (const p of d.payments) {
    progressPayment(p);
    if (p.status !== "succeeded" || !p.subject_id) continue;
    const sale = d.sales.find((s) => s.id === p.subject_id);
    if (sale && sale.payment_request_id === p.id && !(sale as MSale & { settled?: string }).settled) {
      sale.paid = Math.min(sale.total, sale.paid + Number(p.amount));
      (sale as MSale & { settled?: string }).settled = p.id;
    }
  }
}

/** With VITE_MOCK=missing, payment requests go to the real Django + SasaPay; keep a copy for the mock sale. */
async function refreshRealPayments(ctx: Ctx, sales: MSale[]) {
  if (MOCK_MODE !== "missing") return;
  const d = data(ctx);
  for (const s of sales) {
    const p = d.payments.find((x) => x.id === s.payment_request_id);
    if (!p || ["succeeded", "failed", "expired"].includes(p.status)) continue;
    const res = await sendNetwork({ method: "GET", path: `/payments/requests/${p.id}`, query: new URLSearchParams(), body: undefined, headers: ctx.req.headers });
    if (res.status === 200) Object.assign(p, res.body);
  }
}

async function createPayment(ctx: Ctx, sale: MSale, phoneRaw: string, network: string, amount: number): Promise<T.PaymentRequest> {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new MockError(400, "validation_error", "Check the phone number and try again.", { phone: ["Enter the customer's M-Pesa number."] });
  let p: T.PaymentRequest;
  if (MOCK_MODE === "missing") {
    const res = await sendNetwork({ method: "POST", path: "/payments/requests", query: new URLSearchParams(), body: { phone, amount: money(amount), network, description: `Sale S-${sale.number}` }, headers: ctx.req.headers });
    if (res.status >= 400) {
      const b = res.body as T.ApiErrorBody;
      throw new MockError(res.status, b.code ?? "payment.failed", b.message ?? "The M-Pesa request didn't go through.");
    }
    p = { ...(res.body as T.PaymentRequest), subject_type: "sale", subject_id: sale.id };
  } else {
    p = newPayment(phone, amount, network, `S-${sale.number}`, sale.id);
  }
  data(ctx).payments.push(p);
  sale.payment_request_id = p.id;
  return p;
}

/* ---------- Catalogue, farms, onboarding ---------- */

route("GET", "/catalogue", () => CATALOGUE, { org: false });

route("GET", "/farms", (ctx) => paginate(data(ctx).farms, ctx.q, 100));
route("POST", "/farms", (ctx) => {
  need(ctx, "org.settings");
  requireFields(ctx.body, "name");
  const farm: T.Farm = { id: crypto.randomUUID(), name: String(ctx.body.name).trim(), county: ctx.body.county ?? "", location: ctx.body.location ?? null, setup_complete: false, created_at: new Date().toISOString() };
  data(ctx).farms.push(farm);
  // The farmer never names the organisation (ACC-02): it takes the first farm's name.
  const org = ctx.db.orgs.find((o) => o.id === ctx.orgId);
  if (org && data(ctx).farms.length === 1) org.name = farm.name;
  return farm;
}, { status: 201 });
route("PATCH", "/farms/:id", (ctx) => {
  need(ctx, "org.settings");
  const f = farmOf(ctx, ctx.params.id);
  for (const k of ["name", "county", "location"] as const) if (ctx.body[k] !== undefined) (f as unknown as Record<string, unknown>)[k] = ctx.body[k];
  return f;
});

function navigation(ctx: Ctx, farmId: string): T.Navigation {
  const f = farmOf(ctx, farmId);
  const types = data(ctx).picks[farmId] ?? [];
  const modules = [...new Set(types.map((t) => typeInfo(t).module))];
  return { farm_id: farmId, modules, types, setup_complete: f.setup_complete };
}
route("GET", "/navigation", (ctx) => navigation(ctx, ctx.q.get("farm_id") ?? ""));

const SEASON_NAME = () => {
  const m = new Date().getMonth();
  return m >= 2 && m <= 7 ? { en: "long rains", sw: "masika" } : { en: "short rains", sw: "vuli" };
};

/** Default names are stored data (the farmer can rename them), so they are written in the farmer's language. */
function defaultNames(type: T.TypeCode, locale: T.Locale) {
  const info = typeInfo(type);
  const label = info.labels[locale];
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  if (locale === "sw") {
    return { herd: `Kundi la ${lower}`, batch: `${label}, kundi la 1`, plot: `Shamba la ${lower}`, season: `${label}, ${SEASON_NAME().sw}` };
  }
  return { herd: `${label} herd`.replace("cows herd", "herd"), batch: `${label}, batch 1`, plot: `${label} field`, season: `${label}, ${SEASON_NAME().en}` };
}

function createEnterprisesFor(ctx: Ctx, farmId: string, types: T.TypeCode[], counts: Partial<Record<T.TypeCode, number>>) {
  const d = data(ctx);
  const by = me(ctx);
  const today = isoDate(new Date());
  const locale: T.Locale = ctx.req.headers["Accept-Language"] === "en" ? "en" : "sw";
  for (const type of types) {
    if (d.enterprises.some((e) => e.farm_id === farmId && e.type === type && e.status === "active")) continue;
    const info = typeInfo(type);
    const names = defaultNames(type, locale);
    const count = counts[type];
    if (info.module === "livestock") {
      cmd.startEnterprise(d, { farm: farmId, type, name: names.herd, date: today, count: count ?? 0, by });
    } else if (info.module === "batches") {
      cmd.startEnterprise(d, { farm: farmId, type, name: names.batch, date: today, count: count ?? 0, by });
    } else {
      const acres = count && count > 0 ? count : 1;
      const plot = { id: crypto.randomUUID(), farm_id: farmId, name: names.plot, area_acres: acres.toFixed(2), tenure: "owned" as const, lease_cost: null, growing_now: null };
      d.plots.push(plot);
      cmd.startEnterprise(d, { farm: farmId, type, name: names.season, date: today, plot: plot.id, area: acres, by });
    }
  }
}

route("POST", "/onboarding", (ctx) => {
  need(ctx, "org.settings");
  const farm = farmOf(ctx, ctx.body.farm_id);
  const picks = (ctx.body.picks ?? []) as T.TypeCode[];
  if (!picks.length) throw new MockError(400, "onboarding.no_supported_pick", "Choose at least one of the types above to start.");
  const d = data(ctx);
  d.picks[farm.id] = picks;
  d.interest.push({ farm_id: farm.id, coming_soon: ctx.body.coming_soon ?? [], other_text: ctx.body.other_text ?? "" });
  createEnterprisesFor(ctx, farm.id, picks, ctx.body.counts ?? {});
  farm.setup_complete = true;
  return navigation(ctx, farm.id);
});

route("POST", "/farms/:id/types", (ctx) => {
  need(ctx, "org.settings");
  const farm = farmOf(ctx, ctx.params.id);
  const picks = (ctx.body.picks ?? []) as T.TypeCode[];
  if (!picks.length) throw new MockError(400, "onboarding.no_supported_pick", "Keep at least one type.");
  data(ctx).picks[farm.id] = picks;
  createEnterprisesFor(ctx, farm.id, picks, {});
  return navigation(ctx, farm.id);
});

route("GET", "/plots", (ctx) => {
  const d = data(ctx);
  const rows = d.plots.filter((p) => p.farm_id === ctx.q.get("farm_id")).map((p) => {
    const growing = d.enterprises.find((e) => e.plot_id === p.id && e.status === "active");
    return { ...p, lease_cost: m$(ctx, p.lease_cost != null ? Number(p.lease_cost) : null), growing_now: growing?.name ?? null };
  });
  return paginate(rows, ctx.q, 100);
});
route("POST", "/plots", (ctx) => {
  need(ctx, "stock.write");
  requireFields(ctx.body, "farm_id", "name", "area_acres", "tenure");
  positive(ctx.body, "area_acres");
  const plot = { id: crypto.randomUUID(), farm_id: ctx.body.farm_id, name: ctx.body.name, area_acres: Number(ctx.body.area_acres).toFixed(2), tenure: ctx.body.tenure, lease_cost: ctx.body.lease_cost ? Number(ctx.body.lease_cost).toFixed(2) : null, growing_now: null };
  data(ctx).plots.push(plot);
  return plot;
}, { status: 201 });
route("GET", "/plots/:id/history", (ctx) => {
  const d = data(ctx);
  return d.enterprises
    .filter((e) => e.plot_id === ctx.params.id)
    .sort((a, b) => b.started_on.localeCompare(a.started_on))
    .map((e): T.PlotSeasonHistory => {
      const harvested = d.harvests.filter((h) => h.enterprise_id === e.id).reduce((s, h) => s + h.qty * (h.unit === "bag" ? 1 : 1 / 90), 0);
      const all = d.finance.filter((f) => f.enterprise_id === e.id);
      return {
        enterprise_id: e.id, name: e.name, crop: e.type, started_on: e.started_on, closed_on: e.closed_on,
        yield_per_acre: harvested > 0 && e.area_acres ? (harvested / Number(e.area_acres)).toFixed(1) : null, yield_unit: "bag",
        profit: m$(ctx, sumBy(all, "revenue", true) - sumBy(all, "cost", true)),
      };
    });
});

route("GET", "/structures", (ctx) => paginate(data(ctx).structures.filter((s) => s.farm_id === ctx.q.get("farm_id")), ctx.q, 100));
route("POST", "/structures", (ctx) => {
  need(ctx, "stock.write");
  requireFields(ctx.body, "farm_id", "name", "type");
  const s = { id: crypto.randomUUID(), farm_id: ctx.body.farm_id, name: ctx.body.name, type: ctx.body.type, capacity: ctx.body.capacity ? Number(ctx.body.capacity) : null };
  data(ctx).structures.push(s);
  return s;
}, { status: 201 });

/* ---------- Enterprises ---------- */

function publicEnterprise(e: MEnterprise): T.Enterprise {
  const { cost: _c, source: _s, ...rest } = e;
  return rest;
}

route("GET", "/enterprises", (ctx) => {
  const d = data(ctx);
  const farm = ctx.q.get("farm_id");
  const picks = farm ? (d.picks[farm] ?? []) : null;
  const rows = d.enterprises
    .filter((e) => (!farm || e.farm_id === farm) && (!picks || picks.includes(e.type)))
    .filter((e) => !ctx.q.get("module") || e.module === ctx.q.get("module"))
    .filter((e) => !ctx.q.get("status") || e.status === ctx.q.get("status"))
    .sort((a, b) => (a.status === b.status ? b.started_on.localeCompare(a.started_on) : a.status === "active" ? -1 : 1))
    .map(publicEnterprise);
  return paginate(rows, ctx.q, 100);
});

function producedIn(d: OrgData, e: MEnterprise, from: string, to: string): number {
  const out = TYPE_OUTPUT[e.type];
  if (!out) return 0;
  const it = d.items.find((i) => i.id === cmd.itemId(out.item));
  if (!it) return 0;
  const f = factorFor(it, out.unit);
  return d.movements.filter((m) => m.enterprise_id === e.id && m.movement_type === "produced" && inRange(m.occurred_at.slice(0, 10), from, to)).reduce((s, m) => s + m.qty_base, 0) / f;
}

function feedKg(d: OrgData, e: MEnterprise, from: string, to: string) {
  return -d.movements.filter((m) => m.enterprise_id === e.id && (m.movement_type === "used" || (m.movement_type === "reversal" && m.qty_base > 0)) && TYPE_FEED[e.type] && m.item_id === cmd.itemId(TYPE_FEED[e.type]!) && inRange(m.occurred_at.slice(0, 10), from, to)).reduce((s, m) => s + m.qty_base, 0);
}

function lifetime(d: OrgData, e: MEnterprise) {
  const all = d.finance.filter((f) => f.enterprise_id === e.id);
  return { cost: sumBy(all, "cost", true), revenue: sumBy(all, "revenue", true) };
}

function kpis(ctx: Ctx, e: MEnterprise): T.Kpi[] {
  const d = data(ctx);
  const end = e.closed_on ?? isoDate(new Date());
  const w = addDays(end, -6);
  const month = addDays(end, -29);
  const cost30 = sumBy(d.finance.filter((f) => f.enterprise_id === e.id && inRange(f.occurred_on, month, end)), "cost", true);
  const life = lifetime(d, e);
  const deathsTotal = (e.start_count ?? 0) - (e.head_count ?? 0) - soldBirds(d, e);
  const mortality = e.start_count ? (deathsTotal / e.start_count) * 100 : 0;
  const out: T.Kpi[] = [];
  switch (e.type) {
    case "layers": {
      const trays7 = producedIn(d, e, w, end);
      const trays30 = producedIn(d, e, month, end);
      out.push({ code: "laying_rate", value: e.head_count ? ((trays7 * 30) / 7 / e.head_count * 100).toFixed(0) : "0", unit: "%" });
      out.push({ code: "feed_per_tray", value: trays30 ? (feedKg(d, e, month, end) / trays30).toFixed(1) : "0", unit: "kg" });
      out.push({ code: "cost_per_tray", value: trays30 ? money(cost30 / trays30) : "0", unit: "KES", money: true });
      out.push({ code: "mortality", value: mortality.toFixed(1), unit: "%" });
      break;
    }
    case "broilers":
    case "fish": {
      out.push({ code: "alive", value: String(e.head_count ?? 0), unit: e.type === "fish" ? "fish" : "birds" });
      out.push({ code: "age", value: String(daysBetween(e.started_on, end)), unit: "days" });
      out.push({ code: "feed_used", value: feedKg(d, e, e.started_on, end).toFixed(0), unit: "kg" });
      out.push({ code: "mortality", value: mortality.toFixed(1), unit: "%" });
      out.push({ code: "cost_per_bird", value: e.start_count ? money(life.cost / Math.max(1, (e.head_count ?? 0) + soldBirds(d, e))) : "0", unit: "KES", money: true });
      break;
    }
    case "dairy_cattle":
    case "dairy_goats": {
      const l7 = producedIn(d, e, w, end);
      const l30 = producedIn(d, e, month, end);
      out.push({ code: "milk_per_day", value: (l7 / 7).toFixed(1), unit: "l" });
      out.push({ code: "animals", value: String(d.animals.filter((a) => a.enterprise_id === e.id && a.status === "active").length || (e.head_count ?? 0)), unit: "" });
      out.push({ code: "cost_per_litre", value: l30 ? money(cost30 / l30) : "0", unit: "KES", money: true });
      out.push({ code: "milk_30d", value: l30.toFixed(0), unit: "l" });
      break;
    }
    case "beef_cattle":
    case "sheep":
      out.push({ code: "animals", value: String(d.animals.filter((a) => a.enterprise_id === e.id && a.status === "active").length || (e.head_count ?? 0)), unit: "" });
      out.push({ code: "cost_to_date", value: money(life.cost), unit: "KES", money: true });
      break;
    default: {
      const kg = producedIn(d, e, e.started_on, end);
      const bags = kg / 90;
      out.push({ code: "area", value: e.area_acres ?? "0", unit: "acres" });
      out.push({ code: "harvested", value: bags.toFixed(1), unit: "bags" });
      out.push({ code: "yield_per_acre", value: e.area_acres && Number(e.area_acres) > 0 ? (bags / Number(e.area_acres)).toFixed(1) : "0", unit: "bags" });
      out.push({ code: "cost_to_date", value: money(life.cost), unit: "KES", money: true });
    }
  }
  return can(ctx, "money.read") ? out : out.filter((k) => !k.money);
}

function soldBirds(d: OrgData, e: MEnterprise) {
  return d.sales.flatMap((s) => s.lines).filter((l) => l.enterprise_id === e.id && l.item_id === cmd.itemId("live_broilers")).reduce((s, l) => s + l.qty, 0);
}

route("GET", "/enterprises/:id", (ctx) => {
  const e = enterprise(ctx, ctx.params.id);
  moduleEnabled(ctx, e.farm_id, e.type);
  const d = data(ctx);
  return {
    ...publicEnterprise(e),
    kpis: kpis(ctx, e),
    structure_name: d.structures.find((s) => s.id === e.structure_id)?.name ?? null,
    plot_name: d.plots.find((p) => p.id === e.plot_id)?.name ?? null,
  } satisfies T.EnterpriseDetail;
});

route("GET", "/enterprises/:id/records", (ctx) => {
  const e = enterprise(ctx, ctx.params.id);
  const d = data(ctx);
  const rows = d.records
    .filter((r) => r.enterprise_id === e.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r): T.DailyRecord => ({
      id: r.id, date: r.date, produced: r.produced != null ? qty(r.produced) : null, produced_unit: r.produced_unit,
      feed_qty: r.feed_qty != null ? qty(r.feed_qty) : null, feed_unit: r.feed_unit, deaths: r.deaths, note: r.note,
      recorded_by: recorder(ctx, r.recorded_by), conflict: r.conflict,
    }));
  return paginate(rows, ctx.q, 30);
});

route("GET", "/enterprises/:id/health", (ctx) => {
  const rows = data(ctx).health
    .filter((h) => h.enterprise_id === ctx.params.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((h) => ({ id: h.id, date: h.date, product: h.product, dose_note: h.dose_note, subject: h.subject, cost: m$(ctx, h.cost), recorded_by: recorder(ctx, h.recorded_by) }));
  return paginate(rows, ctx.q, 30);
});

route("GET", "/enterprises/:id/production", (ctx) => {
  const e = enterprise(ctx, ctx.params.id);
  const d = data(ctx);
  const end = e.closed_on ?? isoDate(new Date());
  return Array.from({ length: 30 }, (_, i) => {
    const date = addDays(end, i - 29);
    return { date, qty: Math.round(producedIn(d, e, date, date) * 10) / 10 };
  });
});

function closeSummary(ctx: Ctx, e: MEnterprise): T.CloseSummary {
  const life = lifetime(data(ctx), e);
  return { enterprise_id: e.id, cost: money(life.cost), revenue: money(life.revenue), profit: money(life.revenue - life.cost), ratios: kpis(ctx, e) };
}

route("GET", "/enterprises/:id/close-summary", (ctx) => {
  need(ctx, "money.read");
  return closeSummary(ctx, enterprise(ctx, ctx.params.id));
});
route("POST", "/enterprises/:id/close", (ctx) => {
  need(ctx, "stock.write");
  const e = enterprise(ctx, ctx.params.id);
  if (e.module === "livestock") throw new MockError(400, "enterprise.cannot_close", "Herds stay open. Record a sale or death for each animal instead.");
  if (e.status === "closed") throw new MockError(400, "enterprise.already_closed", "This is already closed.");
  e.status = "closed";
  e.closed_on = isoDate(new Date());
  return closeSummary(ctx, e);
});

/* ---------- Livestock ---------- */

route("GET", "/animals", (ctx) => {
  const d = data(ctx);
  const rows = d.animals
    .filter((a) => a.enterprise_id === ctx.q.get("enterprise_id"))
    .sort((a, b) => (a.status === b.status ? a.tag.localeCompare(b.tag) : a.status === "active" ? -1 : 1))
    .map((a) => ({ ...a, cost: m$(ctx, a.cost != null ? Number(a.cost) : null) }));
  return paginate(rows, ctx.q, 100);
});
route("POST", "/animals", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "enterprise_id", "tag", "sex");
  const e = enterprise(ctx, ctx.body.enterprise_id);
  moduleEnabled(ctx, e.farm_id, e.type);
  const d = data(ctx);
  if (d.animals.some((a) => a.enterprise_id === e.id && a.tag.toLowerCase() === String(ctx.body.tag).toLowerCase() && a.status === "active")) {
    throw new MockError(400, "validation_error", "Another animal has this tag.", { tag: ["Another animal in this herd has this tag."] });
  }
  const cost = can(ctx, "money.read") && ctx.body.cost ? Number(ctx.body.cost) : null;
  const animal = {
    id: crypto.randomUUID(), enterprise_id: e.id, tag: ctx.body.tag, name: ctx.body.name ?? "", sex: ctx.body.sex, breed: ctx.body.breed ?? "",
    birth_date: ctx.body.birth_date || null, source: ctx.body.source ?? "bought", cost: cost != null ? money(cost) : null, status: "active" as const,
    mother_id: ctx.body.mother_id || null, milk_7d: null,
  };
  d.animals.push(animal);
  e.head_count = (e.head_count ?? 0) + 1;
  if (cost) cmd.financeEntry(d, { farm: e.farm_id, enterprise: e.id, kind: "cost", category: "acquisition", amount: cost, date: isoDate(new Date()), source: "animal", sourceId: animal.id, by: me(ctx) });
  return animal;
}, { status: 201 });
route("POST", "/animals/:id/exit", (ctx) => {
  need(ctx, "records.write");
  const d = data(ctx);
  const a = d.animals.find((x) => x.id === ctx.params.id);
  if (!a) throw new MockError(404, "not_found", "Not found.");
  if (a.status !== "active") throw new MockError(400, "animal.already_left", "This animal has already left the herd.");
  const e = enterprise(ctx, a.enterprise_id);
  a.status = ctx.body.reason === "sold" ? "sold" : "dead";
  e.head_count = Math.max(0, (e.head_count ?? 1) - 1);
  const value = Number(ctx.body.value ?? 0);
  if (a.status === "sold" && value > 0 && can(ctx, "money.read")) {
    cmd.financeEntry(d, { farm: e.farm_id, enterprise: e.id, kind: "revenue", category: "animal_sale", amount: value, date: ctx.body.date ?? isoDate(new Date()), note: `${a.tag} ${a.name}`, source: "animal_exit", sourceId: a.id, by: me(ctx) });
  }
  return a;
});

function recordOut(ctx: Ctx, r: MRecord): T.DailyRecord {
  return { id: r.id, date: r.date, produced: r.produced != null ? qty(r.produced) : null, produced_unit: r.produced_unit, feed_qty: r.feed_qty != null ? qty(r.feed_qty) : null, feed_unit: r.feed_unit, deaths: r.deaths, note: r.note, recorded_by: recorder(ctx, r.recorded_by), conflict: r.conflict };
}

route("POST", "/milk-records", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "enterprise_id", "date", "litres");
  positive(ctx.body, "litres");
  const e = enterprise(ctx, ctx.body.enterprise_id);
  moduleEnabled(ctx, e.farm_id, e.type);
  return recordOut(ctx, cmd.milkDay(data(ctx), e, { date: ctx.body.date, litres: Number(ctx.body.litres), by: me(ctx) }));
}, { status: 201 });
route("POST", "/feeding-records", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "enterprise_id", "date", "item_id", "qty", "unit");
  positive(ctx.body, "qty");
  const e = enterprise(ctx, ctx.body.enterprise_id);
  moduleEnabled(ctx, e.farm_id, e.type);
  return recordOut(ctx, cmd.feedDay(data(ctx), e, { date: ctx.body.date, item: ctx.body.item_id, qty: Number(ctx.body.qty), unit: ctx.body.unit, by: me(ctx) }));
}, { status: 201 });
route("POST", "/treatments", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "enterprise_id", "date", "item_id", "qty", "unit");
  positive(ctx.body, "qty");
  const e = enterprise(ctx, ctx.body.enterprise_id);
  moduleEnabled(ctx, e.farm_id, e.type);
  const h = cmd.treatment(data(ctx), e, { date: ctx.body.date, item: ctx.body.item_id, qty: Number(ctx.body.qty), unit: ctx.body.unit, dose: ctx.body.dose_note ?? "", subject: ctx.body.subject || "Whole herd", by: me(ctx) });
  return { ...h, cost: m$(ctx, h.cost), recorded_by: recorder(ctx, h.recorded_by) };
}, { status: 201 });

/* ---------- Batches ---------- */

route("POST", "/batches", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "farm_id", "type", "name", "count", "date");
  positive(ctx.body, "count");
  moduleEnabled(ctx, ctx.body.farm_id, ctx.body.type);
  if (typeInfo(ctx.body.type).module !== "batches") throw new MockError(400, "validation_error", "Choose layers, broilers or fish.");
  const e = cmd.startEnterprise(data(ctx), {
    farm: ctx.body.farm_id, type: ctx.body.type, name: ctx.body.name, date: ctx.body.date, count: Number(ctx.body.count),
    cost: can(ctx, "money.read") ? Number(ctx.body.cost || 0) : 0, source: ctx.body.source ?? "", structure: ctx.body.structure_id || null, by: me(ctx),
  });
  return publicEnterprise(e);
}, { status: 201 });
route("POST", "/batches/:id/days", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "date");
  const e = enterprise(ctx, ctx.params.id);
  moduleEnabled(ctx, e.farm_id, e.type);
  if (e.status === "closed") throw new MockError(400, "enterprise.closed", "This batch is closed.");
  const deaths = Number(ctx.body.deaths || 0);
  if (deaths < 0 || deaths > (e.head_count ?? 0)) throw new MockError(400, "validation_error", "Check the number of deaths.", { deaths: [`Enter a number from 0 to ${e.head_count ?? 0}.`] });
  const rec = cmd.batchDay(data(ctx), e, {
    date: ctx.body.date, feedItem: ctx.body.feed_item_id || null, feedQty: Number(ctx.body.feed_qty || 0), feedUnit: ctx.body.feed_unit || "bag",
    deaths, eggsTrays: Number(ctx.body.eggs_trays || 0), note: ctx.body.note ?? "", by: me(ctx),
  });
  return recordOut(ctx, rec);
}, { status: 201 });

/* ---------- Crops ---------- */

route("POST", "/seasons", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "farm_id", "type", "plot_id", "area_acres", "date", "name");
  positive(ctx.body, "area_acres");
  moduleEnabled(ctx, ctx.body.farm_id, ctx.body.type);
  const d = data(ctx);
  const plot = d.plots.find((p) => p.id === ctx.body.plot_id);
  if (!plot) throw new MockError(400, "validation_error", "Choose a plot.", { plot_id: ["Choose a plot."] });
  const used = d.enterprises.filter((e) => e.plot_id === plot.id && e.status === "active").reduce((s, e) => s + Number(e.area_acres ?? 0), 0);
  if (used + Number(ctx.body.area_acres) > Number(plot.area_acres) + 0.001) {
    throw new MockError(400, "validation_error", "The plot is not big enough.", { area_acres: [`Only ${(Number(plot.area_acres) - used).toFixed(2)} acres of ${plot.name} are free.`] });
  }
  const e = cmd.startEnterprise(d, { farm: ctx.body.farm_id, type: ctx.body.type, name: ctx.body.name, date: ctx.body.date, plot: plot.id, variety: ctx.body.variety ?? "", area: Number(ctx.body.area_acres), by: me(ctx) });
  return publicEnterprise(e);
}, { status: 201 });

route("GET", "/seasons/:id/activities", (ctx) => {
  const d = data(ctx);
  const rows = d.activities
    .filter((a) => a.enterprise_id === ctx.params.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a): T.Activity => ({
      id: a.id, date: a.date, type: a.type, note: a.note, recorded_by: recorder(ctx, a.recorded_by),
      inputs: a.inputs.map((i) => ({ item_name: d.items.find((x) => x.id === i.item_id)?.name.en ?? "", qty: qty(i.qty), unit: i.unit })),
      labour_cost: m$(ctx, a.labour_cost), service_cost: m$(ctx, a.service_cost),
    }));
  return paginate(rows, ctx.q, 50);
});
route("POST", "/seasons/:id/activities", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "date", "type");
  const e = enterprise(ctx, ctx.params.id);
  moduleEnabled(ctx, e.farm_id, e.type);
  const a = cmd.activity(data(ctx), e, {
    date: ctx.body.date, type: ctx.body.type,
    inputs: (ctx.body.inputs ?? []).filter((i: { qty: string }) => Number(i.qty) > 0).map((i: { item_id: string; qty: string; unit: string }) => ({ item: i.item_id, qty: Number(i.qty), unit: i.unit })),
    labour: can(ctx, "money.read") ? Number(ctx.body.labour_cost || 0) : 0, service: can(ctx, "money.read") ? Number(ctx.body.service_cost || 0) : 0, note: ctx.body.note ?? "", by: me(ctx),
  });
  return { ...a, recorded_by: recorder(ctx, a.recorded_by) };
}, { status: 201 });
route("GET", "/seasons/:id/harvests", (ctx) => {
  const rows = data(ctx).harvests
    .filter((h) => h.enterprise_id === ctx.params.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((h) => ({ id: h.id, date: h.date, qty: qty(h.qty), unit: h.unit, moisture: h.moisture, recorded_by: recorder(ctx, h.recorded_by) }));
  return paginate(rows, ctx.q, 50);
});
route("POST", "/seasons/:id/harvests", (ctx) => {
  need(ctx, "records.write");
  requireFields(ctx.body, "date", "qty", "unit");
  positive(ctx.body, "qty");
  const e = enterprise(ctx, ctx.params.id);
  moduleEnabled(ctx, e.farm_id, e.type);
  const h = cmd.harvest(data(ctx), e, { date: ctx.body.date, qty: Number(ctx.body.qty), unit: ctx.body.unit, moisture: ctx.body.moisture ?? "dry", by: me(ctx) });
  return { ...h, qty: qty(h.qty), recorded_by: recorder(ctx, h.recorded_by) };
}, { status: 201 });

/* ---------- Stock ---------- */

route("GET", "/items", (ctx) => paginate(data(ctx).items, ctx.q, 200));
route("PATCH", "/items/:id", (ctx) => {
  need(ctx, "stock.write");
  const it = cmd.item(data(ctx), ctx.params.id);
  it.low_stock_level = ctx.body.low_stock_level ? String(Number(ctx.body.low_stock_level)) : null;
  return it;
});

function balanceRows(ctx: Ctx, farmId: string): T.StockBalance[] {
  const d = data(ctx);
  const picks = d.picks[farmId] ?? [];
  const relevant = new Set(picks.flatMap((p) => TYPE_ITEMS[p]).map(cmd.itemId));
  return balances(d, farmId)
    .filter((b) => relevant.has(b.item.id) || Math.abs(b.qty) > 0.0001)
    .map((b) => {
      const low = b.item.low_stock_level != null ? Number(b.item.low_stock_level) : null;
      const handled = d.movements.some((m) => m.item_id === b.item.id && m.farm_id === farmId);
      const status = b.qty < -0.0001 ? "negative" : handled && low != null && b.qty < low ? "low" : "ok";
      const df = factorFor(b.item, b.item.display_unit);
      return {
        item_id: b.item.id, item_name: b.item.name, location: b.location, enterprise_id: null, enterprise_name: null,
        qty_base: qty(b.qty), base_unit: b.item.base_unit, display_unit: b.item.display_unit, display_factor: df,
        value: m$(ctx, b.item.kind === "input" ? Math.max(0, b.qty) * b.avg : null), low_stock_level: b.item.low_stock_level, status,
      } satisfies T.StockBalance;
    })
    .sort((a, b) => (a.status === b.status ? a.item_name.en.localeCompare(b.item_name.en) : a.status === "ok" ? 1 : b.status === "ok" ? -1 : a.status === "negative" ? -1 : 1));
}

route("GET", "/stock/balances", (ctx) => {
  need(ctx, "stock.read");
  return paginate(balanceRows(ctx, ctx.q.get("farm_id") ?? ""), ctx.q, 200);
});

route("GET", "/stock/movements", (ctx) => {
  need(ctx, "stock.read");
  const d = data(ctx);
  const reversedBy = new Map(d.movements.filter((m) => m.reverses_id).map((m) => [m.reverses_id!, m.id]));
  let rows = d.movements
    .filter((m) => !ctx.q.get("farm_id") || m.farm_id === ctx.q.get("farm_id"))
    .filter((m) => !ctx.q.get("item_id") || m.item_id === ctx.q.get("item_id"))
    .filter((m) => !ctx.q.get("enterprise_id") || m.enterprise_id === ctx.q.get("enterprise_id"))
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  // A reversal sits directly beneath the entry it corrects (7.3).
  const reversals = new Map(rows.filter((m) => m.reverses_id).map((m) => [m.reverses_id!, m]));
  rows = rows.filter((m) => !m.reverses_id || !rows.some((o) => o.id === m.reverses_id)).flatMap((m) => (reversals.has(m.id) ? [m, reversals.get(m.id)!] : [m]));
  const out = rows.map((m): T.StockMovement => {
    const it = d.items.find((i) => i.id === m.item_id)!;
    return {
      id: m.id, item_id: m.item_id, item_name: it.name, movement_type: m.movement_type, qty_entered: qty(m.qty_entered), unit_entered: m.unit_entered,
      qty_base: qty(m.qty_base), base_unit: it.base_unit, unit_cost: m$(ctx, m.unit_cost != null ? m.unit_cost * factorFor(it, m.unit_entered) : null),
      total_cost: m$(ctx, m.unit_cost != null ? Math.abs(m.qty_base) * m.unit_cost : null),
      enterprise_name: d.enterprises.find((e) => e.id === m.enterprise_id)?.name ?? null, reverses_id: m.reverses_id, reversed_by_id: reversedBy.get(m.id) ?? null,
      occurred_at: m.occurred_at, recorded_by: recorder(ctx, m.recorded_by),
    };
  });
  return paginate(out, ctx.q, 30);
});

route("POST", "/stock/movements/:id/reverse", (ctx) => {
  need(ctx, "stock.write");
  const d = data(ctx);
  const m = d.movements.find((x) => x.id === ctx.params.id);
  if (!m) throw new MockError(404, "not_found", "Not found.");
  if (m.movement_type === "reversal") throw new MockError(400, "stock.cannot_reverse_reversal", "A correction can't be reversed. Record the entry again instead.");
  if (d.movements.some((x) => x.reverses_id === m.id)) throw new MockError(400, "stock.already_reversed", "This entry has already been corrected.");
  cmd.reverse(d, m.id, me(ctx));
  return undefined;
});

route("POST", "/stock/counts", (ctx) => {
  need(ctx, "stock.write");
  requireFields(ctx.body, "farm_id", "date");
  const d = data(ctx);
  let adjustments = 0;
  for (const line of ctx.body.lines ?? []) {
    if (line.counted === "" || line.counted == null) continue;
    const it = cmd.item(d, line.item_id);
    const counted = Number(line.counted) * factorFor(it, line.unit);
    const diff = counted - balanceOf(d, ctx.body.farm_id, it.id);
    if (Math.abs(diff) > 0.0001) {
      cmd.countAdjust(d, ctx.body.farm_id, it.id, diff, ctx.body.date, me(ctx));
      adjustments++;
    }
  }
  return { adjustments };
}, { status: 201 });

route("POST", "/stock/transfers", (ctx) => {
  need(ctx, "stock.write");
  requireFields(ctx.body, "farm_id", "item_id", "qty", "unit", "to_enterprise_id", "date");
  positive(ctx.body, "qty");
  cmd.transfer(data(ctx), { farm: ctx.body.farm_id, item: ctx.body.item_id, qty: Number(ctx.body.qty), unit: ctx.body.unit, from: ctx.body.from_enterprise_id || null, to: ctx.body.to_enterprise_id, price: Number(ctx.body.unit_price || 0), date: ctx.body.date, by: me(ctx) });
  return undefined;
});

/* ---------- Customers, suppliers, sales, purchases ---------- */

function debtAge(rows: { date: string; balance: number }[]) {
  const open = rows.filter((r) => r.balance > 0.001).sort((a, b) => a.date.localeCompare(b.date));
  return { balance: open.reduce((s, r) => s + r.balance, 0), oldest: open[0] ? daysBetween(open[0].date, isoDate(new Date())) : null };
}

route("GET", "/customers", (ctx) => {
  need(ctx, "money.read");
  settleSales(ctx);
  const d = data(ctx);
  const rows = d.customers.map((c) => {
    const { balance, oldest } = debtAge(d.sales.filter((s) => s.customer_id === c.id).map((s) => ({ date: s.date, balance: s.total - s.paid })));
    return { ...c, balance: money(balance), oldest_days: oldest };
  }).sort((a, b) => Number(b.balance) - Number(a.balance) || a.name.localeCompare(b.name));
  return paginate(rows, ctx.q, 200);
});
route("POST", "/customers", (ctx) => {
  need(ctx, "sales.write");
  requireFields(ctx.body, "name");
  const phone = ctx.body.phone ? normalizePhone(ctx.body.phone) : "";
  if (ctx.body.phone && !phone) throw new MockError(400, "validation_error", "Check the phone number.", { phone: ["Enter a valid phone number, like 0712 345 678."] });
  const c = { id: crypto.randomUUID(), name: String(ctx.body.name).trim(), phone: phone ?? "" };
  data(ctx).customers.push(c);
  return { ...c, balance: "0.00", oldest_days: null };
}, { status: 201 });

route("GET", "/suppliers", (ctx) => {
  need(ctx, "money.read");
  const d = data(ctx);
  const rows = d.suppliers.map((c) => {
    const { balance, oldest } = debtAge(d.purchases.filter((p) => p.supplier_id === c.id).map((p) => ({ date: p.date, balance: p.total - p.paid })));
    return { ...c, balance: money(balance), oldest_days: oldest };
  }).sort((a, b) => Number(b.balance) - Number(a.balance) || a.name.localeCompare(b.name));
  return paginate(rows, ctx.q, 200);
});
route("POST", "/suppliers", (ctx) => {
  need(ctx, "procurement.write");
  requireFields(ctx.body, "name");
  const phone = ctx.body.phone ? normalizePhone(ctx.body.phone) : "";
  if (ctx.body.phone && !phone) throw new MockError(400, "validation_error", "Check the phone number.", { phone: ["Enter a valid phone number, like 0712 345 678."] });
  const c = { id: crypto.randomUUID(), name: String(ctx.body.name).trim(), phone: phone ?? "" };
  data(ctx).suppliers.push(c);
  return { ...c, balance: "0.00", oldest_days: null };
}, { status: 201 });

function saleOut(ctx: Ctx, s: MSale): T.Sale {
  const d = data(ctx);
  const p = d.payments.find((x) => x.id === s.payment_request_id) ?? null;
  const pending = p && (p.status === "pending" || p.status === "awaiting_otp");
  const status: T.SaleStatus = s.paid >= s.total - 0.001 ? "paid" : pending ? "awaiting_payment" : s.paid > 0 ? "partial" : "credit";
  return {
    id: s.id, number: `S-${String(s.number).padStart(4, "0")}`, date: s.date, customer_id: s.customer_id,
    customer_name: d.customers.find((c) => c.id === s.customer_id)?.name ?? "",
    lines: s.lines.map((l) => ({
      item_id: l.item_id, item_name: d.items.find((i) => i.id === l.item_id)?.name ?? { en: "", sw: "" }, qty: qty(l.qty), unit: l.unit,
      unit_price: money(l.unit_price), enterprise_id: l.enterprise_id, enterprise_name: d.enterprises.find((e) => e.id === l.enterprise_id)?.name ?? null,
    })),
    total: money(s.total), paid: money(s.paid), balance_due: money(Math.max(0, s.total - s.paid)), status, method: s.method, payment_request: p,
    recorded_by: recorder(ctx, s.recorded_by),
  };
}

route("GET", "/sales", async (ctx) => {
  need(ctx, "money.read");
  const d = data(ctx);
  const recent = d.sales.filter((s) => s.payment_request_id && Date.now() - new Date(`${s.date}T23:59:59`).getTime() < 86_400_000);
  await refreshRealPayments(ctx, recent);
  settleSales(ctx);
  const from = ctx.q.get("from");
  const to = ctx.q.get("to");
  const rows = d.sales
    .filter((s) => !ctx.q.get("farm_id") || s.farm_id === ctx.q.get("farm_id"))
    .filter((s) => !ctx.q.get("customer_id") || s.customer_id === ctx.q.get("customer_id"))
    .filter((s) => !ctx.q.get("enterprise_id") || s.lines.some((l) => l.enterprise_id === ctx.q.get("enterprise_id")))
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number)
    .map((s) => saleOut(ctx, s))
    .filter((s) => !ctx.q.get("unpaid") || Number(s.balance_due) > 0);
  return paginate(rows, ctx.q, 25);
});
route("GET", "/sales/:id", async (ctx) => {
  need(ctx, "money.read");
  const s = data(ctx).sales.find((x) => x.id === ctx.params.id);
  if (!s) throw new MockError(404, "not_found", "Not found.");
  await refreshRealPayments(ctx, [s]);
  settleSales(ctx);
  return saleOut(ctx, s);
});

route("POST", "/sales", async (ctx) => {
  need(ctx, "sales.write");
  const b = ctx.body as T.NewSaleInput;
  const fields: Record<string, string[]> = {};
  if (!b.customer_id) fields.customer_id = ["Choose a customer or add a new one."];
  if (!b.lines?.length) fields.lines = ["Add at least one product."];
  b.lines?.forEach((l, i) => {
    if (!(Number(l.qty) > 0)) fields[`lines.${i}.qty`] = ["Enter a quantity greater than zero."];
    if (!(Number(l.unit_price) > 0)) fields[`lines.${i}.unit_price`] = ["Enter a price greater than zero."];
  });
  if (b.payment?.method === "mpesa_code" && !/^[A-Z0-9]{10}$/i.test(b.payment.code ?? "")) fields.code = ["Enter the 10-character M-Pesa code from the customer's SMS, like RJK4XY1234."];
  if (Object.keys(fields).length) throw new MockError(400, "validation_error", "Check the highlighted fields.", fields);
  const d = data(ctx);
  const lines = b.lines.map((l) => ({ item: l.item_id, qty: Number(l.qty), unit: l.unit, price: Number(l.unit_price), enterprise: l.enterprise_id }));
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const paid = b.payment.method === "cash" || b.payment.method === "mpesa_code" ? total : 0;
  const sale = cmd.sell(d, { farm: b.farm_id, customer: b.customer_id, date: b.date, lines, method: b.payment.method, paid, by: me(ctx) });
  if (b.payment.method === "mpesa") {
    try {
      await createPayment(ctx, sale, b.payment.phone ?? "", b.payment.network ?? "mpesa", total);
    } catch (e) {
      // The sale stays on credit; the owner can retry, take cash, or leave the debt (backend 12).
      save();
      throw e;
    }
  }
  return saleOut(ctx, sale);
}, { status: 201 });

route("POST", "/sales/:id/payments", async (ctx) => {
  need(ctx, "sales.write");
  const d = data(ctx);
  const s = d.sales.find((x) => x.id === ctx.params.id);
  if (!s) throw new MockError(404, "not_found", "Not found.");
  const due = s.total - s.paid;
  const amount = Math.min(Number(ctx.body.amount || due), due);
  if (!(amount > 0)) throw new MockError(400, "sale.already_paid", "This sale is already paid.");
  if (ctx.body.method === "mpesa") {
    await createPayment(ctx, s, ctx.body.phone ?? "", ctx.body.network ?? "mpesa", amount);
  } else {
    if (ctx.body.method === "mpesa_code" && !/^[A-Z0-9]{10}$/i.test(ctx.body.code ?? "")) {
      throw new MockError(400, "validation_error", "Check the M-Pesa code.", { code: ["Enter the 10-character M-Pesa code, like RJK4XY1234."] });
    }
    s.paid += amount;
  }
  return saleOut(ctx, s);
});

function purchaseOut(ctx: Ctx, p: MPurchase): T.Purchase {
  const d = data(ctx);
  return {
    id: p.id, number: `P-${String(p.number).padStart(4, "0")}`, date: p.date, supplier_id: p.supplier_id, supplier_name: d.suppliers.find((s) => s.id === p.supplier_id)?.name ?? "",
    lines: p.lines.map((l) => ({ item_id: l.item_id, item_name: d.items.find((i) => i.id === l.item_id)?.name ?? { en: "", sw: "" }, qty: qty(l.qty), unit: l.unit, unit_price: money(l.unit_price) })),
    total: money(p.total), paid: money(p.paid), balance_due: money(p.total - p.paid), status: p.paid >= p.total - 0.001 ? "paid" : p.paid > 0 ? "partial" : "credit",
    recorded_by: recorder(ctx, p.recorded_by),
  };
}

route("GET", "/purchases", (ctx) => {
  need(ctx, "money.read");
  const from = ctx.q.get("from");
  const to = ctx.q.get("to");
  const rows = data(ctx).purchases
    .filter((p) => !ctx.q.get("farm_id") || p.farm_id === ctx.q.get("farm_id"))
    .filter((p) => !ctx.q.get("supplier_id") || p.supplier_id === ctx.q.get("supplier_id"))
    .filter((p) => (!from || p.date >= from) && (!to || p.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number)
    .map((p) => purchaseOut(ctx, p))
    .filter((p) => !ctx.q.get("unpaid") || Number(p.balance_due) > 0);
  return paginate(rows, ctx.q, 25);
});
route("POST", "/purchases", (ctx) => {
  need(ctx, "procurement.write");
  const b = ctx.body as T.NewPurchaseInput;
  const fields: Record<string, string[]> = {};
  if (!b.supplier_id) fields.supplier_id = ["Choose a supplier or add a new one."];
  if (!b.lines?.length) fields.lines = ["Add at least one item."];
  b.lines?.forEach((l, i) => {
    if (!(Number(l.qty) > 0)) fields[`lines.${i}.qty`] = ["Enter a quantity greater than zero."];
    if (!(Number(l.unit_price) >= 0) || l.unit_price === "") fields[`lines.${i}.unit_price`] = ["Enter the price paid."];
  });
  if (Object.keys(fields).length) throw new MockError(400, "validation_error", "Check the highlighted fields.", fields);
  const p = cmd.purchase(data(ctx), {
    farm: b.farm_id, supplier: b.supplier_id, date: b.date, lines: b.lines.map((l) => ({ item: l.item_id, qty: Number(l.qty), unit: l.unit, price: Number(l.unit_price) })),
    paid: b.paid === "full" ? "full" : 0, by: me(ctx),
  });
  return purchaseOut(ctx, p);
}, { status: 201 });
route("POST", "/purchases/:id/payments", (ctx) => {
  need(ctx, "procurement.write");
  const p = data(ctx).purchases.find((x) => x.id === ctx.params.id);
  if (!p) throw new MockError(404, "not_found", "Not found.");
  p.paid = Math.min(p.total, p.paid + Number(ctx.body.amount || p.total - p.paid));
  return purchaseOut(ctx, p);
});

/* ---------- Finance and reports ---------- */

function financeOut(ctx: Ctx, f: MFinance): T.FinanceEntry {
  return {
    id: f.id, kind: f.kind, category: f.category, amount: money(f.amount), occurred_on: f.occurred_on, enterprise_id: f.enterprise_id,
    enterprise_name: data(ctx).enterprises.find((e) => e.id === f.enterprise_id)?.name ?? null, note: f.note, source_type: f.source_type, recorded_by: recorder(ctx, f.recorded_by),
  };
}

route("GET", "/finance/entries", (ctx) => {
  need(ctx, "money.read");
  const from = ctx.q.get("from");
  const to = ctx.q.get("to");
  const rows = data(ctx).finance
    .filter((f) => !ctx.q.get("farm_id") || f.farm_id === ctx.q.get("farm_id"))
    .filter((f) => !ctx.q.get("enterprise_id") || f.enterprise_id === ctx.q.get("enterprise_id"))
    .filter((f) => !ctx.q.get("kind") || f.kind === ctx.q.get("kind"))
    .filter((f) => !ctx.q.get("source_type") || f.source_type === ctx.q.get("source_type"))
    .filter((f) => (!from || f.occurred_on >= from) && (!to || f.occurred_on <= to))
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
    .map((f) => financeOut(ctx, f));
  return paginate(rows, ctx.q, 30);
});
route("POST", "/finance/entries", (ctx) => {
  need(ctx, "finance.write");
  requireFields(ctx.body, "farm_id", "kind", "category", "amount", "occurred_on");
  positive(ctx.body, "amount");
  const f = cmd.financeEntry(data(ctx), {
    farm: ctx.body.farm_id, enterprise: ctx.body.enterprise_id || null, kind: ctx.body.kind, category: ctx.body.category, amount: Number(ctx.body.amount),
    date: ctx.body.occurred_on, note: ctx.body.note ?? "", source: "manual", by: me(ctx),
  });
  return financeOut(ctx, f);
}, { status: 201 });

function profitReport(ctx: Ctx, farmId: string, from: string, to: string): T.ProfitReport {
  const d = data(ctx);
  const entries = entriesFor(d, farmId, from, to);
  const len = daysBetween(from, to) + 1;
  const prev = entriesFor(d, farmId, addDays(from, -len), addDays(from, -1));
  const picks = d.picks[farmId] ?? [];
  const ents = d.enterprises.filter((e) => e.farm_id === farmId && picks.includes(e.type));
  const rows: T.EnterpriseProfit[] = ents
    .map((e) => {
      const es = entries.filter((f) => f.enterprise_id === e.id);
      const revenue = sumBy(es, "revenue", true);
      const cost = sumBy(es, "cost", true);
      return { enterprise_id: e.id, name: e.name, type: e.type, status: e.status, revenue: money(revenue), cost: money(cost), profit: money(revenue - cost), _any: es.length > 0 || (e.status === "active" && e.started_on <= to) };
    })
    .filter((r) => r._any)
    .map(({ _any, ...r }) => r);
  const overhead = entries.filter((f) => f.enterprise_id === null);
  if (overhead.length) {
    const revenue = sumBy(overhead, "revenue");
    const cost = sumBy(overhead, "cost");
    rows.push({ enterprise_id: null, name: "Whole farm", type: null, status: "active", revenue: money(revenue), cost: money(cost), profit: money(revenue - cost) });
  }
  rows.sort((a, b) => Number(b.profit) - Number(a.profit));
  const revenue = sumBy(entries, "revenue");
  const cost = sumBy(entries, "cost");
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(`${to}T12:00:00`);
    const start = new Date(ref.getFullYear(), ref.getMonth() - (5 - i), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() - (5 - i) + 1, 0);
    const es = entriesFor(d, farmId, isoDate(start), isoDate(end));
    const r = sumBy(es, "revenue");
    const c = sumBy(es, "cost");
    return { month: isoDate(start).slice(0, 7), revenue: money(r), cost: money(c), profit: money(r - c) };
  });
  return { from, to, revenue: money(revenue), cost: money(cost), profit: money(revenue - cost), previous_profit: money(sumBy(prev, "revenue") - sumBy(prev, "cost")), enterprises: rows, monthly };
}

route("GET", "/reports/profit", (ctx) => {
  need(ctx, "money.read");
  return profitReport(ctx, ctx.q.get("farm_id") ?? "", ctx.q.get("from") ?? daysAgo(29), ctx.q.get("to") ?? isoDate(new Date()));
});

route("GET", "/reports/cost-per-unit", (ctx) => {
  need(ctx, "money.read");
  const d = data(ctx);
  const farm = ctx.q.get("farm_id") ?? "";
  const from = ctx.q.get("from") ?? daysAgo(29);
  const to = ctx.q.get("to") ?? isoDate(new Date());
  const picks = d.picks[farm] ?? [];
  return d.enterprises
    .filter((e) => e.farm_id === farm && picks.includes(e.type) && TYPE_OUTPUT[e.type] && e.type !== "broilers")
    .map((e): T.CostPerUnit => {
      const produced = producedIn(d, e, from, to);
      const cost = sumBy(d.finance.filter((f) => f.enterprise_id === e.id && inRange(f.occurred_on, from, to)), "cost", true);
      return { enterprise_id: e.id, name: e.name, produced_qty: qty(produced), unit: TYPE_OUTPUT[e.type]!.unit, cost: money(cost), cost_per_unit: produced > 0 ? money(cost / produced) : null };
    })
    .filter((r) => Number(r.cost) > 0 || Number(r.produced_qty) > 0);
});

function csv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((c) => {
    const s = c == null ? "" : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}

route("POST", "/exports", (ctx) => {
  need(ctx, "money.read");
  const d = data(ctx);
  const { farm_id, from, to, kinds } = ctx.body as { farm_id: string; from: string; to: string; kinds: string[] };
  const files: { name: string; url: string }[] = [];
  const url = (text: string) => `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`;
  if (kinds.includes("sales")) {
    const rows = d.sales.filter((s) => s.farm_id === farm_id && inRange(s.date, from, to)).map((s) => saleOut(ctx, s));
    files.push({ name: `sales_${from}_${to}.csv`, url: url(csv([["Number", "Date", "Customer", "Products", "Total (KES)", "Paid (KES)", "Owed (KES)", "Payment"], ...rows.map((s) => [s.number, s.date, s.customer_name, s.lines.map((l) => `${l.qty} ${l.unit} ${l.item_name.en}`).join("; "), s.total, s.paid, s.balance_due, s.method])])) });
  }
  if (kinds.includes("expenses")) {
    const rows = d.finance.filter((f) => f.farm_id === farm_id && f.kind === "cost" && inRange(f.occurred_on, from, to)).map((f) => financeOut(ctx, f));
    files.push({ name: `expenses_${from}_${to}.csv`, url: url(csv([["Date", "Category", "Enterprise", "Amount (KES)", "Note", "Recorded by"], ...rows.map((f) => [f.occurred_on, f.category, f.enterprise_name ?? "Whole farm", f.amount, f.note, f.recorded_by.name])])) });
  }
  if (kinds.includes("stock")) {
    const rows = d.movements.filter((m) => m.farm_id === farm_id && inRange(m.occurred_at.slice(0, 10), from, to)).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    files.push({ name: `stock_movements_${from}_${to}.csv`, url: url(csv([["Date", "Item", "Movement", "Quantity", "Unit", "Quantity (base)", "Base unit", "Enterprise", "Recorded by"], ...rows.map((m) => {
      const it = d.items.find((i) => i.id === m.item_id)!;
      return [m.occurred_at.slice(0, 10), it.name.en, m.movement_type, m.qty_entered, m.unit_entered, qty(m.qty_base), it.base_unit, d.enterprises.find((e) => e.id === m.enterprise_id)?.name ?? "", recorder(ctx, m.recorded_by).name];
    })])) });
  }
  return { files };
}, { status: 201 });

/* ---------- Weather ---------- */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function day(farm: T.Farm, date: string, heavy: boolean): T.ForecastDay {
  const cell = farm.location ? `${farm.location.lat.toFixed(1)},${farm.location.lng.toFixed(1)}` : farm.county;
  const r = hash(`${cell}:${date}`);
  const rain = heavy ? 38 + r * 10 : r < 0.45 ? 0 : r < 0.75 ? Math.round(r * 6) : Math.round(4 + r * 14);
  const condition: T.ForecastDay["condition"] = rain >= 30 ? "heavy_rain" : rain >= 8 ? "rain" : rain > 0 ? "light_rain" : r < 0.2 ? "sunny" : "cloudy";
  return { date, rain_mm: Math.round(rain * 10) / 10, rain_probability: Math.min(95, Math.round(rain > 0 ? 40 + rain * 2 : r * 30)), t_min: Math.round(12 + r * 3), t_max: Math.round(21 + hash(`${date}:${cell}`) * 6), condition };
}

function weatherFor(farm: T.Farm): T.Weather {
  const today = isoDate(new Date());
  return {
    farm_id: farm.id,
    fetched_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    forecast: Array.from({ length: 7 }, (_, i) => day(farm, addDays(today, i), i === 2)),
    history: Array.from({ length: 30 }, (_, i) => day(farm, addDays(today, i - 30), false)),
  };
}

route("GET", "/weather", (ctx) => weatherFor(farmOf(ctx, ctx.q.get("farm_id"))));

/* ---------- Alerts (section 14) ---------- */

const BROILER_SCHEDULE = [
  { day: 7, product: "Newcastle" },
  { day: 14, product: "Gumboro" },
  { day: 21, product: "Gumboro" },
  { day: 32, product: "Newcastle booster" },
];

function alertsFor(ctx: Ctx, farmId: string): T.Alert[] {
  const d = data(ctx);
  const farm = farmOf(ctx, farmId);
  const today = isoDate(new Date());
  const picks = d.picks[farmId] ?? [];
  const out: T.Alert[] = [];
  const push = (a: Omit<T.Alert, "status" | "farm_id" | "created_at"> & { created_at?: string }) =>
    out.push({ ...a, farm_id: farmId, created_at: a.created_at ?? new Date().toISOString(), status: d.alertsSeen.includes(a.id) ? "seen" : "open" });

  for (const b of balanceRows(ctx, farmId)) {
    const shown = (Number(b.qty_base) / b.display_factor).toFixed(1).replace(/\.0$/, "");
    if (b.status === "negative") push({ id: `negative_stock:${b.item_id}`, type: "negative_stock", severity: "critical", subject_type: "item", subject_id: b.item_id, params: { item: b.item_name.en, item_sw: b.item_name.sw, qty: shown, unit: b.display_unit }, money: false });
    else if (b.status === "low") push({ id: `low_stock:${b.item_id}`, type: "low_stock", severity: "warning", subject_type: "item", subject_id: b.item_id, params: { item: b.item_name.en, item_sw: b.item_name.sw, qty: shown, unit: b.display_unit }, money: false });
  }
  for (const e of d.enterprises.filter((x) => x.farm_id === farmId && x.status === "active" && x.module === "batches" && picks.includes(x.type))) {
    const recs = d.records.filter((r) => r.enterprise_id === e.id);
    for (const date of [addDays(today, -1), today]) {
      const deaths = recs.filter((r) => r.date === date).reduce((s, r) => s + (r.deaths ?? 0), 0);
      const week = recs.filter((r) => r.date < date && r.date >= addDays(date, -7)).reduce((s, r) => s + (r.deaths ?? 0), 0) / 7;
      if (deaths >= Math.max(3, week * 3)) push({ id: `mortality_spike:${e.id}:${date}`, type: "mortality_spike", severity: "critical", subject_type: "enterprise", subject_id: e.id, params: { enterprise: e.name, deaths, date }, money: false, created_at: `${date}T18:00:00Z` });
    }
    if (e.type === "broilers") {
      const age = daysBetween(e.started_on, today);
      for (const s of BROILER_SCHEDULE) {
        const given = d.health.some((h) => h.enterprise_id === e.id && daysBetween(e.started_on, h.date) >= s.day - 3);
        if (s.day >= age && s.day - age <= 3 && !given) {
          push({ id: `vaccination_due:${e.id}:${s.day}`, type: "vaccination_due", severity: "warning", subject_type: "enterprise", subject_id: e.id, params: { enterprise: e.name, product: s.product, date: addDays(e.started_on, s.day), days: s.day - age }, money: false });
        }
      }
    }
    if (recs.some((r) => r.conflict)) push({ id: `sync_conflict:${e.id}`, type: "sync_conflict", severity: "info", subject_type: "enterprise", subject_id: e.id, params: { enterprise: e.name }, money: false });
  }
  for (const f of weatherFor(farm).forecast.filter((x) => x.rain_mm >= 30)) {
    push({ id: `heavy_rain:${farmId}:${f.date}`, type: "heavy_rain", severity: "warning", subject_type: "farm", subject_id: farmId, params: { date: f.date, rain_mm: f.rain_mm }, money: false });
  }
  if (can(ctx, "money.read")) {
    settleSales(ctx);
    for (const c of d.customers) {
      const { balance, oldest } = debtAge(d.sales.filter((s) => s.customer_id === c.id && s.farm_id === farmId).map((s) => ({ date: s.date, balance: s.total - s.paid })));
      if (balance > 0 && oldest != null && oldest >= 14) push({ id: `overdue_debt:${c.id}`, type: "overdue_debt", severity: "warning", subject_type: "customer", subject_id: c.id, params: { customer: c.name, amount: money(balance), days: oldest }, money: true });
    }
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

route("GET", "/alerts", (ctx) => paginate(alertsFor(ctx, ctx.q.get("farm_id") ?? ""), ctx.q, 100));
route("POST", "/alerts/:id/seen", (ctx) => {
  const d = data(ctx);
  if (!d.alertsSeen.includes(ctx.params.id)) d.alertsSeen.push(ctx.params.id);
  return { id: ctx.params.id, status: "seen" };
});

/* ---------- Dashboard (section 15) ---------- */

route("GET", "/dashboard", (ctx) => {
  const farmId = ctx.q.get("farm_id") ?? "";
  farmOf(ctx, farmId);
  const d = data(ctx);
  const from = ctx.q.get("from") ?? daysAgo(29);
  const to = ctx.q.get("to") ?? isoDate(new Date());
  const today = isoDate(new Date());
  const picks = d.picks[farmId] ?? [];
  let receivables: T.Dashboard["receivables"] = null;
  if (can(ctx, "money.read")) {
    settleSales(ctx);
    const per = d.customers.map((c) => ({ c, ...debtAge(d.sales.filter((s) => s.customer_id === c.id && s.farm_id === farmId).map((s) => ({ date: s.date, balance: s.total - s.paid }))) })).filter((x) => x.balance > 0.001);
    const oldest = per.slice().sort((a, b) => (b.oldest ?? 0) - (a.oldest ?? 0))[0];
    receivables = { total: money(per.reduce((s, x) => s + x.balance, 0)), customers: per.length, oldest_days: oldest?.oldest ?? null, oldest_customer: oldest?.c.name ?? null };
  }
  const todayRecords: T.TodayRecord[] = d.enterprises
    .filter((e) => e.farm_id === farmId && e.status === "active" && picks.includes(e.type))
    .map((e) => {
      const recs = d.records.filter((r) => r.enterprise_id === e.id && r.date === today);
      const summary: T.TodayRecord["summary"] = [];
      const produced = recs.reduce((s, r) => s + (r.produced ?? 0), 0);
      const feed = recs.reduce((s, r) => s + (r.feed_qty ?? 0), 0);
      const deaths = recs.reduce((s, r) => s + (r.deaths ?? 0), 0);
      if (e.type === "layers") summary.push({ code: "eggs", value: qty(produced), unit: "tray" });
      if (e.module === "livestock" && TYPE_OUTPUT[e.type]) summary.push({ code: "milk", value: qty(produced), unit: "l" });
      if (e.module !== "crops") summary.push({ code: "feed", value: qty(feed), unit: recs.find((r) => r.feed_unit)?.feed_unit ?? "bag" });
      if (e.module === "batches") summary.push({ code: "deaths", value: String(deaths), unit: "" });
      return { enterprise_id: e.id, name: e.name, type: e.type, recorded: recs.length > 0 || e.module === "crops", summary };
    });
  return {
    farm_id: farmId, from, to,
    profit: can(ctx, "money.read") ? profitReport(ctx, farmId, from, to) : null,
    receivables,
    alerts: alertsFor(ctx, farmId).filter((a) => a.status === "open" && (!a.money || can(ctx, "money.read"))),
    today: todayRecords,
    stock: balanceRows(ctx, farmId),
  } satisfies T.Dashboard;
});



/* ---------- Staff analytics (demo numbers) ---------- */
function farmerRow(ctx: Ctx, u: MUser, i: number): T.StaffFarmer {
  const m = ctx.db.memberships.find((x) => x.user_id === u.id && x.is_active);
  const joined = new Date(Date.now() - (i * 7 + 2) * 3_600_000);
  return {
    id: u.id, name: u.name, phone: u.phone, email: u.email, username: u.username, date_joined: joined.toISOString(),
    organisation: m ? ctx.db.orgs.find((o) => o.id === m.org_id)?.name ?? null : null, role: m?.role ?? null,
    platform: i % 3 === 1 ? "web" : "android", last_seen_at: new Date(joined.getTime() + 3_600_000).toISOString(), is_active: true,
  };
}

route("GET", "/staff/farmers", (ctx) => {
  if (!ctx.db.staff.includes(ctx.userId ?? "")) throw new MockError(403, "permission_denied", "You do not have permission to do this.");
  const q = (ctx.q.get("q") ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  const rows = ctx.db.users
    .filter((u) => !ctx.db.staff.includes(u.id))
    .map((u, i) => farmerRow(ctx, u, i))
    .filter((r) => !q || [r.name, r.email, r.username].some((v) => v?.toLowerCase().includes(q)) || (!!digits && r.phone.includes(digits)));
  return paginate(rows, ctx.q, 50);
}, { org: false });

/** Repeatable pseudo-random numbers, so the demo shows the same platform each load. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

route("GET", "/staff/analytics", (ctx) => {
  if (!ctx.db.staff.includes(ctx.userId ?? "")) throw new MockError(403, "permission_denied", "You do not have permission to do this.");
  const days = Number(ctx.q.get("days") ?? 30) as T.AnalyticsDays;
  if (![7, 30, 90].includes(days)) throw new MockError(400, "validation_error", "Some fields are not valid.", { days: ["Choose 7, 30 or 90."] });
  const rand = seeded(20260930);
  const today = new Date();
  const series = (n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (n - 1 - i));
    const growth = 1 + (90 - (n - 1 - i)) / 120; // the platform grows over the last 90 days
    const weekend = d.getDay() === 0 ? 0.55 : d.getDay() === 6 ? 0.8 : 1;
    const signups = Math.round((4 + rand() * 7) * growth * weekend);
    return {
      date: isoDate(d),
      signups,
      organisations: Math.round(signups * (0.72 + rand() * 0.2)),
      active_farmers: Math.round((180 + rand() * 60) * growth * weekend),
      collected: money(Math.round((26000 + rand() * 34000) * growth * weekend)),
    };
  });
  const all = series(days * 2);
  const daily = all.slice(days);
  const prev = all.slice(0, days);
  const sum = (rows: typeof daily, k: "signups" | "organisations") => rows.reduce((a, r) => a + r[k], 0);
  const collected = daily.reduce((a, r) => a + Number(r.collected), 0);
  const signed = sum(daily, "signups");
  const requests = Math.round(collected / 2100);
  const succeeded = Math.round(requests * 0.87);
  const users = ctx.db.users.filter((u) => !ctx.db.staff.includes(u.id));
  return {
    days, from: daily[0]!.date, to: daily[daily.length - 1]!.date, generated_at: new Date().toISOString(), currency: "KES",
    totals: {
      farmers: { total: 1184 + signed, new: signed, previous_new: sum(prev, "signups") },
      organisations: { total: 968 + sum(daily, "organisations"), new: sum(daily, "organisations"), previous_new: sum(prev, "organisations") },
      active_farmers: { count: Math.round(640 * (1 + days / 150)), previous: Math.round(590 * (1 + days / 150)) },
      payments: { collected: money(collected), previous_collected: money(prev.reduce((a, r) => a + Number(r.collected), 0)), requests, succeeded, success_rate: Math.round((succeeded / Math.round(requests * 0.97)) * 100) },
      pending_invitations: 37,
    },
    daily,
    funnel: [
      { step: "signed_up", count: signed },
      { step: "farm_account", count: Math.round(signed * 0.91) },
      { step: "added_member", count: Math.round(signed * 0.38) },
      { step: "requested_payment", count: Math.round(signed * 0.22) },
    ],
    platforms: [
      { platform: "android", devices: 1432, farmers: 1206 },
      { platform: "web", devices: 311, farmers: 268 },
      { platform: "ios", devices: 94, farmers: 88 },
    ],
    languages: [{ locale: "sw", farmers: 902 + Math.round(signed * 0.7) }, { locale: "en", farmers: 282 + Math.round(signed * 0.3) }],
    roles: [{ role: "owner", members: 968 }, { role: "field_worker", members: 544 }, { role: "manager", members: 131 }],
    payment_statuses: [
      { status: "succeeded", count: succeeded },
      { status: "failed", count: Math.round(requests * 0.07) },
      { status: "expired", count: Math.round(requests * 0.03) },
      { status: "pending", count: requests - succeeded - Math.round(requests * 0.07) - Math.round(requests * 0.03) },
    ],
    recent_signups: users.slice(0, 10).map((u, i) => farmerRow(ctx, u, i)),
    top_organisations: [
      ...ctx.db.orgs.map((o) => ({
        id: o.id, name: o.name, created_at: o.created_at,
        members: ctx.db.memberships.filter((m) => m.org_id === o.id && m.is_active).length,
        owner: ctx.db.users.find((u) => ctx.db.memberships.some((m) => m.org_id === o.id && m.user_id === u.id && m.role === "owner"))?.name ?? null,
        collected: money(o.name.startsWith("Kamau") ? 184250 : 61300),
      })),
      { id: "demo-3", name: "Chebet dairy", created_at: "2026-03-04T08:00:00Z", members: 6, owner: "Ruth Chebet", collected: "242100.00" },
      { id: "demo-4", name: "Ouma fish ponds", created_at: "2026-05-19T08:00:00Z", members: 4, owner: "Peter Ouma", collected: "97800.00" },
    ].sort((a, b) => b.members - a.members),
  } satisfies T.StaffAnalytics;
}, { org: false });
