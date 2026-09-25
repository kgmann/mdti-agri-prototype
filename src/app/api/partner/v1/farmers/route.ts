// Partner API v1: farmers ranked by credit score (only those who share their data).
import { rankedFarmers } from "@/core/partner";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const farmers = await rankedFarmers({
    department: p.get("department") ?? undefined,
    crop: p.get("crop") ?? undefined,
    minScore: p.get("min_score") ? Number(p.get("min_score")) : undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
  });
  return Response.json({ count: farmers.length, farmers });
}
