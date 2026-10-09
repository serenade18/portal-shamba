import type { Catalogue, Item, TypeCode, VaccinationStep } from "../types";

export const CATALOGUE: Catalogue = {
  version: 1,
  enterprise_types: [
    { code: "dairy_cattle", module: "livestock", tracking_mode: "individual", icon: "🐄", labels: { en: "Dairy cows", sw: "Ng'ombe wa maziwa", fr: "Vaches laitières" } },
    { code: "beef_cattle", module: "livestock", tracking_mode: "individual", icon: "🐂", labels: { en: "Beef cattle", sw: "Ng'ombe wa nyama", fr: "Bovins à viande" } },
    { code: "dairy_goats", module: "livestock", tracking_mode: "individual", icon: "🐐", labels: { en: "Dairy goats", sw: "Mbuzi wa maziwa", fr: "Chèvres laitières" } },
    { code: "sheep", module: "livestock", tracking_mode: "individual", icon: "🐑", labels: { en: "Sheep", sw: "Kondoo", fr: "Moutons" } },
    { code: "layers", module: "batches", tracking_mode: "batch", icon: "🥚", labels: { en: "Layers", sw: "Kuku wa mayai", fr: "Pondeuses" } },
    { code: "broilers", module: "batches", tracking_mode: "batch", icon: "🐔", labels: { en: "Broilers", sw: "Kuku wa nyama", fr: "Poulets de chair" } },
    { code: "fish", module: "batches", tracking_mode: "batch", icon: "🐟", labels: { en: "Fish", sw: "Samaki", fr: "Poissons" } },
    { code: "maize", module: "crops", tracking_mode: "crop_season", icon: "🌽", labels: { en: "Maize", sw: "Mahindi", fr: "Maïs" } },
    { code: "beans", module: "crops", tracking_mode: "crop_season", icon: "🫘", labels: { en: "Beans", sw: "Maharagwe", fr: "Haricots" } },
    { code: "rice", module: "crops", tracking_mode: "crop_season", icon: "🌾", labels: { en: "Rice", sw: "Mpunga", fr: "Riz" } },
    { code: "wheat", module: "crops", tracking_mode: "crop_season", icon: "🌾", labels: { en: "Wheat", sw: "Ngano", fr: "Blé" } },
  ],
  coming_soon: [
    { code: "pigs", labels: { en: "Pigs", sw: "Nguruwe", fr: "Porcs" } },
    { code: "rabbits", labels: { en: "Rabbits", sw: "Sungura", fr: "Lapins" } },
    { code: "tomatoes", labels: { en: "Tomatoes", sw: "Nyanya", fr: "Tomates" } },
    { code: "kales", labels: { en: "Kales", sw: "Sukuma wiki", fr: "Choux kale" } },
    { code: "bananas", labels: { en: "Bananas", sw: "Ndizi", fr: "Bananes" } },
    { code: "avocados", labels: { en: "Avocados", sw: "Parachichi", fr: "Avocats" } },
  ],
};

type ItemDef = Omit<Item, "id" | "low_stock_level" | "produced_by"> & { code: string; low?: number };

export const ITEM_DEFS: Record<string, ItemDef> = {
  milk: { code: "milk", category: "produce", kind: "output", name: { en: "Milk", sw: "Maziwa", fr: "Lait" }, base_unit: "l", display_unit: "l", units: [{ code: "l", factor: 1 }] },
  goat_milk: { code: "goat_milk", category: "produce", kind: "output", name: { en: "Goat milk", sw: "Maziwa ya mbuzi", fr: "Lait de chèvre" }, base_unit: "l", display_unit: "l", units: [{ code: "l", factor: 1 }] },
  eggs: { code: "eggs", category: "produce", kind: "output", name: { en: "Eggs", sw: "Mayai", fr: "Œufs" }, base_unit: "piece", display_unit: "tray", units: [{ code: "tray", factor: 30 }, { code: "piece", factor: 1 }, { code: "crate", factor: 360 }] },
  live_broilers: { code: "live_broilers", category: "produce", kind: "output", name: { en: "Broilers (live)", sw: "Kuku wa nyama (hai)", fr: "Poulets de chair (vifs)" }, base_unit: "bird", display_unit: "bird", units: [{ code: "bird", factor: 1 }] },
  fish_harvest: { code: "fish_harvest", category: "produce", kind: "output", name: { en: "Fish", sw: "Samaki", fr: "Poisson" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "piece", factor: 0.35 }] },
  maize_grain: { code: "maize_grain", category: "produce", kind: "output", name: { en: "Maize grain", sw: "Mahindi (nafaka)", fr: "Maïs (grain)" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 90 }, { code: "debe", factor: 18 }, { code: "kg", factor: 1 }] },
  beans_grain: { code: "beans_grain", category: "produce", kind: "output", name: { en: "Beans", sw: "Maharagwe", fr: "Haricots" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 90 }, { code: "debe", factor: 20 }, { code: "kg", factor: 1 }] },
  rice_paddy: { code: "rice_paddy", category: "produce", kind: "output", name: { en: "Rice (paddy)", sw: "Mpunga", fr: "Riz (paddy)" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 80 }, { code: "kg", factor: 1 }] },
  wheat_grain: { code: "wheat_grain", category: "produce", kind: "output", name: { en: "Wheat", sw: "Ngano", fr: "Blé" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 90 }, { code: "kg", factor: 1 }] },
  dairy_meal: { code: "dairy_meal", category: "feed", kind: "input", name: { en: "Dairy meal", sw: "Chakula cha ng'ombe", fr: "Aliment pour vaches laitières" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 70 }, { code: "kg", factor: 1 }], low: 140 },
  layers_mash: { code: "layers_mash", category: "feed", kind: "input", name: { en: "Layers mash", sw: "Chakula cha kuku wa mayai", fr: "Aliment pondeuses" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 70 }, { code: "kg", factor: 1 }], low: 210 },
  broiler_feed: { code: "broiler_feed", category: "feed", kind: "input", name: { en: "Broiler finisher", sw: "Chakula cha kuku wa nyama", fr: "Aliment de finition poulets de chair" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }], low: 100 },
  fish_feed: { code: "fish_feed", category: "feed", kind: "input", name: { en: "Fish pellets", sw: "Chakula cha samaki", fr: "Granulés pour poissons" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 25 }, { code: "kg", factor: 1 }], low: 25 },
  dap: { code: "dap", category: "fertiliser", kind: "input", name: { en: "DAP fertiliser", sw: "Mbolea ya DAP", fr: "Engrais DAP" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }] },
  can: { code: "can", category: "fertiliser", kind: "input", name: { en: "CAN fertiliser", sw: "Mbolea ya CAN", fr: "Engrais CAN" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }] },
  seed_maize: { code: "seed_maize", category: "seed", kind: "input", name: { en: "Maize seed", sw: "Mbegu za mahindi", fr: "Semences de maïs" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "packet", factor: 2 }] },
  seed_beans: { code: "seed_beans", category: "seed", kind: "input", name: { en: "Bean seed", sw: "Mbegu za maharagwe", fr: "Semences de haricots" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }] },
  newcastle: { code: "newcastle", category: "drug", kind: "input", name: { en: "Newcastle vaccine", sw: "Chanjo ya Newcastle", fr: "Vaccin contre la maladie de Newcastle" }, base_unit: "dose", display_unit: "vial", units: [{ code: "vial", factor: 100 }, { code: "dose", factor: 1 }] },
  dewormer: { code: "dewormer", category: "drug", kind: "input", name: { en: "Dewormer", sw: "Dawa ya minyoo", fr: "Vermifuge" }, base_unit: "ml", display_unit: "ml", units: [{ code: "ml", factor: 1 }, { code: "bottle", factor: 500 }] },
  coccidiostat: { code: "coccidiostat", category: "drug", kind: "input", name: { en: "Coccidiostat", sw: "Dawa ya koksidia", fr: "Coccidiostatique" }, base_unit: "sachet", display_unit: "sachet", units: [{ code: "sachet", factor: 1 }] },
  pesticide: { code: "pesticide", category: "chemical", kind: "input", name: { en: "Pesticide", sw: "Dawa ya wadudu", fr: "Pesticide" }, base_unit: "l", display_unit: "l", units: [{ code: "l", factor: 1 }, { code: "ml", factor: 0.001 }] },
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

/** Default vaccination schedules by batch age, as the backend's apps/catalogue/vaccinations.py (BAT-04). */
export const VACCINATION_DEFAULTS: Partial<Record<TypeCode, VaccinationStep[]>> = {
  layers: [
    { day: 1, vaccine: "Marek's disease", note: "Usually given at the hatchery" },
    { day: 7, vaccine: "Newcastle + Infectious bronchitis", note: "Drinking water" },
    { day: 14, vaccine: "Gumboro (IBD)", note: "Drinking water" },
    { day: 21, vaccine: "Newcastle (Lasota)", note: "Drinking water" },
    { day: 28, vaccine: "Gumboro (IBD)", note: "Drinking water" },
    { day: 42, vaccine: "Fowl pox", note: "Wing web" },
    { day: 56, vaccine: "Fowl typhoid", note: "Injection" },
    { day: 70, vaccine: "Newcastle (Lasota)", note: "Drinking water" },
    { day: 126, vaccine: "Newcastle + IB + EDS (killed)", note: "Injection, before lay" },
  ],
  broilers: [
    { day: 7, vaccine: "Newcastle + Infectious bronchitis", note: "Drinking water" },
    { day: 14, vaccine: "Gumboro (IBD)", note: "Drinking water" },
    { day: 21, vaccine: "Newcastle (Lasota)", note: "Drinking water" },
    { day: 28, vaccine: "Gumboro (IBD)", note: "Drinking water" },
  ],
  fish: [],
};

/** Days from service to birth, as the backend's GESTATION_DAYS (LIV-05). */
export const GESTATION_DAYS: Partial<Record<TypeCode, number>> = { dairy_cattle: 283, beef_cattle: 283, dairy_goats: 150, sheep: 147 };
