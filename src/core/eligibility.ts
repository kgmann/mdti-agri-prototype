// Eligibility of a farmer for the current campaign's programmes. Rules are coded here on purpose:
// they are few, readable, and each failed rule gives the farmer a reason.
import { sql } from "./db";

export type Eligibility = { code: string; name: string; kind: string; description: string; eligible: boolean; reasons: string[] };

const SUBSIDY_CROPS = ["maize", "rice", "cotton", "sorghum", "tomato"];

export async function farmerEligibility(farmerId: number, campaignId: number): Promise<Eligibility[]> {
  const [f] = await sql<{
    crops: string[] | null; cultivated_ha: number; recent_defaults: number; subsidized_this_campaign: boolean;
    coop: boolean; shares: boolean; score: number | null;
  }[]>`
    SELECT
      (SELECT array_agg(DISTINCT pr.code) FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id JOIN products pr ON pr.id = cc.product_id
        WHERE p.owner_id = ${farmerId} AND cc.campaign_id = ${campaignId} AND cc.status IN ('planned', 'growing')) AS crops,
      (SELECT coalesce(sum(cc.area_ha), 0) FROM crop_cycles cc JOIN parcels p ON p.id = cc.parcel_id
        WHERE p.owner_id = ${farmerId} AND cc.campaign_id = ${campaignId}) AS cultivated_ha,
      (SELECT count(*)::int FROM input_distributions WHERE recipient_id = ${farmerId} AND repayment_status = 'defaulted'
        AND campaign_id >= ${campaignId - 2}) AS recent_defaults,
      EXISTS (SELECT 1 FROM input_distributions i JOIN products pr ON pr.id = i.product_id
        WHERE i.recipient_id = ${farmerId} AND i.campaign_id = ${campaignId} AND i.subsidized AND pr.category = 'fertilizer') AS subsidized_this_campaign,
      fp.cooperative_id IS NOT NULL AS coop, fp.shares_data_with_partners AS shares,
      (SELECT score FROM credit_scores WHERE farmer_id = ${farmerId}) AS score
    FROM farmer_profiles fp WHERE fp.actor_id = ${farmerId}`;
  const programmes = await sql<{ code: string; name: string; kind: string; description: string }[]>`
    SELECT code, name_fr AS name, kind, description FROM programmes WHERE campaign_id = ${campaignId} ORDER BY id`;

  const crops = f.crops ?? [];
  const score = f.score ?? 0;
  return programmes.map((p) => {
    const reasons: string[] = [];
    if (p.code.startsWith("fertilizer_subsidy")) {
      if (!crops.some((c) => SUBSIDY_CROPS.includes(c))) reasons.push("Aucune culture éligible en cours (maïs, riz, coton, sorgho, tomate)");
      if (f.cultivated_ha > 10) reasons.push("Surface cultivée supérieure à 10 ha");
      if (f.recent_defaults > 0) reasons.push("Crédit intrant impayé sur les deux dernières campagnes");
      if (f.subsidized_this_campaign) reasons.push("Engrais subventionné déjà reçu cette campagne");
    } else if (p.code === "campaign_credit") {
      if (score < 50) reasons.push(`Score agricole de ${score}, minimum 50`);
      if (!f.shares) reasons.push("Données non partagées avec les partenaires financiers");
      if (f.recent_defaults > 0) reasons.push("Crédit intrant impayé sur les deux dernières campagnes");
    } else if (p.code === "input_credit") {
      if (!f.coop) reasons.push("Réservé aux membres d'une coopérative");
      if (score < 35) reasons.push(`Score agricole de ${score}, minimum 35`);
      if (f.recent_defaults > 1) reasons.push("Plusieurs crédits intrants impayés récemment");
    }
    return { ...p, eligible: reasons.length === 0, reasons };
  });
}
