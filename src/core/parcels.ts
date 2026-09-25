// Parcels search: the filter shared by the government map and the alert audience.
import { sql } from "./db";

export type ParcelFilter = {
  department?: number;
  commune?: number;
  crop?: string; // product code of the parcel's current crop
  status?: "active" | "inactive"; // active = has a growing cycle this campaign
  minArea?: number;
  maxArea?: number;
  ownerType?: "farmer" | "cooperative";
  cooperative?: number; // owner is this cooperative or one of its members
  input?: string; // owner received this input product this campaign
  search?: string; // owner name or NPI/IFU
  owner?: number; // parcels of one owner
};

export type ParcelFeature = {
  type: "Feature";
  geometry: unknown;
  properties: {
    id: number;
    code: string;
    areaHa: number;
    landType: string;
    soilType: string;
    soilTexture: string;
    soilPh: number;
    ownerId: number;
    ownerName: string;
    ownerType: string;
    commune: string;
    department: string;
    crop: string | null;
    cropName: string | null;
    status: string | null;
    active: boolean;
    lon: number;
    lat: number;
  };
};

export function parseParcelFilter(params: URLSearchParams | Record<string, unknown>): ParcelFilter {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return v === null || v === undefined || v === "" ? undefined : String(v);
  };
  const num = (k: string) => (get(k) !== undefined ? Number(get(k)) : undefined);
  return {
    department: num("department"),
    commune: num("commune"),
    crop: get("crop"),
    status: get("status") as ParcelFilter["status"],
    minArea: num("minArea"),
    maxArea: num("maxArea"),
    ownerType: get("ownerType") as ParcelFilter["ownerType"],
    cooperative: num("cooperative"),
    input: get("input"),
    search: get("search"),
    owner: num("owner"),
  };
}

// SQL condition for a filter, over aliases p (parcels), a (owner), c (communes), cur (current cycle), act (active flag).
function where(f: ParcelFilter, campaignId: number) {
  return sql`
    WHERE true
    ${f.department ? sql`AND c.department_id = ${f.department}` : sql``}
    ${f.commune ? sql`AND p.commune_id = ${f.commune}` : sql``}
    ${f.crop ? sql`AND cur.crop = ${f.crop}` : sql``}
    ${f.status === "active" ? sql`AND act.active` : f.status === "inactive" ? sql`AND NOT act.active` : sql``}
    ${f.minArea !== undefined ? sql`AND p.area_ha >= ${f.minArea}` : sql``}
    ${f.maxArea !== undefined ? sql`AND p.area_ha <= ${f.maxArea}` : sql``}
    ${f.ownerType ? sql`AND a.type = ${f.ownerType}` : sql``}
    ${f.cooperative ? sql`AND (a.id = ${f.cooperative} OR fp.cooperative_id = ${f.cooperative})` : sql``}
    ${f.input ? sql`AND EXISTS (SELECT 1 FROM input_distributions i JOIN products ip ON ip.id = i.product_id
        WHERE i.recipient_id = a.id AND i.campaign_id = ${campaignId} AND ip.code = ${f.input})` : sql``}
    ${f.owner ? sql`AND a.id = ${f.owner}` : sql``}
    ${f.search ? sql`AND (a.name ILIKE ${"%" + f.search + "%"} OR a.npi = ${f.search} OR a.ifu = ${f.search})` : sql``}`;
}

// Common FROM clause: parcel, owner, commune, current cycle and active flag.
function from(campaignId: number) {
  return sql`
    FROM parcels p
    JOIN actors a ON a.id = p.owner_id
    LEFT JOIN farmer_profiles fp ON fp.actor_id = a.id
    JOIN communes c ON c.id = p.commune_id
    JOIN departments d ON d.id = c.department_id
    LEFT JOIN LATERAL (
      SELECT pr.code AS crop, pr.name_fr AS crop_name, cc.status::text AS status
      FROM crop_cycles cc JOIN products pr ON pr.id = cc.product_id
      WHERE cc.parcel_id = p.id AND cc.campaign_id = ${campaignId}
      ORDER BY (cc.status = 'growing') DESC, cc.sowing_date DESC LIMIT 1
    ) cur ON true
    LEFT JOIN LATERAL (
      SELECT EXISTS (SELECT 1 FROM crop_cycles g WHERE g.parcel_id = p.id AND g.campaign_id = ${campaignId} AND g.status = 'growing') AS active
    ) act ON true`;
}

export async function searchParcels(f: ParcelFilter, campaignId: number): Promise<ParcelFeature[]> {
  const rows = await sql<{ feature: ParcelFeature }[]>`
    SELECT json_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(p.geom, 6)::json,
      'properties', json_build_object(
        'id', p.id, 'code', p.code, 'areaHa', p.area_ha, 'landType', p.land_type, 'soilType', p.soil_type,
        'soilTexture', p.soil_texture, 'soilPh', p.soil_ph, 'ownerId', a.id, 'ownerName', a.name, 'ownerType', a.type,
        'commune', c.name, 'department', d.name, 'crop', cur.crop, 'cropName', cur.crop_name, 'status', cur.status,
        'active', act.active, 'lon', ST_X(ST_Centroid(p.geom)), 'lat', ST_Y(ST_Centroid(p.geom))
      )) AS feature
    ${from(campaignId)}
    ${where(f, campaignId)}
    ORDER BY p.id`;
  return rows.map((r) => r.feature);
}

// Farmers owning at least one parcel matching the filter: the audience of an alert.
export async function farmersMatching(f: ParcelFilter, campaignId: number): Promise<number[]> {
  const rows = await sql<{ id: number }[]>`
    SELECT DISTINCT a.id ${from(campaignId)} ${where({ ...f, ownerType: "farmer" }, campaignId)}`;
  return rows.map((r) => r.id);
}
