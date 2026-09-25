// Yield statistics per campaign, crop and department, and the precomputed predictions.
import { sql } from "./db";

export type YieldPoint = { campaign: string; campaignId: number; areaHa: number; productionKg: number; yieldKgHa: number | null; cycles: number };
export type Prediction = {
  campaign: string;
  product: string;
  productCode: string;
  department: string;
  departmentId: number;
  predictedYieldKgHa: number;
  lowerKgHa: number;
  upperKgHa: number;
  predictedAreaHa: number;
  method: string;
  generatedAt: string;
};

// Yield history for one crop, nationally or for one department.
export async function yieldHistory(productCode: string, departmentId?: number): Promise<YieldPoint[]> {
  return sql<YieldPoint[]>`
    SELECT cp.code AS campaign, cp.id AS "campaignId", sum(ys.area_ha) AS "areaHa", sum(ys.production_kg) AS "productionKg",
      sum(ys.production_kg) / nullif(sum(ys.area_ha), 0) AS "yieldKgHa", sum(ys.cycles)::int AS cycles
    FROM yield_stats ys JOIN campaigns cp ON cp.id = ys.campaign_id JOIN products pr ON pr.id = ys.product_id
    WHERE pr.code = ${productCode} ${departmentId ? sql`AND ys.department_id = ${departmentId}` : sql``}
    GROUP BY cp.code, cp.id ORDER BY cp.id`;
}

// Predictions for the current campaign. Without a department, a national figure weighted by predicted area.
export async function predictions(productCode?: string, departmentId?: number): Promise<Prediction[]> {
  return sql<Prediction[]>`
    SELECT cp.code AS campaign, pr.name_fr AS product, pr.code AS "productCode", d.name AS department, d.id AS "departmentId",
      yp.predicted_yield_kg_ha AS "predictedYieldKgHa", yp.lower_kg_ha AS "lowerKgHa", yp.upper_kg_ha AS "upperKgHa",
      yp.predicted_area_ha AS "predictedAreaHa", yp.method, yp.generated_at::text AS "generatedAt"
    FROM yield_predictions yp JOIN campaigns cp ON cp.id = yp.campaign_id AND cp.is_current
    JOIN products pr ON pr.id = yp.product_id JOIN departments d ON d.id = yp.department_id
    WHERE true ${productCode ? sql`AND pr.code = ${productCode}` : sql``} ${departmentId ? sql`AND d.id = ${departmentId}` : sql``}
    ORDER BY pr.name_fr, d.name`;
}

// Production per department for a crop and campaign (for the table under the chart).
export async function productionByDepartment(productCode: string, campaignId: number) {
  return sql<{ department: string; areaHa: number; productionKg: number; yieldKgHa: number | null }[]>`
    SELECT d.name AS department, sum(ys.area_ha) AS "areaHa", sum(ys.production_kg) AS "productionKg",
      sum(ys.production_kg) / nullif(sum(ys.area_ha), 0) AS "yieldKgHa"
    FROM yield_stats ys JOIN departments d ON d.id = ys.department_id JOIN products pr ON pr.id = ys.product_id
    WHERE pr.code = ${productCode} AND ys.campaign_id = ${campaignId}
    GROUP BY d.name ORDER BY "productionKg" DESC`;
}

// Headline numbers for the dashboard.
export async function overview(campaignId: number) {
  const [row] = await sql<{ farmers: number; parcels: number; areaHa: number; activeParcels: number; cooperatives: number; processors: number; alerts: number }[]>`
    SELECT
      (SELECT count(*)::int FROM actors WHERE type = 'farmer') AS farmers,
      (SELECT count(*)::int FROM parcels) AS parcels,
      (SELECT sum(area_ha) FROM parcels) AS "areaHa",
      (SELECT count(DISTINCT parcel_id)::int FROM crop_cycles WHERE campaign_id = ${campaignId} AND status = 'growing') AS "activeParcels",
      (SELECT count(*)::int FROM actors WHERE type = 'cooperative') AS cooperatives,
      (SELECT count(*)::int FROM actors WHERE type = 'processor') AS processors,
      (SELECT count(*)::int FROM alerts) AS alerts`;
  return row;
}

// Monitoring indicators (the ToR's monitoring framework: coverage, inclusion, access to inputs and credit).
export type DepartmentIndicators = {
  department: string;
  farmers: number;
  womenPct: number;
  youthPct: number;
  areaHa: number;
  inputAccessPct: number;
  subsidizedPct: number;
  repaymentPct: number | null;
  coopPct: number;
  avgScore: number;
};

const YOUTH_BIRTH_YEAR = 1992; // under 35 in 2026

export async function indicatorsByDepartment(campaignId: number): Promise<DepartmentIndicators[]> {
  return sql<DepartmentIndicators[]>`
    WITH f AS (
      SELECT a.id, d.name AS department, fp.gender, fp.birth_year, fp.cooperative_id,
        (SELECT coalesce(sum(area_ha), 0) FROM parcels WHERE owner_id = a.id) AS area,
        EXISTS (SELECT 1 FROM input_distributions i WHERE i.recipient_id = a.id AND i.campaign_id = ${campaignId}) AS got_inputs,
        EXISTS (SELECT 1 FROM input_distributions i WHERE i.recipient_id = a.id AND i.campaign_id = ${campaignId} AND i.subsidized) AS got_subsidy,
        (SELECT sum(credit_amount_xof) FROM input_distributions WHERE recipient_id = a.id AND campaign_id < ${campaignId}) AS credit,
        (SELECT sum(repaid_amount_xof) FROM input_distributions WHERE recipient_id = a.id AND campaign_id < ${campaignId}) AS repaid,
        cs.score
      FROM actors a JOIN farmer_profiles fp ON fp.actor_id = a.id
      JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id
      LEFT JOIN credit_scores cs ON cs.farmer_id = a.id
    )
    SELECT department, count(*)::int AS farmers,
      100.0 * avg((gender = 'F')::int) AS "womenPct",
      100.0 * avg((birth_year >= ${YOUTH_BIRTH_YEAR})::int) AS "youthPct",
      sum(area) AS "areaHa",
      100.0 * avg(got_inputs::int) AS "inputAccessPct",
      100.0 * avg(got_subsidy::int) AS "subsidizedPct",
      100.0 * sum(repaid) / nullif(sum(credit), 0) AS "repaymentPct",
      100.0 * avg((cooperative_id IS NOT NULL)::int) AS "coopPct",
      avg(score) AS "avgScore"
    FROM f GROUP BY department ORDER BY farmers DESC`;
}

export async function indicatorTotals(campaignId: number) {
  const [row] = await sql<{
    farmers: number; womenPct: number; youthPct: number; coopPct: number; sharingPct: number; areaHa: number;
    activePct: number; inputAccessPct: number; subsidyValueXof: number; repaymentPct: number; defaults: number;
    avgScore: number; alerts: number; alertReadPct: number;
  }[]>`
    SELECT
      (SELECT count(*)::int FROM farmer_profiles) AS farmers,
      (SELECT 100.0 * avg((gender = 'F')::int) FROM farmer_profiles) AS "womenPct",
      (SELECT 100.0 * avg((birth_year >= ${YOUTH_BIRTH_YEAR})::int) FROM farmer_profiles) AS "youthPct",
      (SELECT 100.0 * avg((cooperative_id IS NOT NULL)::int) FROM farmer_profiles) AS "coopPct",
      (SELECT 100.0 * avg(shares_data_with_partners::int) FROM farmer_profiles) AS "sharingPct",
      (SELECT sum(area_ha) FROM parcels) AS "areaHa",
      (SELECT 100.0 * count(DISTINCT parcel_id) FILTER (WHERE status = 'growing') / (SELECT count(*) FROM parcels) FROM crop_cycles WHERE campaign_id = ${campaignId}) AS "activePct",
      (SELECT 100.0 * count(DISTINCT recipient_id) / (SELECT count(*) FROM farmer_profiles) FROM input_distributions WHERE campaign_id = ${campaignId}) AS "inputAccessPct",
      (SELECT coalesce(sum(value_xof), 0) FROM input_distributions WHERE campaign_id = ${campaignId} AND subsidized) AS "subsidyValueXof",
      (SELECT 100.0 * sum(repaid_amount_xof) / nullif(sum(credit_amount_xof), 0) FROM input_distributions WHERE campaign_id < ${campaignId}) AS "repaymentPct",
      (SELECT count(*)::int FROM input_distributions WHERE repayment_status = 'defaulted') AS defaults,
      (SELECT avg(score) FROM credit_scores) AS "avgScore",
      (SELECT count(*)::int FROM alerts) AS alerts,
      (SELECT 100.0 * count(read_at) / nullif(count(*), 0) FROM alert_recipients) AS "alertReadPct"`;
  return row;
}

export async function scoreBands() {
  return sql<{ band: string; farmers: number }[]>`SELECT band, count(*)::int AS farmers FROM credit_scores GROUP BY band ORDER BY band`;
}

// Production and value per crop for a campaign.
export async function productionByCrop(campaignId: number) {
  return sql<{ crop: string; productionKg: number; areaHa: number; valueXof: number }[]>`
    SELECT pr.name_fr AS crop, sum(coalesce(cc.harvested_kg, 0)) AS "productionKg", sum(cc.area_ha) AS "areaHa",
      sum(coalesce(cc.harvested_kg, 0) * pr.reference_price_xof) AS "valueXof"
    FROM crop_cycles cc JOIN products pr ON pr.id = cc.product_id
    WHERE cc.campaign_id = ${campaignId} AND cc.status IN ('harvested', 'failed')
    GROUP BY pr.name_fr ORDER BY "valueXof" DESC`;
}
