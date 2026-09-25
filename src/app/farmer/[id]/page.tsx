import { getFarmer, getFarmerParcels } from "@/core/farmers";
import { farmerMarkets } from "@/core/markets";
import { searchParcels } from "@/core/parcels";
import { getCurrentCampaign } from "@/core/reference";
import ParcelsMiniMap from "@/components/ParcelsMiniMap";
import { Card } from "@/components/ui";
import { LAND_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS, date, fmt, fmt1, tonnes } from "@/lib/format";
import { getWeather, weatherLabel } from "@/lib/weather";

export default async function FarmPage({ params }: PageProps<"/farmer/[id]">) {
  const id = Number((await params).id);
  const campaign = await getCurrentCampaign();
  const farmer = (await getFarmer(id))!;
  const [parcels, features, weather, markets] = await Promise.all([
    getFarmerParcels(id),
    searchParcels({ owner: id }, campaign.id),
    getWeather(farmer.lat, farmer.lon),
    farmerMarkets(id, campaign.id),
  ]);
  const BUYER: Record<string, string> = { processor: "transformateur", distributor: "grossiste", cooperative: "coopérative" };

  return (
    <>
      <Card title="Météo à la ferme">
        {weather ? (
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{Math.round(weather.current.temperature)} °C</span>
              <span className="text-neutral-600">{weatherLabel(weather.current.code)} · humidité {weather.current.humidity} % · vent {Math.round(weather.current.windSpeed)} km/h</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
              {weather.daily.slice(0, 5).map((d) => (
                <div key={d.date} className="rounded-lg bg-neutral-50 p-2">
                  <div className="font-medium">{new Date(d.date + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })}</div>
                  <div className="text-neutral-600">{weatherLabel(d.code)}</div>
                  <div>{Math.round(d.tMin)}–{Math.round(d.tMax)} °C</div>
                  <div className="text-blue-700">{d.precipitation} mm</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">Source : Open-Meteo (prévisions réelles pour la position de la ferme).</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Météo indisponible pour le moment.</p>
        )}
      </Card>

      {markets.length > 0 && (
        <Card title="Prix et acheteurs">
          <div className="space-y-4">
            {markets.map((m) => {
              const change = m.medianPriceXof && m.previousYearPriceXof ? Math.round((m.medianPriceXof / m.previousYearPriceXof - 1) * 100) : null;
              return (
                <div key={m.crop}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{m.cropName}</span>
                    {m.medianPriceXof ? (
                      <span className="text-sm">
                        <b className="text-lg">{fmt(m.medianPriceXof)}</b> FCFA/kg
                        {change !== null && (
                          <span className={`ml-2 text-xs ${change >= 0 ? "text-brand-700" : "text-red-700"}`}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)} % sur un an</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">Pas de vente récente dans votre département</span>
                    )}
                  </div>
                  {m.medianPriceXof && <div className="text-xs text-neutral-500">Prix médian payé aux producteurs de {farmer.department} sur 6 mois ({m.sales} ventes enregistrées)</div>}
                  {m.buyers.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {m.buyers.map((b) => (
                        <li key={b.id} className="flex justify-between gap-2">
                          <span>{b.name} <span className="text-xs text-neutral-500">({BUYER[b.type]}, {fmt1(b.distanceKm)} km)</span></span>
                          <span className="shrink-0 text-xs text-neutral-600">{fmt(b.lastPriceXof)} FCFA/kg le {date(b.lastDate)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">Calculé à partir des ventes tracées sur la plateforme. Les acheteurs listés sont les plus proches ayant acheté ce produit.</p>
        </Card>
      )}

      <Card title={`Mes parcelles (${parcels.length})`}>
        <ParcelsMiniMap parcels={{ type: "FeatureCollection", features: features as never }} height="280px" />
      </Card>

      {parcels.map((p) => {
        const current = p.cycles.find((c) => c.status === "growing") ?? p.cycles.find((c) => c.status === "planned") ?? null;
        const history = p.cycles.filter((c) => c.status === "harvested" || c.status === "failed").slice(0, 4);
        return (
          <Card key={p.id} title={`Parcelle ${p.code} · ${fmt1(p.areaHa)} ha`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="text-sm">
                <div className="text-xs font-medium text-neutral-500">Terrain et sol</div>
                <div>{LAND_TYPE_LABELS[p.landType]}</div>
                <div>{p.soilType}</div>
                <div>Texture {p.soilTexture} · pH {p.soilPh} · carbone organique {p.soilOrganicCarbonPct} %</div>
              </div>
              <div className="text-sm">
                <div className="text-xs font-medium text-neutral-500">Culture en cours ({campaign.code})</div>
                {current ? (
                  <>
                    <div className="font-medium">
                      {current.cropName}{" "}
                      <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: STATUS_COLORS[current.status] }}>{STATUS_LABELS[current.status]}</span>
                    </div>
                    <div>Semée le {date(current.sowingDate)} sur {fmt1(current.areaHa)} ha</div>
                    <div>Récolte prévue le {date(current.expectedHarvestDate)}</div>
                  </>
                ) : (
                  <div className="text-neutral-500">Aucune culture en cours</div>
                )}
              </div>
            </div>
            {history.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="text-xs font-medium text-neutral-500">Dernières récoltes</div>
                <ul className="mt-1 space-y-0.5">
                  {history.map((c) => (
                    <li key={c.id}>
                      {c.campaign}{c.season === 2 ? " (2e saison)" : ""} · {c.cropName} : {c.status === "failed" ? "échec, " : ""}{tonnes(c.harvestedKg)} sur {fmt1(c.areaHa)} ha
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
