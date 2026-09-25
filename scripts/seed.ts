// Seeds the database: real administrative boundaries + deterministic synthetic data,
// then computes credit scores and yield predictions.
// Usage: npm run seed            (wipes and reseeds)
//        npm run seed -- --if-empty   (only seeds an empty database; used on deploy)
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { computeScore } from "../src/core/scoring";

const sql = postgres(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} });
const TODAY = "2026-09-25"; // fixed "today" of the synthetic world, so data is reproducible
const ROOT = path.join(__dirname, "..");

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------
let seedState = 20260925;
function rand() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + (b - a) * rand();
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => rand() < p;
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
function weighted<T extends string>(w: Partial<Record<T, number>>): T {
  const entries = Object.entries(w) as [T, number][];
  let r = rand() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of entries) if ((r -= v) <= 0) return k;
  return entries[entries.length - 1][0];
}
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const d = (s: string) => new Date(s + "T00:00:00Z");
const iso = (x: Date) => x.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(d(s).getTime() + n * 86400000));
const ymd = (y: number, m: number, day: number) => iso(new Date(Date.UTC(y, m - 1, day)));

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const DEPT_NAMES: Record<string, string> = { Atakora: "Atacora", Atlanique: "Atlantique", Kouffo: "Couffo", Oueme: "Ouémé" };
const COMMUNE_NAMES: Record<string, string> = {
  Come: "Comè", Save: "Savè", Ketou: "Kétou", Pobe: "Pobè", Sakete: "Sakété", "Dassa-Zoume": "Dassa-Zoumè",
  Glazoue: "Glazoué", Ouesse: "Ouèssè", Bante: "Bantè", Tanguieta: "Tanguiéta", Materi: "Matéri", Kerou: "Kérou",
  Perere: "Pèrèrè", Sinende: "Sinendé", Bembereke: "Bembèrèkè", Kalale: "Kalalé", "N'dali": "N'Dali",
  Aplahoue: "Aplahoué", Klouekanme: "Klouékanmè", Athieme: "Athiémé", Houeyogbe: "Houéyogbé", Kpomasse: "Kpomassè",
  Ze: "Zè", Aguegues: "Aguégués", "Akpo-Misserete": "Akpro-Missérété", "Adja-Ouere": "Adja-Ouèrè", Ouake: "Ouaké",
  Cove: "Covè", "Seme-Kpodji": "Sèmè-Kpodji", Boukombe: "Boukoumbé", Pehunco: "Péhunco", Kouande: "Kouandé",
  Toucountouna: "Toucountouna", Bembe: "Bembè",
};
const NORTH = ["Alibori", "Borgou", "Atacora", "Donga", "Collines"];
const BIMODAL = ["Zou", "Plateau", "Ouémé", "Atlantique", "Mono", "Couffo", "Littoral"];

type Crop = "maize" | "sorghum" | "rice" | "cassava" | "yam" | "soybean" | "cowpea" | "cotton" | "cashew" | "pineapple" | "oil_palm" | "tomato";

const PRODUCTS = [
  // code, name_fr, kind, category, perennial, typical yield kg/ha, price XOF/kg
  ["maize", "Maïs", "crop", "cereal", false, 1300, 200],
  ["sorghum", "Sorgho", "crop", "cereal", false, 1000, 220],
  ["rice", "Riz paddy", "crop", "cereal", false, 3500, 250],
  ["cassava", "Manioc", "crop", "tuber", false, 14000, 60],
  ["yam", "Igname", "crop", "tuber", false, 12000, 250],
  ["soybean", "Soja", "crop", "legume", false, 1100, 300],
  ["cowpea", "Niébé", "crop", "legume", false, 800, 450],
  ["cotton", "Coton graine", "crop", "cash_crop", false, 1000, 300],
  ["cashew", "Anacarde (noix brutes)", "crop", "cash_crop", true, 450, 400],
  ["pineapple", "Ananas", "crop", "fruit", true, 45000, 100],
  ["oil_palm", "Régimes de palme", "crop", "cash_crop", true, 8000, 60],
  ["tomato", "Tomate", "crop", "vegetable", false, 12000, 250],
  ["gari", "Gari", "processed", "food", false, null, 450],
  ["maize_flour", "Farine de maïs", "processed", "food", false, null, 350],
  ["cashew_kernels", "Amandes de cajou", "processed", "food", false, null, 3500],
  ["palm_oil", "Huile de palme", "processed", "oil", false, null, 900],
  ["pineapple_juice", "Jus d'ananas", "processed", "food", false, null, 800],
  ["parboiled_rice", "Riz étuvé", "processed", "food", false, null, 550],
  ["cotton_lint", "Fibre de coton", "processed", "fiber", false, null, 1200],
  ["npk", "Engrais NPK 15-15-15", "input", "fertilizer", false, null, 350],
  ["urea", "Urée 46 %", "input", "fertilizer", false, null, 350],
  ["maize_seed", "Semences de maïs améliorées", "input", "seed", false, null, 800],
  ["rice_seed", "Semences de riz", "input", "seed", false, null, 600],
  ["herbicide", "Herbicide", "input", "pesticide", false, null, 4000],
  ["insecticide", "Insecticide", "input", "pesticide", false, null, 5000],
] as const;

// Processed product ← raw crop, with conversion ratio (kg output per kg input)
const PROCESSING: Record<string, { from: Crop; ratio: number }> = {
  gari: { from: "cassava", ratio: 0.25 },
  maize_flour: { from: "maize", ratio: 0.8 },
  cashew_kernels: { from: "cashew", ratio: 0.22 },
  palm_oil: { from: "oil_palm", ratio: 0.2 },
  pineapple_juice: { from: "pineapple", ratio: 0.5 },
  parboiled_rice: { from: "rice", ratio: 0.65 },
  cotton_lint: { from: "cotton", ratio: 0.42 },
};
// Processors per specialty and the departments where they are located
const PROCESSORS: [string, number, string[], string][] = [
  ["gari", 8, ["Zou", "Plateau", "Couffo", "Mono", "Atlantique", "Ouémé", "Collines"], "Gari"],
  ["maize_flour", 5, ["Borgou", "Zou", "Atlantique", "Couffo", "Alibori"], "Moulin"],
  ["cashew_kernels", 5, ["Collines", "Borgou", "Donga", "Atacora"], "Cajou"],
  ["palm_oil", 4, ["Plateau", "Ouémé", "Couffo", "Mono"], "Huilerie"],
  ["pineapple_juice", 3, ["Atlantique"], "Jus"],
  ["parboiled_rice", 3, ["Alibori", "Ouémé", "Collines"], "Riz étuvé"],
  ["cotton_lint", 4, ["Borgou", "Alibori", "Atacora", "Zou"], "Égrenage"],
];

const CROP_WEIGHTS: Record<string, Partial<Record<Crop, number>>> = {
  Alibori: { cotton: 30, maize: 25, sorghum: 15, rice: 8, soybean: 8, cowpea: 6, yam: 3 },
  Borgou: { cotton: 22, maize: 25, sorghum: 10, soybean: 15, yam: 12, cashew: 8, cowpea: 5, rice: 3 },
  Atacora: { cotton: 20, maize: 25, sorghum: 20, cowpea: 10, yam: 10, cashew: 5, rice: 5, soybean: 5 },
  Donga: { maize: 25, yam: 20, cashew: 15, soybean: 12, sorghum: 10, cotton: 8, cowpea: 5, rice: 5 },
  Collines: { maize: 25, cashew: 20, soybean: 15, cassava: 12, yam: 10, cotton: 8, cowpea: 5, rice: 5 },
  Zou: { maize: 30, cassava: 20, cotton: 10, soybean: 10, cowpea: 10, tomato: 5, oil_palm: 5, rice: 5, yam: 5 },
  Plateau: { maize: 30, cassava: 20, oil_palm: 20, cowpea: 8, tomato: 7, soybean: 5, yam: 5, rice: 5 },
  Ouémé: { maize: 25, cassava: 15, oil_palm: 15, rice: 15, tomato: 15, cowpea: 10, pineapple: 5 },
  Atlantique: { pineapple: 30, maize: 25, cassava: 20, tomato: 10, oil_palm: 5, cowpea: 10 },
  Mono: { maize: 30, cassava: 25, tomato: 15, oil_palm: 10, cowpea: 10, rice: 10 },
  Couffo: { maize: 30, cassava: 25, oil_palm: 15, cowpea: 10, tomato: 10, soybean: 5, rice: 5 },
  Littoral: { tomato: 60, maize: 40 },
};
const FARMER_WEIGHTS: Record<string, number> = {
  Alibori: 12, Borgou: 14, Atacora: 10, Donga: 7, Collines: 10, Zou: 10, Plateau: 7, Ouémé: 6, Atlantique: 9, Mono: 5, Couffo: 8, Littoral: 0.3,
};
const DURATION: Record<Crop, number> = {
  maize: 105, sorghum: 130, rice: 120, cassava: 330, yam: 240, soybean: 110, cowpea: 80, cotton: 160, tomato: 95, cashew: 120, pineapple: 160, oil_palm: 150,
};
const SHARE_SOLD: Record<Crop, number> = {
  cotton: 1, cashew: 0.95, oil_palm: 0.9, pineapple: 0.85, tomato: 0.8, soybean: 0.8, rice: 0.6, maize: 0.4, sorghum: 0.3, cassava: 0.5, yam: 0.5, cowpea: 0.5,
};
const PERENNIAL: Crop[] = ["cashew", "pineapple", "oil_palm"];
const SECOND_SEASON: Crop[] = ["maize", "cowpea", "tomato"];

// Campaign-level shocks: yield and price multipliers per zone
const CAMPAIGNS = ["2021-2022", "2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027"];
const YIELD_SHOCK = [
  { north: 1.0, south: 1.02 },
  { north: 0.82, south: 0.97 }, // late rains in the north
  { north: 1.05, south: 1.04 },
  { north: 1.02, south: 0.86 }, // floods in the south
  { north: 1.08, south: 1.05 },
  { north: 1.03, south: 1.0 },
];
const PRICE_FACTOR = [0.92, 1.08, 1.0, 1.1, 1.04, 1.06];

const FIRST_M = ["Koffi", "Kossi", "Comlan", "Codjo", "Hounsou", "Mathieu", "Rodrigue", "Brice", "Gildas", "Serge", "Fiacre", "Coffi", "Mahougnon", "Ulrich", "Arnaud", "Parfait", "Sènan", "Dieudonné", "Innocent", "Romain"];
const FIRST_M_NORTH = ["Abdoulaye", "Issa", "Moussa", "Bio", "Sabi", "Orou", "Soulé", "Adamou", "Ibrahim", "Yacoubou", "Gounou", "Salifou", "Boni", "Chabi", "Idrissou", "Kamarou", "Seidou", "Alassane"];
const FIRST_F = ["Afiavi", "Ablavi", "Houéfa", "Bernadette", "Honorine", "Félicité", "Gisèle", "Hortense", "Blandine", "Akouavi", "Chimène", "Pélagie", "Victoire", "Rosine", "Grâce", "Sika", "Enagnon", "Clarisse"];
const FIRST_F_NORTH = ["Rachida", "Mariam", "Fatouma", "Aminatou", "Zénabou", "Nafissatou", "Salamatou", "Ramatou", "Mémouna", "Awa", "Safiatou", "Adiza"];
const LAST_SOUTH = ["Houngbédji", "Agossou", "Dossou", "Hounkpatin", "Zinsou", "Akpovi", "Gbaguidi", "Ahouansou", "Kpadonou", "Tossou", "Assogba", "Houénou", "Hounsa", "Adjovi", "Sossa", "Dansou", "Glèlè", "Avocè", "Kinhou", "Djossou", "Sagbo", "Akplogan"];
const LAST_CENTRE = ["Adéoti", "Akindélé", "Olabiyi", "Adébayo", "Ogoundélé", "Fagbohoun", "Adjadi", "Oké", "Lawani", "Salami", "Adégbola", "Amoussa", "Idohou", "Ayéna"];
const LAST_NORTH = ["Bio Sika", "Sabi Gado", "Orou Guéra", "Chabi Yo", "Gounou", "Worou", "Yarou", "Bouraïma", "Mama", "Djibril", "Sanni", "Boukari", "Tamou", "Kora", "Baké", "Gani", "Imorou", "Zakari", "Tokpa", "N'Tcha"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function insertMany(table: string, rows: Record<string, unknown>[], chunk = 2000) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    await sql`INSERT INTO ${sql(table)} ${sql(part as Record<string, never>[])}`;
  }
}

// Rectangle of `ha` hectares around (lon, lat), rotated, as WKT.
function parcelWkt(lon: number, lat: number, ha: number): string {
  const areaM2 = ha * 10000;
  const aspect = between(1, 2.5);
  const w = Math.sqrt(areaM2 / aspect);
  const h = w * aspect;
  const angle = rand() * Math.PI;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const corners = [
    [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2],
  ].map(([x, y]) => {
    const xr = x * Math.cos(angle) - y * Math.sin(angle);
    const yr = x * Math.sin(angle) + y * Math.cos(angle);
    return `${(lon + xr / mPerDegLon).toFixed(7)} ${(lat + yr / mPerDegLat).toFixed(7)}`;
  });
  return `POLYGON((${corners.join(",")}))`;
}
function offsetPoint(lon: number, lat: number, maxKm: number): [number, number] {
  const r = Math.sqrt(rand()) * maxKm * 1000;
  const a = rand() * 2 * Math.PI;
  return [lon + (r * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.sin(a)) / 111320];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const ifEmpty = process.argv.includes("--if-empty");
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM departments`;
  if (n > 0 && ifEmpty) {
    console.log("Database already seeded, skipping.");
    return;
  }
  console.log("Resetting tables…");
  await sql`TRUNCATE departments, communes, campaigns, products, actors, farmer_profiles, bank_policies, parcels, crop_cycles,
    programmes, input_distributions, transfers, processing_batches, processing_batch_inputs, alerts, alert_recipients,
    credit_scores, yield_predictions RESTART IDENTITY CASCADE`;

  // --- Boundaries --------------------------------------------------------------
  console.log("Loading boundaries…");
  const adm1 = JSON.parse(fs.readFileSync(path.join(ROOT, "db/data/ben_adm1.geojson"), "utf8"));
  for (const f of adm1.features) {
    const raw = f.properties.shapeName as string;
    await sql`INSERT INTO departments (code, name, geom)
      VALUES (${f.properties.shapeISO ?? "BJ-KO"}, ${DEPT_NAMES[raw] ?? raw}, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326)))`;
  }
  const adm2 = JSON.parse(fs.readFileSync(path.join(ROOT, "db/data/ben_adm2.geojson"), "utf8"));
  for (const f of adm2.features) {
    const raw = f.properties.shapeName as string;
    await sql`INSERT INTO communes (department_id, name, geom)
      SELECT dp.id, ${COMMUNE_NAMES[raw] ?? raw}, g.geom
      FROM (SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326)) AS geom) g
      JOIN LATERAL (SELECT id FROM departments ORDER BY ST_Area(ST_Intersection(departments.geom, g.geom)) DESC LIMIT 1) dp ON true`;
  }
  const communes = await sql<{ id: number; name: string; dept: string }[]>`
    SELECT c.id, c.name, d.name AS dept FROM communes c JOIN departments d ON d.id = c.department_id ORDER BY c.id`;
  const points = await sql<{ id: number; lon: number; lat: number }[]>`
    SELECT c.id, ST_X(p.geom) AS lon, ST_Y(p.geom) AS lat
    FROM communes c, ST_Dump(ST_GeneratePoints(c.geom, 120, 42)) p ORDER BY c.id, p.path`;
  const pointsByCommune = new Map<number, [number, number][]>();
  for (const p of points) {
    if (!pointsByCommune.has(p.id)) pointsByCommune.set(p.id, []);
    pointsByCommune.get(p.id)!.push([p.lon, p.lat]);
  }
  const takePoint = (communeId: number): [number, number] => {
    const list = pointsByCommune.get(communeId)!;
    return list.length > 1 ? list.shift()! : list[0];
  };
  type CommuneRow = { id: number; name: string; dept: string };
  const communesByDept = new Map<string, CommuneRow[]>();
  for (const c of communes) {
    if (!communesByDept.has(c.dept)) communesByDept.set(c.dept, []);
    communesByDept.get(c.dept)!.push(c);
  }
  const deptOf = new Map(communes.map((c) => [c.id, c.dept]));

  // --- Campaigns, products, programmes -----------------------------------------
  const campaigns = CAMPAIGNS.map((code, i) => ({
    id: i + 1, code, start_date: ymd(2021 + i, 4, 1), end_date: ymd(2022 + i, 3, 31), is_current: i === CAMPAIGNS.length - 1,
  }));
  await insertMany("campaigns", campaigns);
  const campaignOf = (date: string) => campaigns.find((c) => date >= c.start_date && date <= c.end_date);
  const CURRENT = campaigns[campaigns.length - 1];

  const products = PRODUCTS.map((p, i) => ({
    id: i + 1, code: p[0], name_fr: p[1], kind: p[2], category: p[3], is_perennial: p[4], typical_yield_kg_ha: p[5], reference_price_xof: p[6],
  }));
  await insertMany("products", products);
  const prod = Object.fromEntries(products.map((p) => [p.code, p]));

  const programmes: Record<string, unknown>[] = campaigns.map((c) => ({
    id: c.id, code: `fertilizer_subsidy_${c.code}`, name_fr: `Subvention engrais ${c.code}`, kind: "subsidy", campaign_id: c.id,
    description: "Engrais (NPK, urée) à prix subventionné pour les cultures vivrières et le coton.",
  }));
  programmes.push(
    { id: 100, code: "campaign_credit", name_fr: "Crédit de campagne", kind: "credit", campaign_id: CURRENT.id, description: "Prêt de campagne auprès des banques partenaires, basé sur le score agricole." },
    { id: 101, code: "input_credit", name_fr: "Intrants à crédit via coopérative", kind: "credit", campaign_id: CURRENT.id, description: "Intrants fournis à crédit par la coopérative, remboursables à la récolte." },
  );
  await insertMany("programmes", programmes);

  // --- Actors ------------------------------------------------------------------
  console.log("Generating actors…");
  let actorId = 0;
  const actors: Record<string, unknown>[] = [];
  const usedIds = new Set<string>();
  const uniqueId = (prefix: string, len: number) => {
    let v;
    do v = prefix + digits(len - prefix.length);
    while (usedIds.has(v));
    usedIds.add(v);
    return v;
  };
  const phone = () => `01 9${int(0, 9)} ${digits(2)} ${digits(2)} ${digits(2)}`;
  function addActor(type: string, name: string, communeId: number, loc: [number, number], registered: string, person: boolean) {
    const a = {
      id: ++actorId, type, name, npi: person ? uniqueId("99", 10) : null, ifu: person ? (chance(0.2) ? uniqueId("9", 13) : null) : uniqueId("9", 13),
      phone: phone(), commune_id: communeId, location: `SRID=4326;POINT(${loc[0]} ${loc[1]})`, registered_on: registered,
    };
    actors.push(a);
    return a;
  }
  const orgRegistered = () => ymd(2020, 1, 1).slice(0, 4) + "-" + String(int(1, 12)).padStart(2, "0") + "-" + String(int(1, 28)).padStart(2, "0");
  const communeIn = (dept: string) => pick(communesByDept.get(dept)!);

  // Cooperatives: ~40, weighted like farmers, focused on the department's main crop
  const coops: { id: number; commune: number; dept: string; crop: Crop }[] = [];
  const coopCount: Record<string, number> = { Alibori: 5, Borgou: 6, Atacora: 4, Donga: 3, Collines: 4, Zou: 4, Plateau: 3, Ouémé: 3, Atlantique: 4, Mono: 2, Couffo: 3 };
  for (const [dept, count] of Object.entries(coopCount)) {
    for (let i = 0; i < count; i++) {
      const c = communeIn(dept);
      const crop = weighted(CROP_WEIGHTS[dept]);
      const a = addActor("cooperative", `Coopérative des producteurs de ${prod[crop].name_fr.toLowerCase()} de ${c.name}`, c.id, takePoint(c.id), orgRegistered(), false);
      coops.push({ id: a.id, commune: c.id, dept, crop });
    }
  }
  // Processors
  const processors: { id: number; dept: string; output: string; input: Crop }[] = [];
  for (const [output, count, depts, label] of PROCESSORS) {
    for (let i = 0; i < count; i++) {
      const dept = depts[i % depts.length];
      const c = communeIn(dept);
      const a = addActor("processor", `${label} ${c.name}${i >= depts.length ? " II" : ""}`, c.id, takePoint(c.id), orgRegistered(), false);
      processors.push({ id: a.id, dept, output, input: PROCESSING[output].from });
    }
  }
  // Distributors: input suppliers and produce wholesalers
  const inputSuppliers: { id: number; dept: string }[] = [];
  const wholesalers: { id: number; dept: string }[] = [];
  const allDepts = Object.keys(FARMER_WEIGHTS).filter((x) => x !== "Littoral");
  allDepts.forEach((dept, i) => {
    const c = communeIn(dept);
    inputSuppliers.push({ id: addActor("distributor", `Intrants & Services ${c.name}`, c.id, takePoint(c.id), orgRegistered(), false).id, dept });
    const c2 = communeIn(dept);
    wholesalers.push({ id: addActor("distributor", `Grossiste vivrier ${c2.name}`, c2.id, takePoint(c2.id), orgRegistered(), false).id, dept });
    if (i % 2 === 0) {
      const c3 = communeIn(dept);
      wholesalers.push({ id: addActor("distributor", `Agro-Distribution ${c3.name}`, c3.id, takePoint(c3.id), orgRegistered(), false).id, dept });
    }
  });
  // Banks and insurers (fictional), head offices in Cotonou/Parakou
  const cotonou = communes.find((c) => c.name === "Cotonou")!;
  const parakou = communes.find((c) => c.name === "Parakou")!;
  const BANKS: [string, number, Record<string, number>, number, number, typeof cotonou][] = [
    ["AgriBanque Bénin (fictive)", 0.35, { A: 1, B: 0.8, C: 0.6, D: 0.3, E: 0 }, 40, 3000000, cotonou],
    ["Caisse Mutuelle des Producteurs (fictive)", 0.5, { A: 1, B: 0.9, C: 0.7, D: 0.4, E: 0 }, 30, 1500000, parakou],
    ["Banque Solidaire du Nord (fictive)", 0.3, { A: 1, B: 0.85, C: 0.5, D: 0, E: 0 }, 50, 5000000, parakou],
    ["Fonds Crédit Paysan (fictif)", 0.45, { A: 1, B: 0.75, C: 0.55, D: 0.25, E: 0 }, 35, 1000000, cotonou],
    ["Microfinance Sèmè Agri (fictive)", 0.4, { A: 0.9, B: 0.8, C: 0.6, D: 0.3, E: 0 }, 30, 800000, cotonou],
  ];
  const bankPolicies: Record<string, unknown>[] = [];
  for (const [name, share, mult, minScore, max, c] of BANKS) {
    const a = addActor("bank", name, c.id, takePoint(c.id), orgRegistered(), false);
    bankPolicies.push({ bank_id: a.id, income_share: share, band_multipliers: sql.json(mult), min_score: minScore, max_amount_xof: max });
  }
  for (const name of ["Assur'Agri Bénin (fictive)", "Mutuelle Récolte Sûre (fictive)", "Couverture Climat SA (fictive)"]) {
    addActor("insurer", name, cotonou.id, takePoint(cotonou.id), orgRegistered(), false);
  }

  // Farmers
  const FARMERS = 1500;
  type Farmer = { id: number; commune: number; dept: string; home: [number, number]; skill: number; reliability: number; coop: number | null; registered: string };
  const farmers: Farmer[] = [];
  const profiles: Record<string, unknown>[] = [];
  for (let i = 0; i < FARMERS; i++) {
    const dept = weighted(FARMER_WEIGHTS);
    const c = communeIn(dept);
    const north = NORTH.includes(dept);
    const female = chance(0.3);
    const first = female ? pick(north && chance(0.7) ? FIRST_F_NORTH : FIRST_F) : pick(north && chance(0.7) ? FIRST_M_NORTH : FIRST_M);
    const last = north ? pick(LAST_NORTH) : ["Collines", "Plateau"].includes(dept) || chance(0.2) ? pick(LAST_CENTRE) : pick(LAST_SOUTH);
    const regYear = weighted({ 2020: 35, 2021: 25, 2022: 15, 2023: 10, 2024: 10, 2025: 5 });
    const registered = ymd(Number(regYear), int(1, 12), int(1, 28));
    const home = takePoint(c.id);
    const a = addActor("farmer", `${first} ${last}`, c.id, home, registered, true);
    const localCoops = coops.filter((k) => k.commune === c.id);
    const deptCoops = coops.filter((k) => k.dept === dept);
    const coop = chance(0.45) ? (localCoops.length ? pick(localCoops) : deptCoops.length ? pick(deptCoops) : null) : null;
    const skill = Math.exp(between(-0.3, 0.25));
    farmers.push({ id: a.id, commune: c.id, dept, home, skill, reliability: Math.max(0.2, Math.min(0.97, 0.45 + (skill - 1) * 0.8 + between(0, 0.4))), coop: coop?.id ?? null, registered });
    profiles.push({
      actor_id: a.id, gender: female ? "F" : "M", birth_year: int(1958, 2002),
      preferred_language: BIMODAL.includes(dept) && chance(0.45) ? "fon" : "fr",
      cooperative_id: coop?.id ?? null, shares_data_with_partners: chance(0.85),
    });
  }
  await insertMany("actors", actors);
  await insertMany("farmer_profiles", profiles);
  await insertMany("bank_policies", bankPolicies);

  // --- Parcels -----------------------------------------------------------------
  console.log("Generating parcels…");
  type Parcel = { id: number; owner: Farmer | { id: number; commune: number; dept: string; home: [number, number]; skill: number; reliability: number; coop: null; registered: string }; crop: Crop; lowland: boolean };
  const parcels: Parcel[] = [];
  const parcelRows: Record<string, unknown>[] = [];
  const SOILS = {
    south: ["Terre de barre (sol ferrallitique)", "sablo-argileux", [5.2, 6.2], [0.6, 1.2]],
    north: ["Sol ferrugineux tropical", "sablo-limoneux", [5.5, 6.8], [0.4, 1.0]],
    lowland: ["Sol hydromorphe", "argileux", [5.0, 6.0], [1.2, 2.5]],
    vertisol: ["Vertisol (dépression de la Lama)", "argileux", [6.5, 7.5], [0.8, 1.5]],
  } as const;
  function addParcel(owner: Parcel["owner"], big: boolean) {
    const dept = owner.dept;
    let crop = weighted(CROP_WEIGHTS[dept]);
    const lowland = crop === "rice" || chance(0.08);
    if (lowland && !["rice", "tomato", "maize", "cassava"].includes(crop)) crop = "rice";
    const north = NORTH.includes(dept);
    const median = big ? 8 : north ? 2.4 : 1.3;
    const ha = Math.max(0.3, Math.min(big ? 25 : 12, median * Math.exp(between(-0.8, 0.8))));
    const [lon, lat] = offsetPoint(owner.home[0], owner.home[1], 2.5);
    const soilKey = lowland ? "lowland" : ["Zou", "Couffo"].includes(dept) && chance(0.15) ? "vertisol" : north ? "north" : "south";
    const soil = SOILS[soilKey];
    const p: Parcel = { id: parcels.length + 1, owner, crop, lowland };
    parcels.push(p);
    parcelRows.push({
      id: p.id, code: `P-${String(p.id).padStart(6, "0")}`, owner_id: owner.id, commune_id: owner.commune,
      geom: `SRID=4326;${parcelWkt(lon, lat, ha)}`, area_ha: 0,
      land_type: crop === "rice" && chance(0.3) ? "irrigated" : lowland ? "rainfed_lowland" : "rainfed_upland",
      soil_type: soil[0], soil_texture: soil[1],
      soil_ph: Number(between(soil[2][0], soil[2][1]).toFixed(1)), soil_organic_carbon_pct: Number(between(soil[3][0], soil[3][1]).toFixed(2)),
    });
  }
  for (const f of farmers) {
    const count = Number(weighted({ 1: 50, 2: 35, 3: 15 }));
    for (let i = 0; i < count; i++) addParcel(f, false);
  }
  for (const k of coops.slice(0, 30)) {
    const home = actors.find((a) => a.id === k.id)!.location as string;
    const [lon, lat] = home.replace(/.*POINT\(|\)/g, "").split(" ").map(Number);
    addParcel({ id: k.id, commune: k.commune, dept: k.dept, home: [lon, lat], skill: 1.05, reliability: 0.9, coop: null, registered: "2020-01-01" }, true);
  }
  await insertMany("parcels", parcelRows);
  await sql`UPDATE parcels SET area_ha = round((ST_Area(geom::geography) / 10000)::numeric, 2)`;
  const areas = new Map((await sql<{ id: number; area_ha: string }[]>`SELECT id, area_ha FROM parcels`).map((r) => [r.id, Number(r.area_ha)]));

  // --- Crop cycles -------------------------------------------------------------
  console.log("Generating crop cycles…");
  type Cycle = { id: number; parcel: Parcel; crop: Crop; campaign: number; season: number; sow: string; expected: string; harvest: string | null; area: number; kg: number | null; status: string };
  const cycles: Cycle[] = [];
  const deptFactor = new Map<string, number>();
  const factor = (crop: string, dept: string) => {
    const k = crop + dept;
    if (!deptFactor.has(k)) deptFactor.set(k, between(0.82, 1.18));
    return deptFactor.get(k)!;
  };
  for (const p of parcels) {
    const dept = p.owner.dept;
    const zone = NORTH.includes(dept) ? "north" : "south";
    const bimodal = BIMODAL.includes(dept);
    let crop = p.crop;
    for (let ci = 0; ci < CAMPAIGNS.length; ci++) {
      const y = 2021 + ci;
      if (ci > 0 && !PERENNIAL.includes(crop) && chance(0.25)) {
        const w = { ...CROP_WEIGHTS[dept] };
        for (const pc of PERENNIAL) delete w[pc];
        crop = p.lowland ? pick(["rice", "maize", "tomato"] as Crop[]).valueOf() as Crop : weighted(w);
      }
      const plans: { season: number; sow: string; harvest: string }[] = [];
      if (crop === "cashew") { const h = addDays(ymd(y + 1, 2, 1), int(0, 50)); plans.push({ season: 1, sow: addDays(h, -120), harvest: h }); }
      else if (crop === "oil_palm") { const h = addDays(ymd(y + 1, 1, 15), int(0, 60)); plans.push({ season: 1, sow: addDays(h, -150), harvest: h }); }
      else if (crop === "pineapple") { const h = addDays(ymd(y, 5, 1), int(0, 300)); plans.push({ season: 1, sow: addDays(h, -160), harvest: h }); }
      else {
        let sow: string;
        if (crop === "cassava") sow = addDays(ymd(y - 1, 4, 1), int(0, 50)); // planted the previous year, harvested this campaign
        else if (crop === "yam") sow = addDays(ymd(y, 3, 15), int(0, 40));
        else if (crop === "cotton") sow = addDays(ymd(y, 5, 20), int(0, 40));
        else if (bimodal) sow = addDays(ymd(y, 3, 20), int(0, 40));
        else sow = addDays(ymd(y, 6, 1), int(0, 40));
        plans.push({ season: 1, sow, harvest: addDays(sow, DURATION[crop] + int(-10, 10)) });
        if (bimodal && SECOND_SEASON.includes(crop) && chance(0.5)) {
          const sow2 = addDays(ymd(y, 9, 1), int(0, 30));
          plans.push({ season: 2, sow: sow2, harvest: addDays(sow2, DURATION[crop] + int(-5, 10)) });
        }
      }
      for (const plan of plans) {
        const camp = campaignOf(plan.harvest);
        if (!camp || camp.end_date < p.owner.registered) continue;
        const isCurrent = camp.id === CURRENT.id;
        const area = Number((areas.get(p.id)! * (plan.season === 2 ? between(0.4, 0.8) : between(0.7, 1))).toFixed(2));
        let status: string;
        if (plan.harvest <= TODAY) status = chance(isCurrent ? 0.04 : 0.06) ? "failed" : "harvested";
        else if (PERENNIAL.includes(crop) || plan.sow <= TODAY) status = "growing";
        else status = "planned";
        let kg: number | null = null;
        if (status === "harvested" || status === "failed") {
          const trend = 1 + 0.015 * (camp.id - 1);
          const yld = prod[crop].typical_yield_kg_ha! * factor(crop, dept) * YIELD_SHOCK[camp.id - 1][zone] * p.owner.skill * trend * between(0.85, 1.15);
          kg = Math.round(area * yld * (status === "failed" ? between(0, 0.3) : 1));
        }
        cycles.push({ id: cycles.length + 1, parcel: p, crop, campaign: camp.id, season: plan.season, sow: plan.sow, expected: plan.harvest, harvest: status === "harvested" || status === "failed" ? plan.harvest : null, area, kg, status });
      }
    }
  }
  await insertMany("crop_cycles", cycles.map((c) => ({
    id: c.id, parcel_id: c.parcel.id, product_id: prod[c.crop].id, campaign_id: c.campaign, season: c.season, sowing_date: c.sow,
    expected_harvest_date: c.expected, harvest_date: c.harvest, area_ha: c.area, harvested_kg: c.kg, status: c.status,
  })));

  // --- Input distributions -----------------------------------------------------
  console.log("Generating input distributions…");
  const inputs: Record<string, unknown>[] = [];
  const FERT_P: Partial<Record<Crop, number>> = { cotton: 0.9, maize: 0.6, rice: 0.7, tomato: 0.6, sorghum: 0.3, soybean: 0.2, cassava: 0.15, yam: 0.15, pineapple: 0.5 };
  const supplierFor = (f: Parcel["owner"]) => (f.coop && chance(0.4) ? f.coop : (inputSuppliers.find((s) => s.dept === f.dept) ?? pick(inputSuppliers)).id);
  for (const c of cycles) {
    const f = c.parcel.owner;
    const date = addDays(c.sow, -int(0, 20));
    if (date > TODAY) continue;
    const camp = campaigns[c.campaign - 1];
    const give = (code: string, kg: number, subsidizable: boolean) => {
      const value = Math.round(kg * prod[code].reference_price_xof!);
      const subsidized = subsidizable && chance(0.65);
      const onCredit = chance(0.45);
      const credit = onCredit ? Math.round(value * (subsidized ? 0.5 : 1) * between(0.6, 1)) : 0;
      let status = "none", repaid = 0;
      if (credit > 0) {
        const harvested = c.status === "harvested" || c.status === "failed";
        if (camp.id === CURRENT.id && !harvested) status = "pending";
        else if (chance(f.reliability * (c.status === "failed" ? 0.5 : 1))) { status = "repaid"; repaid = credit; }
        else if (camp.id === CURRENT.id) status = "pending";
        else if (chance(0.6)) { status = "partial"; repaid = Math.round(credit * between(0.3, 0.9)); }
        else { status = "defaulted"; repaid = Math.round(credit * between(0, 0.2)); }
      }
      inputs.push({
        recipient_id: f.id, supplier_id: supplierFor(f), product_id: prod[code].id, campaign_id: camp.id,
        programme_id: subsidized ? camp.id : null, date, quantity_kg: Math.round(kg), value_xof: value, subsidized,
        credit_amount_xof: credit, repaid_amount_xof: repaid, repayment_status: status,
      });
    };
    if (chance(FERT_P[c.crop] ?? 0.1)) {
      give("npk", c.area * 150 * between(0.7, 1.2), true);
      if (chance(0.6)) give("urea", c.area * 50 * between(0.7, 1.2), true);
    }
    if ((c.crop === "maize" || c.crop === "rice") && chance(0.25)) give(c.crop === "maize" ? "maize_seed" : "rice_seed", c.area * 25, false);
    if (chance(0.3)) give("herbicide", c.area * 3, false);
    if (c.crop === "cotton" || (c.crop === "tomato" && chance(0.5))) give("insecticide", c.area * 2, false);
  }
  await insertMany("input_distributions", inputs.map((r, i) => ({ id: i + 1, ...r })));

  // --- Transfers and processing ------------------------------------------------
  console.log("Generating transfers and processing batches…");
  type Transfer = { id: number; from_actor_id: number; to_actor_id: number; product_id: number; campaign_id: number; date: string; quantity_kg: number; unit_price_xof: number };
  const transfers: Transfer[] = [];
  const addTransfer = (from: number, to: number, code: string, campaign: number, date: string, kg: number, price: number) => {
    if (date > TODAY || kg <= 0) return null;
    const t = { id: transfers.length + 1, from_actor_id: from, to_actor_id: to, product_id: prod[code].id, campaign_id: campaign, date, quantity_kg: Math.round(kg), unit_price_xof: Math.round(price) };
    transfers.push(t);
    return t;
  };
  const near = <T extends { dept: string }>(list: T[], dept: string) => {
    const local = list.filter((x) => x.dept === dept);
    return local.length && chance(0.8) ? pick(local) : pick(list);
  };
  const processorFor = (crop: Crop, dept: string) => {
    const list = processors.filter((p) => p.input === crop);
    return list.length ? near(list, dept) : null;
  };
  const PROCESS_P: Partial<Record<Crop, number>> = { cotton: 1, oil_palm: 0.9, cassava: 0.7, rice: 0.6, cashew: 0.5, pineapple: 0.5, maize: 0.3 };
  for (const c of cycles) {
    if (c.status !== "harvested" || !c.kg) continue;
    const f = c.parcel.owner;
    const kg = c.kg * SHARE_SOLD[c.crop] * between(0.85, 1);
    const price = prod[c.crop].reference_price_xof! * PRICE_FACTOR[c.campaign - 1] * between(0.9, 1.1);
    const date = addDays(c.harvest!, int(3, 45));
    let buyer: number;
    if (f.coop && chance(0.5)) buyer = f.coop;
    else {
      const proc = chance(PROCESS_P[c.crop] ?? 0) ? processorFor(c.crop, f.dept) : null;
      buyer = proc ? proc.id : near(wholesalers, f.dept).id;
    }
    addTransfer(f.id, buyer, c.crop, c.campaign, date, kg, price);
  }
  // Cooperatives resell what they collected (plus their own harvest) in a few lots
  for (const k of coops) {
    for (const camp of campaigns) {
      const byCrop = new Map<number, { kg: number; last: string }>();
      for (const t of transfers) {
        if (t.to_actor_id !== k.id || t.campaign_id !== camp.id) continue;
        const e = byCrop.get(t.product_id) ?? { kg: 0, last: t.date };
        e.kg += t.quantity_kg;
        if (t.date > e.last) e.last = t.date;
        byCrop.set(t.product_id, e);
      }
      for (const [pid, e] of byCrop) {
        const code = products[pid - 1].code as Crop;
        const lots = int(1, 3);
        for (let l = 0; l < lots; l++) {
          const proc = chance(PROCESS_P[code] ?? 0) ? processorFor(code, k.dept) : null;
          const buyer = proc ? proc.id : near(wholesalers, k.dept).id;
          addTransfer(k.id, buyer, code, camp.id, addDays(e.last, int(5, 30)), (e.kg * 0.95) / lots, prod[code].reference_price_xof! * PRICE_FACTOR[camp.id - 1] * 1.08);
        }
      }
    }
  }
  // Processing batches from each processor's incoming raw material, then sales of the output to wholesalers
  const batches: Record<string, unknown>[] = [];
  const batchInputs: Record<string, unknown>[] = [];
  for (const p of processors) {
    const incoming = transfers.filter((t) => t.to_actor_id === p.id && t.product_id === prod[p.input].id).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < incoming.length; ) {
      const size = int(4, 12);
      const group = incoming.slice(i, i + size);
      i += size;
      const last = group[group.length - 1];
      const date = addDays(last.date, int(1, 10));
      if (date > TODAY) continue;
      const inKg = group.reduce((s, t) => s + t.quantity_kg, 0) * between(0.9, 1);
      const outKg = inKg * PROCESSING[p.output].ratio * between(0.95, 1.05);
      const id = batches.length + 1;
      batches.push({ id, processor_id: p.id, campaign_id: last.campaign_id, date, input_product_id: prod[p.input].id, input_kg: Math.round(inKg), output_product_id: prod[p.output].id, output_kg: Math.round(outKg) });
      for (const t of group) batchInputs.push({ batch_id: id, transfer_id: t.id });
      addTransfer(p.id, near(wholesalers, p.dept).id, p.output, last.campaign_id, addDays(date, int(2, 20)), outKg * between(0.8, 0.95), prod[p.output].reference_price_xof! * PRICE_FACTOR[last.campaign_id - 1] * between(0.95, 1.05));
    }
  }
  await insertMany("transfers", transfers);
  await insertMany("processing_batches", batches);
  await insertMany("processing_batch_inputs", batchInputs);

  // --- Alerts (a few past ones, so portals have content) -----------------------
  console.log("Generating alerts…");
  const alertDefs = [
    { type: "pest_disease", title: "Chenille légionnaire d'automne signalée", body: "Des attaques de chenille légionnaire d'automne ont été signalées sur le maïs dans votre zone. Inspectez vos champs deux fois par semaine (feuilles trouées, sciure dans le cornet). En cas d'attaque, contactez votre agent ATDA avant tout traitement.", sent: "2026-08-12T09:00:00Z", filter: { departments: ["Borgou", "Alibori"], crop: "maize" } },
    { type: "weather", title: "Fortes pluies attendues cette semaine", body: "METEO-Bénin prévoit de fortes pluies du jeudi au dimanche. Évitez les semis et les épandages d'engrais pendant cette période, dégagez les rigoles de drainage et protégez les récoltes stockées.", sent: "2026-09-21T07:30:00Z", filter: { departments: ["Ouémé", "Atlantique", "Mono"] } },
    { type: "subsidy", title: "Engrais subventionné disponible pour la deuxième saison", body: "L'engrais NPK et l'urée subventionnés pour la deuxième saison sont disponibles auprès de votre coopérative et des points de vente agréés jusqu'au 15 octobre. Présentez votre NPI.", sent: "2026-09-02T10:00:00Z", filter: { departments: ["Zou", "Couffo", "Plateau"], active: true } },
  ];
  const cur = CURRENT.id;
  for (let i = 0; i < alertDefs.length; i++) {
    const a = alertDefs[i];
    await sql`INSERT INTO alerts (id, type, title, body, audience_filter, sent_at) VALUES (${i + 1}, ${a.type}, ${a.title}, ${a.body}, ${sql.json(a.filter)}, ${a.sent})`;
    const recipients = await sql<{ id: number }[]>`
      SELECT DISTINCT a.id FROM actors a
      JOIN communes c ON c.id = a.commune_id JOIN departments dp ON dp.id = c.department_id
      JOIN parcels p ON p.owner_id = a.id JOIN crop_cycles cc ON cc.parcel_id = p.id AND cc.campaign_id = ${cur}
      JOIN products pr ON pr.id = cc.product_id
      WHERE a.type = 'farmer' AND dp.name = ANY(${a.filter.departments})
        AND (${a.filter.crop ?? null}::text IS NULL OR pr.code = ${a.filter.crop ?? null})
        AND (${a.filter.active ?? false} = false OR cc.status = 'growing')`;
    await insertMany("alert_recipients", recipients.map((r) => ({ alert_id: i + 1, farmer_id: r.id, read_at: chance(0.5) ? a.sent : null })));
  }

  // --- Credit scores -----------------------------------------------------------
  console.log("Computing credit scores…");
  await computeCreditScores(CURRENT.id);

  // --- Yield predictions -------------------------------------------------------
  console.log("Computing yield predictions…");
  await sql`
    INSERT INTO yield_predictions (campaign_id, product_id, department_id, predicted_yield_kg_ha, lower_kg_ha, upper_kg_ha, predicted_area_ha, method)
    SELECT ${cur}, h.product_id, h.department_id,
      greatest(0, round((h.a + h.b * ${cur})::numeric)),
      greatest(0, round((h.a + h.b * ${cur} - 1.64 * greatest(h.sd, 0.05 * h.mean))::numeric)),
      round((h.a + h.b * ${cur} + 1.64 * greatest(h.sd, 0.05 * h.mean))::numeric),
      coalesce(ar.area, 0),
      'Tendance linéaire sur les campagnes passées (référence simple)'
    FROM (
      SELECT product_id, department_id,
        regr_intercept(yield_kg_ha, campaign_id) AS a, regr_slope(yield_kg_ha, campaign_id) AS b,
        coalesce(sqrt(regr_syy(yield_kg_ha, campaign_id) * (1 - coalesce(regr_r2(yield_kg_ha, campaign_id), 0)) / greatest(count(*) - 2, 1)), 0) AS sd,
        avg(yield_kg_ha) AS mean
      FROM yield_stats WHERE campaign_id < ${cur} AND cycles >= 3
      GROUP BY product_id, department_id HAVING count(*) >= 3
    ) h
    LEFT JOIN (
      SELECT cc.product_id, c.department_id, sum(cc.area_ha) AS area
      FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN communes c ON c.id = p.commune_id
      WHERE cc.campaign_id = ${cur} GROUP BY 1, 2
    ) ar ON ar.product_id = h.product_id AND ar.department_id = h.department_id`;

  // --- Sequences ---------------------------------------------------------------
  for (const t of ["campaigns", "products", "programmes", "actors", "parcels", "crop_cycles", "input_distributions", "transfers", "processing_batches", "alerts"]) {
    await sql.unsafe(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT max(id) FROM ${t}))`);
  }
  const counts = await sql`SELECT
    (SELECT count(*) FROM actors WHERE type = 'farmer') AS farmers, (SELECT count(*) FROM parcels) AS parcels,
    (SELECT count(*) FROM crop_cycles) AS cycles, (SELECT count(*) FROM input_distributions) AS inputs,
    (SELECT count(*) FROM transfers) AS transfers, (SELECT count(*) FROM processing_batches) AS batches,
    (SELECT count(*) FROM yield_predictions) AS predictions`;
  console.log("Done:", counts[0]);
}

// Computes the scorecard for every farmer from the registries and flows.
async function computeCreditScores(currentId: number) {
  const rows = await sql<{
    id: number; yield_ratio: string | null; cycles_total: number; cycles_failed: number; credit_total: string; credit_repaid: string;
    defaults: number; sales_value: string | null; production_value: string | null; cultivated_ha: string; coop: boolean; years: number; income: string;
  }[]>`
    WITH farmer_cycles AS (
      SELECT p.owner_id AS farmer_id, cc.*, c.department_id
      FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN communes c ON c.id = p.commune_id
      JOIN actors a ON a.id = p.owner_id AND a.type = 'farmer'
    ),
    ratios AS (
      SELECT fc.farmer_id, avg((fc.harvested_kg / nullif(fc.area_ha, 0)) / nullif(ys.yield_kg_ha, 0)) AS r
      FROM farmer_cycles fc JOIN yield_stats ys USING (campaign_id, product_id, department_id)
      WHERE fc.campaign_id BETWEEN ${currentId - 3} AND ${currentId - 1} AND fc.status IN ('harvested', 'failed')
      GROUP BY fc.farmer_id
    ),
    last_prod AS (
      SELECT fc.farmer_id, sum(fc.harvested_kg * pr.reference_price_xof) AS value
      FROM farmer_cycles fc JOIN products pr ON pr.id = fc.product_id
      WHERE fc.campaign_id = ${currentId - 1} AND fc.status = 'harvested' GROUP BY fc.farmer_id
    ),
    last_sales AS (
      SELECT from_actor_id AS farmer_id, sum(t.quantity_kg * pr.reference_price_xof) AS value
      FROM transfers t JOIN products pr ON pr.id = t.product_id WHERE t.campaign_id = ${currentId - 1} GROUP BY 1
    ),
    ref_price AS (
      SELECT product_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY unit_price_xof) AS price
      FROM transfers WHERE campaign_id = ${currentId - 1} GROUP BY product_id
    ),
    farmer_avg_yield AS (
      SELECT farmer_id, product_id, avg(harvested_kg / nullif(area_ha, 0)) AS y
      FROM farmer_cycles WHERE status = 'harvested' GROUP BY 1, 2
    ),
    income AS (
      SELECT fc.farmer_id, sum(
        CASE WHEN fc.status = 'harvested' THEN fc.harvested_kg
             WHEN fc.status = 'failed' THEN 0
             ELSE fc.area_ha * coalesce(fay.y, pr.typical_yield_kg_ha) END
        * coalesce(rp.price, pr.reference_price_xof)) AS value,
        sum(fc.area_ha) AS ha
      FROM farmer_cycles fc JOIN products pr ON pr.id = fc.product_id
      LEFT JOIN farmer_avg_yield fay ON fay.farmer_id = fc.farmer_id AND fay.product_id = fc.product_id
      LEFT JOIN ref_price rp ON rp.product_id = fc.product_id
      WHERE fc.campaign_id = ${currentId} GROUP BY fc.farmer_id
    ),
    history AS (
      SELECT farmer_id, count(*)::int AS total, count(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM farmer_cycles WHERE campaign_id < ${currentId} GROUP BY farmer_id
    ),
    credit AS (
      SELECT recipient_id AS farmer_id, sum(credit_amount_xof) AS total, sum(repaid_amount_xof) AS repaid,
        count(*) FILTER (WHERE repayment_status = 'defaulted')::int AS defaults
      FROM input_distributions WHERE campaign_id < ${currentId} AND credit_amount_xof > 0 GROUP BY 1
    )
    SELECT a.id, r.r AS yield_ratio, coalesce(h.total, 0) AS cycles_total, coalesce(h.failed, 0) AS cycles_failed,
      coalesce(cr.total, 0) AS credit_total, coalesce(cr.repaid, 0) AS credit_repaid, coalesce(cr.defaults, 0) AS defaults,
      ls.value AS sales_value, lp.value AS production_value, coalesce(i.ha, 0) AS cultivated_ha,
      fp.cooperative_id IS NOT NULL AS coop,
      greatest(0, extract(year FROM age(DATE '2026-09-25', a.registered_on)))::int AS years,
      coalesce(i.value, 0) AS income
    FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id
    LEFT JOIN ratios r ON r.farmer_id = a.id LEFT JOIN history h ON h.farmer_id = a.id
    LEFT JOIN credit cr ON cr.farmer_id = a.id LEFT JOIN last_sales ls ON ls.farmer_id = a.id
    LEFT JOIN last_prod lp ON lp.farmer_id = a.id LEFT JOIN income i ON i.farmer_id = a.id
    WHERE a.type = 'farmer'`;
  const out = rows.map((r) => {
    const prodValue = r.production_value ? Number(r.production_value) : 0;
    const { score, band, factors } = computeScore({
      yieldRatio: r.yield_ratio === null ? null : Number(r.yield_ratio),
      cyclesTotal: r.cycles_total, cyclesFailed: r.cycles_failed,
      creditTotalXof: Number(r.credit_total), creditRepaidXof: Number(r.credit_repaid), defaults: r.defaults,
      salesShare: prodValue > 0 ? Math.min(1, Number(r.sales_value ?? 0) / prodValue) : null,
      cultivatedHa: Number(r.cultivated_ha), coopMember: r.coop, yearsRegistered: r.years,
    });
    return { farmer_id: r.id, campaign_id: currentId, score, band, factors: sql.json(factors), estimated_income_xof: Math.round(Number(r.income)) };
  });
  await insertMany("credit_scores", out);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
