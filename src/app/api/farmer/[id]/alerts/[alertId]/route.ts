import { markAlertRead } from "@/core/alerts";

export async function POST(_request: Request, ctx: RouteContext<"/api/farmer/[id]/alerts/[alertId]">) {
  const { id, alertId } = await ctx.params;
  await markAlertRead(Number(id), Number(alertId));
  return Response.json({ ok: true });
}
