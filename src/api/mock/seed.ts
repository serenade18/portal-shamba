import type { TypeCode } from "../types";
import { TYPE_ITEMS } from "./catalogue";
import {
  activity, batchDay, ensureItems, feedDay, financeEntry, harvest, itemId, milkDay, purchase, reverse, sell,
  startEnterprise, treatment, useInput,
} from "./commands";
import { at, balanceOf, daysAgo, emptyOrgData, type MockDb, type MRecorder, type OrgData } from "./db";

export const DEMO_OWNER_PHONE = "+254712345678";
export const DEMO_WORKER_PHONE = "+254722000111";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ids = {
  john: "0192a000-0000-7000-8000-000000000001",
  mary: "0192a000-0000-7000-8000-000000000002",
  otieno: "0192a000-0000-7000-8000-000000000003",
  wanjiru: "0192a000-0000-7000-8000-000000000004",
  orgKamau: "0192a000-0000-7000-8000-0000000000a1",
  orgWanjiru: "0192a000-0000-7000-8000-0000000000a2",
};

export function seed(): MockDb {
  const created = at(daysAgo(420));
  const db: MockDb = {
    version: 0,
    users: [
      { id: ids.john, phone: DEMO_OWNER_PHONE, name: "John Kamau", email: null, preferred_locale: "en", date_joined: created },
      { id: ids.mary, phone: "+254733456789", name: "Mary Wanjiku", email: null, preferred_locale: "sw", date_joined: created },
      { id: ids.otieno, phone: DEMO_WORKER_PHONE, name: "Otieno Ouma", email: null, preferred_locale: "sw", date_joined: created },
      { id: ids.wanjiru, phone: "+254711222333", name: "Grace Wanjiru", email: null, preferred_locale: "sw", date_joined: created },
    ],
    orgs: [
      { id: ids.orgKamau, name: "Kamau farm", country: "KE", currency: "KES", default_locale: "sw", created_at: created, payment_mode: "request" },
      { id: ids.orgWanjiru, name: "Wanjiru family farm", country: "KE", currency: "KES", default_locale: "sw", created_at: created, payment_mode: "manual" },
    ],
    memberships: [
      { id: crypto.randomUUID(), user_id: ids.john, org_id: ids.orgKamau, role: "owner", is_active: true, epoch: 1, created_at: created, removed_at: null },
      { id: crypto.randomUUID(), user_id: ids.mary, org_id: ids.orgKamau, role: "manager", is_active: true, epoch: 1, created_at: created, removed_at: null },
      { id: crypto.randomUUID(), user_id: ids.otieno, org_id: ids.orgKamau, role: "field_worker", is_active: true, epoch: 1, created_at: created, removed_at: null },
      { id: crypto.randomUUID(), user_id: ids.wanjiru, org_id: ids.orgWanjiru, role: "owner", is_active: true, epoch: 1, created_at: created, removed_at: null },
      { id: crypto.randomUUID(), user_id: ids.john, org_id: ids.orgWanjiru, role: "manager", is_active: true, epoch: 1, created_at: created, removed_at: null },
    ],
    invitations: [
      {
        id: crypto.randomUUID(), org_id: ids.orgKamau, invited_by: ids.john, phone: "+254700111222", role: "field_worker",
        status: "pending", expires_at: at(daysAgo(-5)), created_at: at(daysAgo(2)),
      },
    ],
    data: {},
  };
  db.data[ids.orgKamau] = seedKamau();
  db.data[ids.orgWanjiru] = seedWanjiru();
  return db;
}

function seedKamau(): OrgData {
  const r = rng(42);
  const between = (a: number, b: number) => a + r() * (b - a);
  const data = emptyOrgData();
  const web: MRecorder = { user_id: ids.john, device: "web", synced_at: null };
  const phone = (date: string): MRecorder => ({ user_id: ids.otieno, device: "phone", synced_at: at(date, 20) });
  const maryPhone = (date: string): MRecorder => ({ user_id: ids.mary, device: "phone", synced_at: at(date, 19) });

  const farm = "0192a000-0000-7000-8000-0000000000f1";
  const farm2 = "0192a000-0000-7000-8000-0000000000f2";
  data.farms.push(
    { id: farm, name: "Kamau farm", county: "Kiambu", location: { lat: -1.03, lng: 36.83 }, setup_complete: true, created_at: at(daysAgo(420)) },
    { id: farm2, name: "Limuru plot", county: "Kiambu", location: { lat: -1.11, lng: 36.64 }, setup_complete: true, created_at: at(daysAgo(300)) },
  );
  data.picks[farm] = ["dairy_cattle", "layers", "broilers", "maize", "beans"] satisfies TypeCode[];
  data.picks[farm2] = ["maize"];
  ensureItems(data, [...new Set(Object.values(TYPE_ITEMS).flat())]);

  const s = (name: string, type: "shed" | "poultry_house" | "store", capacity: number | null, f = farm) => {
    const row = { id: crypto.randomUUID(), farm_id: f, name, type, capacity };
    data.structures.push(row);
    return row.id;
  };
  const cowShed = s("Cow shed", "shed", 8);
  const ph1 = s("Poultry house 1", "poultry_house", 400);
  const ph2 = s("Poultry house 2", "poultry_house", 600);
  s("Feed store", "store", null);

  const p = (name: string, acres: number, tenure: "owned" | "leased" | "family", lease: number | null, f = farm) => {
    const row = { id: crypto.randomUUID(), farm_id: f, name, area_acres: acres.toFixed(2), tenure, lease_cost: lease != null ? lease.toFixed(2) : null, growing_now: null };
    data.plots.push(row);
    return row.id;
  };
  const upper = p("Upper field", 2, "owned", null);
  const river = p("River plot", 1.5, "leased", 12000);
  p("Home garden", 0.25, "family", null);
  const limuruPlot = p("Limuru field", 3, "family", null, farm2);

  const cust = (name: string, tel: string) => {
    const row = { id: crypto.randomUUID(), name, phone: tel };
    data.customers.push(row);
    return row.id;
  };
  const coop = cust("Githunguri dairy co-op", "+254720555010");
  const neighbours = cust("Neighbours (cash)", "");
  const hotel = cust("Hotel Baraka", "+254722330044");
  const shop = cust("Kiprono shop", "+254712908070");
  const wanjiru = cust("Mama Wanjiru", "+254701445566");
  const traders = cust("Grace Achieng (trader)", "+254733221100");

  const sup = (name: string, tel: string) => {
    const row = { id: crypto.randomUUID(), name, phone: tel };
    data.suppliers.push(row);
    return row.id;
  };
  const agrovet = sup("Kamau agrovet", "+254722101010");
  const feeds = sup("Unga feeds depot", "+254733202020");
  sup("Kenchic hatchery", "+254711303030");

  // Enterprises
  const dairy = startEnterprise(data, { farm, type: "dairy_cattle", name: "Dairy herd", date: daysAgo(400), count: 6, cost: 240000, source: "bought", structure: cowShed, by: web });
  const layers = startEnterprise(data, { farm, type: "layers", name: "Layers, batch 3", date: daysAgo(210), count: 500, cost: 190000, source: "Kenchic hatchery", structure: ph2, by: web });
  const b6 = startEnterprise(data, { farm, type: "broilers", name: "Broilers, batch 6", date: daysAgo(82), count: 300, cost: 28500, source: "Kenchic hatchery", structure: ph1, by: web });
  const maize = startEnterprise(data, { farm, type: "maize", name: "Maize, long rains", date: daysAgo(160), plot: upper, variety: "H614", area: 2, by: web });
  const beans = startEnterprise(data, { farm, type: "beans", name: "Beans, short rains 2025", date: daysAgo(330), plot: river, variety: "Rosecoco", area: 1.5, by: web });
  const limuruMaize = startEnterprise(data, { farm: farm2, type: "maize", name: "Maize, Limuru", date: daysAgo(150), plot: limuruPlot, variety: "DK8031", area: 3, by: web });

  const animals: [string, string, "female" | "male", string, number][] = [
    ["KF-01", "Wairimu", "female", "Friesian", 1900],
    ["KF-02", "Njeri", "female", "Ayrshire", 1600],
    ["KF-03", "Chebet", "female", "Friesian", 1400],
    ["KF-04", "Zawadi", "female", "Friesian cross", 1250],
    ["KF-05", "Neema", "female", "Ayrshire", 700],
    ["KF-06", "Baraka", "male", "Friesian", 180],
  ];
  for (const [tag, name, sex, breed, age] of animals) {
    data.animals.push({
      id: crypto.randomUUID(), enterprise_id: dairy.id, tag, name, sex, breed, birth_date: daysAgo(age),
      source: age < 400 ? "born" : "bought", cost: age < 400 ? null : "60000.00", status: "active", mother_id: null, milk_7d: null,
    });
  }
  data.animals[5].mother_id = data.animals[0].id;

  // Beans last season: closed, for plot history (FRM-06).
  purchase(data, { farm, supplier: agrovet, date: daysAgo(335), lines: [{ item: itemId("seed_beans"), qty: 40, unit: "kg", price: 180 }, { item: itemId("dap"), qty: 3, unit: "bag", price: 3800 }], paid: "full", by: web });
  activity(data, beans, { date: daysAgo(330), type: "planting", inputs: [{ item: itemId("seed_beans"), qty: 40, unit: "kg" }, { item: itemId("dap"), qty: 3, unit: "bag" }], labour: 4500, service: 6000, by: web });
  activity(data, beans, { date: daysAgo(300), type: "weeding", inputs: [], labour: 3500, service: 0, by: web });
  harvest(data, beans, { date: daysAgo(250), qty: 9, unit: "bag", moisture: "dry", by: web });
  sell(data, { farm, customer: traders, date: daysAgo(245), lines: [{ item: itemId("beans_grain"), qty: 9, unit: "bag", price: 9500, enterprise: beans.id }], method: "cash", paid: 85500, by: web });
  financeEntry(data, { farm, enterprise: beans.id, kind: "cost", category: "lease", amount: 6000, date: daysAgo(330), source: "lease", by: web });
  beans.status = "closed";
  beans.closed_on = daysAgo(245);

  // Maize season inputs before the 90-day window
  purchase(data, { farm, supplier: agrovet, date: daysAgo(162), lines: [{ item: itemId("seed_maize"), qty: 20, unit: "kg", price: 330 }, { item: itemId("dap"), qty: 4, unit: "bag", price: 3800 }, { item: itemId("can"), qty: 4, unit: "bag", price: 3200 }, { item: itemId("pesticide"), qty: 2, unit: "l", price: 1400 }], paid: "full", by: web });
  activity(data, maize, { date: daysAgo(160), type: "land_preparation", inputs: [], labour: 3000, service: 8000, note: "Tractor ploughing", by: web });
  activity(data, maize, { date: daysAgo(155), type: "planting", inputs: [{ item: itemId("seed_maize"), qty: 20, unit: "kg" }, { item: itemId("dap"), qty: 4, unit: "bag" }], labour: 4000, service: 0, by: phone(daysAgo(155)) });
  activity(data, maize, { date: daysAgo(120), type: "weeding", inputs: [], labour: 4500, service: 0, by: phone(daysAgo(120)) });
  activity(data, maize, { date: daysAgo(105), type: "fertilising", inputs: [{ item: itemId("can"), qty: 4, unit: "bag" }], labour: 2000, service: 0, note: "Top dressing", by: phone(daysAgo(105)) });
  activity(data, maize, { date: daysAgo(80), type: "spraying", inputs: [{ item: itemId("pesticide"), qty: 1.5, unit: "l" }], labour: 1500, service: 0, note: "Fall armyworm", by: phone(daysAgo(80)) });
  activity(data, limuruMaize, { date: daysAgo(148), type: "planting", inputs: [], labour: 6000, service: 9000, by: web });

  // Opening feed stock
  purchase(data, { farm, supplier: feeds, date: daysAgo(90), lines: [{ item: itemId("dairy_meal"), qty: 12, unit: "bag", price: 2600 }, { item: itemId("layers_mash"), qty: 30, unit: "bag", price: 3300 }], paid: "full", by: web });
  purchase(data, { farm, supplier: agrovet, date: daysAgo(89), lines: [{ item: itemId("dewormer"), qty: 1, unit: "bottle", price: 1800 }, { item: itemId("newcastle"), qty: 4, unit: "vial", price: 650 }], paid: "full", by: web });
  purchase(data, { farm, supplier: feeds, date: daysAgo(82), lines: [{ item: itemId("broiler_feed"), qty: 30, unit: "bag", price: 3400 }], paid: "full", by: web });

  const b7Start = 30;
  let b7: ReturnType<typeof startEnterprise> | null = null;

  for (let d = 89; d >= 0; d--) {
    const date = daysAgo(d);
    const by = phone(date);

    // Dairy: milk and feed every day, recorded on Otieno's phone
    milkDay(data, dairy, { date, litres: Math.round(between(52, 62)), by: d % 9 === 0 ? maryPhone(date) : by });
    if (d % 2 === 0) feedDay(data, dairy, { date, item: itemId("dairy_meal"), qty: 1, unit: "bag", by });

    // Layers: one screen, one record (BAT-02)
    const trays = Math.round(between(12.6, 15.2) * 2) / 2;
    const deaths = r() < 0.18 ? 1 : 0;
    if (d === 4) {
      const rec = batchDay(data, layers, { date, feedItem: itemId("layers_mash"), feedQty: 3, feedUnit: "bag", deaths, eggsTrays: trays, by });
      const wrong = data.movements.filter((m) => m.item_id === itemId("layers_mash") && m.movement_type === "used").at(-1)!;
      reverse(data, wrong.id, web);
      useInput(data, { farm, item: itemId("layers_mash"), qty: 1, unit: "bag", enterprise: layers.id, date, by: web }, "feed", "batch_day");
      rec.feed_qty = 1;
      rec.note = "Feed corrected from 3 bags";
    } else {
      batchDay(data, layers, { date, feedItem: itemId("layers_mash"), feedQty: 1, feedUnit: "bag", deaths, eggsTrays: trays, by, conflict: d === 2 });
    }

    // Broilers batch 6 until it closed
    if (d <= 82 && d >= 40) {
      const age = 82 - d;
      batchDay(data, b6, { date, feedItem: itemId("broiler_feed"), feedQty: age < 14 ? 0.3 : 0.8, feedUnit: "bag", deaths: r() < 0.25 ? 1 : 0, eggsTrays: 0, by });
    }
    if (d === 40 || d === 38) {
      const qty = d === 40 ? 150 : Math.max(0, (b6.head_count ?? 0));
      sell(data, { farm, customer: d === 40 ? hotel : traders, date, lines: [{ item: itemId("live_broilers"), qty, unit: "bird", price: 620, enterprise: b6.id }], method: d === 40 ? "mpesa" : "cash", paid: qty * 620, by: web });
    }
    if (d === 38) {
      b6.status = "closed";
      b6.closed_on = date;
    }

    // Broilers batch 7
    if (d === b7Start) {
      b7 = startEnterprise(data, { farm, type: "broilers", name: "Broilers, batch 7", date, count: 300, cost: 28500, source: "Kenchic hatchery", structure: ph1, by: web });
      purchase(data, { farm, supplier: feeds, date, lines: [{ item: itemId("broiler_feed"), qty: 20, unit: "bag", price: 3450 }], paid: 30000, by: web });
    }
    if (b7 && d < b7Start) {
      const age = b7Start - d;
      const dd = d === 1 ? 6 : r() < 0.2 ? 1 : 0;
      batchDay(data, b7, { date, feedItem: itemId("broiler_feed"), feedQty: age < 14 ? 0.4 : 0.9, feedUnit: "bag", deaths: dd, eggsTrays: 0, note: d === 1 ? "Birds weak, some coughing" : "", by });
      if (age === 7) treatment(data, b7, { date, item: itemId("newcastle"), qty: 3, unit: "vial", dose: "Eye drop, day 7", subject: "Whole batch", by });
      if (d === 5) treatment(data, b7, { date, item: itemId("coccidiostat"), qty: 2, unit: "sachet", dose: "In drinking water, 3 days", subject: "Whole batch", by });
    }

    // Feed restocks
    if (d === 59 || d === 29) purchase(data, { farm, supplier: feeds, date, lines: [{ item: itemId("layers_mash"), qty: d === 29 ? 32 : 30, unit: "bag", price: d === 29 ? 3350 : 3300 }], paid: d === 29 ? 60000 : "full", by: web });
    if (d === 66 || d === 44 || d === 20) purchase(data, { farm, supplier: feeds, date, lines: [{ item: itemId("dairy_meal"), qty: 12, unit: "bag", price: 2650 }], paid: "full", by: web });

    // Egg sales every second day from what is in stock
    if (d % 2 === 1) {
      const available = Math.floor(balanceOf(data, farm, itemId("eggs")) / 30);
      if (available > 0) {
        const rotation = [hotel, shop, hotel, wanjiru, shop];
        const customer = rotation[(89 - d) % rotation.length];
        const onCredit = customer === wanjiru && (d === 21 || d < 10);
        const price = customer === hotel ? 400 : 380;
        sell(data, {
          farm, customer, date, lines: [{ item: itemId("eggs"), qty: available, unit: "tray", price, enterprise: layers.id }],
          method: onCredit ? "credit" : customer === hotel ? "mpesa" : "cash", paid: onCredit ? (d < 10 ? 1000 : 0) : available * price, by: web,
        });
      }
    }

    // Milk: neighbours pay cash every third day, the co-op collects weekly
    if (d % 3 === 0) {
      sell(data, { farm, customer: neighbours, date, lines: [{ item: itemId("milk"), qty: 18, unit: "l", price: 60, enterprise: dairy.id }], method: "cash", paid: 1080, by: web });
    }
    if (d % 7 === 0) {
      const litres = Math.floor(balanceOf(data, farm, itemId("milk")));
      if (litres > 0) {
        sell(data, { farm, customer: coop, date, lines: [{ item: itemId("milk"), qty: litres, unit: "l", price: 50, enterprise: dairy.id }], method: d < 14 ? "credit" : "mpesa", paid: d < 14 ? 0 : litres * 50, by: web });
      }
    }

    // Other costs (FIN-01)
    if (d % 7 === 3) financeEntry(data, { farm, enterprise: dairy.id, kind: "cost", category: "labour", amount: 1500, date, note: "Casual labour, cleaning the shed", source: "manual", by: web });
    if (d % 14 === 6) financeEntry(data, { farm, enterprise: layers.id, kind: "cost", category: "transport", amount: 600, date, note: "Egg delivery to town", source: "manual", by: web });
    if (d === 45) financeEntry(data, { farm, enterprise: dairy.id, kind: "cost", category: "vet", amount: 2500, date, note: "Vet visit, Chebet mastitis", source: "manual", by: web });
    if (new Date(`${date}T12:00:00`).getDate() === 5) financeEntry(data, { farm, enterprise: null, kind: "cost", category: "utilities", amount: 1500, date, note: "Electricity", source: "manual", by: web });
    if (d === 40) treatment(data, dairy, { date, item: itemId("dewormer"), qty: 300, unit: "ml", dose: "50 ml per cow", subject: "Whole herd", by });
    if (d === 45) data.health.push({ id: crypto.randomUUID(), enterprise_id: dairy.id, date, product: "Vet visit", dose_note: "Intramammary tubes, 3 days", subject: "KF-03 Chebet", cost: 2500, recorded_by: maryPhone(date) });

    // Maize harvest this month
    if (d === 14) activity(data, maize, { date, type: "other", inputs: [], labour: 7000, service: 0, note: "Harvesting labour", by });
    if (d === 12) harvest(data, maize, { date, qty: 20, unit: "bag", moisture: "dry", by });
    if (d === 10) activity(data, maize, { date, type: "other", inputs: [], labour: 3000, service: 2500, note: "Shelling and bagging", by });
    if (d === 6) sell(data, { farm, customer: traders, date, lines: [{ item: itemId("maize_grain"), qty: 3, unit: "bag", price: 3900, enterprise: maize.id }], method: "mpesa", paid: 11700, by: web });
  }

  return data;
}

function seedWanjiru(): OrgData {
  const data = emptyOrgData();
  const web: MRecorder = { user_id: ids.wanjiru, device: "web", synced_at: null };
  const farm = "0192a000-0000-7000-8000-0000000000f3";
  data.farms.push({ id: farm, name: "Wanjiru farm", county: "Nyeri", location: { lat: -0.42, lng: 36.95 }, setup_complete: true, created_at: at(daysAgo(200)) });
  data.picks[farm] = ["layers"];
  ensureItems(data, TYPE_ITEMS.layers);
  const shop = { id: crypto.randomUUID(), name: "Karatina market", phone: "+254799000111" };
  data.customers.push(shop);
  const feedCo = { id: crypto.randomUUID(), name: "Nyeri feeds", phone: "+254799000222" };
  data.suppliers.push(feedCo);
  const ent = startEnterprise(data, { farm, type: "layers", name: "Layers, batch 1", date: daysAgo(180), count: 200, cost: 70000, source: "Local hatchery", by: web });
  purchase(data, { farm, supplier: feedCo.id, date: daysAgo(30), lines: [{ item: itemId("layers_mash"), qty: 14, unit: "bag", price: 3300 }], paid: "full", by: web });
  for (let d = 29; d >= 0; d--) {
    const date = daysAgo(d);
    batchDay(data, ent, { date, feedItem: itemId("layers_mash"), feedQty: 0.4, feedUnit: "bag", deaths: 0, eggsTrays: 5.5, by: web });
    if (d % 3 === 0) {
      const trays = Math.floor(balanceOf(data, farm, itemId("eggs")) / 30);
      if (trays > 0) sell(data, { farm, customer: shop.id, date, lines: [{ item: itemId("eggs"), qty: trays, unit: "tray", price: 370, enterprise: ent.id }], method: "cash", paid: trays * 370, by: web });
    }
  }
  return data;
}
