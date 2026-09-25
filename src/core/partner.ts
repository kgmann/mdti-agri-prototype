// Partner-facing data (banks): the public face of the core. Only farmers who share their data are exposed.
import { sql } from "./db";
import { lendingCeiling, type Band, type LendingPolicy, type ScoreFactor } from "./scoring";

export type PartnerFarmer = {
  npi: string;
  name: string;
  commune: string;
  department: string;
  cultivatedHa: number;
  mainCrops: string[];
  score: number;
  band: Band;
  estimatedIncomeXof: number;
};

export type PartnerFilter = { department?: string; crop?: string; minScore?: number; limit?: number };

const cultivated = sql`
  (SELECT coalesce(sum(cc.area_ha), 0) FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id
    JOIN campaigns cp ON cp.id = cc.campaign_id AND cp.is_current WHERE p.owner_id = a.id)`;
const mainCrops = sql`
  coalesce((SELECT array_agg(x.name_fr ORDER BY x.area DESC) FROM (
    SELECT pr.name_fr, sum(cc.area_ha) AS area FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id
    JOIN products pr ON pr.id = cc.product_id JOIN campaigns cp ON cp.id = cc.campaign_id AND cp.is_current
    WHERE p.owner_id = a.id GROUP BY pr.name_fr) x), '{}')`;

export async function rankedFarmers(f: PartnerFilter): Promise<PartnerFarmer[]> {
  return sql<PartnerFarmer[]>`
    SELECT a.npi, a.name, c.name AS commune, d.name AS department, ${cultivated} AS "cultivatedHa", ${mainCrops} AS "mainCrops",
      cs.score, cs.band, cs.estimated_income_xof AS "estimatedIncomeXof"
    FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id AND fp.shares_data_with_partners
    JOIN credit_scores cs ON cs.farmer_id = a.id
    JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id
    WHERE true
    ${f.department ? sql`AND d.name = ${f.department}` : sql``}
    ${f.minScore ? sql`AND cs.score >= ${f.minScore}` : sql``}
    ${f.crop ? sql`AND EXISTS (SELECT 1 FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN products pr ON pr.id = cc.product_id
        JOIN campaigns cp ON cp.id = cc.campaign_id AND cp.is_current WHERE p.owner_id = a.id AND pr.code = ${f.crop})` : sql``}
    ORDER BY cs.score DESC, a.name LIMIT ${Math.min(f.limit ?? 50, 500)}`;
}

export type PartnerFarmerProfile = PartnerFarmer & {
  gender: string;
  birthYear: number;
  registeredOn: string;
  cooperative: string | null;
  parcels: { code: string; areaHa: number; landType: string; soilType: string }[];
  production: { campaign: string; crop: string; areaHa: number; harvestedKg: number; failed: number }[];
  credit: { campaign: string; creditXof: number; repaidXof: number; defaults: number }[];
  factors: ScoreFactor[];
};

export async function partnerFarmer(npi: string): Promise<PartnerFarmerProfile | null> {
  const [f] = await sql<(PartnerFarmer & { id: number; gender: string; birthYear: number; registeredOn: string; cooperative: string | null; factors: ScoreFactor[] })[]>`
    SELECT a.id, a.npi, a.name, c.name AS commune, d.name AS department, ${cultivated} AS "cultivatedHa", ${mainCrops} AS "mainCrops",
      cs.score, cs.band, cs.estimated_income_xof AS "estimatedIncomeXof", cs.factors,
      fp.gender, fp.birth_year AS "birthYear", a.registered_on::text AS "registeredOn", co.name AS cooperative
    FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id AND fp.shares_data_with_partners
    JOIN credit_scores cs ON cs.farmer_id = a.id
    JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id
    LEFT JOIN actors co ON co.id = fp.cooperative_id
    WHERE a.npi = ${npi}`;
  if (!f) return null;
  const [parcels, production, credit] = await Promise.all([
    sql<PartnerFarmerProfile["parcels"]>`
      SELECT code, area_ha AS "areaHa", land_type AS "landType", soil_type AS "soilType" FROM parcels WHERE owner_id = ${f.id} ORDER BY id`,
    sql<PartnerFarmerProfile["production"]>`
      SELECT cp.code AS campaign, pr.name_fr AS crop, sum(cc.area_ha) AS "areaHa", sum(coalesce(cc.harvested_kg, 0)) AS "harvestedKg",
        count(*) FILTER (WHERE cc.status = 'failed')::int AS failed
      FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN products pr ON pr.id = cc.product_id JOIN campaigns cp ON cp.id = cc.campaign_id
      WHERE p.owner_id = ${f.id} AND cc.status IN ('harvested', 'failed') GROUP BY cp.code, pr.name_fr ORDER BY cp.code DESC, pr.name_fr`,
    sql<PartnerFarmerProfile["credit"]>`
      SELECT cp.code AS campaign, sum(credit_amount_xof) AS "creditXof", sum(repaid_amount_xof) AS "repaidXof",
        count(*) FILTER (WHERE repayment_status = 'defaulted')::int AS defaults
      FROM input_distributions i JOIN campaigns cp ON cp.id = i.campaign_id
      WHERE recipient_id = ${f.id} AND credit_amount_xof > 0 GROUP BY cp.code ORDER BY cp.code DESC`,
  ]);
  const { id: _id, ...rest } = f;
  void _id;
  return { ...rest, parcels, production, credit };
}

export async function partnerParcels(npi: string) {
  const [row] = await sql<{ fc: unknown }[]>`
    SELECT json_build_object('type', 'FeatureCollection', 'features', coalesce(json_agg(json_build_object(
      'type', 'Feature', 'geometry', ST_AsGeoJSON(p.geom, 6)::json,
      'properties', json_build_object('code', p.code, 'areaHa', p.area_ha, 'landType', p.land_type))), '[]')) AS fc
    FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id AND fp.shares_data_with_partners
    JOIN parcels p ON p.owner_id = a.id WHERE a.npi = ${npi}`;
  return row?.fc ?? null;
}

export type Bank = { id: number; name: string; policy: LendingPolicy };

export async function listBanks(): Promise<Bank[]> {
  const rows = await sql<{ id: number; name: string; incomeShare: number; bandMultipliers: Record<Band, number>; minScore: number; maxAmountXof: number }[]>`
    SELECT a.id, a.name, bp.income_share AS "incomeShare", bp.band_multipliers AS "bandMultipliers", bp.min_score AS "minScore", bp.max_amount_xof AS "maxAmountXof"
    FROM actors a JOIN bank_policies bp ON bp.bank_id = a.id ORDER BY a.name`;
  return rows.map(({ id, name, ...policy }) => ({ id, name, policy }));
}

export async function getBank(id: number): Promise<Bank | null> {
  return (await listBanks()).find((b) => b.id === id) ?? null;
}

export type Offer = PartnerFarmer & { ceilingXof: number };

// A bank's view: eligible farmers with the ceiling computed from that bank's policy.
export async function bankOffers(bank: Bank, f: PartnerFilter): Promise<Offer[]> {
  const farmers = await rankedFarmers({ ...f, minScore: Math.max(f.minScore ?? 0, bank.policy.minScore) });
  return farmers.map((x) => ({ ...x, ceilingXof: lendingCeiling(bank.policy, x.score, x.band, x.estimatedIncomeXof) }));
}
