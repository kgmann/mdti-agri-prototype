// Display helpers (French formatting) and shared labels/colours.

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : nf.format(n));
export const fmt1 = (n: number | null | undefined) => (n === null || n === undefined ? "–" : nf1.format(n));
export const xof = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${nf.format(n)} FCFA`);
export const tonnes = (kg: number | null | undefined) => (kg === null || kg === undefined ? "–" : `${nf1.format(kg / 1000)} t`);
export const date = (s: string | null | undefined) =>
  s ? new Date(s.length === 10 ? s + "T00:00:00Z" : s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";

export const STATUS_LABELS: Record<string, string> = {
  planned: "Planifiée",
  growing: "En cours",
  harvested: "Récoltée",
  failed: "Échec",
};

export const LAND_TYPE_LABELS: Record<string, string> = {
  rainfed_upland: "Plateau (pluvial)",
  rainfed_lowland: "Bas-fond (pluvial)",
  irrigated: "Irrigué",
};

// Crops are grouped into 8 categories for map colours (a categorical palette stays readable up to 8 hues).
export const CROP_GROUPS: { key: string; label: string; color: string; crops: string[] }[] = [
  { key: "cereals", label: "Céréales", color: "#2a78d6", crops: ["maize", "sorghum", "rice"] },
  { key: "tubers", label: "Tubercules", color: "#eb6834", crops: ["cassava", "yam"] },
  { key: "legumes", label: "Légumineuses", color: "#1baf7a", crops: ["soybean", "cowpea"] },
  { key: "cotton", label: "Coton", color: "#eda100", crops: ["cotton"] },
  { key: "fruits", label: "Ananas", color: "#e87ba4", crops: ["pineapple"] },
  { key: "cashew", label: "Anacarde", color: "#008300", crops: ["cashew"] },
  { key: "palm", label: "Palmier à huile", color: "#4a3aa7", crops: ["oil_palm"] },
  { key: "vegetables", label: "Maraîchage", color: "#e34948", crops: ["tomato"] },
];
export const NO_CROP_COLOR = "#a3a29c";
export const cropColor = (crop: string | null) => CROP_GROUPS.find((g) => crop && g.crops.includes(crop))?.color ?? NO_CROP_COLOR;

export const STATUS_COLORS: Record<string, string> = {
  growing: "#1f7a3d",
  planned: "#7a8699",
  harvested: "#b88a1b",
  failed: "#c62828",
  none: NO_CROP_COLOR,
};

export const BAND_COLORS: Record<string, string> = { A: "#1f7a3d", B: "#5a9a3a", C: "#b88a1b", D: "#d9731f", E: "#c62828" };
