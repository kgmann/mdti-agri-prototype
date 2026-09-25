// Actor registry for the government dashboard: search, detail and flows (traceability).
import { sql } from "./db";

export const ACTOR_TYPES = ["farmer", "cooperative", "processor", "distributor", "bank", "insurer"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];
export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  farmer: "Producteur",
  cooperative: "Coopérative",
  processor: "Transformateur",
  distributor: "Distributeur",
  bank: "Banque",
  insurer: "Assureur",
};

export type ActorFilter = {
  type?: ActorType;
  department?: number;
  search?: string;
  crop?: string; // farmers/cooperatives growing it this campaign, or buying it (processors, distributors)
  input?: string; // received this input this campaign
  processed?: string; // processors producing this processed product
  campaign?: number;
  page?: number;
};

export type ActorRow = {
  id: number;
  type: ActorType;
  name: string;
  nationalId: string | null;
  commune: string;
  department: string;
  detail: string | null;
};

const PAGE_SIZE = 50;

export async function searchActors(f: ActorFilter, currentCampaignId: number): Promise<{ rows: ActorRow[]; total: number; pageSize: number }> {
  const campaignId = f.campaign ?? currentCampaignId;
  const cond = sql`
    WHERE true
    ${f.type ? sql`AND a.type = ${f.type}` : sql``}
    ${f.department ? sql`AND c.department_id = ${f.department}` : sql``}
    ${f.search ? sql`AND (a.name ILIKE ${"%" + f.search + "%"} OR a.npi = ${f.search} OR a.ifu = ${f.search})` : sql``}
    ${f.crop ? sql`AND (
        EXISTS (SELECT 1 FROM parcels p JOIN crop_cycles cc ON cc.parcel_id = p.id JOIN products pr ON pr.id = cc.product_id
          WHERE p.owner_id = a.id AND cc.campaign_id = ${campaignId} AND pr.code = ${f.crop})
        OR EXISTS (SELECT 1 FROM transfers t JOIN products pr ON pr.id = t.product_id
          WHERE t.to_actor_id = a.id AND t.campaign_id = ${campaignId} AND pr.code = ${f.crop}))` : sql``}
    ${f.input ? sql`AND EXISTS (SELECT 1 FROM input_distributions i JOIN products pr ON pr.id = i.product_id
        WHERE i.recipient_id = a.id AND i.campaign_id = ${campaignId} AND pr.code = ${f.input})` : sql``}
    ${f.processed ? sql`AND EXISTS (SELECT 1 FROM processing_batches b JOIN products pr ON pr.id = b.output_product_id
        WHERE b.processor_id = a.id AND pr.code = ${f.processed})` : sql``}`;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ total }]] = await Promise.all([
    sql<ActorRow[]>`
      SELECT a.id, a.type, a.name, coalesce(a.npi, a.ifu) AS "nationalId", c.name AS commune, d.name AS department,
        CASE a.type
          WHEN 'farmer' THEN (SELECT round(sum(p.area_ha), 1) || ' ha, score ' || coalesce(cs.score::text, '–') FROM parcels p WHERE p.owner_id = a.id)
          WHEN 'cooperative' THEN (SELECT count(*) || ' membres' FROM farmer_profiles m WHERE m.cooperative_id = a.id)
          WHEN 'processor' THEN (SELECT string_agg(DISTINCT pr.name_fr, ', ') FROM processing_batches b JOIN products pr ON pr.id = b.output_product_id WHERE b.processor_id = a.id)
          ELSE NULL END AS detail
      FROM actors a JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id
      LEFT JOIN credit_scores cs ON cs.farmer_id = a.id
      ${cond}
      ORDER BY a.type, a.name LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`
      SELECT count(*)::int AS total FROM actors a JOIN communes c ON c.id = a.commune_id ${cond}`,
  ]);
  return { rows, total, pageSize: PAGE_SIZE };
}

export type ActorDetail = {
  id: number;
  type: ActorType;
  name: string;
  npi: string | null;
  ifu: string | null;
  phone: string;
  commune: string;
  department: string;
  registeredOn: string;
  lon: number;
  lat: number;
  cooperative: { id: number; name: string } | null;
  members: number;
};

export async function getActor(id: number): Promise<ActorDetail | null> {
  const [row] = await sql<ActorDetail[]>`
    SELECT a.id, a.type, a.name, a.npi, a.ifu, a.phone, c.name AS commune, d.name AS department, a.registered_on::text AS "registeredOn",
      ST_X(a.location) AS lon, ST_Y(a.location) AS lat,
      CASE WHEN co.id IS NULL THEN NULL ELSE json_build_object('id', co.id, 'name', co.name) END AS cooperative,
      (SELECT count(*)::int FROM farmer_profiles m WHERE m.cooperative_id = a.id) AS members
    FROM actors a JOIN communes c ON c.id = a.commune_id JOIN departments d ON d.id = c.department_id
    LEFT JOIN farmer_profiles fp ON fp.actor_id = a.id LEFT JOIN actors co ON co.id = fp.cooperative_id
    WHERE a.id = ${id}`;
  return row ?? null;
}

export async function cooperativeMembers(coopId: number) {
  return sql<{ id: number; name: string; commune: string; areaHa: number; score: number | null }[]>`
    SELECT a.id, a.name, c.name AS commune, (SELECT coalesce(sum(area_ha), 0) FROM parcels WHERE owner_id = a.id) AS "areaHa", cs.score
    FROM farmer_profiles fp JOIN actors a ON a.id = fp.actor_id JOIN communes c ON c.id = a.commune_id
    LEFT JOIN credit_scores cs ON cs.farmer_id = a.id
    WHERE fp.cooperative_id = ${coopId} ORDER BY a.name`;
}

export type FlowSummary = {
  direction: "in" | "out";
  campaign: string;
  product: string;
  counterparties: number;
  quantityKg: number;
  valueXof: number;
};

// Purchases (in) and sales (out) aggregated by campaign and product.
export async function actorFlows(actorId: number): Promise<FlowSummary[]> {
  return sql<FlowSummary[]>`
    SELECT CASE WHEN t.to_actor_id = ${actorId} THEN 'in' ELSE 'out' END AS direction, cp.code AS campaign, pr.name_fr AS product,
      count(DISTINCT CASE WHEN t.to_actor_id = ${actorId} THEN t.from_actor_id ELSE t.to_actor_id END)::int AS counterparties,
      sum(t.quantity_kg) AS "quantityKg", sum(t.quantity_kg * t.unit_price_xof) AS "valueXof"
    FROM transfers t JOIN campaigns cp ON cp.id = t.campaign_id JOIN products pr ON pr.id = t.product_id
    WHERE t.to_actor_id = ${actorId} OR t.from_actor_id = ${actorId}
    GROUP BY 1, 2, 3 ORDER BY 2 DESC, 1, 3`;
}

export type Transfer = {
  id: number;
  date: string;
  direction: "in" | "out";
  counterpartyId: number;
  counterpartyName: string;
  counterpartyType: ActorType;
  product: string;
  quantityKg: number;
  unitPriceXof: number;
};

export async function actorTransfers(actorId: number, limit = 30): Promise<Transfer[]> {
  return sql<Transfer[]>`
    SELECT t.id, t.date::text, CASE WHEN t.to_actor_id = ${actorId} THEN 'in' ELSE 'out' END AS direction,
      o.id AS "counterpartyId", o.name AS "counterpartyName", o.type AS "counterpartyType", pr.name_fr AS product,
      t.quantity_kg AS "quantityKg", t.unit_price_xof AS "unitPriceXof"
    FROM transfers t JOIN products pr ON pr.id = t.product_id
    JOIN actors o ON o.id = CASE WHEN t.to_actor_id = ${actorId} THEN t.from_actor_id ELSE t.to_actor_id END
    WHERE t.to_actor_id = ${actorId} OR t.from_actor_id = ${actorId}
    ORDER BY t.date DESC LIMIT ${limit}`;
}

export type InputRow = {
  date: string;
  campaign: string;
  product: string;
  counterpartyId: number | null;
  counterpartyName: string | null;
  quantityKg: number;
  valueXof: number;
  subsidized: boolean;
  creditXof: number;
  repaidXof: number;
  repaymentStatus: string;
};

// Inputs received by an actor (farmer) or supplied by it (distributor, cooperative).
export async function actorInputs(actorId: number, role: "recipient" | "supplier", limit = 40): Promise<InputRow[]> {
  const self = role === "recipient" ? sql`i.recipient_id` : sql`i.supplier_id`;
  const other = role === "recipient" ? sql`i.supplier_id` : sql`i.recipient_id`;
  return sql<InputRow[]>`
    SELECT i.date::text, cp.code AS campaign, pr.name_fr AS product, o.id AS "counterpartyId", o.name AS "counterpartyName",
      i.quantity_kg AS "quantityKg", i.value_xof AS "valueXof", i.subsidized, i.credit_amount_xof AS "creditXof",
      i.repaid_amount_xof AS "repaidXof", i.repayment_status AS "repaymentStatus"
    FROM input_distributions i JOIN products pr ON pr.id = i.product_id JOIN campaigns cp ON cp.id = i.campaign_id
    LEFT JOIN actors o ON o.id = ${other}
    WHERE ${self} = ${actorId} ORDER BY i.date DESC LIMIT ${limit}`;
}

export type Batch = {
  id: number;
  date: string;
  campaign: string;
  inputProduct: string;
  inputKg: number;
  outputProduct: string;
  outputKg: number;
  suppliers: number;
};

export async function processorBatches(processorId: number, limit = 30): Promise<Batch[]> {
  return sql<Batch[]>`
    SELECT b.id, b.date::text, cp.code AS campaign, ip.name_fr AS "inputProduct", b.input_kg AS "inputKg",
      op.name_fr AS "outputProduct", b.output_kg AS "outputKg",
      (SELECT count(DISTINCT t.from_actor_id)::int FROM processing_batch_inputs bi JOIN transfers t ON t.id = bi.transfer_id WHERE bi.batch_id = b.id) AS suppliers
    FROM processing_batches b JOIN products ip ON ip.id = b.input_product_id JOIN products op ON op.id = b.output_product_id
    JOIN campaigns cp ON cp.id = b.campaign_id
    WHERE b.processor_id = ${processorId} ORDER BY b.date DESC LIMIT ${limit}`;
}

export type BatchTrace = {
  batch: Batch & { processorId: number; processorName: string };
  suppliers: { id: number; name: string; type: ActorType; commune: string; quantityKg: number; date: string }[];
  // For supplies that came through a cooperative: its members who sold the same product to it that campaign.
  viaCooperatives: { cooperativeId: number; cooperativeName: string; farmers: { id: number; name: string; quantityKg: number }[] }[];
};

// Trace a processed batch back to the actors who supplied its raw material.
export async function traceBatch(batchId: number): Promise<BatchTrace | null> {
  const [batch] = await sql<BatchTrace["batch"][]>`
    SELECT b.id, b.date::text, cp.code AS campaign, ip.name_fr AS "inputProduct", b.input_kg AS "inputKg",
      op.name_fr AS "outputProduct", b.output_kg AS "outputKg", b.processor_id AS "processorId", pa.name AS "processorName",
      (SELECT count(DISTINCT t.from_actor_id)::int FROM processing_batch_inputs bi JOIN transfers t ON t.id = bi.transfer_id WHERE bi.batch_id = b.id) AS suppliers
    FROM processing_batches b JOIN products ip ON ip.id = b.input_product_id JOIN products op ON op.id = b.output_product_id
    JOIN campaigns cp ON cp.id = b.campaign_id JOIN actors pa ON pa.id = b.processor_id
    WHERE b.id = ${batchId}`;
  if (!batch) return null;
  const suppliers = await sql<BatchTrace["suppliers"]>`
    SELECT a.id, a.name, a.type, c.name AS commune, t.quantity_kg AS "quantityKg", t.date::text
    FROM processing_batch_inputs bi JOIN transfers t ON t.id = bi.transfer_id
    JOIN actors a ON a.id = t.from_actor_id JOIN communes c ON c.id = a.commune_id
    WHERE bi.batch_id = ${batchId} ORDER BY t.date`;
  const coopRows = await sql<{ cooperativeId: number; cooperativeName: string; id: number; name: string; quantityKg: number }[]>`
    SELECT co.id AS "cooperativeId", co.name AS "cooperativeName", f.id, f.name, sum(t2.quantity_kg) AS "quantityKg"
    FROM processing_batch_inputs bi JOIN transfers t ON t.id = bi.transfer_id
    JOIN actors co ON co.id = t.from_actor_id AND co.type = 'cooperative'
    JOIN transfers t2 ON t2.to_actor_id = co.id AND t2.product_id = t.product_id AND t2.campaign_id = t.campaign_id
    JOIN actors f ON f.id = t2.from_actor_id
    WHERE bi.batch_id = ${batchId}
    GROUP BY co.id, co.name, f.id, f.name ORDER BY co.id, f.name`;
  const viaCooperatives: BatchTrace["viaCooperatives"] = [];
  for (const r of coopRows) {
    let g = viaCooperatives.find((x) => x.cooperativeId === r.cooperativeId);
    if (!g) viaCooperatives.push((g = { cooperativeId: r.cooperativeId, cooperativeName: r.cooperativeName, farmers: [] }));
    g.farmers.push({ id: r.id, name: r.name, quantityKg: r.quantityKg });
  }
  return { batch, suppliers, viaCooperatives };
}

// Crop history of an owner's parcels (farmer or cooperative).
export async function ownerCycles(ownerId: number) {
  return sql<{ parcel: string; campaign: string; season: number; crop: string; areaHa: number; harvestedKg: number | null; status: string; sowingDate: string }[]>`
    SELECT p.code AS parcel, cp.code AS campaign, cc.season, pr.name_fr AS crop, cc.area_ha AS "areaHa", cc.harvested_kg AS "harvestedKg",
      cc.status, cc.sowing_date::text AS "sowingDate"
    FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN products pr ON pr.id = cc.product_id JOIN campaigns cp ON cp.id = cc.campaign_id
    WHERE p.owner_id = ${ownerId} ORDER BY cc.sowing_date DESC`;
}

export async function cooperativesList() {
  return sql<{ id: number; name: string }[]>`SELECT id, name FROM actors WHERE type = 'cooperative' ORDER BY name`;
}
