// Farmer assistant: chat, crop photo diagnosis and voice, grounded in the farmer's own context.
import { Type, type Content, type Part } from "@google/genai";
import { farmerAlerts } from "@/core/alerts";
import { getFarmer, getFarmerParcels } from "@/core/farmers";
import { getWeather, weatherSummary } from "@/lib/weather";
import { gemini, MODEL } from "./gemini";

export type ChatMessage = { role: "user" | "model"; text: string; image?: { mimeType: string; data: string } };
export type Language = "fr" | "fon";

const TODAY = "2026-09-25"; // the synthetic world's "today" (see scripts/seed.ts)

async function systemPrompt(farmerId: number, language: Language): Promise<string> {
  const [farmer, parcels, alerts] = await Promise.all([getFarmer(farmerId), getFarmerParcels(farmerId), farmerAlerts(farmerId)]);
  if (!farmer) throw new Error("Farmer not found");
  const weather = await getWeather(farmer.lat, farmer.lon);
  const parcelLines = parcels.map((p) => {
    const current = p.cycles.find((c) => c.status === "growing") ?? p.cycles.find((c) => c.status === "planned");
    const last = p.cycles.find((c) => c.status === "harvested");
    return (
      `- Parcelle ${p.code}: ${p.areaHa} ha, ${p.landType === "rainfed_upland" ? "plateau pluvial" : p.landType === "rainfed_lowland" ? "bas-fond pluvial" : "irriguée"}, ` +
      `sol ${p.soilType} (${p.soilTexture}, pH ${p.soilPh}, carbone organique ${p.soilOrganicCarbonPct} %). ` +
      (current
        ? `Culture en cours: ${current.cropName}, semée le ${current.sowingDate}, récolte prévue le ${current.expectedHarvestDate} (statut ${current.status}). `
        : "Pas de culture en cours. ") +
      (last ? `Dernière récolte: ${last.cropName}, ${last.harvestedKg} kg sur ${last.areaHa} ha (${last.campaign}).` : "")
    );
  });
  const alertLines = alerts.slice(0, 3).map((a) => `- ${a.sentAt.slice(0, 10)} ${a.title}: ${a.body}`);
  const languageRule =
    language === "fon"
      ? "Réponds en fongbe (langue fon du Bénin), avec des phrases simples. Pour les termes techniques (noms de produits, doses), ajoute le mot français entre parenthèses."
      : "Réponds en français simple, comme on parle à un producteur au Bénin.";
  return `Tu es l'assistant agricole d'Agri-Digit Bénin. Tu conseilles directement le producteur ou la productrice qui te parle, comme un bon agent de vulgarisation de l'ATDA.

Règles :
- ${languageRule}
- Sois concret et bref : quelques phrases ou une courte liste d'actions. Adapte tes conseils à ses parcelles, son sol, la saison et la météo ci-dessous.
- Sécurité : pour les pesticides, rappelle les protections et les délais avant récolte ; ne recommande jamais de produits interdits. Si le problème est grave ou incertain, conseille de contacter l'agent ATDA ou le technicien de la coopérative.
- Si on t'envoie une photo de plante : indique le problème le plus probable, le niveau de gravité (faible, moyen, élevé), ce qu'il faut faire maintenant et comment prévenir. Dis-le si la photo ne permet pas de conclure.
- N'invente pas de chiffres sur sa ferme qui ne sont pas donnés ci-dessous.

Date du jour : ${TODAY}.
Producteur : ${farmer.name}, commune de ${farmer.commune} (département ${farmer.department}).${farmer.cooperative ? ` Membre de ${farmer.cooperative.name}.` : ""}
Parcelles :
${parcelLines.join("\n")}
Météo : ${weather ? weatherSummary(weather) : "indisponible"}
Alertes récentes du ministère :
${alertLines.length ? alertLines.join("\n") : "- aucune"}`;
}

function toContents(messages: ChatMessage[]): Content[] {
  return messages.map((m) => {
    const parts: Part[] = [];
    if (m.image) parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.data } });
    parts.push({ text: m.text || (m.image ? "Qu'est-ce qui ne va pas avec cette plante ?" : "") });
    return { role: m.role, parts };
  });
}

export async function chat(farmerId: number, language: Language, messages: ChatMessage[]): Promise<string> {
  const res = await gemini().models.generateContent({
    model: MODEL(),
    contents: toContents(messages.slice(-12)),
    config: { systemInstruction: await systemPrompt(farmerId, language) },
  });
  return res.text ?? "";
}

// Voice turn: the farmer's audio is transcribed and answered in one call.
export async function voiceChat(
  farmerId: number,
  language: Language,
  history: ChatMessage[],
  audio: { mimeType: string; data: string },
): Promise<{ transcript: string; answer: string }> {
  const contents = toContents(history.slice(-10));
  contents.push({
    role: "user",
    parts: [
      { inlineData: audio },
      { text: "Message vocal du producteur. Transcris-le fidèlement dans sa langue, puis réponds-lui en suivant tes règles." },
    ],
  });
  const res = await gemini().models.generateContent({
    model: MODEL(),
    contents,
    config: {
      systemInstruction: await systemPrompt(farmerId, language),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { transcript: { type: Type.STRING }, answer: { type: Type.STRING } },
        required: ["transcript", "answer"],
      },
    },
  });
  return JSON.parse(res.text ?? "{}");
}
