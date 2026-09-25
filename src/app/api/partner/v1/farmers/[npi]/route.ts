// Partner API v1: one farmer's profile, production and repayment history, score factors.
import { partnerFarmer } from "@/core/partner";

export async function GET(_request: Request, ctx: RouteContext<"/api/partner/v1/farmers/[npi]">) {
  const farmer = await partnerFarmer((await ctx.params).npi);
  if (!farmer) return Response.json({ error: "Farmer not found or not sharing data with partners" }, { status: 404 });
  return Response.json(farmer);
}
