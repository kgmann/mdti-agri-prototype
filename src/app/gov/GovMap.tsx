"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ParcelMap, { type ParcelCollection, type ParcelProps } from "@/components/ParcelMap";
import { CROP_GROUPS, LAND_TYPE_LABELS, NO_CROP_COLOR, STATUS_COLORS, STATUS_LABELS, cropColor, fmt, fmt1 } from "@/lib/format";

type Option = { code: string; name: string };
type Props = {
  departments: { id: number; name: string }[];
  communes: { id: number; name: string; departmentId: number }[];
  crops: Option[];
  inputs: Option[];
  cooperatives: { id: number; name: string }[];
  boundaries: { departments: unknown; communes: unknown };
  campaign: string;
};

type Filter = Record<string, string>;
const EMPTY: Filter = {};
const ALERT_TYPES = [
  ["general", "Général"],
  ["weather", "Météo"],
  ["pest_disease", "Ravageurs et maladies"],
  ["subsidy", "Subvention"],
  ["market", "Marché"],
];

export default function GovMap(props: Props) {
  const [filter, setFilter] = useState<Filter>(EMPTY);
  const [data, setData] = useState<ParcelCollection>({ type: "FeatureCollection", features: [] });
  const [loading, setLoading] = useState(true);
  const [colorMode, setColorMode] = useState<"crop" | "status">("crop");
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/gov/parcels?${new URLSearchParams(filter)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => {
          setData(j);
          setLoading(false);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [filter]);

  const set = (k: string, v: string) => setFilter((f) => {
    const next = { ...f, [k]: v };
    if (!v) delete next[k];
    if (k === "department") delete next.commune;
    return next;
  });

  const stats = useMemo(() => {
    const farmers = new Set<number>();
    let area = 0;
    for (const f of data.features) {
      area += Number(f.properties.areaHa);
      if (f.properties.ownerType === "farmer") farmers.add(f.properties.ownerId as number);
    }
    return { parcels: data.features.length, area, farmers: farmers.size };
  }, [data]);

  const colorOf = useCallback(
    (p: ParcelProps) => (colorMode === "crop" ? cropColor(p.crop as string | null) : STATUS_COLORS[(p.status as string) ?? "none"] ?? NO_CROP_COLOR),
    [colorMode],
  );

  const communes = props.communes.filter((c) => !filter.department || c.departmentId === Number(filter.department));
  const select = "w-full rounded border border-black/15 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="flex flex-col lg:h-[calc(100vh-98px)] lg:flex-row">
      <aside className="w-full shrink-0 space-y-3 overflow-y-auto border-r border-black/10 bg-white p-4 lg:w-80">
        <div>
          <h1 className="font-semibold">Exploitations — campagne {props.campaign}</h1>
          <p className="text-xs text-neutral-500">Filtrez la carte, puis envoyez une alerte aux producteurs concernés.</p>
        </div>
        <label className="block text-xs text-neutral-600">Recherche (nom, NPI, IFU)
          <input className={select} value={filter.search ?? ""} onChange={(e) => set("search", e.target.value)} placeholder="ex. Dossou" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-neutral-600">Département
            <select className={select} value={filter.department ?? ""} onChange={(e) => set("department", e.target.value)}>
              <option value="">Tous</option>
              {props.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-neutral-600">Commune
            <select className={select} value={filter.commune ?? ""} onChange={(e) => set("commune", e.target.value)}>
              <option value="">Toutes</option>
              {communes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-neutral-600">Culture en cours
            <select className={select} value={filter.crop ?? ""} onChange={(e) => set("crop", e.target.value)}>
              <option value="">Toutes</option>
              {props.crops.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-neutral-600">Statut
            <select className={select} value={filter.status ?? ""} onChange={(e) => set("status", e.target.value)}>
              <option value="">Tous</option>
              <option value="active">Active (culture en cours)</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-neutral-600">Surface min. (ha)
            <input type="number" min={0} step={0.5} className={select} value={filter.minArea ?? ""} onChange={(e) => set("minArea", e.target.value)} />
          </label>
          <label className="block text-xs text-neutral-600">Surface max. (ha)
            <input type="number" min={0} step={0.5} className={select} value={filter.maxArea ?? ""} onChange={(e) => set("maxArea", e.target.value)} />
          </label>
        </div>
        <label className="block text-xs text-neutral-600">Propriétaire
          <select className={select} value={filter.ownerType ?? ""} onChange={(e) => set("ownerType", e.target.value)}>
            <option value="">Tous</option>
            <option value="farmer">Producteurs</option>
            <option value="cooperative">Coopératives</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-600">Coopérative (et ses membres)
          <select className={select} value={filter.cooperative ?? ""} onChange={(e) => set("cooperative", e.target.value)}>
            <option value="">Toutes</option>
            {props.cooperatives.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-neutral-600">Intrant reçu cette campagne
          <select className={select} value={filter.input ?? ""} onChange={(e) => set("input", e.target.value)}>
            <option value="">Indifférent</option>
            {props.inputs.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <button className="text-xs text-brand-700 underline" onClick={() => setFilter(EMPTY)}>Réinitialiser les filtres</button>

        <div className="rounded-lg bg-brand-50 p-3 text-sm">
          <div><b>{fmt(stats.parcels)}</b> parcelles · <b>{fmt(stats.area)}</b> ha</div>
          <div><b>{fmt(stats.farmers)}</b> producteurs concernés {loading && <span className="text-xs text-neutral-500">(chargement…)</span>}</div>
          <button
            disabled={stats.farmers === 0}
            onClick={() => setAlertOpen(true)}
            className="mt-2 w-full rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40"
          >
            Envoyer une alerte à ces {fmt(stats.farmers)} producteurs
          </button>
        </div>

        <div>
          <div className="mb-1 flex gap-1 text-xs">
            <span className="mr-1 text-neutral-600">Couleur :</span>
            {(["crop", "status"] as const).map((m) => (
              <button key={m} onClick={() => setColorMode(m)} className={`rounded px-2 py-0.5 ${colorMode === m ? "bg-brand-700 text-white" : "bg-neutral-100"}`}>
                {m === "crop" ? "Culture" : "Statut"}
              </button>
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-neutral-700">
            {colorMode === "crop"
              ? [...CROP_GROUPS.map((g) => [g.label, g.color]), ["Aucune culture", NO_CROP_COLOR]].map(([l, c]) => <Legend key={l} label={l} color={c} />)
              : Object.entries(STATUS_LABELS).map(([k, l]) => <Legend key={k} label={l} color={STATUS_COLORS[k]} />).concat(<Legend key="none" label="Aucune culture" color={STATUS_COLORS.none} />)}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">Points à l&apos;échelle du pays ; zoomez pour voir les contours des parcelles.</p>
        </div>
      </aside>
      <div className="h-[70vh] flex-1 lg:h-auto">
        <ParcelMap parcels={data} colorOf={colorOf} popup={(p) => <ParcelPopup p={p} />} boundaries={props.boundaries} />
      </div>
      {alertOpen && <AlertDialog filter={filter} farmers={stats.farmers} onClose={() => setAlertOpen(false)} />}
    </div>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </li>
  );
}

function ParcelPopup({ p }: { p: ParcelProps }) {
  return (
    <div className="min-w-52 text-sm">
      <div className="font-semibold">{p.code as string}</div>
      <div>
        {p.ownerType === "cooperative" ? "Coopérative" : "Producteur"} :{" "}
        <a className="text-brand-700 underline" href={`/gov/actors/${p.ownerId}`}>{p.ownerName as string}</a>
      </div>
      <div>{p.commune as string}, {p.department as string}</div>
      <div>{fmt1(Number(p.areaHa))} ha · {LAND_TYPE_LABELS[p.landType as string]}</div>
      <div>Sol : {p.soilType as string} ({p.soilTexture as string}, pH {p.soilPh as number})</div>
      <div>
        Culture : {(p.cropName as string) ?? "aucune"}
        {p.status ? ` — ${STATUS_LABELS[p.status as string]}` : ""}
      </div>
    </div>
  );
}

function AlertDialog({ filter, farmers, onClose }: { filter: Filter; farmers: number; onClose: () => void }) {
  const [type, setType] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<{ sending?: boolean; done?: number; error?: string }>({});

  async function send() {
    setState({ sending: true });
    const res = await fetch("/api/gov/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, title, body, filter }) });
    const j = await res.json();
    setState(res.ok ? { done: j.recipients } : { error: j.error ?? "Erreur" });
  }

  const input = "w-full rounded border border-black/15 px-2 py-1.5 text-sm";
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Nouvelle alerte</h2>
        {state.done !== undefined ? (
          <>
            <p className="mt-3 text-sm">Alerte envoyée à <b>{fmt(state.done)}</b> producteurs. Elle apparaît dans leur espace.</p>
            <div className="mt-4 text-right">
              <button className="rounded bg-brand-700 px-4 py-2 text-sm text-white" onClick={onClose}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-600">Destinataires : les <b>{fmt(farmers)}</b> producteurs correspondant aux filtres de la carte.</p>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-neutral-600">Type
                <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
                  {ALERT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="block text-xs text-neutral-600">Titre
                <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </label>
              <label className="block text-xs text-neutral-600">Message
                <textarea className={input} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
            </div>
            {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded px-4 py-2 text-sm" onClick={onClose}>Annuler</button>
              <button disabled={state.sending || !title || !body} className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={send}>
                {state.sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
