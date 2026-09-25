import { ALERT_TYPES, sendAlert, type AlertType } from "@/core/alerts";
import { parseParcelFilter } from "@/core/parcels";
import { getCurrentCampaign } from "@/core/reference";

export async function POST(request: Request) {
  const body = await request.json();
  const type = body.type as AlertType;
  const title = String(body.title ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!ALERT_TYPES.includes(type) || !title || !text) {
    return Response.json({ error: "Type, titre et message sont obligatoires." }, { status: 400 });
  }
  const campaign = await getCurrentCampaign();
  const result = await sendAlert({ type, title, body: text, filter: parseParcelFilter(body.filter ?? {}) }, campaign.id);
  return Response.json(result);
}
