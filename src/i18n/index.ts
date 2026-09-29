import { useCallback } from "react";
import type { Locale } from "@/api/types";
import { useUi } from "@/stores/ui";
import en from "./en";
import sw from "./sw";

export type MsgKey = keyof typeof en;
export type Params = Record<string, string | number | null | undefined>;

const dicts: Record<Locale, Record<MsgKey, string>> = { en, sw };

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));
}

export function translate(locale: Locale, key: MsgKey, params?: Params): string {
  return interpolate(dicts[locale][key] ?? en[key] ?? key, params);
}

/** For keys built at runtime (codes from the API). Falls back to `fallback`, never shows a raw key. */
export function translateDynamic(locale: Locale, key: string, fallback: string, params?: Params): string {
  const text = (dicts[locale] as Record<string, string>)[key] ?? (en as Record<string, string>)[key];
  return interpolate(text ?? fallback, params);
}

export interface Translator {
  (key: MsgKey, params?: Params): string;
  /** Plural by count: uses `${base}.one` or `${base}.other`. */
  n: (base: string, count: number, params?: Params) => string;
  dyn: (key: string, fallback: string, params?: Params) => string;
  unit: (code: string, count?: number) => string;
  locale: Locale;
}

export function makeT(locale: Locale): Translator {
  const t = ((key: MsgKey, params?: Params) => translate(locale, key, params)) as Translator;
  t.n = (base, count, params) => translateDynamic(locale, `${base}.${count === 1 ? "one" : "other"}`, base, { n: count, ...params });
  t.dyn = (key, fallback, params) => translateDynamic(locale, key, fallback, params);
  t.unit = (code, count = 2) => translateDynamic(locale, `unit.${code}.${count === 1 ? "one" : "other"}`, code);
  t.locale = locale;
  return t;
}

const cache: Partial<Record<Locale, Translator>> = {};

export function useT(): Translator {
  const locale = useUi((s) => s.locale);
  const get = useCallback(() => (cache[locale] ??= makeT(locale)), [locale]);
  return get();
}

/** "3 bags", "1 tray", "1.5 bags" in the reader's language. */
export function useQty() {
  const t = useT();
  return useCallback(
    (value: string | number | null | undefined, unit: string, maxDecimals = 1) => {
      if (value === null || value === undefined || value === "") return "";
      const n = Number(value);
      const shown = n.toLocaleString("en-KE", { maximumFractionDigits: maxDecimals });
      return `${shown} ${t.unit(unit, Math.abs(n) === 1 ? 1 : 2)}`;
    },
    [t],
  );
}
