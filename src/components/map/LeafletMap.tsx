"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LUND_CENTER } from "@/lib/config";
import { PUBLIC_AREA_RADIUS_M, type LatLng } from "@/lib/geo";

// Mirrors --color-ink and --color-tag in globals.css. Leaflet sets these as SVG attributes, where CSS variables don't resolve.
const INK = "#1a1814";
const TAG = "#ffd43b";

export interface LeafletMapProps {
  /** "pick": click to place a pin. "area": approximate circle. "pin": exact meeting point. */
  mode: "pick" | "area" | "pin";
  point: LatLng | null;
  onPick?: (point: LatLng) => void;
  /** Changing this pans the map, e.g. after "use my location". */
  focus?: LatLng | null;
  className?: string;
}

export default function LeafletMap({ mode, point, onPick, focus, className = "h-64" }: LeafletMapProps) {
  const center = point ?? LUND_CENTER;
  return (
    <MapContainer
      center={center}
      zoom={mode === "pick" ? (point ? 15 : 13) : mode === "area" ? 14 : 16}
      scrollWheelZoom={false}
      className={`w-full rounded-md ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mode === "pick" && onPick && <ClickToPick onPick={onPick} />}
      {focus && <PanTo point={focus} />}
      {point && mode === "area" && (
        <Circle center={point} radius={PUBLIC_AREA_RADIUS_M} pathOptions={{ color: INK, fillColor: TAG, fillOpacity: 0.4, weight: 2 }} />
      )}
      {point && mode !== "area" && (
        <CircleMarker center={point} radius={9} pathOptions={{ color: INK, weight: 3, fillColor: TAG, fillOpacity: 1 }} />
      )}
    </MapContainer>
  );
}

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function PanTo({ point }: { point: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView(point, Math.max(map.getZoom(), 15));
  }, [map, point]);
  return null;
}
