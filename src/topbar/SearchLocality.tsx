import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useAppStore } from "@/app/store";
import { asSuggestion, geocodingURL, type Suggestion } from "./geocoding";
import styles from "./SearchLocality.module.css";
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
export function SearchLocality() {
  const { query, placeName } = useAppStore((s) => s.search),
    setSearch = useAppStore((s) => s.setSearch);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [active, setActive] = useState(-1),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [fetchedFor, setFetchedFor] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const wrap = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    listId = useId(),
    dismissVersion = useRef(0);
  const trimmed = query.trim();
  useEffect(() => {
    const ctrl = new AbortController(),
      version = dismissVersion.current;
    if (!TOKEN || (placeName && placeName === query)) return () => ctrl.abort();
    const timer = setTimeout(async () => {
      setActive(-1);
      setError("");
      if (trimmed.length < 2) {
        setSuggestions([]);
        setLoading(false);
        setFetchedFor("");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(geocodingURL(trimmed, TOKEN), {
          signal: ctrl.signal,
        });
        if (!res.ok)
          throw new Error(`Ricerca non disponibile (${res.status}). Riprova.`);
        const data = (await res.json()) as { features?: unknown };
        if (!Array.isArray(data.features))
          throw new Error("Risposta della ricerca non valida. Riprova.");
        if (ctrl.signal.aborted) return;
        setSuggestions(
          data.features.map(asSuggestion).filter((s): s is Suggestion => !!s),
        );
        setFetchedFor(trimmed);
        if (dismissVersion.current === version) setOpen(true);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setSuggestions([]);
          setFetchedFor(trimmed);
          setError(
            e instanceof Error && /^(Ricerca non disponibile|Risposta della ricerca)/.test(e.message)
              ? e.message
              : "Ricerca non raggiungibile. Verifica la connessione e riprova.",
          );
          if (dismissVersion.current === version) setOpen(true);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed, query, placeName, retry]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        dismissVersion.current++;
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const current = fetchedFor === trimmed ? suggestions : [];
  const unavailable = !TOKEN && trimmed.length >= 2;
  const showStatus =
    trimmed.length >= 2 &&
    (unavailable || (!loading && fetchedFor === trimmed));
  const menuOpen =
    open &&
    (current.length > 0 || showStatus || (loading && trimmed.length >= 2));
  function pick(s: Suggestion) {
    setSearch({ query: s.fullName, placeName: s.fullName });
    setSuggestions([]);
    setActive(-1);
    setOpen(false);
    setLoading(false);
    setFetchedFor("");
    setError("");
    window.dispatchEvent(
      new CustomEvent("fvg:flyto", {
        detail: {
          lng: s.lng,
          lat: s.lat,
          zoom: s.zoom,
          label: s.fullName,
          precision: s.precision,
        },
      }),
    );
    if (window.matchMedia?.("(pointer: coarse)").matches) input.current?.blur();
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!current.length) return;
      setActive((i) =>
        e.key === "ArrowDown"
          ? (i + 1) % current.length
          : i <= 0
            ? current.length - 1
            : i - 1,
      );
      setOpen(true);
    } else if (e.key === "Enter") {
      const s = current[active >= 0 ? active : 0];
      if (s && menuOpen) {
        e.preventDefault();
        pick(s);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      dismissVersion.current++;
      setOpen(false);
    }
  }
  return (
    <div className={styles.wrap} ref={wrap}>
      <svg
        className={styles.ico}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="m14 14-3.1-3.1" />
      </svg>
      <input
        ref={input}
        className={styles.input}
        type="search"
        role="combobox"
        placeholder="Cerca località, via o civico…"
        aria-label="Cerca località, vie e civici"
        aria-autocomplete="list"
        aria-busy={loading}
        aria-controls={menuOpen && current.length > 0 ? listId : undefined}
        aria-expanded={menuOpen && current.length > 0}
        aria-activedescendant={
          menuOpen && current[active] ? `${listId}-${active}` : undefined
        }
        value={query}
        onChange={(e) => {
          setSearch({ query: e.target.value, placeName: null });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={key}
      />
      {menuOpen && (
        <div className={styles.menu}>
          {loading && !current.length && (
            <div className={styles.optEmpty} role="status">
              Cerco località, vie e civici…
            </div>
          )}
          {current.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Indirizzi e località trovati"
            >
              {current.map((s, i) => (
                <li
                  id={`${listId}-${i}`}
                  key={s.id}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  title={s.fullName}
                  className={styles.opt}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                >
                  <span className={styles.optName}>{s.name}</span>
                  <span className={styles.optCtx}>
                    {s.kind} · {s.context}
                  </span>
                  {s.precision && (
                    <span className={styles.precision}>{s.precision}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!current.length && showStatus && (
            <div className={styles.optEmpty} role={error ? "alert" : "status"}>
              {unavailable
                ? "Ricerca indirizzi non configurata."
                : error ||
                  "Nessuna località, via o civico trovato nell’area di ricerca."}
              {error && (
                <button
                  onClick={() => {
                    setRetry((v) => v + 1);
                    input.current?.focus();
                  }}
                >
                  Riprova ricerca
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
