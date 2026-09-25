"use client";
import { useState } from "react";

type Answer = { sql: string; explanation: string; columns: string[]; rows: Record<string, unknown>[]; truncated: boolean; error?: string };

const EXAMPLES = [
  "Quelles coopératives vendent du manioc aux transformateurs de gari du Zou cette campagne ?",
  "Top 10 des communes par production de maïs lors de la campagne 2025-2026",
  "Combien de productrices ont reçu de l'engrais NPK subventionné cette campagne, par département ?",
  "Quels producteurs ont des crédits intrants impayés et un score supérieur à 60 ?",
  "Quantité totale d'amandes de cajou produite par transformateur, par campagne",
];

const cell = (v: unknown) => (v === null || v === undefined ? "–" : typeof v === "object" ? JSON.stringify(v) : typeof v === "number" ? v.toLocaleString("fr-FR") : String(v));

export default function DataAssistantPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    setQuestion(q);
    setLoading(true);
    setError(null);
    setAnswer(null);
    const res = await fetch("/api/gov/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
    const j = await res.json();
    setLoading(false);
    if (!res.ok) setError(j.error ?? "Erreur");
    else setAnswer(j);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
        <h1 className="font-semibold">Assistant données</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Posez une question en langage courant. L&apos;assistant la traduit en requête SQL, exécutée avec un accès en lecture seule, et affiche la requête et le résultat.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) ask(question.trim());
          }}
        >
          <input value={question} onChange={(e) => setQuestion(e.target.value)} className="flex-1 rounded border border-black/15 px-3 py-2 text-sm" placeholder="Votre question…" />
          <button disabled={loading} className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-40">{loading ? "Recherche…" : "Demander"}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <button key={q} onClick={() => ask(q)} className="rounded-full bg-brand-50 px-3 py-1 text-left text-xs text-brand-800 hover:bg-brand-100">{q}</button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {answer && (
        <section className="space-y-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <p className="text-sm">{answer.explanation}</p>
          {answer.sql && (
            <details>
              <summary className="cursor-pointer text-xs text-neutral-500">Requête SQL</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-neutral-900 p-3 text-xs text-neutral-100">{answer.sql}</pre>
            </details>
          )}
          {answer.error && <p className="text-sm text-red-700">La requête a échoué : {answer.error}</p>}
          {answer.rows.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-1 text-xs text-neutral-500">{answer.rows.length} ligne(s){answer.truncated ? " (limité à 200)" : ""}</p>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/10 text-xs text-neutral-500">
                  <tr>{answer.columns.map((c) => <th key={c} className="px-2 py-1.5 font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {answer.rows.map((r, i) => (
                    <tr key={i} className="border-b border-black/5">{answer.columns.map((c) => <td key={c} className="px-2 py-1.5">{cell(r[c])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!answer.error && answer.sql && answer.rows.length === 0 && <p className="text-sm text-neutral-500">Aucun résultat.</p>}
        </section>
      )}
    </div>
  );
}
