import { getCampaigns } from "@/core/reference";
import { indicatorsByDepartment, indicatorTotals, productionByCrop, scoreBands } from "@/core/stats";
import { Card, Stat, Table } from "@/components/ui";
import { BAND_COLORS, fmt, tonnes, xof } from "@/lib/format";

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${Math.round(n)} %`);

export default async function IndicatorsPage() {
  const campaigns = await getCampaigns();
  const current = campaigns.find((c) => c.isCurrent)!;
  const last = campaigns[campaigns.indexOf(current) - 1];
  const [totals, byDept, bands, crops] = await Promise.all([indicatorTotals(current.id), indicatorsByDepartment(current.id), scoreBands(), productionByCrop(last.id)]);
  const maxBand = Math.max(...bands.map((b) => b.farmers));
  const maxValue = Math.max(...crops.map((c) => c.valueXof));

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">Indicateurs de suivi</h1>
        <p className="text-sm text-neutral-600">Couverture, inclusion, accès aux intrants et au crédit. Campagne en cours : {current.code}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Producteurs enregistrés" value={fmt(totals.farmers)} />
        <Stat label="Femmes" value={pct(totals.womenPct)} />
        <Stat label="Jeunes (< 35 ans)" value={pct(totals.youthPct)} />
        <Stat label="Membres de coopérative" value={pct(totals.coopPct)} />
        <Stat label="Surface cartographiée" value={`${fmt(totals.areaHa)} ha`} />
        <Stat label="Parcelles actives" value={pct(totals.activePct)} />
        <Stat label="Partage de données consenti" value={pct(totals.sharingPct)} />
        <Stat label={`Accès aux intrants (${current.code})`} value={pct(totals.inputAccessPct)} />
        <Stat label={`Intrants subventionnés (${current.code})`} value={xof(totals.subsidyValueXof)} />
        <Stat label="Taux de remboursement (crédits intrants passés)" value={pct(totals.repaymentPct)} />
        <Stat label="Crédits intrants impayés" value={fmt(totals.defaults)} />
        <Stat label="Score agricole moyen" value={`${Math.round(totals.avgScore)}/100`} />
        <Stat label="Alertes envoyées" value={fmt(totals.alerts)} />
        <Stat label="Alertes lues" value={pct(totals.alertReadPct)} />
      </div>

      <Card title="Par département">
        <Table
          head={["Département", "Producteurs", "Femmes", "Jeunes", "Surface", "Accès intrants", "Subventionnés", "Remboursement", "Coopérative", "Score moyen"]}
          rows={byDept.map((d) => [d.department, fmt(d.farmers), pct(d.womenPct), pct(d.youthPct), `${fmt(d.areaHa)} ha`, pct(d.inputAccessPct), pct(d.subsidizedPct), pct(d.repaymentPct), pct(d.coopPct), Math.round(d.avgScore)])}
        />
        <p className="mt-2 text-xs text-neutral-500">Accès intrants et subventions : part des producteurs ayant reçu des intrants cette campagne. Remboursement : sur les campagnes terminées.</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Répartition des scores agricoles">
          <ul className="space-y-2 text-sm">
            {bands.map((b) => (
              <li key={b.band} className="flex items-center gap-2">
                <span className="w-16">Classe {b.band}</span>
                <span className="h-4 rounded-r" style={{ width: `${(b.farmers / maxBand) * 70}%`, background: BAND_COLORS[b.band] }} />
                <span className="text-neutral-700">{fmt(b.farmers)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Production par culture — campagne ${last.code}`}>
          <ul className="space-y-1.5 text-sm">
            {crops.map((c) => (
              <li key={c.crop} className="grid grid-cols-[8rem_1fr_7rem] items-center gap-2">
                <span className="truncate">{c.crop}</span>
                <span className="h-3 rounded-r bg-brand-600" style={{ width: `${(c.valueXof / maxValue) * 100}%` }} />
                <span className="text-right text-xs text-neutral-600">{tonnes(c.productionKg)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">Barres : valeur de la production au prix de référence. À droite : quantité récoltée.</p>
        </Card>
      </div>
    </div>
  );
}
