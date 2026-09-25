"use client";
// Leaflet needs the browser: load the map on the client only.
import dynamic from "next/dynamic";

const ParcelMap = dynamic(() => import("./ParcelMapInner"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-64 items-center justify-center bg-neutral-100 text-sm text-neutral-500">Chargement de la carte…</div>,
});

export default ParcelMap;
export type { ParcelCollection, ParcelProps } from "./ParcelMapInner";
