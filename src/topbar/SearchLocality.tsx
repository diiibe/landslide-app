import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAppStore } from "@/app/store";
import styles from "./SearchLocality.module.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const FVG_BBOX = "12.3,45.5,13.95,46.65";
const DEBOUNCE_MS = 220;

interface Suggestion {
  id: string;
  name: string;
  context: string;
  lng: number;
  lat: number;
}

function flyTo(s: Suggestion): void {
  window.dispatchEvent(
    new CustomEvent("fvg:flyto", { detail: { lng: s.lng, lat: s.lat } }),
  );
}

/**
 * P3 nit: render `⌘K` on Apple platforms (Mac/iPhone/iPad) and `Ctrl K`
 * elsewhere instead of unconditionally showing the Mac glyph.
 * `navigator.platform` is deprecated but still the most reliable signal
 * across browsers; userAgent is the fallback.
 */
function shortcutHint(): string {
  if (typeof navigator === "undefined") return "⌘K";
  const ua = (navigator.platform || navigator.userAgent || "").toLowerCase();
  return /mac|iphone|ipad|ipod/.test(ua) ? "⌘K" : "Ctrl K";
}
const KBD_HINT = shortcutHint();

/**
 * P1.7: validate the geocoder payload before consuming it. Mapbox can
 * reply with a partial / malformed feature shape; without this guard a
 * crashy NaN coord could be passed to flyTo and lock the camera.
 */
function asSuggestion(value: unknown): Suggestion | null {
  if (!value || typeof value !== "object") return null;
  const f = value as {
    id?: unknown;
    text?: unknown;
    place_name?: unknown;
    center?: unknown;
  };
  if (typeof f.id !== "string" && typeof f.id !== "number") return null;
  if (typeof f.text !== "string") return null;
  if (typeof f.place_name !== "string") return null;
  if (!Array.isArray(f.center) || f.center.length < 2) return null;
  const lng = f.center[0];
  const lat = f.center[1];
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    id: String(f.id),
    name: f.text,
    // Strip the leading "X, " so the context line doesn't repeat the name.
    context: f.place_name.replace(/^[^,]+,\s*/, ""),
    lng,
    lat,
  };
}

export function SearchLocality() {
  const query = useAppStore((s) => s.search.query);
  const setSearch = useAppStore((s) => s.setSearch);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // P1.7: AbortController keyed to the in-flight request. Each new debounced
  // fetch aborts its predecessor so out-of-order responses can't update the
  // dropdown after a newer query has been issued.
  const inflightRef = useRef<AbortController | null>(null);

  // Cancel any pending fetch on unmount.
  useEffect(() => {
    return () => inflightRef.current?.abort();
  }, []);

  // Debounced autocomplete fetch.
  useEffect(() => {
    if (!TOKEN) return;
    const q = query.trim();
    // Always defer setState into setTimeout so we don't trigger a synchronous
    // re-render from inside the effect (lint: react-hooks/set-state-in-effect).
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([]);
        setActiveIdx(-1);
        return;
      }
      inflightRef.current?.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
        `?access_token=${TOKEN}&country=it&bbox=${FVG_BBOX}` +
        `&types=place,locality,neighborhood,address,poi&autocomplete=true&limit=6`;
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { features?: unknown[] };
        // Drop the response if a newer request has superseded us.
        if (inflightRef.current !== ctrl) return;
        const next = (data.features ?? [])
          .map(asSuggestion)
          .filter((s): s is Suggestion => s !== null);
        setSuggestions(next);
        setActiveIdx(next.length > 0 ? 0 : -1);
        setOpen(true);
      } catch {
        // network failure or aborted request — silently drop
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Click-outside to close. P1.14: listen on `pointerdown` (covers
  // mouse + touch + pen). On iOS Safari / Android Chrome with the on-
  // screen keyboard open, taps outside the dropdown don't reliably
  // synthesise `mousedown` so the menu stays stuck open. PointerEvents
  // are supported in every browser we ship to today.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (s: Suggestion) => {
    setSearch({ query: s.name, placeName: s.name });
    setSuggestions([]);
    setActiveIdx(-1);
    setOpen(false);
    flyTo(s);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIdx((i) => (i + 1) % suggestions.length);
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
      setOpen(true);
    } else if (e.key === "Enter") {
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (target) {
        e.preventDefault();
        pick(target);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
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
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-activedescendant={activeIdx >= 0 ? `sl-opt-${activeIdx}` : undefined}
        value={query}
        onChange={(e) => setSearch({ query: e.target.value, placeName: null })}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKey}
      />
      <span className={styles.kbd}>{KBD_HINT}</span>
      {open && suggestions.length > 0 && (
        <ul className={styles.menu} role="listbox">
          {suggestions.map((s, i) => (
            <li
              id={`sl-opt-${i}`}
              key={s.id}
              role="option"
              aria-selected={i === activeIdx}
              data-active={i === activeIdx}
              className={styles.opt}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                // mousedown (not click) so the input's blur doesn't close
                // the list before the selection lands.
                e.preventDefault();
                pick(s);
              }}
            >
              <span className={styles.optName}>{s.name}</span>
              <span className={styles.optCtx}>{s.context}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
