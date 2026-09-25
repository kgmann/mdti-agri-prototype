import { chat, type ChatMessage, type Language } from "@/ai/assistant";

export async function POST(request: Request, ctx: RouteContext<"/api/farmer/[id]/chat">) {
  const { id } = await ctx.params;
  const { messages, language } = (await request.json()) as { messages: ChatMessage[]; language: Language };
  try {
    return Response.json({ answer: await chat(Number(id), language === "fon" ? "fon" : "fr", messages) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
