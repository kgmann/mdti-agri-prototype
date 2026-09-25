import { getCampaigns, getCurrentCampaign, getDepartments, getProducts } from "@/core/reference";
import { predictions, productionByDepartment, yieldHistory } from "@/core/stats";
import { Card, Table } from "@/components/ui";
import { fmt, tonnes } from "@/lib/format";
import YieldChart from "./YieldChart";

export default async function YieldsPage({ searchParams }: PageProps<"/gov/yields">) {
  const sp = await searchParams;
  const crop = typeof sp.crop === "string" && sp.crop ? sp.crop : "maize";
  const department = typeof sp.department === "string" && sp.department ? Number(sp.department) : undefined;
  const [crops, departments, current, campaigns] = await Promise.all([getProducts("crop"), getDepartments(), getCurrentCampaign(), getCampaigns()]);
  const last = campaigns[campaigns.length - 2];
  const [history, preds, byDept] = await Promise.all([yieldHistory(crop, department), predictions(crop, department), productionByDepartment(crop, last.id)]);

  // National prediction = area-weighted average of department predictions.
  const area = preds.reduce((s, p) => s + p.predictedAreaHa, 0);
  const wavg = (k: "predictedYieldKgHa" | "lowerKgHa" | "upperKgHa") => (area ? preds.reduce((s, p) => s + p[k] * p.predictedAreaHa, 0) / area : null);
  const pred = wavg("predictedYieldKgHa");
  const data = history
    .filter((h) => h.campaignId !== current.id)
    .map((h) => ({ campaign: h.campaign, yield: h.yieldKgHa === null ? null : Math.round(h.yieldKgHa) }));
  if (pred !== null) data.push({ campaign: current.code, yield: null, predicted: Math.round(pred), err: [Math.round(pred - wavg("lowerKgHa")!), Math.round(wavg("upperKgHa")! - pred)] } as never);

  const cropName = crops.find((c) => c.code === crop)?.nameFr ?? crop;
  const deptName = departments.find((d) => d.id === department)?.name;
  const field = "rounded border border-black/15 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <Card title="Rendements et prévisions">
        <form className="flex flex-wrap items-end gap-2 text-xs text-neutral-600">
          <label>Culture<br />
            <select name="crop" defaultValue={crop} className={field}>{crops.map((c) => <option key={c.code} value={c.code}>{c.nameFr}</option>)}</select>
          </label>
          <label>Département<br />
            <select name="department" defaultValue={department ?? ""} className={field}>
              <option value="">National</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <button className="rounded bg-brand-700 px-4 py-1.5 text-sm text-white">Afficher</button>
        </form>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`${cropName} — ${deptName ?? "national"} : rendement par campagne`} className="lg:col-span-2">
          <YieldChart data={data} />
          <p className="mt-2 text-xs text-neutral-500">
            Ligne bleue : rendement observé (production récoltée / surface). Losange orange : prévision pour la campagne {current.code}, avec sa marge
            d&apos;incertitude. Prévisions calculées périodiquement par une tendance linéaire simple (référence), sur des données synthétiques.
          </p>
        </Card>
        <Card title={`Prévision ${current.code}`}>
          {pred === null ? (
            <p className="text-sm text-neutral-500">Pas assez d&apos;historique pour cette sélection.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="text-3xl font-semibold">{fmt(pred)} <span className="text-base font-normal text-neutral-500">kg/ha</span></div>
              <div className="text-neutral-600">Fourchette : {fmt(wavg("lowerKgHa"))} – {fmt(wavg("upperKgHa"))} kg/ha</div>
              <div className="text-neutral-600">Surface enregistrée cette campagne : {fmt(area)} ha</div>
              <div className="text-neutral-600">Production attendue : <b>{tonnes(pred * area)}</b></div>
            </div>
          )}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Historique (tableau)">
          <Table head={["Campagne", "Surface", "Production", "Rendement", "Cycles"]} rows={history.map((h) => [h.campaign, `${fmt(h.areaHa)} ha`, tonnes(h.productionKg), `${fmt(h.yieldKgHa)} kg/ha`, h.cycles])} />
          <p className="mt-2 text-xs text-neutral-500">La campagne en cours ne compte que les cycles déjà récoltés.</p>
        </Card>
        <Card title={`Production par département — ${last.code}`}>
          <Table head={["Département", "Surface", "Production", "Rendement"]} rows={byDept.map((d) => [d.department, `${fmt(d.areaHa)} ha`, tonnes(d.productionKg), `${fmt(d.yieldKgHa)} kg/ha`])} />
        </Card>
      </div>
      {!department && preds.length > 0 && (
        <Card title={`Prévisions ${current.code} par département — ${cropName}`}>
          <Table head={["Département", "Rendement prévu", "Fourchette", "Surface", "Production attendue"]}
            rows={preds.map((p) => [p.department, `${fmt(p.predictedYieldKgHa)} kg/ha`, `${fmt(p.lowerKgHa)} – ${fmt(p.upperKgHa)}`, `${fmt(p.predictedAreaHa)} ha`, tonnes(p.predictedYieldKgHa * p.predictedAreaHa)])} />
        </Card>
      )}
    </div>
  );
}
