import { Icon } from "@/ui/Icon";
import { SearchField } from "@/ui/SearchField";
import { useEffect, useId, useRef, useState } from "react";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "./store";
import { useTwinStore } from "@/digital-twin/store";
import { enableLayer, isLayerEnabled } from "./builtins";
import {
  catalogItems,
  filterItems,
  itemType,
  itemCadence,
  THEMES,
  type CatalogItem,
  type CatalogFilters,
} from "./catalog";
import styles from "./CatalogBrowser.module.css";

function showDetails(item: CatalogItem) {
  useTwinStore.setState({
    selection: null,
    ...(item.layer.pcrVariable ? { variable: item.layer.pcrVariable } : {}),
  });
  useRegionalStore.setState({
    catalogOpen: false,
    detailId: item.layer.id,
    selection: null,
  });
  useAppStore.setState({ drawerOpen: true });
}
export function CatalogButton() {
  const open = useRegionalStore((s) => s.catalogOpen);
  return (
    <button
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-controls="data-catalog"
      aria-expanded={open}
      onClick={(event) => {
        // Safari does not focus buttons on pointer activation. Establish the
        // opener before showModal so native close can restore focus to it.
        event.currentTarget.focus({ preventScroll: true });
        useRegionalStore.setState({ catalogOpen: !open });
      }}
    >
      <Icon name="catalog" />
      Catalogo
    </button>
  );
}
export function CatalogBrowser() {
  const open = useRegionalStore((s) => s.catalogOpen),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) {
      el.showModal();
      el.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    } else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      id="data-catalog"
      className={styles.dialog}
      aria-labelledby="catalog-title"
      onCancel={() => useRegionalStore.setState({ catalogOpen: false })}
      onClick={(e) => {
        if (e.target === e.currentTarget)
          useRegionalStore.setState({ catalogOpen: false });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // Search inputs can consume Escape to clear their value. The
          // catalog uses it consistently to close, leaving clear explicit.
          e.preventDefault();
          e.stopPropagation();
          useRegionalStore.setState({ catalogOpen: false });
        }
      }}
    >
      <div className={styles.header}>
        <div>
          <h1 id="catalog-title">Catalogo dei dati</h1>
          <p>Trova i dati da aggiungere alla tua mappa.</p>
        </div>
        <button
          onClick={() => useRegionalStore.setState({ catalogOpen: false })}
          aria-label="Chiudi catalogo"
          title="Chiudi catalogo"
        >
          <Icon name="close" />
        </button>
      </div>
      {open && <CatalogExplorer mode="catalog" />}
      <footer className={styles.footer}>
        <span>I dati conservano frequenza, fonte e data di osservazione.</span>
        <button
          onClick={() => {
            useRegionalStore.setState({ catalogOpen: false });
            useAppStore.setState({ drawerOpen: true });
          }}
        >
          Vedi i livelli sulla mappa
        </button>
      </footer>
    </dialog>
  );
}
const emptyFilters: CatalogFilters = {
  query: "",
  theme: "",
  provider: "",
  type: "",
  cadence: "",
  availability: "",
};
export function CatalogExplorer({ mode }: { mode: "catalog" | "sidebar" }) {
  const s = useRegionalStore();
  useAppStore((v) => v.layers);
  useAppStore((v) => v.userLayers);
  const items = catalogItems(s.catalog?.layers ?? []);
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters),
    [source, setSource] = useState(""),
    [limit, setLimit] = useState(40);
  const set = (key: keyof CatalogFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(40);
    if (key === "theme") setSource("");
  };
  const effectiveFilters =
    mode === "sidebar" ? { ...filters, query: s.query } : filters;
  const filtered = filterItems(items, effectiveFilters, isLayerEnabled);
  const list = source
    ? filtered.filter((i) => (i.layer.subfolder ?? i.layer.sourceId) === source)
    : filtered;
  const theme = filters.theme as keyof typeof THEMES;
  const providers = [...new Set(items.map((i) => i.layer.provider))].sort(
    (a, b) => a.localeCompare(b, "it"),
  );
  const groups = [
    ...new Set(filtered.map((i) => i.layer.subfolder ?? i.layer.sourceId)),
  ];
  const browse = mode === "sidebar" && !s.query;
  return (
    <div className={styles.explorer} data-mode={mode}>
      {mode === "catalog" && (
        <SearchField
          label="Cerca nel catalogo"
          placeholder="Cerca dati, sensori e fonti…"
          value={filters.query}
          onChange={(value) => set("query", value)}
        />
      )}
      {mode === "catalog" && (
        <div className={styles.filters}>
          <label>
            Fonte
            <select
              aria-label="Fonte"
              value={filters.provider}
              onChange={(e) => set("provider", e.target.value)}
            >
              <option value="">Tutte le fonti</option>
              {providers.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo di dato
            <select
              aria-label="Tipo di dato"
              value={filters.type}
              onChange={(e) => set("type", e.target.value)}
            >
              <option value="">Tutti i tipi</option>
              {[...new Set(items.map(itemType))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Aggiornamento
            <select
              aria-label="Aggiornamento"
              value={filters.cadence}
              onChange={(e) => set("cadence", e.target.value)}
            >
              <option value="">Ogni frequenza</option>
              {[...new Set(items.map(itemCadence))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Disponibilità
            <select
              aria-label="Disponibilità"
              value={filters.availability}
              onChange={(e) => set("availability", e.target.value)}
            >
              <option value="">Tutti</option>
              <option value="ready">Importabili</option>
              <option value="active">Sulla mappa</option>
              <option value="blocked">Da revisionare</option>
            </select>
          </label>
        </div>
      )}
      <div className={styles.explorerBody}>
        {mode === "catalog" && (
          <nav className={styles.themes} aria-label="Temi del catalogo">
            <button
              aria-current={!theme ? "page" : undefined}
              onClick={() => set("theme", "")}
            >
              Tutti i dati <span>{items.length}</span>
            </button>
            {Object.entries(THEMES).map(([id, label]) => (
              <button
                key={id}
                aria-current={theme === id ? "page" : undefined}
                onClick={() => set("theme", id)}
              >
                {label}
                <span>{items.filter((i) => i.theme === id).length}</span>
              </button>
            ))}
          </nav>
        )}
        <div className={styles.results}>
          <nav
            className={styles.breadcrumbs}
            aria-label="Percorso del catalogo"
          >
            <button
              onClick={() => {
                set("theme", "");
                setSource("");
              }}
            >
              Tutti i dati
            </button>
            {theme && (
              <>
                <Icon name="chevron" />
                <button onClick={() => setSource("")}>{THEMES[theme]}</button>
              </>
            )}
            {source && (
              <>
                <Icon name="chevron" />
                <span>{source}</span>
              </>
            )}
          </nav>
          {browse && !theme ? (
            <div className={styles.folders}>
              {Object.entries(THEMES).map(([id, label]) => {
                const count = items.filter((i) => i.theme === id).length;
                return count > 0 ? (
                  <button key={id} onClick={() => set("theme", id)}>
                    <Icon name="folder" />
                    {label}
                    <span>
                      {count}
                      <Icon name="chevron" />
                    </span>
                  </button>
                ) : null;
              })}
            </div>
          ) : browse && !source && groups.length > 1 ? (
            <div className={styles.folders}>
              {groups.map((g) => (
                <button key={g} onClick={() => setSource(g)}>
                  <Icon name="folder" />
                  {g}
                  <span>
                    {
                      filtered.filter(
                        (i) => (i.layer.subfolder ?? i.layer.sourceId) === g,
                      ).length
                    }{" "}
                    <Icon name="chevron" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className={styles.resultHead}>
                <span role="status">{list.length} livelli</span>
                {Object.values(effectiveFilters).some(Boolean) && (
                  <button
                    onClick={() => {
                      setFilters(emptyFilters);
                      setSource("");
                      setLimit(40);
                      if (mode === "sidebar")
                        useRegionalStore.setState({ query: "" });
                    }}
                  >
                    Azzera filtri
                  </button>
                )}
              </div>
              {mode === "catalog" &&
                !filters.query &&
                !theme &&
                !filters.provider &&
                !filters.type &&
                !filters.cadence &&
                !filters.availability && (
                  <div className={styles.featured}>
                    <strong>Mappature dei versanti</strong>
                    <p>
                      Esplora la suscettibilità ai corpi di frana e alle zone
                      diffuse, con soglia e trasparenza regolabili.
                    </p>
                    <button onClick={() => set("theme", "frane")}>
                      Esplora le mappature
                      <Icon name="arrow" />
                    </button>
                  </div>
                )}
              {list.slice(0, limit).map((item) => (
                <CatalogRow
                  key={item.layer.id}
                  item={item}
                  compact={mode === "sidebar"}
                />
              ))}
              {list.length === 0 && (
                <p className={styles.empty}>
                  Nessun livello trovato. Prova un parametro più generico o
                  rimuovi un filtro.
                </p>
              )}
              {list.length > limit && (
                <button
                  className={styles.more}
                  onClick={() => setLimit((v) => v + 40)}
                >
                  Mostra altri {Math.min(40, list.length - limit)} livelli
                </button>
              )}
            </>
          )}
          {s.catalogError && (
            <p role="alert">Catalogo regionale: {s.catalogError}</p>
          )}
          {!s.catalog && !s.catalogError && (
            <p role="status">Caricamento dei dati regionali…</p>
          )}
        </div>
      </div>
    </div>
  );
}
export function CatalogRow({
  item,
  compact = false,
}: {
  item: CatalogItem;
  compact?: boolean;
}) {
  const metadataId = useId();
  const l = item.layer,
    on = isLayerEnabled(l);
  return (
    <article className={styles.row} data-active={on} data-compact={compact}>
      <div className={styles.rowInfo}>
        <button
          className={styles.name}
          aria-label={l.title}
          aria-describedby={metadataId}
          onClick={() => showDetails(item)}
        >
          <i aria-hidden="true" style={{ background: l.color }} />
          <span>{l.title}</span>
          <small id={metadataId} title={`${itemType(item)} · ${l.provider}`}>
            {itemType(item)} · {l.provider}
          </small>
        </button>
        {!compact && <p>{l.description}</p>}
        {l.status === "blocked" && <span>Da revisionare · {l.problem}</span>}
      </div>
      <button
        className={styles.add}
        disabled={l.status !== "ready"}
        aria-pressed={on}
        aria-label={
          (on ? "Rimuovi dalla mappa · " : "Aggiungi alla mappa · ") + l.title
        }
        onClick={() => enableLayer(l, !on)}
      >
        {l.status === "blocked" ? (
          "Non disponibile"
        ) : (
          <>
            <Icon name={on ? (compact ? "close" : "check") : "plus"} />
            {!compact && (on ? "Sulla mappa" : "Aggiungi")}
          </>
        )}
      </button>
    </article>
  );
}
