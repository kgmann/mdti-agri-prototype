import { cooperativesList } from "@/core/actors";
import { getBoundaries, getCommunes, getCurrentCampaign, getDepartments, getProducts } from "@/core/reference";
import GovMap from "./GovMap";

export default async function GovMapPage() {
  const [departments, communes, crops, inputs, coops, boundaries, campaign] = await Promise.all([
    getDepartments(),
    getCommunes(),
    getProducts("crop"),
    getProducts("input"),
    cooperativesList(),
    getBoundaries(),
    getCurrentCampaign(),
  ]);
  return (
    <GovMap
      departments={departments}
      communes={communes}
      crops={crops.map((c) => ({ code: c.code, name: c.nameFr }))}
      inputs={inputs.map((c) => ({ code: c.code, name: c.nameFr }))}
      cooperatives={coops}
      boundaries={boundaries}
      campaign={campaign.code}
    />
  );
}
