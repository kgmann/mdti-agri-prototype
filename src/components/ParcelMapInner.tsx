"use client";
// Leaflet map of parcels. At country scale parcels are dots (a 2 ha field is invisible), from ZOOM_POLYGONS they are outlines.
import { useEffect, useState } from "react";
import { CircleMarker, GeoJSON, LayersControl, MapContainer, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry } from "geojson";

export type ParcelProps = { id: number; lon: number; lat: number; [k: string]: unknown };
export type ParcelCollection = FeatureCollection<Geometry, ParcelProps>;

const ZOOM_POLYGONS = 12;
const BENIN_BOUNDS: L.LatLngBoundsExpression = [
  [6.2, 0.75],
  [12.45, 3.9],
];

type Props = {
  parcels: ParcelCollection;
  colorOf: (p: ParcelProps) => string;
  popup: (p: ParcelProps) => React.ReactNode;
  boundaries?: { departments: unknown; communes: unknown };
  fitToParcels?: boolean;
  satelliteDefault?: boolean;
  height?: string;
};

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

function FitBounds({ parcels, enabled }: { parcels: ParcelCollection; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || parcels.features.length === 0) return;
    const b = L.geoJSON(parcels as never).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 16 });
  }, [map, parcels, enabled]);
  return null;
}

export default function ParcelMapInner({ parcels, colorOf, popup, boundaries, fitToParcels, satelliteDefault, height = "100%" }: Props) {
  const [zoom, setZoom] = useState(7);
  const showPolygons = zoom >= ZOOM_POLYGONS || !!fitToParcels;
  return (
    <MapContainer bounds={BENIN_BOUNDS} style={{ height, width: "100%" }} preferCanvas scrollWheelZoom>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked={!satelliteDefault} name="Plan (OpenStreetMap)">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked={!!satelliteDefault} name="Satellite (Esri)">
          <TileLayer
            attribution="Imagerie &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <ZoomWatcher onZoom={setZoom} />
      <FitBounds parcels={parcels} enabled={!!fitToParcels} />

      {boundaries && (
        <>
          <GeoJSON data={boundaries.departments as never} style={{ color: "#134d28", weight: 1.5, fill: false }} interactive={false} />
          {zoom >= 9 && <GeoJSON data={boundaries.communes as never} style={{ color: "#134d28", weight: 0.7, dashArray: "3 3", fill: false }} interactive={false} />}
        </>
      )}

      {parcels.features.map((f) =>
        showPolygons && f.geometry.type === "Polygon" ? (
          <Polygon
            key={f.properties.id}
            positions={(f.geometry.coordinates[0] as number[][]).map(([lon, lat]) => [lat, lon] as [number, number])}
            pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: colorOf(f.properties), fillOpacity: 0.75 }}
          >
            <Popup>{popup(f.properties)}</Popup>
          </Polygon>
        ) : (
          <CircleMarker
            key={f.properties.id}
            center={[f.properties.lat, f.properties.lon]}
            radius={4}
            pathOptions={{ color: "#ffffff", weight: 1, fillColor: colorOf(f.properties), fillOpacity: 0.9 }}
          >
            <Popup>{popup(f.properties)}</Popup>
          </CircleMarker>
        ),
      )}
    </MapContainer>
  );
}
