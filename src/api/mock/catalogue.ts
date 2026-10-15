import type { BreedingProfile, Catalogue, Item, TypeCode, VaccinationStep } from "../types";

/** When each animal type's breeding steps fall, as the backend's apps/catalogue/breeding.py (LIV-05). */
export const BREEDING: Partial<Record<TypeCode, BreedingProfile>> = {
  dairy_cattle: { gestation: 283, cycle: 21, pregnancy_check: 60, dry_off: 60, prepare: 21, wean: 90, serve_after_birth: 60, first_service: 450 },
  beef_cattle: { gestation: 283, cycle: 21, pregnancy_check: 60, dry_off: null, prepare: 21, wean: 210, serve_after_birth: 60, first_service: 450 },
  dairy_goats: { gestation: 150, cycle: 21, pregnancy_check: 45, dry_off: 60, prepare: 14, wean: 90, serve_after_birth: 60, first_service: 240 },
  sheep: { gestation: 147, cycle: 17, pregnancy_check: 45, dry_off: null, prepare: 14, wean: 90, serve_after_birth: 60, first_service: 240 },
  pigs: { gestation: 114, cycle: 21, pregnancy_check: 21, dry_off: null, prepare: 7, wean: 28, serve_after_birth: 33, first_service: 210 },
  rabbits: { gestation: 31, cycle: null, pregnancy_check: 12, dry_off: null, prepare: 3, wean: 35, serve_after_birth: 35, first_service: 150 },
};

export const CATALOGUE: Catalogue = {
  version: 4,
  enterprise_types: [
    { code: "dairy_cattle", module: "livestock", tracking_mode: "individual", icon: "🐄", labels: { en: "Dairy cows", sw: "Ng'ombe wa maziwa", fr: "Vaches laitières" } },
    { code: "beef_cattle", module: "livestock", tracking_mode: "individual", icon: "🐂", labels: { en: "Beef cattle", sw: "Ng'ombe wa nyama", fr: "Bovins à viande" } },
    { code: "dairy_goats", module: "livestock", tracking_mode: "individual", icon: "🐐", labels: { en: "Dairy goats", sw: "Mbuzi wa maziwa", fr: "Chèvres laitières" } },
    { code: "sheep", module: "livestock", tracking_mode: "individual", icon: "🐑", labels: { en: "Sheep", sw: "Kondoo", fr: "Moutons" } },
    { code: "pigs", module: "livestock", tracking_mode: "mixed", icon: "🐖", labels: { en: "Pigs", sw: "Nguruwe", fr: "Porcs" } },
    { code: "rabbits", module: "livestock", tracking_mode: "mixed", icon: "🐇", labels: { en: "Rabbits", sw: "Sungura", fr: "Lapins" } },
    { code: "layers", module: "batches", tracking_mode: "batch", icon: "🥚", labels: { en: "Layers", sw: "Kuku wa mayai", fr: "Pondeuses" } },
    { code: "broilers", module: "batches", tracking_mode: "batch", icon: "🐔", labels: { en: "Broilers", sw: "Kuku wa nyama", fr: "Poulets de chair" } },
    { code: "fish", module: "batches", tracking_mode: "batch", icon: "🐟", labels: { en: "Fish", sw: "Samaki", fr: "Poissons" } },
    { code: "maize", module: "crops", tracking_mode: "crop_season", icon: "🌽", labels: { en: "Maize", sw: "Mahindi", fr: "Maïs" } },
    { code: "beans", module: "crops", tracking_mode: "crop_season", icon: "🫘", labels: { en: "Beans", sw: "Maharagwe", fr: "Haricots" } },
    { code: "rice", module: "crops", tracking_mode: "crop_season", icon: "🌾", labels: { en: "Rice", sw: "Mpunga", fr: "Riz" } },
    { code: "wheat", module: "crops", tracking_mode: "crop_season", icon: "🌾", labels: { en: "Wheat", sw: "Ngano", fr: "Blé" } },
    { code: "tomatoes", module: "crops", tracking_mode: "crop_season", icon: "🍅", labels: { en: "Tomatoes", sw: "Nyanya", fr: "Tomates" } },
    { code: "kales", module: "crops", tracking_mode: "crop_season", icon: "🥬", labels: { en: "Kales", sw: "Sukuma wiki", fr: "Choux kale" } },
    { code: "spinach", module: "crops", tracking_mode: "crop_season", icon: "🥬", labels: { en: "Spinach", sw: "Spinachi", fr: "Épinards" } },
    { code: "bananas", module: "crops", tracking_mode: "perennial", icon: "🍌", labels: { en: "Bananas", sw: "Ndizi", fr: "Bananes" } },
    { code: "avocados", module: "crops", tracking_mode: "perennial", icon: "🥑", labels: { en: "Avocados", sw: "Parachichi", fr: "Avocats" } },
  ],
  coming_soon: [],
  breeding: BREEDING,
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
  live_pigs: { code: "live_pigs", category: "produce", kind: "output", name: { en: "Pigs (live)", sw: "Nguruwe (hai)", fr: "Porcs (vifs)" }, base_unit: "pig", display_unit: "pig", units: [{ code: "pig", factor: 1 }] },
  live_rabbits: { code: "live_rabbits", category: "produce", kind: "output", name: { en: "Rabbits (live)", sw: "Sungura (hai)", fr: "Lapins (vivants)" }, base_unit: "rabbit", display_unit: "rabbit", units: [{ code: "rabbit", factor: 1 }] },
  tomatoes: { code: "tomatoes", category: "produce", kind: "output", name: { en: "Tomatoes", sw: "Nyanya", fr: "Tomates" }, base_unit: "kg", display_unit: "crate", units: [{ code: "crate", factor: 64 }, { code: "kg", factor: 1 }] },
  kales: { code: "kales", category: "produce", kind: "output", name: { en: "Kales", sw: "Sukuma wiki", fr: "Choux kale" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "bunch", factor: 0.5 }, { code: "bag", factor: 50 }] },
  spinach: { code: "spinach", category: "produce", kind: "output", name: { en: "Spinach", sw: "Spinachi", fr: "Épinards" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "bunch", factor: 0.5 }, { code: "bag", factor: 50 }] },
  bananas: { code: "bananas", category: "produce", kind: "output", name: { en: "Bananas", sw: "Ndizi", fr: "Bananes" }, base_unit: "bunch", display_unit: "bunch", units: [{ code: "bunch", factor: 1 }] },
  avocados: { code: "avocados", category: "produce", kind: "output", name: { en: "Avocados", sw: "Parachichi", fr: "Avocats" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "piece", factor: 0.25 }, { code: "crate", factor: 50 }] },
  sow_weaner_meal: { code: "sow_weaner_meal", category: "feed", kind: "input", name: { en: "Sow and weaner meal", sw: "Chakula cha nguruwe wazazi na wachanga", fr: "Aliment truies et porcelets" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 70 }, { code: "kg", factor: 1 }], low: 140 },
  pig_finisher: { code: "pig_finisher", category: "feed", kind: "input", name: { en: "Pig finisher", sw: "Chakula cha kunenepesha nguruwe", fr: "Aliment de finition porcs" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 70 }, { code: "kg", factor: 1 }], low: 140 },
  rabbit_pellets: { code: "rabbit_pellets", category: "feed", kind: "input", name: { en: "Rabbit pellets", sw: "Chakula cha sungura", fr: "Granulés pour lapins" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }], low: 50 },
  npk: { code: "npk", category: "fertiliser", kind: "input", name: { en: "NPK fertiliser", sw: "Mbolea ya NPK", fr: "Engrais NPK" }, base_unit: "kg", display_unit: "bag", units: [{ code: "bag", factor: 50 }, { code: "kg", factor: 1 }] },
  seed_tomato: { code: "seed_tomato", category: "seed", kind: "input", name: { en: "Tomato seed", sw: "Mbegu za nyanya", fr: "Semences de tomates" }, base_unit: "g", display_unit: "packet", units: [{ code: "packet", factor: 10 }, { code: "g", factor: 1 }] },
  seed_kale: { code: "seed_kale", category: "seed", kind: "input", name: { en: "Kale seed", sw: "Mbegu za sukuma wiki", fr: "Semences de chou kale" }, base_unit: "g", display_unit: "packet", units: [{ code: "packet", factor: 50 }, { code: "g", factor: 1 }] },
  seed_spinach: { code: "seed_spinach", category: "seed", kind: "input", name: { en: "Spinach seed", sw: "Mbegu za spinachi", fr: "Semences d'épinards" }, base_unit: "g", display_unit: "packet", units: [{ code: "packet", factor: 50 }, { code: "g", factor: 1 }] },
  banana_plantlets: { code: "banana_plantlets", category: "seed", kind: "input", name: { en: "Banana plantlets", sw: "Miche ya ndizi", fr: "Plants de bananier" }, base_unit: "piece", display_unit: "piece", units: [{ code: "piece", factor: 1 }] },
  avocado_seedlings: { code: "avocado_seedlings", category: "seed", kind: "input", name: { en: "Avocado seedlings", sw: "Miche ya parachichi", fr: "Plants d'avocatier" }, base_unit: "piece", display_unit: "piece", units: [{ code: "piece", factor: 1 }] },
  iron_injection: { code: "iron_injection", category: "drug", kind: "input", name: { en: "Iron injection (piglets)", sw: "Sindano ya madini ya chuma (nguruwe wachanga)", fr: "Injection de fer (porcelets)" }, base_unit: "ml", display_unit: "bottle", units: [{ code: "bottle", factor: 100 }, { code: "ml", factor: 1 }] },
  fungicide: { code: "fungicide", category: "chemical", kind: "input", name: { en: "Fungicide", sw: "Dawa ya ukungu", fr: "Fongicide" }, base_unit: "kg", display_unit: "kg", units: [{ code: "kg", factor: 1 }, { code: "g", factor: 0.001 }] },
};

/** Which catalogue items each enterprise type produces and commonly uses (EnterpriseTypeProduct). */
export const TYPE_ITEMS: Record<TypeCode, string[]> = {
  dairy_cattle: ["milk", "dairy_meal", "dewormer"],
  beef_cattle: ["dairy_meal", "dewormer"],
  dairy_goats: ["goat_milk", "dairy_meal", "dewormer"],
  sheep: ["dewormer"],
  pigs: ["live_pigs", "sow_weaner_meal", "pig_finisher", "iron_injection", "dewormer"],
  rabbits: ["live_rabbits", "rabbit_pellets", "dewormer"],
  layers: ["eggs", "layers_mash", "newcastle", "coccidiostat"],
  broilers: ["live_broilers", "broiler_feed", "newcastle", "coccidiostat"],
  fish: ["fish_harvest", "fish_feed"],
  maize: ["maize_grain", "seed_maize", "dap", "can", "pesticide"],
  beans: ["beans_grain", "seed_beans", "dap", "pesticide"],
  rice: ["rice_paddy", "dap", "can", "pesticide"],
  wheat: ["wheat_grain", "dap", "can", "pesticide"],
  tomatoes: ["tomatoes", "seed_tomato", "dap", "can", "npk", "fungicide", "pesticide"],
  kales: ["kales", "seed_kale", "dap", "can", "pesticide"],
  spinach: ["spinach", "seed_spinach", "dap", "can", "pesticide"],
  bananas: ["bananas", "banana_plantlets", "npk", "dap"],
  avocados: ["avocados", "avocado_seedlings", "npk", "fungicide", "pesticide"],
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
  pigs: { item: "live_pigs", unit: "pig" },
  rabbits: { item: "live_rabbits", unit: "rabbit" },
  tomatoes: { item: "tomatoes", unit: "kg" },
  kales: { item: "kales", unit: "kg" },
  spinach: { item: "spinach", unit: "kg" },
  bananas: { item: "bananas", unit: "bunch" },
  avocados: { item: "avocados", unit: "kg" },
};

/** Sold live from a batch: a sale lowers the batch's count instead of stock. */
export const LIVE_OUTPUTS = ["live_broilers", "live_pigs", "live_rabbits"];

export const TYPE_FEED: Partial<Record<TypeCode, string>> = {
  dairy_cattle: "dairy_meal",
  beef_cattle: "dairy_meal",
  dairy_goats: "dairy_meal",
  layers: "layers_mash",
  broilers: "broiler_feed",
  fish: "fish_feed",
  pigs: "sow_weaner_meal",
  rabbits: "rabbit_pellets",
};

export function typeInfo(code: TypeCode) {
  return CATALOGUE.enterprise_types.find((t) => t.code === code)!;
}

const CATTLE: VaccinationStep[] = [
  { day: 60, vaccine: "East Coast Fever (ITM)", note: "Once, by a trained vet" },
  { day: 90, vaccine: "Anthrax + Blackquarter", note: "Injection" },
  { day: 120, vaccine: "Brucellosis (S19)", note: "Heifers only, once", sex: "female" },
  { kind: "every", every_days: 180, vaccine: "Foot and mouth disease (FMD)", note: "Injection" },
  { kind: "every", every_days: 365, vaccine: "Lumpy skin disease", note: "Injection" },
  { kind: "every", every_days: 365, vaccine: "Anthrax + Blackquarter", note: "Yearly booster" },
  { kind: "every", every_days: 90, vaccine: "Deworming", note: "Oral drench" },
];
const SMALL_RUMINANTS: VaccinationStep[] = [
  { day: 90, vaccine: "PPR", note: "Once; protects for about 3 years" },
  { day: 120, vaccine: "Sheep and goat pox", note: "Injection" },
  { kind: "every", every_days: 365, vaccine: "Sheep and goat pox", note: "Yearly booster" },
  { kind: "every", every_days: 90, vaccine: "Deworming", note: "Oral drench" },
  { kind: "before_birth", days: 28, vaccine: "Enterotoxaemia", note: "Protects the young through her milk" },
];

/** Default vaccination schedules, as the backend's apps/catalogue/vaccinations.py (BAT-04, LIV-04). */
export const VACCINATION_DEFAULTS: Partial<Record<TypeCode, VaccinationStep[]>> = {
  dairy_cattle: CATTLE,
  beef_cattle: CATTLE.filter((s) => s.sex !== "female"),
  dairy_goats: [...SMALL_RUMINANTS, { kind: "every", every_days: 365, vaccine: "CCPP", note: "Contagious caprine pleuropneumonia" }],
  sheep: [...SMALL_RUMINANTS, { kind: "every", every_days: 180, vaccine: "Enterotoxaemia booster", note: "Injection" }],
  pigs: [
    { day: 3, vaccine: "Iron injection", note: "Piglets, in the neck muscle" },
    { day: 35, vaccine: "Deworming", note: "After weaning" },
    { kind: "every", every_days: 90, vaccine: "Deworming", note: "Breeding stock" },
    { kind: "before_birth", days: 14, vaccine: "Deworming before farrowing", note: "The sow, so piglets aren't infected" },
  ],
  rabbits: [
    { day: 28, vaccine: "Coccidiostat", note: "In drinking water, around weaning" },
    { kind: "every", every_days: 90, vaccine: "Deworming", note: "Breeding stock" },
  ],
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

/** Days from service to birth (LIV-05). */
export const GESTATION_DAYS: Partial<Record<TypeCode, number>> = Object.fromEntries(Object.entries(BREEDING).map(([k, v]) => [k, v.gestation]));

/** The key a treatment records for a schedule step, as the backend's step_key. */
export function stepKey(s: VaccinationStep): string {
  const kind = s.kind ?? "age";
  return kind === "age" ? `age:${s.day}` : `${kind}:${s.vaccine.trim().toLowerCase()}`.slice(0, 60);
}
