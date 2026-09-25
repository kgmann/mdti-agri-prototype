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
