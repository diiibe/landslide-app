import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useAppStore } from "@/app/store";
import {
  getComuneIndex,
  unionBounds,
  type ComuneEntry,
} from "@/map/layers/comuneIndex";
import styles from "./ComuneFilterPanel.module.css";

/**
 * Filter the comune choropleth to a hand-picked subset, with autocomplete
 * over the 214 FVG comuni and a chip list for the active selection. On
 * each add we fitBounds to the union of selected comuni's bboxes so the
 * map zooms toward the highlighted set; the choropleth's MapLibre filter
 * is updated reactively in MapView.
 *
 * Mounts only when `layers.comuni` is on — the panel disappears entirely
 * when the choropleth is off (selection state in the store is preserved).
 */
export function ComuneFilterPanel() {
  const open = useAppStore((s) => s.comuneFilterPanelOpen);
  const toggle = useAppStore((s) => s.toggleComuneFilterPanel);
  const layers = useAppStore((s) => s.layers);
  const selected = useAppStore((s) => s.selectedComuni);
  const toggleComune = useAppStore((s) => s.toggleComune);
  const clearComuni = useAppStore((s) => s.clearComuni);

  const [index, setIndex] = useState<ComuneEntry[]>([]);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load the index lazily — only when the comuni layer is actually on,
  // so the panel doesn't pay the parsing cost (or surface fetch errors
  // in unit tests) until needed. Idempotent: getComuneIndex() caches
  // its result so toggling the layer doesn't refetch.
  useEffect(() => {
    if (!layers.comuni) return;
    let cancelled = false;
    getComuneIndex()
      .then((idx) => {
        if (!cancelled) setIndex(idx);
      })
      .catch(() => {
        // Validation failure or fetch 404 — silently keep the panel
        // empty so the rest of the app still works.
      });
    return () => {
      cancelled = true;
    };
  }, [layers.comuni]);

  // Click-outside to close the autocomplete menu. pointerdown covers
  // touch + mouse + pen (P1.14 pattern reused from SearchLocality).
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Filter suggestions: case-insensitive substring match, exclude
  // already-selected, cap at 8 for menu height. Empty query shows the
  // first 8 unselected as a "browse" affordance.
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches: ComuneEntry[] = [];
    for (const e of index) {
      if (selectedSet.has(e.istat)) continue;
      if (q && !e.name.toLowerCase().includes(q)) continue;
      matches.push(e);
      if (matches.length >= 8) break;
    }
    return matches;
  }, [index, query, selectedSet]);

  const selectedEntries = useMemo(() => {
    const lookup = new Map(index.map((e) => [e.istat, e] as const));
    return selected
      .map((istat) => lookup.get(istat))
      .filter((e): e is ComuneEntry => e !== undefined);
  }, [index, selected]);

  if (!layers.comuni) return null;

  const pick = async (entry: ComuneEntry) => {
    toggleComune(entry.istat);
    setQuery("");
    setActiveIdx(-1);
    setMenuOpen(false);
    // Fit bounds to the union of selected + just-added.
    const nextCodes = selectedSet.has(entry.istat)
      ? selected.filter((c) => c !== entry.istat)
      : [...selected, entry.istat];
    const bounds = await unionBounds(nextCodes);
    if (bounds) {
      window.dispatchEvent(
        new CustomEvent("fvg:fitbounds", {
          detail: { bounds, padding: 64 },
        }),
      );
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIdx((i) => (i + 1) % suggestions.length);
      setMenuOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
      setMenuOpen(true);
    } else if (e.key === "Enter") {
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (target) {
        e.preventDefault();
        void pick(target);
      }
    } else if (e.key === "Escape") {
      setMenuOpen(false);
    }
  };

  return (
    <div className={styles.panel} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls="comune-filter-panel-body"
        aria-label={
          open ? "Collapse comune filter panel" : "Expand comune filter panel"
        }
        onClick={toggle}
      >
        <span className={styles.ttl}>Comune filter</span>
        {selected.length > 0 && (
          <span className={styles.count} aria-label={`${selected.length} selected`}>
            {selected.length}
          </span>
        )}
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap} id="comune-filter-panel-body">
        <div className={styles.body} ref={wrapRef}>
          <div className={styles.searchWrap}>
            <input
              className={styles.input}
              type="text"
              placeholder={
                selected.length === 0
                  ? "Type a comune name…"
                  : "Add another comune…"
              }
              aria-label="Filter by comune"
              aria-autocomplete="list"
              aria-expanded={menuOpen && suggestions.length > 0}
              aria-activedescendant={
                activeIdx >= 0 ? `cf-opt-${activeIdx}` : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMenuOpen(true);
                setActiveIdx(-1);
              }}
              onFocus={() => setMenuOpen(true)}
              onKeyDown={onKey}
            />
            {menuOpen && suggestions.length > 0 && (
              <ul className={styles.menu} role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    id={`cf-opt-${i}`}
                    key={s.istat}
                    role="option"
                    aria-selected={i === activeIdx}
                    data-active={i === activeIdx}
                    className={styles.opt}
                    title={s.name}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseDown={(e) => {
                      // mousedown (not click) so input blur doesn't kill
                      // the selection before it lands. Pattern from
                      // SearchLocality.
                      e.preventDefault();
                      void pick(s);
                    }}
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedEntries.length > 0 && (
            <div className={styles.chips}>
              {selectedEntries.map((e) => (
                <button
                  key={e.istat}
                  type="button"
                  className={styles.chip}
                  onClick={() => toggleComune(e.istat)}
                  title={`Remove ${e.name} from filter`}
                  aria-label={`Remove ${e.name} from filter`}
                >
                  <span className={styles.chipName}>{e.name}</span>
                  <span className={styles.chipX} aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                className={styles.clear}
                onClick={clearComuni}
                title="Clear all selected comuni"
              >
                Clear all
              </button>
            </div>
          )}
          {selectedEntries.length === 0 && (
            <p className={styles.hint}>
              No filter active — every comune visible. Pick one or more to
              restrict the choropleth.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
