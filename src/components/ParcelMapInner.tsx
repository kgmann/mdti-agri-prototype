"use client";
// Leaflet map of parcels. At country scale parcels are dots (a 2 ha field is invisible), from ZOOM_POLYGONS they are outlines.
import { useEffect, useRef, useState } from "react";
import { CircleMarker, GeoJSON, LayersControl, MapContainer, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry } from "geojson";

export type ParcelProps = { id: number; lon: number; lat: number; [k: string]: unknown };
export type ParcelCollection = FeatureCollection<Geometry, ParcelProps>;

const ZOOM_POLYGONS = 12;
const BENIN_BOUNDS: L.LatLngBoundsExpression = [
  [6.2, 0.75],
  [12.45, 3.9],
];

// Extra layers for flow maps (supply networks, traceability).
export type MapLine = { positions: [number, number][]; color: string; weight: number; dashed?: boolean; label?: string };
export type MapPoint = { lat: number; lon: number; color: string; radius: number; label: React.ReactNode };

// Free NASA GIBS layers (no API key). "default" = most recent available date.
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const NO_LINES: MapLine[] = [];
const NO_POINTS: MapPoint[] = [];

type Props = {
  parcels: ParcelCollection;
  lines?: MapLine[];
  points?: MapPoint[];
  colorOf: (p: ParcelProps) => string;
  popup: (p: ParcelProps) => React.ReactNode;
  boundaries?: { departments: unknown; communes: unknown };
  fitToParcels?: boolean;
  satelliteDefault?: boolean;
  height?: string;
};

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

// Fits the view to the content once per dataset (not on every re-render, or zooming would reset the view).
function FitBounds({ parcels, points, enabled }: { parcels: ParcelCollection; points: MapPoint[]; enabled: boolean }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);
  const key = `${parcels.features.length}:${parcels.features[0]?.properties.id ?? ""}:${points.length}:${points[0]?.lat ?? ""}`;
  useEffect(() => {
    if (!enabled || fitted.current === key) return;
    const b = L.latLngBounds([]);
    if (parcels.features.length) b.extend(L.geoJSON(parcels as never).getBounds());
    for (const p of points) b.extend([p.lat, p.lon]);
    if (!b.isValid()) return;
    // The container may not have its final size yet when the map mounts: measure again before fitting.
    // Marked as fitted only once it actually ran (a re-render may cancel the pending timeout).
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(b, { padding: [30, 30], maxZoom: 16 });
      fitted.current = key;
    }, 100);
    return () => clearTimeout(t);
  }, [map, parcels, points, enabled, key]);
  return null;
}

export default function ParcelMapInner({ parcels, lines = NO_LINES, points = NO_POINTS, colorOf, popup, boundaries, fitToParcels, satelliteDefault, height = "100%" }: Props) {
  const [zoom, setZoom] = useState(7);
  const showPolygons = zoom >= ZOOM_POLYGONS;
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
        <LayersControl.Overlay name="Végétation — NDVI (NASA MODIS, 8 jours)">
          <TileLayer
            attribution='NDVI &copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> / MODIS'
            url={`${GIBS}/MODIS_Terra_NDVI_8Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`}
            maxNativeZoom={9}
            opacity={0.7}
          />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Pluie en cours (NASA IMERG)">
          <TileLayer
            attribution='Précipitations &copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> / GPM IMERG'
            url={`${GIBS}/IMERG_Precipitation_Rate/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`}
            maxNativeZoom={6}
            opacity={0.75}
          />
        </LayersControl.Overlay>
      </LayersControl>
      <ZoomWatcher onZoom={setZoom} />
      <FitBounds parcels={parcels} points={points} enabled={!!fitToParcels} />

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
      {lines.map((l, i) => (
        <Polyline key={`l${i}`} positions={l.positions} pathOptions={{ color: l.color, weight: l.weight, opacity: 0.7, dashArray: l.dashed ? "6 6" : undefined }}>
          {l.label && <Tooltip sticky>{l.label}</Tooltip>}
        </Polyline>
      ))}
      {points.map((p, i) => (
        <CircleMarker key={`p${i}`} center={[p.lat, p.lon]} radius={p.radius} pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: p.color, fillOpacity: 0.95 }}>
          <Popup>{p.label}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
