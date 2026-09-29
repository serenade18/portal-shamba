import type { Catalogue, Item, TypeCode } from "../types";

export const CATALOGUE: Catalogue = {
  version: 1,
  enterprise_types: [
    { code: "dairy_cattle", module: "livestock", tracking_mode: "individual", icon: "🐄", labels: { en: "Dairy cows", sw: "Ng'ombe wa maziwa" } },
    { code: "beef_cattle", module: "livestock", tracking_mode: "individual", icon: "🐂", labels: { en: "Beef cattle", sw: "Ng'ombe wa nyama" } },
    { code: "dairy_goats", module: "livestock", tracking_mode: "individual", icon: "🐐", labels: { en: "Dairy goats", sw: "Mbuzi wa maziwa" } },
    { code: "sheep", module: "livestock", tracking_mode: "individual", icon: "🐑", labels: { en: "Sheep", sw: "Kondoo" } },
    { code: "layers", module: "batches", tracking_mode: "batch", icon: "🥚", labels: { en: "Layers", sw: "Kuku wa mayai" } },
    { code: "broilers", module: "batches", tracking_mode: "batch", icon: "🐔", labels: { en: "Broilers", sw: "Kuku wa nyama" } },
    { code: "fish", module: "batches", tracking_mode: "batch", icon: "🐟", labels: { en: "Fish", sw: "Samaki" } },
    { code: "maize", module: "crops", tracking_mode: "crop_season", icon: "🌽", labels: { en: "Maize", sw: "Mahindi" } },
    { code: "beans", module: "crops", tracking_mode: "crop_season", icon: "🫘", labels: { en: "Beans", sw: "Maharagwe" } },
    { code: "rice", module: "crops", tracking_mode: "crop_season", icon: "🌾", labels: { en: "Rice", sw: "Mchele" } },
    { code: "wheat", module: "crops", tracking_mode: "crop_season", icon: "🌾", labels: { en: "Wheat", sw: "Ngano" } },
  ],
  coming_soon: [
    { code: "pigs", labels: { en: "Pigs", sw: "Nguruwe" } },
    { code: "rabbits", labels: { en: "Rabbits", sw: "Sungura" } },
    { code: "tomatoes", labels: { en: "Tomatoes", sw: "Nyanya" } },
    { code: "kales", labels: { en: "Kales", sw: "Sukuma wiki" } },
    { code: "bananas", labels: { en: "Bananas", sw: "Ndizi" } },
    { code: "avocados", labels: { en: "Avocados", sw: "Parachichi" } },
  ],
};

type ItemDef = Omit<Item, "id" | "low_stock_level"> & { code: string; low?: number };

export const ITEM_DEFS: Record<string, ItemDef> = {
  milk: { code: "milk", kind: "output", name: { en: "Milk", sw: "Maziwa" }, base_unit: "l", display_unit: "l", units: [{ code: "l", factor: 1 }] },
  goat_milk: { code: "goat_milk", kind: "output", name: { en: "Goat milk", sw: "Maziwa ya mbuzi" }, base_unit: "l", display_unit: "l", units: [{ code: "l", factor: 1 }] },
  eggs: { code: "eggs", kind: "output", name: { en: "Eggs", sw: "Mayai" }, base_unit: "piece", display_unit: "tray", units: [{ code: "tray", factor: 30 }, { code: "piece", factor: 1 }, { code: "crate", factor: 360 }] },
  live_broilers: { code: "live_broilers", kind: "output", name: { en: "Broilers (live)", sw: "Kuku wa nyama (hai)" }, base_unit: "bird", display_unit: "bird", units: [{ code: "bird", factor: 1 }] },
  fish_harvest: { code: "fish_harvest", kind: "output", name: { en: "Fish", sw: "Samaki" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "piece", factor: 0.35 }] },
  maize_grain: { code: "maize_grain", kind: "output", name: { en: "Maize grain", sw: "Mahindi (nafaka)" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 90 }, { code: "debe", factor: 18 }, { code: "kg", factor: 1 }] },
  beans_grain: { code: "beans_grain", kind: "output", name: { en: "Beans", sw: "Maharagwe" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 90 }, { code: "debe", factor: 20 }, { code: "kg", factor: 1 }] },
  rice_paddy: { code: "rice_paddy", kind: "output", name: { en: "Rice (paddy)", sw: "Mpunga" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 80 }, { code: "kg", factor: 1 }] },
  wheat_grain: { code: "wheat_grain", kind: "output", name: { en: "Wheat", sw: "Ngano" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 90 }, { code: "kg", factor: 1 }] },
  dairy_meal: { code: "dairy_meal", kind: "input", name: { en: "Dairy meal", sw: "Chakula cha ng'ombe" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 70 }, { code: "kg", factor: 1 }], low: 140 },
  layers_mash: { code: "layers_mash", kind: "input", name: { en: "Layers mash", sw: "Chakula cha kuku wa mayai" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 70 }, { code: "kg", factor: 1 }], low: 210 },
  broiler_feed: { code: "broiler_feed", kind: "input", name: { en: "Broiler finisher", sw: "Chakula cha kuku wa nyama" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }], low: 100 },
  fish_feed: { code: "fish_feed", kind: "input", name: { en: "Fish pellets", sw: "Chakula cha samaki" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 25 }, { code: "kg", factor: 1 }], low: 25 },
  dap: { code: "dap", kind: "input", name: { en: "DAP fertiliser", sw: "Mbolea ya DAP" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }] },
  can: { code: "can", kind: "input", name: { en: "CAN fertiliser", sw: "Mbolea ya CAN" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }] },
  seed_maize: { code: "seed_maize", kind: "input", name: { en: "Maize seed", sw: "Mbegu za mahindi" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "packet", factor: 2 }] },
  seed_beans: { code: "seed_beans", kind: "input", name: { en: "Bean seed", sw: "Mbegu za maharagwe" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }] },
  newcastle: { code: "newcastle", kind: "input", name: { en: "Newcastle vaccine", sw: "Chanjo ya Newcastle" }, base_unit: "dose", display_unit: "vial", units: [{ code: "vial", factor: 100 }, { code: "dose", factor: 1 }] },
  dewormer: { code: "dewormer", kind: "input", name: { en: "Dewormer", sw: "Dawa ya minyoo" }, base_unit: "ml", display_unit: "ml", units: [{ code: "ml", factor: 1 }, { code: "bottle", factor: 500 }] },
  coccidiostat: { code: "coccidiostat", kind: "input", name: { en: "Coccidiostat", sw: "Dawa ya koksidia" }, base_unit: "sachet", display_unit: "sachet", units: [{ code: "sachet", factor: 1 }] },
  pesticide: { code: "pesticide", kind: "input", name: { en: "Pesticide", sw: "Dawa ya wadudu" }, base_unit: "l", display_unit: "l", units: [{ code: "l", factor: 1 }, { code: "ml", factor: 0.001 }] },
};

/** Which catalogue items each enterprise type produces and commonly uses (EnterpriseTypeProduct). */
export const TYPE_ITEMS: Record<TypeCode, string[]> = {
  dairy_cattle: ["milk", "dairy_meal", "dewormer"],
  beef_cattle: ["dairy_meal", "dewormer"],
  dairy_goats: ["goat_milk", "dairy_meal", "dewormer"],
  sheep: ["dewormer"],
  layers: ["eggs", "layers_mash", "newcastle", "coccidiostat"],
  broilers: ["live_broilers", "broiler_feed", "newcastle", "coccidiostat"],
  fish: ["fish_harvest", "fish_feed"],
  maize: ["maize_grain", "seed_maize", "dap", "can", "pesticide"],
  beans: ["beans_grain", "seed_beans", "dap", "pesticide"],
  rice: ["rice_paddy", "dap", "can", "pesticide"],
  wheat: ["wheat_grain", "dap", "can", "pesticide"],
};

/** The item each type produces, for daily records and cost per unit. */
export const TYPE_OUTPUT: Partial<Record<TypeCode, { item: string; unit: string }>> = {
  dairy_cattle: { item: "milk", unit: "l" },
  dairy_goats: { item: "goat_milk", unit: "l" },
  layers: { item: "eggs", unit: "tray" },
  broilers: { item: "live_broilers", unit: "bird" },
  fish: { item: "fish_harvest", unit: "kg" },
  maize: { item: "maize_grain", unit: "kg" },
  beans: { item: "beans_grain", unit: "kg" },
  rice: { item: "rice_paddy", unit: "kg" },
  wheat: { item: "wheat_grain", unit: "kg" },
};

export const TYPE_FEED: Partial<Record<TypeCode, string>> = {
  dairy_cattle: "dairy_meal",
  beef_cattle: "dairy_meal",
  dairy_goats: "dairy_meal",
  layers: "layers_mash",
  broilers: "broiler_feed",
  fish: "fish_feed",
};

export function typeInfo(code: TypeCode) {
  return CATALOGUE.enterprise_types.find((t) => t.code === code)!;
}
