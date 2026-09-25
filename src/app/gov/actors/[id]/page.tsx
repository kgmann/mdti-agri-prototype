import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACTOR_TYPE_LABELS,
  actorFlows,
  actorInputs,
  actorNetwork,
  actorTransfers,
  cooperativeMembers,
  getActor,
  ownerCycles,
  processorBatches,
  traceBatch,
} from "@/core/actors";
import { getFarmerScore } from "@/core/farmers";
import { searchParcels } from "@/core/parcels";
import { getCampaigns, getCurrentCampaign } from "@/core/reference";
import { listBanks } from "@/core/partner";
import { NetworkMap, TraceMap } from "@/components/FlowMap";
import ParcelsMiniMap from "@/components/ParcelsMiniMap";
import { Badge, Card, Stat, Table } from "@/components/ui";
import { BAND_COLORS, STATUS_LABELS, date, fmt, fmt1, tonnes, xof } from "@/lib/format";

const REPAYMENT: Record<string, string> = { none: "Payé comptant", pending: "En cours", repaid: "Remboursé", partial: "Partiel", defaulted: "Impayé" };

export default async function ActorPage({ params, searchParams }: PageProps<"/gov/actors/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await getActor(Number(id));
  if (!actor) notFound();
  const campaign = await getCurrentCampaign();
  const isOwner = actor.type === "farmer" || actor.type === "cooperative";

  const [flows, transfers, parcels, cycles, received, supplied, members, batches, score, banks] = await Promise.all([
    actorFlows(actor.id),
    actorTransfers(actor.id),
    isOwner ? searchParcels(actor.type === "cooperative" ? { cooperative: actor.id } : { owner: actor.id }, campaign.id) : Promise.resolve([]),
    isOwner ? ownerCycles(actor.id) : Promise.resolve([]),
    isOwner ? actorInputs(actor.id, "recipient") : Promise.resolve([]),
    actor.type === "distributor" || actor.type === "cooperative" ? actorInputs(actor.id, "supplier") : Promise.resolve([]),
    actor.type === "cooperative" ? cooperativeMembers(actor.id) : Promise.resolve([]),
    actor.type === "processor" ? processorBatches(actor.id) : Promise.resolve([]),
    actor.type === "farmer" ? getFarmerScore(actor.id) : Promise.resolve(null),
    actor.type === "bank" ? listBanks() : Promise.resolve([]),
  ]);
  const trace = typeof sp.trace === "string" ? await traceBatch(Number(sp.trace)) : null;
  // Supply map on the last completed campaign (the current one is only partly harvested).
  const hasNetwork = actor.type === "processor" || actor.type === "cooperative" || actor.type === "distributor";
  const campaigns = await getCampaigns();
  const networkCampaign = campaigns[campaigns.findIndex((c) => c.isCurrent) - 1];
  const network = hasNetwork ? await actorNetwork(actor.id, networkCampaign.id) : null;
  const policy = banks.find((b) => b.id === actor.id)?.policy;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div>
        <Link href="/gov/actors" className="text-sm text-brand-700">← Registre des acteurs</Link>
        <h1 className="mt-1 text-2xl font-semibold">{actor.name}</h1>
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-neutral-600">
          <Badge>{ACTOR_TYPE_LABELS[actor.type]}</Badge>
          {actor.npi && <span>NPI <span className="font-mono">{actor.npi}</span></span>}
          {actor.ifu && <span>IFU <span className="font-mono">{actor.ifu}</span></span>}
          <span>{actor.commune}, {actor.department}</span>
          <span>Tél. {actor.phone}</span>
          <span>Inscrit le {date(actor.registeredOn)}</span>
          {actor.cooperative && <span>Membre de <Link className="text-brand-700 underline" href={`/gov/actors/${actor.cooperative.id}`}>{actor.cooperative.name}</Link></span>}
        </div>
      </div>

      {score && (
        <Card title="Score agricole">
          <div className="flex flex-wrap gap-3">
            <Stat label="Score" value={<span style={{ color: BAND_COLORS[score.band] }}>{score.score}/100 ({score.band})</span>} />
            <Stat label="Revenu estimé campagne en cours" value={xof(score.estimatedIncomeXof)} />
          </div>
        </Card>
      )}

      {policy && (
        <Card title="Politique de prêt (utilisée pour le plafond indicatif)">
          <p className="text-sm">
            Prête jusqu&apos;à {Math.round(policy.incomeShare * 100)} % du revenu estimé de la campagne, ajusté selon la classe du score
            ({Object.entries(policy.bandMultipliers).map(([b, m]) => `${b} ×${m}`).join(", ")}), plafonné à {xof(policy.maxAmountXof)}, score minimum {policy.minScore}.
          </p>
        </Card>
      )}

      {isOwner && parcels.length > 0 && (
        <Card title={actor.type === "cooperative" ? `Parcelles de la coopérative et de ses membres (${parcels.length})` : `Parcelles (${parcels.length})`}>
          <ParcelsMiniMap parcels={{ type: "FeatureCollection", features: parcels as never }} />
        </Card>
      )}

      {network && (network.suppliers.length > 0 || network.buyers.length > 0) && (
        <Card title={`Carte d'approvisionnement — campagne ${networkCampaign.code}`}>
          <p className="mb-2 text-sm text-neutral-600">
            {network.suppliers.length} fournisseurs, {network.buyers.length} acheteurs. Chaque ligne relie deux acteurs qui ont échangé des produits, d&apos;après les ventes enregistrées.
          </p>
          <NetworkMap network={network} name={actor.name} />
        </Card>
      )}

      {members.length > 0 && (
        <Card title={`Membres (${members.length})`}>
          <Table
            head={["Nom", "Commune", "Surface", "Score"]}
            rows={members.map((m) => [<Link key="n" className="text-brand-700 hover:underline" href={`/gov/actors/${m.id}`}>{m.name}</Link>, m.commune, `${fmt1(m.areaHa)} ha`, m.score ?? "–"])}
          />
        </Card>
      )}

      {cycles.length > 0 && (
        <Card title="Historique des cultures">
          <Table
            head={["Campagne", "Parcelle", "Culture", "Saison", "Semis", "Surface", "Récolte", "Statut"]}
            rows={cycles.slice(0, 40).map((c) => [c.campaign, c.parcel, c.crop, c.season, date(c.sowingDate), `${fmt1(c.areaHa)} ha`, c.harvestedKg === null ? "–" : tonnes(c.harvestedKg), STATUS_LABELS[c.status]])}
          />
        </Card>
      )}

      {flows.length > 0 && (
        <Card title="Flux par campagne (achats et ventes)">
          <Table
            head={["Campagne", "Sens", "Produit", "Contreparties", "Quantité", "Valeur"]}
            rows={flows.map((f) => [f.campaign, f.direction === "in" ? "Achat" : "Vente", f.product, f.counterparties, tonnes(f.quantityKg), xof(f.valueXof)])}
          />
        </Card>
      )}

      {batches.length > 0 && (
        <Card title="Lots de transformation">
          {trace && (
            <div className="mb-4 rounded-lg border border-brand-600/30 bg-brand-50 p-3 text-sm">
              <div className="font-semibold">
                Traçabilité du lot #{trace.batch.id} : {tonnes(trace.batch.outputKg)} de {trace.batch.outputProduct.toLowerCase()} ({date(trace.batch.date)})
              </div>
              <div className="my-3"><TraceMap trace={trace} /></div>
              <p className="mt-1">Matière première : {tonnes(trace.batch.inputKg)} de {trace.batch.inputProduct.toLowerCase()}, fournie par :</p>
              <ul className="mt-1 list-disc pl-5">
                {trace.suppliers.map((s, i) => (
                  <li key={i}>
                    <Link className="text-brand-700 underline" href={`/gov/actors/${s.id}`}>{s.name}</Link> ({ACTOR_TYPE_LABELS[s.type].toLowerCase()}, {s.commune}) — {tonnes(s.quantityKg)} le {date(s.date)}
                  </li>
                ))}
              </ul>
              {trace.viaCooperatives.map((c) => (
                <div key={c.cooperativeId} className="mt-2">
                  Via {c.cooperativeName} : {c.farmers.length} producteurs ({c.farmers.slice(0, 8).map((f) => f.name).join(", ")}{c.farmers.length > 8 ? "…" : ""})
                </div>
              ))}
            </div>
          )}
          <Table
            head={["Date", "Campagne", "Entrée", "Sortie", "Rendement", "Fournisseurs", ""]}
            rows={batches.map((b) => [
              date(b.date), b.campaign, `${tonnes(b.inputKg)} ${b.inputProduct.toLowerCase()}`, `${tonnes(b.outputKg)} ${b.outputProduct.toLowerCase()}`,
              `${Math.round((b.outputKg / b.inputKg) * 100)} %`, b.suppliers,
              <Link key="t" className="text-brand-700 underline" href={`?trace=${b.id}`}>Tracer</Link>,
            ])}
          />
        </Card>
      )}

      {transfers.length > 0 && (
        <Card title="Dernières transactions">
          <Table
            head={["Date", "Sens", "Contrepartie", "Produit", "Quantité", "Prix unitaire"]}
            rows={transfers.map((t) => [
              date(t.date), t.direction === "in" ? "Achat" : "Vente",
              <Link key="c" className="text-brand-700 hover:underline" href={`/gov/actors/${t.counterpartyId}`}>{t.counterpartyName}</Link>,
              t.product, tonnes(t.quantityKg), `${fmt(t.unitPriceXof)} FCFA/kg`,
            ])}
          />
        </Card>
      )}

      {received.length > 0 && (
        <Card title="Intrants reçus">
          <Table
            head={["Date", "Campagne", "Intrant", "Fournisseur", "Quantité", "Valeur", "Subventionné", "Crédit", "Remboursement"]}
            rows={received.map((i) => [date(i.date), i.campaign, i.product, i.counterpartyName ?? "–", `${fmt(i.quantityKg)} kg`, xof(i.valueXof), i.subsidized ? "Oui" : "Non", i.creditXof ? xof(i.creditXof) : "–", REPAYMENT[i.repaymentStatus]])}
          />
        </Card>
      )}

      {supplied.length > 0 && (
        <Card title="Intrants fournis (derniers)">
          <Table
            head={["Date", "Campagne", "Intrant", "Bénéficiaire", "Quantité", "Valeur", "Subventionné"]}
            rows={supplied.map((i) => [date(i.date), i.campaign, i.product, i.counterpartyId ? <Link key="b" className="text-brand-700 hover:underline" href={`/gov/actors/${i.counterpartyId}`}>{i.counterpartyName}</Link> : "–", `${fmt(i.quantityKg)} kg`, xof(i.valueXof), i.subsidized ? "Oui" : "Non"])}
          />
        </Card>
      )}
    </div>
  );
}
