import { useEffect, useRef, type KeyboardEvent } from "react";
import { useAppStore } from "@/app/store";
import styles from "./SearchLocality.module.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

interface GeocodeFeature {
  center: [number, number];
  place_name: string;
}

/**
 * P1.7: validate the geocoder payload before consuming it. The previous
 * version destructured `[lng, lat] = f.center` and crashed silently with
 * NaN coordinates on malformed responses, sending flyTo into a NaN
 * loop. We now require an array of two finite numbers and a string
 * `place_name`.
 */
function asGeocodeFeature(value: unknown): GeocodeFeature | null {
  if (!value || typeof value !== "object") return null;
  const f = value as { center?: unknown; place_name?: unknown };
  if (!Array.isArray(f.center) || f.center.length < 2) return null;
  const lng = f.center[0];
  const lat = f.center[1];
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (typeof f.place_name !== "string") return null;
  return { center: [lng, lat], place_name: f.place_name };
}

export function SearchLocality() {
  const query = useAppStore((s) => s.search.query);
  const setSearch = useAppStore((s) => s.setSearch);
  // P1.7: AbortController keyed to the in-flight request. When the user
  // submits a new query, the previous fetch is cancelled so out-of-order
  // responses can't update the map after a newer query has been issued.
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => inflightRef.current?.abort();
  }, []);

  const onKey = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !query.trim() || !TOKEN) return;
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${TOKEN}&country=it&bbox=12.3,45.5,13.95,46.65&types=place,locality,neighborhood&limit=1`;
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return;
      const data = (await res.json()) as { features?: unknown[] };
      const f = asGeocodeFeature(data.features?.[0]);
      if (!f) return;
      // Drop the response if a newer request has superseded us.
      if (inflightRef.current !== ctrl) return;
      const [lng, lat] = f.center;
      setSearch({ query: f.place_name, placeName: f.place_name });
      window.dispatchEvent(new CustomEvent("fvg:flyto", { detail: { lng, lat } }));
    } catch {
      // network failure or aborted request — silently drop
    }
  };

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.ico}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="m14 14-3.1-3.1" />
      </svg>
      <input
        className={styles.input}
        type="text"
        placeholder="Search locality, comune…"
        aria-label="Search locality"
        value={query}
        onChange={(e) => setSearch({ query: e.target.value, placeName: null })}
        onKeyDown={onKey}
      />
      <span className={styles.kbd}>⌘K</span>
    </div>
  );
}
