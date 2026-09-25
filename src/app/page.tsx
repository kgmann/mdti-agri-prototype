import Link from "next/link";
import { getCurrentCampaign } from "@/core/reference";
import { overview } from "@/core/stats";
import { fmt } from "@/lib/format";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const PORTALS = [
  {
    href: "/farmer",
    title: "Producteur",
    icon: icon("M12 21c-4-3-7-6.5-7-10.5a7 7 0 0 1 14 0c0 4-3 7.5-7 10.5z M12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"),
    text: "Sa ferme sur la carte, le sol, la culture en cours et la météo, les alertes du ministère, un assistant IA en français et en fon (texte, voix, photo), son score et son éligibilité aux programmes.",
  },
  {
    href: "/gov",
    title: "Gouvernement",
    icon: icon("M3 21h18 M5 21V10l7-5 7 5v11 M9 21v-6h6v6"),
    text: "Carte des exploitations avec filtres, registre des acteurs, traçabilité des flux, rendements et prévisions, alertes ciblées et assistant de données en langage naturel.",
  },
  {
    href: "/bank",
    title: "Banque partenaire",
    icon: icon("M3 10h18 M5 10v8 M9 10v8 M15 10v8 M19 10v8 M3 21h18 M12 3l9 5H3z"),
    text: "Producteurs classés par score avec les preuves derrière le score, et un plafond de prêt indicatif calculé selon la politique de la banque. Construit sur l'API partenaire.",
  },
];

export default async function Home() {
  const campaign = await getCurrentCampaign();
  const o = await overview(campaign.id);
  const stats = [
    [fmt(o.farmers), "producteurs"],
    [fmt(o.parcels), "parcelles"],
    [`${fmt(o.areaHa)} ha`, "cartographiés"],
    [fmt(o.cooperatives), "coopératives"],
    [fmt(o.processors), "transformateurs"],
    [campaign.code, "campagne en cours"],
  ];
  return (
    <div>
      <section className="relative overflow-hidden bg-brand-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- static hero, no optimisation needed */}
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-800/95 via-brand-800/75 to-brand-800/10" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-wider text-amber-300">Prototype · Agriculture numérique et IA</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">Agri-Digit Bénin</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Un socle de données commun — registres des acteurs et des parcelles, cultures par campagne, flux entre acteurs — au service des producteurs,
            de l&apos;administration et des partenaires financiers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/gov" className="rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-amber-200">Ouvrir le tableau de bord</Link>
            <Link href="/farmer" className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10">Voir l&apos;espace producteur</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4">
        <div className="relative -mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(([v, l]) => (
            <div key={l} className="bg-white px-4 py-3">
              <div className="text-xl font-semibold text-brand-800">{v}</div>
              <div className="text-xs text-neutral-500">{l}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PORTALS.map((p) => (
            <Link key={p.href} href={p.href} className="group rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white">{p.icon}</span>
              <h2 className="mt-3 text-lg font-semibold text-brand-800">{p.title} →</h2>
              <p className="mt-2 text-sm text-neutral-600">{p.text}</p>
            </Link>
          ))}
        </div>
        <p className="mb-10 mt-8 text-xs text-neutral-500">
          Toutes les personnes, exploitations et transactions sont fictives. Les identifiants (NPI, IFU) sont dans des plages volontairement fictives.
        </p>
      </div>
    </div>
  );
}
