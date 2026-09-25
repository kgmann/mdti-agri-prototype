// Alerts sent by officials to farmers. Recipients are fixed at sending time.
import { sql } from "./db";
import { farmersMatching, type ParcelFilter } from "./parcels";

export const ALERT_TYPES = ["general", "weather", "pest_disease", "subsidy", "market"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  general: "Général",
  weather: "Météo",
  pest_disease: "Ravageurs et maladies",
  subsidy: "Subvention",
  market: "Marché",
};

export type Alert = {
  id: number;
  type: AlertType;
  title: string;
  body: string;
  sentAt: string;
  recipients: number;
  readCount: number;
  audienceFilter: Record<string, unknown>;
};

export async function sendAlert(input: { type: AlertType; title: string; body: string; filter: ParcelFilter }, campaignId: number) {
  const recipients = await farmersMatching(input.filter, campaignId);
  if (recipients.length === 0) return { id: null, recipients: 0 };
  return sql.begin(async (tx) => {
    const [a] = await tx<{ id: number }[]>`
      INSERT INTO alerts (type, title, body, audience_filter)
      VALUES (${input.type}, ${input.title}, ${input.body}, ${tx.json(input.filter as never)}) RETURNING id`;
    await tx`INSERT INTO alert_recipients ${tx(recipients.map((farmer_id) => ({ alert_id: a.id, farmer_id })))}`;
    return { id: a.id, recipients: recipients.length };
  });
}

export async function listAlerts(): Promise<Alert[]> {
  return sql<Alert[]>`
    SELECT a.id, a.type, a.title, a.body, a.sent_at::text AS "sentAt", a.audience_filter AS "audienceFilter",
      count(r.*)::int AS recipients, count(r.read_at)::int AS "readCount"
    FROM alerts a LEFT JOIN alert_recipients r ON r.alert_id = a.id
    GROUP BY a.id ORDER BY a.sent_at DESC`;
}

export type FarmerAlert = { id: number; type: AlertType; title: string; body: string; sentAt: string; readAt: string | null };

export async function farmerAlerts(farmerId: number): Promise<FarmerAlert[]> {
  return sql<FarmerAlert[]>`
    SELECT a.id, a.type, a.title, a.body, a.sent_at::text AS "sentAt", r.read_at::text AS "readAt"
    FROM alert_recipients r JOIN alerts a ON a.id = r.alert_id
    WHERE r.farmer_id = ${farmerId} ORDER BY a.sent_at DESC`;
}

export async function markAlertRead(farmerId: number, alertId: number) {
  await sql`UPDATE alert_recipients SET read_at = now() WHERE farmer_id = ${farmerId} AND alert_id = ${alertId} AND read_at IS NULL`;
}
