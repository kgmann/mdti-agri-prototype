import { textToSpeech } from "@/ai/gemini";

export async function POST(request: Request) {
  const { text, language } = await request.json();
  if (!text) return Response.json({ error: "Texte manquant." }, { status: 400 });
  try {
    const wav = await textToSpeech(String(text).slice(0, 3000), language === "fon" ? "fon" : "fr");
    return new Response(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
