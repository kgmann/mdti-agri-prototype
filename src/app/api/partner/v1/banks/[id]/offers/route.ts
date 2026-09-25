// Partner API v1: eligible farmers for a bank, with the indicative ceiling from that bank's lending policy.
import { bankOffers, getBank } from "@/core/partner";

export async function GET(request: Request, ctx: RouteContext<"/api/partner/v1/banks/[id]/offers">) {
  const bank = await getBank(Number((await ctx.params).id));
  if (!bank) return Response.json({ error: "Bank not found" }, { status: 404 });
  const p = new URL(request.url).searchParams;
  const offers = await bankOffers(bank, {
    department: p.get("department") ?? undefined,
    crop: p.get("crop") ?? undefined,
    minScore: p.get("min_score") ? Number(p.get("min_score")) : undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
  });
  return Response.json({ bank: { id: bank.id, name: bank.name, policy: bank.policy }, count: offers.length, offers });
}
