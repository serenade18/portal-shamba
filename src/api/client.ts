import { useSession } from "@/stores/session";
import type { ApiErrorBody } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";
export type MockMode = "all" | "missing" | "none";
export const MOCK_MODE = (import.meta.env.VITE_MOCK ?? "none") as MockMode;

/** Routes the Django backend serves today. With VITE_MOCK=missing, everything else is mocked. */
const IMPLEMENTED = [
  /^\/health$/,
  /^\/auth\//,
  /^\/me$/,
  /^\/me\/organisations$/,
  /^\/me\/invitations\/[^/]+\/accept$/,
  /^\/organisation$/,
  /^\/members(\/[^/]+)?$/,
  /^\/invitations(\/[^/]+)?$/,
  /^\/payments\/requests(\/[^/]+)?(\/otp)?$/,
];

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message || body.code);
    this.status = status;
    this.body = body;
  }
  get code() {
    return this.body.code;
  }
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Send X-Org-Id. Defaults to true whenever an organisation is active. */
  org?: boolean;
  auth?: boolean;
}

export interface RawRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Record<string, string>;
}

type MockHandler = (req: RawRequest) => Promise<{ status: number; body: unknown }>;
let mockHandler: MockHandler | null = null;

async function loadMock(): Promise<MockHandler> {
  if (!mockHandler) mockHandler = (await import("./mock/server")).handle;
  return mockHandler;
}

function shouldMock(path: string): boolean {
  if (MOCK_MODE === "all") return true;
  if (MOCK_MODE === "none") return false;
  return !IMPLEMENTED.some((re) => re.test(path));
}

/** Sends the request to the real backend, ignoring the mock. Used by the mock for passthrough. */
export async function sendNetwork(req: RawRequest): Promise<{ status: number; body: unknown }> {
  const qs = req.query.toString();
  const res = await fetch(`${BASE}${req.path}${qs ? `?${qs}` : ""}`, {
    method: req.method,
    headers: { Accept: "application/json", ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}), ...req.headers },
    body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { code: "server_error", message: text.slice(0, 200), params: {}, fields: {} };
    }
  }
  return { status: res.status, body };
}

function buildRequest(method: string, path: string, opts: RequestOptions): RawRequest {
  const s = useSession.getState();
  const headers: Record<string, string> = {};
  if (opts.auth !== false && s.access) headers.Authorization = `Bearer ${s.access}`;
  if (opts.org !== false && s.activeOrgId) headers["X-Org-Id"] = s.activeOrgId;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") query.set(k, String(v));
  }
  return { method, path, query, body: opts.body, headers };
}

async function send(req: RawRequest) {
  if (shouldMock(req.path)) return (await loadMock())(req);
  return sendNetwork(req);
}

let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh token once, however many requests hit a 401 at the same time. */
export function refreshAccess(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const { refresh, setTokens, signOut } = useSession.getState();
      if (!refresh) return false;
      const res = await send(buildRequest("POST", "/auth/token/refresh", { body: { refresh }, auth: false, org: false }));
      if (res.status === 200) {
        const b = res.body as { access: string; refresh?: string };
        setTokens(b.access, b.refresh);
        return true;
      }
      signOut();
      return false;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function api<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  if (opts.auth !== false && !useSession.getState().access && useSession.getState().refresh) {
    await refreshAccess();
  }
  let res = await send(buildRequest(method, path, opts));
  if (res.status === 401 && opts.auth !== false && (await refreshAccess())) {
    res = await send(buildRequest(method, path, opts));
  }
  if (res.status >= 400) {
    const body = (res.body ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, {
      code: body.code ?? `http_${res.status}`,
      message: body.message ?? "",
      params: body.params ?? {},
      fields: body.fields ?? {},
    });
  }
  return res.body as T;
}

export const http = {
  get: <T>(path: string, query?: RequestOptions["query"], opts?: RequestOptions) => api<T>("GET", path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => api<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => api<T>("PATCH", path, { ...opts, body }),
  del: <T = void>(path: string, opts?: RequestOptions) => api<T>("DELETE", path, opts),
};
