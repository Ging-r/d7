"use client";

import dynamic from "next/dynamic";
import type { LeafletMapProps } from "./LeafletMap";

// Leaflet touches `window` on import, so it only loads in the browser.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-stone-200" />,
});

export function CostumeMap(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}
