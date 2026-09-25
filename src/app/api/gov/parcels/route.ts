import { parseParcelFilter, searchParcels } from "@/core/parcels";
import { getCurrentCampaign } from "@/core/reference";

export async function GET(request: Request) {
  const filter = parseParcelFilter(new URL(request.url).searchParams);
  const campaign = await getCurrentCampaign();
  const features = await searchParcels(filter, campaign.id);
  return Response.json({ type: "FeatureCollection", features });
}
