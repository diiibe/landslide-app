import { Icon } from "@/ui/Icon";
import { SearchField } from "@/ui/SearchField";
import { Select } from "@/ui/Select";
import { FileExplorer } from "./FileExplorer";
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
    [limit, setLimit] = useState(40);
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
    <div className={styles.explorer} data-mode={mode}>
      {mode === "catalog" && (
        <SearchField
          label="Cerca nel catalogo"
          placeholder="Cerca dati, sensori e fonti…"
          value={filters.query}
          onChange={(value) => set("query", value)}
        />
      )}
      <div className={styles.filters}>
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
    >
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
            {itemType(item)} · {displayProvider(l)}
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
            <Icon
              name={
                on
                  ? compact && context === "active"
                    ? "close"
                    : "check"
                  : "plus"
              }
            />
            {!compact && (on ? "Sulla mappa" : "Aggiungi")}
          </>
        )}
      </button>
    </article>
  );
}
