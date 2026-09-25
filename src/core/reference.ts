// Reference data: departments, communes, campaigns, products.
import { sql } from "./db";

export type Department = { id: number; code: string; name: string };
export type Commune = { id: number; name: string; departmentId: number };
export type Campaign = { id: number; code: string; startDate: string; endDate: string; isCurrent: boolean };
export type Product = {
  id: number;
  code: string;
  nameFr: string;
  kind: "crop" | "processed" | "input";
  category: string;
  isPerennial: boolean;
  typicalYieldKgHa: number | null;
  referencePriceXof: number | null;
};

export async function getDepartments(): Promise<Department[]> {
  return sql<Department[]>`SELECT id, code, name FROM departments ORDER BY name`;
}

export async function getCommunes(): Promise<Commune[]> {
  return sql<Commune[]>`SELECT id, name, department_id AS "departmentId" FROM communes ORDER BY name`;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return sql<Campaign[]>`
    SELECT id, code, start_date::text AS "startDate", end_date::text AS "endDate", is_current AS "isCurrent"
    FROM campaigns ORDER BY start_date`;
}

export async function getCurrentCampaign(): Promise<Campaign> {
  const [c] = await sql<Campaign[]>`
    SELECT id, code, start_date::text AS "startDate", end_date::text AS "endDate", is_current AS "isCurrent"
    FROM campaigns WHERE is_current`;
  return c;
}

export async function getProducts(kind?: Product["kind"]): Promise<Product[]> {
  return sql<Product[]>`
    SELECT id, code, name_fr AS "nameFr", kind, category, is_perennial AS "isPerennial",
      typical_yield_kg_ha AS "typicalYieldKgHa", reference_price_xof AS "referencePriceXof"
    FROM products ${kind ? sql`WHERE kind = ${kind}` : sql``} ORDER BY name_fr`;
}

// Department and commune boundaries as GeoJSON, for the map.
export async function getBoundaries() {
  const [row] = await sql<{ departments: unknown; communes: unknown }[]>`
    SELECT
      (SELECT json_build_object('type', 'FeatureCollection', 'features', json_agg(json_build_object(
        'type', 'Feature', 'geometry', ST_AsGeoJSON(geom, 5)::json, 'properties', json_build_object('id', id, 'name', name)))) FROM departments) AS departments,
      (SELECT json_build_object('type', 'FeatureCollection', 'features', json_agg(json_build_object(
        'type', 'Feature', 'geometry', ST_AsGeoJSON(geom, 5)::json, 'properties', json_build_object('id', id, 'name', name)))) FROM communes) AS communes`;
  return row;
}
