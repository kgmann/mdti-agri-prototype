import { farmerEligibility } from "@/core/eligibility";
import { getFarmer, getFarmerScore } from "@/core/farmers";
import { getCurrentCampaign } from "@/core/reference";
import { Card } from "@/components/ui";
import { BAND_COLORS, xof } from "@/lib/format";

export default async function CreditPage({ params }: PageProps<"/farmer/[id]/credit">) {
  const id = Number((await params).id);
  const campaign = await getCurrentCampaign();
  const [farmer, score, eligibility] = await Promise.all([getFarmer(id), getFarmerScore(id), farmerEligibility(id, campaign.id)]);
  return (
    <>
      {score && (
        <Card title="Mon score agricole">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4" style={{ borderColor: BAND_COLORS[score.band] }}>
              <span className="text-2xl font-semibold">{score.score}</span>
              <span className="text-xs text-neutral-500">/100</span>
            </div>
            <div className="text-sm">
              <div>Classe <b style={{ color: BAND_COLORS[score.band] }}>{score.band}</b></div>
              <div>Revenu estimé de la campagne {campaign.code} : <b>{xof(score.estimatedIncomeXof)}</b></div>
              <div className="text-xs text-neutral-500">Calculé à partir de vos récoltes, ventes et remboursements enregistrés.</div>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {score.factors.map((f) => (
              <li key={f.key} className="text-sm">
                <div className="flex justify-between"><span>{f.label}</span><span className="font-medium">{f.points} / {f.max}</span></div>
                <div className="h-2 rounded-full bg-neutral-100">
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(f.points / f.max) * 100}%` }} />
                </div>
                <div className="text-xs text-neutral-500">{f.detail}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={`Programmes de la campagne ${campaign.code}`}>
        <ul className="space-y-3">
          {eligibility.map((e) => (
            <li key={e.code} className="rounded-lg border border-black/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{e.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs text-white ${e.eligible ? "bg-brand-600" : "bg-neutral-500"}`}>{e.eligible ? "✓ Éligible" : "Non éligible"}</span>
              </div>
              <p className="text-xs text-neutral-600">{e.description}</p>
              {e.reasons.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-neutral-700">{e.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Partage de mes données">
        <p className="text-sm">
          {farmer?.sharesData
            ? "Vous avez accepté que les banques et institutions financières partenaires consultent votre profil agricole et votre score pour vous proposer un crédit."
            : "Vous n'avez pas accepté le partage de vos données avec les partenaires financiers : les banques ne voient pas votre profil."}
        </p>
      </Card>
    </>
  );
}
