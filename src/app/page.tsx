import Link from "next/link";
import { getCurrentCampaign } from "@/core/reference";
import { overview } from "@/core/stats";
import { fmt } from "@/lib/format";

const PORTALS = [
  {
    href: "/farmer",
    title: "Producteur",
    text: "Sa ferme sur la carte, le sol, la culture en cours et la météo, les alertes du ministère, un assistant IA en français et en fon (texte, voix, photo), son score et son éligibilité aux programmes.",
  },
  {
    href: "/gov",
    title: "Gouvernement",
    text: "Carte des exploitations avec filtres, registre des acteurs, traçabilité des flux, rendements et prévisions, alertes ciblées et assistant de données en langage naturel.",
  },
  {
    href: "/bank",
    title: "Banque partenaire",
    text: "Producteurs classés par score avec les preuves derrière le score, et un plafond de prêt indicatif calculé selon la politique de la banque. Construit sur l'API partenaire.",
  },
];

export default async function Home() {
  const campaign = await getCurrentCampaign();
  const o = await overview(campaign.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Agri-Digit Bénin</h1>
      <p className="mt-3 max-w-3xl text-neutral-700">
        Prototype de la plateforme numérique multi-filières d&apos;assistance et de conseil agricole. Un socle de données commun
        (registres des acteurs et des parcelles, cultures par campagne, flux entre acteurs) sert trois publics : les producteurs,
        l&apos;administration et les partenaires financiers.
      </p>
      <div className="mt-6 flex flex-wrap gap-6 text-sm text-neutral-600">
        <span><b className="text-neutral-900">{fmt(o.farmers)}</b> producteurs</span>
        <span><b className="text-neutral-900">{fmt(o.parcels)}</b> parcelles ({fmt(o.areaHa)} ha)</span>
        <span><b className="text-neutral-900">{fmt(o.cooperatives)}</b> coopératives</span>
        <span><b className="text-neutral-900">{fmt(o.processors)}</b> transformateurs</span>
        <span>Campagne en cours : <b className="text-neutral-900">{campaign.code}</b></span>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PORTALS.map((p) => (
          <Link key={p.href} href={p.href} className="group rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-brand-600 hover:shadow">
            <h2 className="text-lg font-semibold text-brand-800 group-hover:text-brand-600">{p.title} →</h2>
            <p className="mt-2 text-sm text-neutral-600">{p.text}</p>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-xs text-neutral-500">
        Toutes les personnes, exploitations et transactions sont fictives. Les identifiants (NPI, IFU) sont dans des plages volontairement fictives.
      </p>
    </div>
  );
}
