import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Locale } from "@/api/types";

export type RangePreset = "this_month" | "last_month" | "last_30" | "this_year";

interface UiState {
  locale: Locale;
  /** Last farm chosen per organisation. */
  farmByOrg: Record<string, string>;
  range: RangePreset;
  drawerOpen: boolean;

  setLocale: (locale: Locale) => void;
  setFarm: (orgId: string, farmId: string) => void;
  setRange: (range: RangePreset) => void;
  setDrawer: (open: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      locale: "sw",
      farmByOrg: {},
      range: "this_month",
      drawerOpen: false,

      setLocale: (locale) => {
        document.documentElement.lang = locale;
        set({ locale });
      },
      setFarm: (orgId, farmId) => set((s) => ({ farmByOrg: { ...s.farmByOrg, [orgId]: farmId } })),
      setRange: (range) => set({ range }),
      setDrawer: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: "shamba-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ locale, farmByOrg, range }) => ({ locale, farmByOrg, range }),
    },
  ),
);

export function rangeDates(preset: RangePreset, today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const utc = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd));
  switch (preset) {
    case "this_month":
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m, today.getDate())) };
    case "last_month":
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case "last_30":
      return { from: iso(utc(y, m, today.getDate() - 29)), to: iso(utc(y, m, today.getDate())) };
    case "this_year":
      return { from: iso(utc(y, 0, 1)), to: iso(utc(y, m, today.getDate())) };
  }
}
