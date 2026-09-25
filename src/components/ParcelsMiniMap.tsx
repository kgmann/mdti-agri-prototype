"use client";
// Small map of a known set of parcels (an owner's, a cooperative's), coloured by crop.
import ParcelMap, { type ParcelCollection } from "./ParcelMap";
import { LAND_TYPE_LABELS, STATUS_LABELS, cropColor, fmt1 } from "@/lib/format";

export default function ParcelsMiniMap({ parcels, height = "320px", satellite = true }: { parcels: ParcelCollection; height?: string; satellite?: boolean }) {
  return (
    <div style={{ height }} className="overflow-hidden rounded-lg">
      <ParcelMap
        parcels={parcels}
        fitToParcels
        satelliteDefault={satellite}
        colorOf={(p) => cropColor(p.crop as string | null)}
        popup={(p) => (
          <div className="text-sm">
            <div className="font-semibold">{p.code as string} — {p.ownerName as string}</div>
            <div>{fmt1(Number(p.areaHa))} ha · {LAND_TYPE_LABELS[p.landType as string]}</div>
            <div>Sol : {p.soilType as string}, pH {p.soilPh as number}</div>
            <div>Culture : {(p.cropName as string) ?? "aucune"}{p.status ? ` — ${STATUS_LABELS[p.status as string]}` : ""}</div>
          </div>
        )}
      />
    </div>
  );
}
