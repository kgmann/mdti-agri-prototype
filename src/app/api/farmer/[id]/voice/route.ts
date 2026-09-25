import { voiceChat, type ChatMessage, type Language } from "@/ai/assistant";

export async function POST(request: Request, ctx: RouteContext<"/api/farmer/[id]/voice">) {
  const { id } = await ctx.params;
  const { history, language, audio } = (await request.json()) as { history: ChatMessage[]; language: Language; audio: { mimeType: string; data: string } };
  try {
    return Response.json(await voiceChat(Number(id), language === "fon" ? "fon" : "fr", history, audio));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
