"use client";
// Farmer assistant: text, crop photo, voice in/out, in French or Fon.
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

type Msg = { role: "user" | "model"; text: string; image?: { mimeType: string; data: string }; preview?: string; voice?: boolean };
type Lang = "fr" | "fon";

const GREETING: Record<Lang, (n: string) => string> = {
  fr: (n) => `Bonjour ${n} ! Je suis votre assistant agricole. Posez-moi une question sur vos cultures, envoyez une photo d'une plante malade, ou parlez-moi avec le micro.`,
  fon: (n) => `Bonjour ${n} ! Je vous réponds en fon (fongbe). Écrivez ou parlez en fon ou en français. Les réponses en fon sont expérimentales : elles n'ont pas été validées par des locuteurs natifs.`,
};
const SUGGESTIONS: Record<Lang, string[]> = {
  fr: ["Quand dois-je mettre l'engrais sur mon maïs ?", "Il va beaucoup pleuvoir, que faire ?", "Comment protéger ma récolte stockée ?"],
  fon: ["Quand dois-je mettre l'engrais sur mon maïs ?", "Comment reconnaître la chenille légionnaire ?"],
};

// Recorded audio (any browser format) → 16 kHz mono WAV, a format Gemini accepts.
async function toWavBase64(blob: Blob): Promise<string> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  let bin = "";
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  await ctx.close();
  return btoa(bin);
}

export default function Chat({ farmerId, firstName, defaultLanguage }: { farmerId: number; firstName: string; defaultLanguage: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLanguage);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<Msg["image"] & { preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Block body on purpose: an effect must return nothing or a cleanup function (Chrome's scrollIntoView returns a Promise).
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const history = () => messages.map(({ role, text }) => ({ role, text }));

  async function send(content: string) {
    if (!content.trim() && !image) return;
    const msg: Msg = { role: "user", text: content.trim(), image: image ? { mimeType: image.mimeType, data: image.data } : undefined, preview: image?.preview };
    const next = [...messages, msg];
    setMessages(next);
    setText("");
    setImage(null);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/farmer/${farmerId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang, messages: [...history(), { role: "user", text: msg.text, image: msg.image }] }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Erreur");
    setMessages([...next, { role: "model", text: j.answer }]);
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        try {
          const data = await toWavBase64(new Blob(chunks, { type: rec.mimeType }));
          const res = await fetch(`/api/farmer/${farmerId}/voice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language: lang, history: history(), audio: { mimeType: "audio/wav", data } }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error);
          const next: Msg[] = [...messages, { role: "user", text: j.transcript, voice: true }, { role: "model", text: j.answer }];
          setMessages(next);
          speak(next.length - 1, j.answer);
        } catch (e) {
          setError((e as Error).message || "Erreur audio");
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Micro indisponible (autorisez l'accès au micro dans le navigateur).");
    }
  }

  async function speak(i: number, content: string) {
    setSpeaking(i);
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: content }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audio.onended = () => setSpeaking(null);
      await audio.play();
    } catch (e) {
      setSpeaking(null);
      setError(`Lecture audio impossible : ${(e as Error).message}`);
    }
  }

  // Loads a sample photo of a damaged maize leaf, for demos without a real plant at hand.
  async function loadSamplePhoto() {
    const blob = await (await fetch("/images/sample-maize-leaf.jpg")).blob();
    onFile(new File([blob], "feuille-mais.jpg", { type: "image/jpeg" }));
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImage({ mimeType: file.type || "image/jpeg", data: url.split(",")[1], preview: url });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-[calc(100vh-230px)] min-h-[480px] flex-col rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2 text-sm">
        <span className="font-medium">Assistant agricole</span>
        <div className="flex gap-1">
          {(["fr", "fon"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded px-2 py-0.5 text-xs ${lang === l ? "bg-brand-700 text-white" : "bg-neutral-100"}`}>
              {l === "fr" ? "Français" : "Fon (expérimental)"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-brand-50 px-3 py-2 text-sm">{GREETING[lang](firstName)}</div>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={loadSamplePhoto} className="rounded-full border border-amber-500/60 bg-amber-50 px-3 py-1 text-xs text-amber-900">📷 Essayer avec une photo exemple (feuille de maïs)</button>
            {SUGGESTIONS[lang].map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-brand-600/40 px-3 py-1 text-xs text-brand-800">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "rounded-tr-sm bg-brand-700 text-white" : "rounded-tl-sm bg-brand-50"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              {m.preview && <img src={m.preview} alt="Photo envoyée" className="mb-2 max-h-48 rounded-lg" />}
              {m.voice && <span className="mr-1">🎤</span>}
              {m.role === "model" ? (
                <div className="whitespace-normal [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_ul]:list-disc [&_ul]:my-1">
                  <Markdown>{m.text}</Markdown>
                </div>
              ) : (
                m.text
              )}
              {m.role === "model" && (
                <button onClick={() => speak(i, m.text)} disabled={speaking !== null} className="mt-1 block text-xs text-brand-700 underline disabled:opacity-50">
                  {speaking === i ? "Lecture…" : "🔊 Écouter"}
                </button>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-neutral-500">L&apos;assistant réfléchit…</div>}
        {error && <div className="text-xs text-red-700">{error}</div>}
        <div ref={bottom} />
      </div>

      {image && (
        <div className="flex items-center gap-2 border-t border-black/10 px-4 py-2 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={image.preview} alt="" className="h-12 rounded" />
          <span>Photo jointe</span>
          <button onClick={() => setImage(null)} className="text-red-700 underline">Retirer</button>
        </div>
      )}
      <form
        className="flex items-center gap-2 border-t border-black/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label className="cursor-pointer rounded-full bg-neutral-100 px-3 py-2 text-sm" title="Joindre une photo de plante">
          📷
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={toggleRecording} disabled={busy && !recording} className={`rounded-full px-3 py-2 text-sm ${recording ? "animate-pulse bg-red-600 text-white" : "bg-neutral-100"}`} title="Parler">
          {recording ? "■" : "🎤"}
        </button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={recording ? "Enregistrement… appuyez sur ■ pour envoyer" : "Écrivez votre question…"} className="flex-1 rounded-full border border-black/15 px-4 py-2 text-sm" />
        <button disabled={busy || (!text.trim() && !image)} className="rounded-full bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-40">Envoyer</button>
      </form>
    </div>
  );
}
