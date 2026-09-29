import type { Locale } from "@/api/types";

const intlLocale = (l: Locale) => (l === "sw" ? "sw-KE" : "en-KE");

/** "KES 245,600": thousands separators, no decimals unless the value has cents (section 10). */
export function formatMoney(value: string | number | null | undefined, currency = "KES", opts: { abs?: boolean } = {}): string {
  if (value === null || value === undefined || value === "") return "";
  let n = Number(value);
  if (opts.abs) n = Math.abs(n);
  const hasCents = Math.round(n * 100) % 100 !== 0;
  const s = Math.abs(n).toLocaleString("en-KE", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: hasCents ? 2 : 0 });
  return `${n < 0 ? "−" : ""}${currency} ${s}`;
}

export function formatNumber(value: string | number | null | undefined, maxDecimals = 1): string {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString("en-KE", { maximumFractionDigits: maxDecimals });
}

export function formatDate(iso: string | null | undefined, locale: Locale, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    ...(opts.year === false ? {} : { year: "numeric" }),
    ...(opts.weekday ? { weekday: "short" } : {}),
  }).format(d);
}

const SW_WEEKDAYS = ["Jpili", "Jtatu", "Jnne", "Jtano", "Alh", "Ijm", "Jmos"];

export function formatWeekday(iso: string, locale: Locale): string {
  if (locale === "sw") return SW_WEEKDAYS[new Date(`${iso}T12:00:00`).getDay()]!;
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(new Date(`${iso}T12:00:00`));
}

export function formatMonth(yyyyMm: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short" }).format(new Date(`${yyyyMm}-01T12:00:00`));
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysSince(iso: string): number {
  return Math.round((new Date(`${today()}T12:00:00`).getTime() - new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()) / 86_400_000);
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
