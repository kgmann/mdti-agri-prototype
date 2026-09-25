// Farmer-facing data: identity, parcels and crops, score. Also used to build the AI assistant's context.
import { sql } from "./db";
import type { ScoreFactor } from "./scoring";

export type FarmerSummary = {
  id: number;
  name: string;
  npi: string;
  commune: string;
  department: string;
  language: "fr" | "fon";
  gender: "F" | "M";
  mainCrop: string | null;
  score: number | null;
  band: string | null;
  unreadAlerts: number;
};

export type FarmerProfile = FarmerSummary & {
  ifu: string | null;
  phone: string;
  birthYear: number;
  registeredOn: string;
  cooperative: { id: number; name: string } | null;
  sharesData: boolean;
  lon: number;
  lat: number;
};

export type FarmerParcel = {
  id: number;
  code: string;
  areaHa: number;
  landType: string;
  soilType: string;
  soilTexture: string;
  soilPh: number;
  soilOrganicCarbonPct: number;
  geometry: unknown;
  cycles: {
    id: number;
    crop: string;
    cropName: string;
    campaign: string;
    season: number;
    sowingDate: string;
    expectedHarvestDate: string;
    harvestDate: string | null;
    areaHa: number;
    harvestedKg: number | null;
    status: string;
  }[];
};

export type FarmerScore = { score: number; band: string; factors: ScoreFactor[]; estimatedIncomeXof: number; computedAt: string };

const summaryColumns = sql`
  a.id, a.name, a.npi, c.name AS commune, d.name AS department, fp.preferred_language AS language, fp.gender,
  (SELECT pr.name_fr FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN products pr ON pr.id = cc.product_id
    JOIN campaigns cp ON cp.id = cc.campaign_id AND cp.is_current
    WHERE p.owner_id = a.id GROUP BY pr.name_fr ORDER BY sum(cc.area_ha) DESC LIMIT 1) AS "mainCrop",
  cs.score, cs.band,
  (SELECT count(*)::int FROM alert_recipients r WHERE r.farmer_id = a.id AND r.read_at IS NULL) AS "unreadAlerts"`;

const summaryFrom = sql`
  FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id
  JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id
  LEFT JOIN credit_scores cs ON cs.farmer_id = a.id`;

// A handful of farmers showing different situations, for the "view as" selector.
export async function demoFarmers(): Promise<(FarmerSummary & { why: string })[]> {
  const picks = await sql<{ id: number; why: string }[]>`
    (SELECT a.id, 'Alerte non lue, producteur de maïs du Borgou' AS why FROM actors a
      JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id AND d.name = 'Borgou'
      JOIN alert_recipients r ON r.farmer_id = a.id AND r.read_at IS NULL JOIN credit_scores cs ON cs.farmer_id = a.id
      JOIN parcels p ON p.owner_id = a.id JOIN crop_cycles cc ON cc.parcel_id = p.id AND cc.status = 'growing' JOIN products pr ON pr.id = cc.product_id AND pr.code = 'maize'
      ORDER BY cs.score DESC LIMIT 1)
    UNION ALL
    (SELECT a.id, 'Parle fon, manioc et maïs dans le Zou' FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id AND fp.preferred_language = 'fon'
      JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id AND d.name = 'Zou'
      JOIN parcels p ON p.owner_id = a.id JOIN crop_cycles cc ON cc.parcel_id = p.id AND cc.status = 'growing' JOIN products pr ON pr.id = cc.product_id AND pr.code = 'cassava'
      ORDER BY a.id LIMIT 1)
    UNION ALL
    (SELECT a.id, 'Score élevé (A), producteur de coton' FROM actors a JOIN credit_scores cs ON cs.farmer_id = a.id AND cs.band = 'A'
      JOIN parcels p ON p.owner_id = a.id JOIN crop_cycles cc ON cc.parcel_id = p.id AND cc.status = 'growing' JOIN products pr ON pr.id = cc.product_id AND pr.code = 'cotton'
      ORDER BY cs.score DESC LIMIT 1)
    UNION ALL
    (SELECT a.id, 'Score faible, crédits impayés' FROM actors a JOIN credit_scores cs ON cs.farmer_id = a.id AND cs.band IN ('D', 'E')
      ORDER BY cs.score LIMIT 1)
    UNION ALL
    (SELECT a.id, 'Productrice d''ananas dans l''Atlantique' FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id AND fp.gender = 'F'
      JOIN parcels p ON p.owner_id = a.id JOIN crop_cycles cc ON cc.parcel_id = p.id AND cc.status = 'growing' JOIN products pr ON pr.id = cc.product_id AND pr.code = 'pineapple'
      ORDER BY a.id LIMIT 1)
    UNION ALL
    (SELECT a.id, 'Riziculteur de bas-fond, membre de coopérative' FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id AND fp.cooperative_id IS NOT NULL
      JOIN parcels p ON p.owner_id = a.id AND p.land_type <> 'rainfed_upland' JOIN crop_cycles cc ON cc.parcel_id = p.id AND cc.status = 'growing' JOIN products pr ON pr.id = cc.product_id AND pr.code = 'rice'
      ORDER BY a.id LIMIT 1)`;
  const ids = picks.map((p) => p.id);
  const rows = await sql<FarmerSummary[]>`SELECT ${summaryColumns} ${summaryFrom} WHERE a.id IN ${sql(ids)}`;
  return picks.map((p) => ({ ...rows.find((r) => r.id === p.id)!, why: p.why })).filter((r) => r.id);
}

export async function searchFarmers(q: string, limit = 20): Promise<FarmerSummary[]> {
  return sql<FarmerSummary[]>`
    SELECT ${summaryColumns} ${summaryFrom}
    WHERE a.type = 'farmer' AND (a.name ILIKE ${"%" + q + "%"} OR a.npi = ${q} OR c.name ILIKE ${q + "%"})
    ORDER BY a.name LIMIT ${limit}`;
}

export async function getFarmer(id: number): Promise<FarmerProfile | null> {
  const [row] = await sql<FarmerProfile[]>`
    SELECT ${summaryColumns}, a.ifu, a.phone, fp.birth_year AS "birthYear", a.registered_on::text AS "registeredOn",
      CASE WHEN co.id IS NULL THEN NULL ELSE json_build_object('id', co.id, 'name', co.name) END AS cooperative,
      fp.shares_data_with_partners AS "sharesData", ST_X(a.location) AS lon, ST_Y(a.location) AS lat
    ${summaryFrom}
    LEFT JOIN actors co ON co.id = fp.cooperative_id
    WHERE a.id = ${id}`;
  return row ?? null;
}

export async function getFarmerParcels(ownerId: number): Promise<FarmerParcel[]> {
  return sql<FarmerParcel[]>`
    SELECT p.id, p.code, p.area_ha AS "areaHa", p.land_type AS "landType", p.soil_type AS "soilType", p.soil_texture AS "soilTexture",
      p.soil_ph AS "soilPh", p.soil_organic_carbon_pct AS "soilOrganicCarbonPct", ST_AsGeoJSON(p.geom, 6)::json AS geometry,
      coalesce((SELECT json_agg(json_build_object(
          'id', cc.id, 'crop', pr.code, 'cropName', pr.name_fr, 'campaign', cp.code, 'season', cc.season,
          'sowingDate', cc.sowing_date, 'expectedHarvestDate', cc.expected_harvest_date, 'harvestDate', cc.harvest_date,
          'areaHa', cc.area_ha, 'harvestedKg', cc.harvested_kg, 'status', cc.status) ORDER BY cc.sowing_date DESC)
        FROM crop_cycles cc JOIN products pr ON pr.id = cc.product_id JOIN campaigns cp ON cp.id = cc.campaign_id
        WHERE cc.parcel_id = p.id), '[]') AS cycles
    FROM parcels p WHERE p.owner_id = ${ownerId} ORDER BY p.id`;
}

export async function getFarmerScore(farmerId: number): Promise<FarmerScore | null> {
  const [row] = await sql<FarmerScore[]>`
    SELECT score, band, factors, estimated_income_xof AS "estimatedIncomeXof", computed_at::text AS "computedAt"
    FROM credit_scores WHERE farmer_id = ${farmerId}`;
  return row ?? null;
}
