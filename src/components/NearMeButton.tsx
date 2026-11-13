"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

/** Asks for the browser's location and re-runs the search sorted by distance. */
export function NearMeButton({ className = "btn-secondary", basePath = "/costumes" }: { className?: string; basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "locating" | "error">("idle");
  const active = params.has("lat") && params.has("lng");

  function locate() {
    if (!navigator.geolocation) {
      setState("error");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params);
        next.set("lat", pos.coords.latitude.toFixed(4));
        next.set("lng", pos.coords.longitude.toFixed(4));
        next.set("sort", "nearest");
        setState("idle");
        router.push(`${basePath}?${next}`);
      },
      () => setState("error"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function clear() {
    const next = new URLSearchParams(params);
    next.delete("lat");
    next.delete("lng");
    if (next.get("sort") === "nearest") next.delete("sort");
    router.push(`${basePath}?${next}`);
  }

  if (active && basePath === "/costumes") {
    return (
      <button type="button" onClick={clear} className={className}>
        <Icon name="locate" />
        Near you
        <Icon name="x" className="size-3.5 text-muted" />
        <span className="sr-only">Clear location</span>
      </button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={locate} disabled={state === "locating"} className={className}>
        <Icon name="locate" />
        {state === "locating" ? "Finding you…" : "Near me"}
      </button>
      {state === "error" && <span className="text-xs text-signal">Location unavailable. Allow location access and try again.</span>}
    </div>
  );
}
