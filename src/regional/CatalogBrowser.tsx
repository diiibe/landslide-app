import { Icon } from "@/ui/Icon";
import { SearchField } from "@/ui/SearchField";
import { Select } from "@/ui/Select";
import { FileExplorer } from "./FileExplorer";
import { CategoryIcon, LayerSymbol } from "./CatalogSymbols";
import { CATEGORY } from "./catalogAppearance";
import { useEffect, useId, useRef, useState } from "react";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "./store";
import { useTwinStore } from "@/digital-twin/store";
import { enableLayer, isLayerEnabled } from "./builtins";
import {
  catalogItems,
  displayProvider,
  filterItems,
  itemType,
  itemCadence,
  THEMES,
  type CatalogItem,
  type CatalogFilters,
  type ThemeId,
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
      aria-label="Catalogo"
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
      <span>Catalogo</span>
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
      if (window.matchMedia?.(mobileCatalogQuery).matches)
        el.querySelector<HTMLElement>("#catalog-title")?.focus();
      else el.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
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
          <h1 id="catalog-title" tabIndex={-1}>Catalogo dei dati</h1>
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
        <span>Fonte, frequenza e data sempre consultabili nel dettaglio.</span>
        <button
          onClick={() => {
            useRegionalStore.setState({ catalogOpen: false });
            useAppStore.setState({ drawerOpen: true });
          }}
        >
          Torna alla mappa
        </button>
      </footer>
    </dialog>
  );
}
const mobileCatalogQuery = "(max-width: 768px), (max-height: 500px) and (pointer: coarse)";
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
    [limit, setLimit] = useState(40);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterId = useId();
  const [browseAll, setBrowseAll] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const refinementCount = [filters.provider, filters.type, filters.cadence, filters.availability].filter(Boolean).length;
  const showCategories = !browseAll && !Object.values(filters).some(Boolean);
  const resetCatalog = () => {
    setBrowseAll(false); setFilters(emptyFilters); setLimit(40);
    requestAnimationFrame(() => { if (resultRef.current) resultRef.current.scrollTop = 0; });
  };
  const chooseTheme = (id: string) => {
    setBrowseAll(!id);
    set("theme", id);
    if (window.matchMedia?.(mobileCatalogQuery).matches)
      requestAnimationFrame(() => { if (resultRef.current) resultRef.current.scrollTop = 0; });
  };
  const set = (key: keyof CatalogFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(40);
  };
  const effectiveFilters =
    mode === "sidebar" ? { ...filters, query: s.query } : filters;
  const filtered = filterItems(items, effectiveFilters, isLayerEnabled);
  const list = filtered;
  const theme = filters.theme as keyof typeof THEMES;
  const providers = [
    ...new Set(items.map((i) => displayProvider(i.layer))),
  ].sort((a, b) => a.localeCompare(b, "it"));
  if (mode === "sidebar")
    return (
      <>
        {s.catalogError && (
          <div className={styles.catalogState} role="alert">
            <strong>Catalogo regionale non raggiungibile</strong>
            <p>
              La ricerca include soltanto i dati già caricati. L’aggiornamento
              automatico riproverà a contattare la fonte.
            </p>
            <button
              onClick={() =>
                useRegionalStore.setState((state) => ({
                  refreshKey: state.refreshKey + 1,
                }))
              }
            >
              Riprova adesso
            </button>
          </div>
        )}
        {!s.catalog && !s.catalogError && (
          <p className={styles.catalogState} role="status">
            Caricamento del catalogo regionale… Puoi già esplorare le mappature
            disponibili.
          </p>
        )}
        <FileExplorer
          items={items}
          query={s.query}
          clearQuery={() => useRegionalStore.setState({ query: "" })}
          renderItem={(item) => (
            <CatalogRow item={item} compact context="browse" />
          )}
        />
      </>
    );
  return (
    <div className={styles.explorer} data-mode={mode} data-categories={showCategories}>
      <div className={styles.searchTools}>
        <SearchField
          label="Cerca nel catalogo"
          placeholder="Cerca dati…"
          value={filters.query}
          onChange={(value) => set("query", value)}
        />
        <button className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls={filterId} onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setFiltersOpen(!filtersOpen); }}>
          <Icon name="filter" /><span>Filtri</span>{refinementCount > 0 && <b>{refinementCount}</b>}
        </button>
      </div>
      <div className={styles.filters} id={filterId} hidden={!filtersOpen}>
        <label>
          Fonte
          <Select
            label="Fonte"
            value={filters.provider}
            onChange={(value) => set("provider", value)}
            options={[
              { value: "", label: "Tutte le fonti" },
              ...providers.map((p) => ({ value: p, label: p })),
            ]}
          />
        </label>
        <label>
          Tipo di dato
          <Select
            label="Tipo di dato"
            value={filters.type}
            onChange={(value) => set("type", value)}
            options={[
              { value: "", label: "Tutti i tipi" },
              ...[...new Set(items.map(itemType))].map((t) => ({
                value: t,
                label: t,
              })),
            ]}
          />
        </label>
        <label>
          Aggiornamento
          <Select
            label="Aggiornamento"
            value={filters.cadence}
            onChange={(value) => set("cadence", value)}
            options={[
              { value: "", label: "Ogni frequenza" },
              ...[...new Set(items.map(itemCadence))].map((t) => ({
                value: t,
                label: t,
              })),
            ]}
          />
        </label>
        <label>
          Disponibilità
          <Select
            label="Disponibilità"
            value={filters.availability}
            onChange={(value) => set("availability", value)}
            options={[
              { value: "", label: "Tutti" },
              { value: "ready", label: "Importabili" },
              { value: "active", label: "Sulla mappa" },
              { value: "blocked", label: "Da revisionare" },
            ]}
          />
        </label>
      </div>

      {s.catalogError && (
        <div className={styles.catalogState} role="alert">
          <strong>Catalogo regionale non raggiungibile</strong>
          <p>Le categorie includono soltanto i dati già disponibili. Puoi continuare a esplorare la mappa.</p>
          <button onClick={() => useRegionalStore.setState((state) => ({ refreshKey: state.refreshKey + 1 }))}>Riprova adesso</button>
        </div>
      )}
      {!s.catalog && !s.catalogError && <p className={styles.catalogState} role="status">Caricamento dei dati regionali…</p>}
      <div className={styles.explorerBody} ref={resultRef}>
        {mode === "catalog" && (
          <nav className={styles.themes} aria-label="Temi del catalogo">
            <h2 className={styles.categoryHeading}>Esplora per categoria</h2>
            <button
              aria-current={!theme ? "page" : undefined}
              onClick={() => chooseTheme("")}
            >
              <Icon name="catalog" /><strong>Tutti i dati</strong><span>{items.length}</span>
            </button>
            {Object.entries(THEMES).map(([id, label]) => (
              <button
                key={id}
                aria-current={theme === id ? "page" : undefined}
                onClick={() => chooseTheme(id)}
              >
                <CategoryIcon theme={id as ThemeId} />
                <strong>{label}<small>{CATEGORY[id as ThemeId].note}</small></strong>
                <span>{items.filter((i) => i.theme === id).length}</span>
              </button>
            ))}
          </nav>
        )}
        <div className={styles.results}>
          <button className={styles.backCategories} onClick={resetCatalog}><Icon name="chevron" />Categorie</button>
          <nav
            className={styles.breadcrumbs}
            aria-label="Percorso del catalogo"
          >
            <button
              onClick={() => {
                set("theme", "");
              }}
            >
              Tutti i dati
            </button>
            {theme && (
              <>
                <Icon name="chevron" />
                <span aria-current="location">{THEMES[theme]}</span>
              </>
            )}
          </nav>
          <div className={styles.resultHead}>
            <span role="status">{list.length} livelli</span>
            {Object.values(effectiveFilters).some(Boolean) && (
              <button
                onClick={() => {
                  setBrowseAll(false);
                  setFilters(emptyFilters);
                  setLimit(40);
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
              <button className={styles.featured} onClick={() => set("theme", "frane")}>
                <CategoryIcon theme="frane" />
                <span><strong>Mappature dei versanti</strong><small>Corpi di frana e zone diffuse</small></span>
                <Icon name="arrow" />
              </button>
            )}
          {list.slice(0, limit).map((item) => (
            <CatalogRow key={item.layer.id} item={item} />
          ))}
          {list.length === 0 && (
            <p className={styles.empty}>
              Nessun livello trovato. Prova un parametro più generico o rimuovi
              un filtro.
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

        </div>
      </div>
    </div>
  );
}
export function CatalogRow({
  item,
  compact = false,
  context = "active",
}: {
  item: CatalogItem;
  compact?: boolean;
  context?: "active" | "browse";
}) {
  const metadataId = useId();
  const current = useRegionalStore((state) => state.detailId === item.layer.id);
  const l = item.layer,
    on = isLayerEnabled(l);
  return (
    <article
      className={styles.row}
      data-active={on}
      data-compact={compact}
      data-detail={current}
      data-context={context}
    >
      <div className={styles.rowInfo}>
        <button
          className={styles.name}
          aria-label={l.title}
          aria-describedby={metadataId}
          onClick={() => showDetails(item)}
        >
          <LayerSymbol item={item} />
          <span>{l.title}</span>
          <small id={metadataId} title={`${itemType(item)} · ${l.provider}`}>
            {itemType(item)} · {displayProvider(l).replace(/^Protezione Civile della Regione Friuli Venezia Giulia$/, "Protezione Civile FVG")}
          </small>
          <Icon name="chevron" className={styles.detailsCaret} />
        </button>
        {!compact && <p>{l.description}</p>}
        {l.status === "blocked" && <span>Da revisionare · {l.problem}</span>}
      </div>
      <button
        className={styles.add}
        disabled={l.status !== "ready"}
        aria-pressed={on}
        aria-label={
          (l.status !== "ready" ? "Da revisionare · " : on ? "Rimuovi dalla mappa · " : "Aggiungi alla mappa · ") + l.title
        }
        onClick={() => enableLayer(l, !on)}
      >
        {l.status === "blocked" ? (
          <><Icon name="close" />{!compact && <span>Da revisionare</span>}</>
        ) : (
          <>
            <Icon
              name={on && compact && context === "active" ? "eye" : on ? "check" : "plus"}
            />
            {!compact && <span>{on ? "Sulla mappa" : "Aggiungi"}</span>}
          </>
        )}
      </button>
    </article>
  );
}
