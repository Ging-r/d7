export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Radius of the "approximate area" circle shown on public listing pages. */
export const PUBLIC_AREA_RADIUS_M = 400;

/**
 * Offsets a point by up to `maxMeters` in a random direction. Stored once per
 * pin so repeated page loads can't be averaged to recover the exact location.
 */
export function fuzzLocation(point: LatLng, maxMeters = 250, random: () => number = Math.random): LatLng {
  const distance = maxMeters * Math.sqrt(random());
  const angle = random() * 2 * Math.PI;
  const dLat = (distance * Math.cos(angle)) / 111_320;
  const dLng = (distance * Math.sin(angle)) / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
