// Prices and buyers, derived from recorded sales (transfers). No separate price feed: every traced sale is a price observation.
import { sql } from "./db";

export type CropMarket = {
  crop: string;
  cropName: string;
  medianPriceXof: number | null; // median price paid to producers in the farmer's department, last 180 days
  previousYearPriceXof: number | null; // same window one year earlier
  sales: number;
  buyers: { id: number; name: string; type: string; distanceKm: number; lastPriceXof: number; lastDate: string; quantityKg: number }[];
};

// For each crop the farmer grows this campaign: local price and the nearest registered buyers of that crop.
export async function farmerMarkets(farmerId: number, campaignId: number): Promise<CropMarket[]> {
  const crops = await sql<{ id: number; code: string; name: string }[]>`
    SELECT DISTINCT pr.id, pr.code, pr.name_fr AS name
    FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN products pr ON pr.id = cc.product_id
    WHERE p.owner_id = ${farmerId} AND cc.campaign_id = ${campaignId}`;
  return Promise.all(
    crops.map(async (c) => {
      const [price] = await sql<{ median: number | null; previous: number | null; sales: number }[]>`
        WITH ref AS (SELECT max(date) AS today FROM transfers),
        local AS (
          SELECT t.date, t.unit_price_xof FROM transfers t JOIN actors s ON s.id = t.from_actor_id AND s.type = 'farmer'
          JOIN communes sc ON sc.id = s.commune_id
          WHERE t.product_id = ${c.id} AND sc.department_id = (SELECT c2.department_id FROM actors a JOIN communes c2 ON c2.id = a.commune_id WHERE a.id = ${farmerId})
        )
        SELECT
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY unit_price_xof) FROM local, ref WHERE date > today - 180) AS median,
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY unit_price_xof) FROM local, ref WHERE date BETWEEN today - 545 AND today - 365) AS previous,
          (SELECT count(*)::int FROM local, ref WHERE date > today - 180) AS sales`;
      const buyers = await sql<CropMarket["buyers"]>`
        SELECT b.id, b.name, b.type, round((ST_Distance(b.location::geography, f.location::geography) / 1000)::numeric, 1) AS "distanceKm",
          (array_agg(t.unit_price_xof ORDER BY t.date DESC))[1] AS "lastPriceXof", max(t.date)::text AS "lastDate", sum(t.quantity_kg) AS "quantityKg"
        FROM transfers t JOIN actors b ON b.id = t.to_actor_id AND b.type IN ('processor', 'distributor', 'cooperative')
        JOIN actors f ON f.id = ${farmerId}
        WHERE t.product_id = ${c.id} AND t.campaign_id >= ${campaignId - 1}
        GROUP BY b.id, b.name, b.type, b.location, f.location
        ORDER BY "distanceKm" LIMIT 3`;
      return { crop: c.code, cropName: c.name, medianPriceXof: price.median, previousYearPriceXof: price.previous, sales: price.sales, buyers };
    }),
  );
}

// Median price paid to producers per campaign for a crop (nationally or in one department).
export async function priceHistory(productCode: string, departmentId?: number) {
  return sql<{ campaign: string; medianPriceXof: number; sales: number }[]>`
    SELECT cp.code AS campaign, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.unit_price_xof) AS "medianPriceXof", count(*)::int AS sales
    FROM transfers t JOIN products pr ON pr.id = t.product_id JOIN campaigns cp ON cp.id = t.campaign_id
    JOIN actors s ON s.id = t.from_actor_id AND s.type = 'farmer' JOIN communes c ON c.id = s.commune_id
    WHERE pr.code = ${productCode} ${departmentId ? sql`AND c.department_id = ${departmentId}` : sql``}
    GROUP BY cp.code ORDER BY cp.code`;
}
