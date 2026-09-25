import { askData } from "@/ai/data-assistant";

export async function POST(request: Request) {
  const { question } = await request.json();
  if (!question || String(question).length > 1000) return Response.json({ error: "Question manquante ou trop longue." }, { status: 400 });
  try {
    return Response.json(await askData(String(question)));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
