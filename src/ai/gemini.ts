// Gemini client and helpers. All AI calls are server-side.
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";

let client: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export const MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Tried in order when the main model is overloaded (503) or out of quota (429).
const FALLBACK_MODELS = () => (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash,gemini-3.5-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);

// generateContent on the main text model, falling back to the next model on capacity errors.
export async function generate(params: Omit<GenerateContentParameters, "model">): Promise<GenerateContentResponse> {
  const models = [MODEL(), ...FALLBACK_MODELS().filter((m) => m !== MODEL())];
  let lastError: unknown;
  for (const model of models) {
    try {
      return await gemini().models.generateContent({ ...params, model, config: { ...params.config, httpOptions: { timeout: 45000 } } });
    } catch (e) {
      const status = (e as { status?: number }).status;
      // Retry on capacity errors and on network failures/timeouts (no status); fail fast on anything else.
      if (status !== undefined && status !== 503 && status !== 429 && status !== 500) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
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

// Removes Markdown symbols so they are not read aloud.
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_#`>]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .trim();
}

// Only the text is sent: any instruction in the prompt would be read aloud. The voice is set in speechConfig.
export async function textToSpeech(text: string): Promise<Buffer> {
  const res = await gemini().models.generateContent({
    model: TTS_MODEL(),
    contents: [{ role: "user", parts: [{ text: plainText(text) }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  });
  const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("No audio returned");
  return pcmToWav(Buffer.from(data, "base64"));
}
