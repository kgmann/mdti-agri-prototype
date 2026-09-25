// Gemini client and helpers. All AI calls are server-side.
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const TTS_MODEL = () => process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";

// Wraps raw 16-bit mono PCM (as returned by the TTS model) in a WAV header.
export function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function textToSpeech(text: string, language: "fr" | "fon"): Promise<Buffer> {
  const instruction =
    language === "fon"
      ? "Lis ce texte en fongbe (langue fon du Bénin), d'une voix calme et chaleureuse :"
      : "Lis ce texte en français, d'une voix calme et chaleureuse, avec un accent d'Afrique de l'Ouest :";
  const res = await gemini().models.generateContent({
    model: TTS_MODEL(),
    contents: [{ role: "user", parts: [{ text: `${instruction}\n\n${text}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  });
  const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("No audio returned");
  return pcmToWav(Buffer.from(data, "base64"));
}
