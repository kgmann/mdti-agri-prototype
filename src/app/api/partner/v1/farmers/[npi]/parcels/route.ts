// Partner API v1: a farmer's parcels as GeoJSON.
import { partnerParcels } from "@/core/partner";

export async function GET(_request: Request, ctx: RouteContext<"/api/partner/v1/farmers/[npi]/parcels">) {
  const fc = await partnerParcels((await ctx.params).npi);
  if (!fc) return Response.json({ error: "Farmer not found or not sharing data with partners" }, { status: 404 });
  return Response.json(fc);
}
