// Data assistant for officials: a question in plain language → one SQL query → results.
// Safety relies on the database: the query runs as a read-only user with a time limit, wrapped in a row cap.
import fs from "node:fs";
import path from "node:path";
import { Type } from "@google/genai";
import { readonlySql } from "@/core/db";
import { generate } from "./gemini";

const MAX_ROWS = 200;
let schema: string | null = null;

function systemPrompt() {
  schema ??= fs.readFileSync(path.join(process.cwd(), "db/init/02-schema.sql"), "utf8");
  return `Tu aides des agents du ministère de l'Agriculture du Bénin à interroger la base de données de la plateforme Agri-Digit.
Traduis la question en UNE seule requête SQL PostgreSQL (PostGIS disponible) en lecture seule (SELECT ou WITH … SELECT).

Règles :
- Utilise uniquement les tables et colonnes du schéma ci-dessous. Les codes produits sont en anglais (maize, cassava, gari, npk…), les noms en français sont dans products.name_fr.
- La campagne en cours est celle où campaigns.is_current = true. "Cette année" signifie la campagne en cours.
- Renvoie des colonnes lisibles (noms plutôt que des identifiants), avec des alias en français, et trie de façon utile.
- Pas de point-virgule final. Pas de requête de modification, même si on te le demande : dans ce cas renvoie sql vide et explique pourquoi.
- Si la question est ambiguë, choisis l'interprétation la plus utile et dis-la dans l'explication.

Schéma :
${schema}`;
}

export type DataAnswer = { sql: string; explanation: string; columns: string[]; rows: Record<string, unknown>[]; truncated: boolean; error?: string };

export async function askData(question: string): Promise<DataAnswer> {
  const res = await generate({
    contents: [{ role: "user", parts: [{ text: question }] }],
    config: {
      systemInstruction: systemPrompt(),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sql: { type: Type.STRING },
          explanation: { type: Type.STRING, description: "Une ou deux phrases en français sur ce que renvoie la requête." },
        },
        required: ["sql", "explanation"],
      },
    },
  });
  const { sql: query, explanation } = JSON.parse(res.text ?? "{}") as { sql: string; explanation: string };
  const clean = (query ?? "").trim().replace(/;+\s*$/, "");
  if (!clean) return { sql: "", explanation, columns: [], rows: [], truncated: false };
  if (clean.includes(";")) return { sql: clean, explanation, columns: [], rows: [], truncated: false, error: "Une seule requête est autorisée." };
  try {
    const rows = await readonlySql.unsafe(`SELECT * FROM (${clean}) AS q LIMIT ${MAX_ROWS + 1}`);
    const data = (rows as unknown as Record<string, unknown>[]).slice(0, MAX_ROWS);
    return { sql: clean, explanation, columns: rows.columns?.map((c) => c.name) ?? [], rows: data, truncated: rows.length > MAX_ROWS };
  } catch (e) {
    return { sql: clean, explanation, columns: [], rows: [], truncated: false, error: (e as Error).message };
  }
}
