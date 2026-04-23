import type { KeyboardEvent } from "react";
import { useAppStore } from "@/app/store";
import styles from "./SearchLocality.module.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export function SearchLocality() {
  const query = useAppStore((s) => s.search.query);
  const setSearch = useAppStore((s) => s.setSearch);

  const onKey = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !query.trim() || !TOKEN) return;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${TOKEN}&country=it&bbox=12.3,45.5,13.95,46.65&types=place,locality,neighborhood&limit=1`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const f = data.features?.[0];
      if (!f) return;
      const [lng, lat] = f.center;
      setSearch({ query: f.place_name, placeName: f.place_name });
      window.dispatchEvent(new CustomEvent("fvg:flyto", { detail: { lng, lat } }));
    } catch {
      // network failure ignored — user can retry
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
