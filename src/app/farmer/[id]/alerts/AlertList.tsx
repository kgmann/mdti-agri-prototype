"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type A = { id: number; type: string; typeLabel: string; title: string; body: string; sentAt: string; readAt: string | null };

export default function AlertList({ farmerId, alerts }: { farmerId: number; alerts: A[] }) {
  const router = useRouter();
  const [read, setRead] = useState<Set<number>>(new Set(alerts.filter((a) => a.readAt).map((a) => a.id)));
  const [playing, setPlaying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reads the alert aloud, for farmers who read with difficulty.
  async function listen(a: A) {
    setPlaying(a.id);
    setError(null);
    open(a);
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `${a.title}. ${a.body}` }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audio.onended = () => setPlaying(null);
      await audio.play();
    } catch (e) {
      setPlaying(null);
      setError(`Lecture impossible : ${(e as Error).message}`);
    }
  }

  async function open(a: A) {
    if (read.has(a.id)) return;
    setRead(new Set([...read, a.id]));
    await fetch(`/api/farmer/${farmerId}/alerts/${a.id}`, { method: "POST" });
    router.refresh();
  }

  if (alerts.length === 0) return <p className="text-sm text-neutral-500">Aucune alerte pour le moment.</p>;
  return (
    <ul className="space-y-3">
      {error && <li className="text-xs text-red-700">{error}</li>}
      {alerts.map((a) => (
        <li key={a.id}>
          <details className={`rounded-xl border bg-white p-4 shadow-sm ${read.has(a.id) ? "border-black/10" : "border-red-600"}`} onToggle={(e) => (e.currentTarget.open ? open(a) : null)}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="rounded-full border px-2 py-0.5">{a.typeLabel}</span>
                <span>{new Date(a.sentAt).toLocaleDateString("fr-FR")}</span>
                {!read.has(a.id) && <span className="font-semibold text-red-700">Nouveau</span>}
              </div>
              <div className="mt-1 font-semibold">{a.title}</div>
            </summary>
            <p className="mt-2 text-sm text-neutral-700">{a.body}</p>
          </details>
          <button onClick={() => listen(a)} disabled={playing !== null} className="mt-1 ml-1 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-800 disabled:opacity-50">
            {playing === a.id ? "Lecture…" : "🔊 Écouter l'alerte"}
          </button>
        </li>
      ))}
    </ul>
  );
}
