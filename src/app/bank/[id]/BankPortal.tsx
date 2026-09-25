"use client";
// The bank portal is a plain client of the partner API (/api/partner/v1), like a bank's own system would be.
import { useEffect, useState } from "react";
import type { Bank, Offer, PartnerFarmerProfile } from "@/core/partner";
import { BAND_COLORS, fmt, fmt1, tonnes, xof } from "@/lib/format";

type Props = { bank: Bank; departments: string[]; crops: { code: string; name: string }[] };

export default function BankPortal({ bank, departments, crops }: Props) {
  const [filter, setFilter] = useState({ department: "", crop: "", min_score: "", limit: "100" });
  const [result, setResult] = useState<{ query: string; offers: Offer[] }>({ query: "", offers: [] });
  const [selected, setSelected] = useState<Offer | null>(null);
  const [profile, setProfile] = useState<PartnerFarmerProfile | null>(null);
  const [tab, setTab] = useState<"farmers" | "api">("farmers");

  const query = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString();

  useEffect(() => {
    fetch(`/api/partner/v1/banks/${bank.id}/offers?${query}`)
      .then((r) => r.json())
      .then((j) => setResult({ query, offers: j.offers }));
  }, [bank.id, query]);
  const offers = result.offers;
  const loading = result.query !== query;

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/partner/v1/farmers/${selected.npi}`).then((r) => r.json()).then(setProfile);
  }, [selected]);

  const total = offers.reduce((s, o) => s + o.ceilingXof, 0);
  const field = "rounded border border-black/15 bg-white px-2 py-1.5 text-sm";
  const p = bank.policy;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{bank.name}</h1>
          <p className="text-sm text-neutral-600">
            Politique de prêt : {Math.round(p.incomeShare * 100)} % du revenu estimé de la campagne × coefficient de classe (
            {Object.entries(p.bandMultipliers).map(([b, m]) => `${b} ${m}`).join(" · ")}), plafond {xof(p.maxAmountXof)}, score minimum {p.minScore}.
          </p>
        </div>
        <div className="flex gap-1 text-sm">
          {(["farmers", "api"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1.5 ${tab === t ? "bg-brand-700 text-white" : "bg-white"}`}>
              {t === "farmers" ? "Producteurs" : "API"}
            </button>
          ))}
        </div>
      </div>

      {tab === "api" ? (
        <ApiTab bankId={bank.id} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-black/10 bg-white p-3 text-xs text-neutral-600">
            <label>Département<br />
              <select className={field} value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })}>
                <option value="">Tous</option>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label>Culture<br />
              <select className={field} value={filter.crop} onChange={(e) => setFilter({ ...filter, crop: e.target.value })}>
                <option value="">Toutes</option>
                {crops.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label>Score minimum<br />
              <input type="number" className={`${field} w-24`} value={filter.min_score} onChange={(e) => setFilter({ ...filter, min_score: e.target.value })} />
            </label>
            <div className="ml-auto text-sm text-neutral-700">
              {loading ? "Chargement…" : <><b>{fmt(offers.length)}</b> producteurs éligibles · encours potentiel <b>{xof(total)}</b></>}
            </div>
          </div>
          <p className="text-xs text-neutral-500">Seuls les producteurs ayant accepté de partager leurs données avec les partenaires apparaissent.</p>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm lg:col-span-3">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/10 text-xs text-neutral-500">
                  <tr>{["#", "Producteur", "Département", "Cultures", "Surface", "Score", "Revenu estimé", "Plafond indicatif"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {offers.map((o, i) => (
                    <tr key={o.npi} onClick={() => setSelected(o)} className={`cursor-pointer border-b border-black/5 hover:bg-brand-50 ${selected?.npi === o.npi ? "bg-brand-50" : ""}`}>
                      <td className="px-2 py-1.5 text-neutral-500">{i + 1}</td>
                      <td className="px-2 py-1.5">{o.name}</td>
                      <td className="px-2 py-1.5">{o.department}</td>
                      <td className="px-2 py-1.5 text-xs">{o.mainCrops.slice(0, 2).join(", ")}</td>
                      <td className="px-2 py-1.5">{fmt1(o.cultivatedHa)} ha</td>
                      <td className="px-2 py-1.5 font-medium" style={{ color: BAND_COLORS[o.band] }}>{o.score} ({o.band})</td>
                      <td className="px-2 py-1.5">{xof(o.estimatedIncomeXof)}</td>
                      <td className="px-2 py-1.5 font-semibold">{o.ceilingXof ? xof(o.ceilingXof) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lg:col-span-2">
              {selected ? <FarmerPanel offer={selected} profile={profile?.npi === selected.npi ? profile : null} /> : <div className="rounded-xl border border-dashed border-black/20 p-6 text-sm text-neutral-500">Sélectionnez un producteur pour voir son dossier.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FarmerPanel({ offer, profile }: { offer: Offer; profile: PartnerFarmerProfile | null }) {
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4 text-sm shadow-sm lg:sticky lg:top-4">
      <div>
        <div className="text-lg font-semibold">{offer.name}</div>
        <div className="text-neutral-600">NPI {offer.npi} · {offer.commune}, {offer.department}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-neutral-50 p-2"><div className="text-xs text-neutral-500">Score</div><div className="text-lg font-semibold" style={{ color: BAND_COLORS[offer.band] }}>{offer.score}/100 ({offer.band})</div></div>
        <div className="rounded-lg bg-neutral-50 p-2"><div className="text-xs text-neutral-500">Plafond indicatif</div><div className="text-lg font-semibold">{xof(offer.ceilingXof)}</div></div>
      </div>
      {!profile ? (
        <p className="text-neutral-500">Chargement du dossier…</p>
      ) : (
        <>
          <div className="text-neutral-700">
            {profile.gender === "F" ? "Productrice" : "Producteur"} né(e) en {profile.birthYear}, inscrit(e) depuis le {new Date(profile.registeredOn).toLocaleDateString("fr-FR")}
            {profile.cooperative ? `, membre de ${profile.cooperative}` : ", sans coopérative"}.
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-neutral-500">Facteurs du score</div>
            <ul className="space-y-1">
              {profile.factors.map((f) => (
                <li key={f.key}>
                  <div className="flex justify-between"><span>{f.label}</span><span>{f.points}/{f.max}</span></div>
                  <div className="text-xs text-neutral-500">{f.detail}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-neutral-500">Parcelles</div>
            {profile.parcels.map((p) => <div key={p.code}>{p.code} · {fmt1(p.areaHa)} ha · {p.soilType}</div>)}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-neutral-500">Production récoltée</div>
            {profile.production.slice(0, 8).map((x, i) => <div key={i}>{x.campaign} · {x.crop} : {tonnes(x.harvestedKg)} sur {fmt1(x.areaHa)} ha{x.failed ? ` (${x.failed} échec)` : ""}</div>)}
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-neutral-500">Crédits intrants</div>
            {profile.credit.length === 0 ? <div className="text-neutral-500">Aucun</div> : profile.credit.map((c) => <div key={c.campaign}>{c.campaign} : {xof(c.repaidXof)} remboursés sur {xof(c.creditXof)}{c.defaults ? ` · ${c.defaults} impayé(s)` : ""}</div>)}
          </div>
        </>
      )}
      <p className="text-xs text-neutral-500">Le plafond applique la politique de la banque aux données de la plateforme. La décision de prêt reste celle de la banque.</p>
    </div>
  );
}

function ApiTab({ bankId }: { bankId: number }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const calls = [
    ["Producteurs classés par score", `/api/partner/v1/farmers?department=Zou&min_score=60&limit=20`],
    ["Dossier d'un producteur (par NPI)", `/api/partner/v1/farmers/{npi}`],
    ["Parcelles d'un producteur (GeoJSON)", `/api/partner/v1/farmers/{npi}/parcels`],
    ["Offres de cette banque (plafonds)", `/api/partner/v1/banks/${bankId}/offers?limit=20`],
  ];
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4 text-sm shadow-sm">
      <p>
        Cet espace utilise l&apos;API partenaire de la plateforme. Une banque peut l&apos;intégrer directement à son propre système. Toutes les réponses sont en JSON,
        en lecture seule, et ne concernent que les producteurs ayant consenti au partage.
      </p>
      {calls.map(([label, path]) => (
        <div key={path}>
          <div className="font-medium">{label}</div>
          <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-xs text-neutral-100">{`curl -u "$LOGIN:$MOT_DE_PASSE" "${origin}${path}"`}</pre>
          {!path.includes("{") && <a className="text-xs text-brand-700 underline" href={path} target="_blank">Ouvrir la réponse</a>}
        </div>
      ))}
    </div>
  );
}
