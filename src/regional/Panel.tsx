import { useUIText } from "@/ui/interfaceSettings";
import { QuickLayers } from "./QuickLayers";
import { Icon } from "@/ui/Icon";
import { Select } from "@/ui/Select";
import { SearchField } from "@/ui/SearchField";
import { useEffect, useRef, type CSSProperties } from "react";
import { useAppStore } from "@/app/store";
import { TwinPanel, Series } from "@/digital-twin/Panel";
import { useTwinStore } from "@/digital-twin/store";
import {
  ageLabel,
  formatTime,
  formatValue,
  variableMeasures,
} from "@/digital-twin/data";
import { enableLayer, isLayerEnabled } from "./builtins";
import { setRegionalOpacity, setRegionalDisplay, useRegionalStore } from "./store";
import { metricRange, defaultOpacity } from "./data";
import { presentation, type DisplayMode } from "./presentation";
import type { LayerDefinition } from "./types";
import { CatalogExplorer, CatalogRow } from "./CatalogBrowser";
import { catalogItems } from "./catalog";
import { MapLayerControls } from "./MapLayerControls";
import styles from "./Panel.module.css";
function date(value?: string) {
  if (!value) return "Non indicata dalla fonte";
  const ms = Date.parse(value);
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })
    : value;
}
function closeOnMobile() {
  if (
    window.matchMedia(
      "(max-width: 768px), (max-height: 500px) and (pointer: coarse)",
    ).matches
  )
    useAppStore.setState({ drawerOpen: false });
}
export function RegionalPanel() {
  const explore = useUIText("explore");
  const state = useRegionalStore(),
    twin = useTwinStore(),
    app = useAppStore(),
    ref = useRef<HTMLDivElement>(null);
  const items = catalogItems(state.catalog?.layers ?? []);
  const active = items.filter((i) => isLayerEnabled(i.layer));
  const selected = twin.selection
    ? items.find(
        (i) =>
          i.layer.id ===
          (twin.selection?.kind === "sensor"
            ? "pcr-" + twin.variable
            : twin.selection?.kind === "asset"
              ? "twin-aia"
              : "twin-buildings"),
      )
    : items.find(
        (i) => i.layer.id === (state.selection?.layerId ?? state.detailId),
      );
  const selectedId = selected?.layer.id;
  useEffect(() => {
    if (selectedId) ref.current?.scrollIntoView?.({ block: "start" });
  }, [selectedId, state.selection, twin.selection]);
  const close = () => {
    useRegionalStore.setState({ detailId: null, selection: null });
    useTwinStore.setState({ selection: null });
  };
  return (
    <div className={styles.panel}>
      <div className={styles.panelSearch}>
        <SearchField
          label="Cerca nei livelli"
          value={state.query}
          onChange={(query) => useRegionalStore.setState({ query })}
        />
      </div>
      <section className={styles.activeSection} aria-label="Livelli attivi">
        <div className={styles.sectionHead}>
          <h2>
            Livelli attivi <span>{active.length}</span>
          </h2>
          <button
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              useRegionalStore.setState({ catalogOpen: true });
            }}
          >
            <Icon name="plus" />
            Aggiungi dati
          </button>
        </div>
        {!active.length && (
          <p className={styles.emptyMap}>
            La mappa è libera. Cerca un dato nel catalogo e aggiungilo per
            confrontarlo con il territorio.
          </p>
        )}
        {active.map((item) => (
          <div key={item.layer.id}>
            <CatalogRow item={item} compact />
            {!item.mapKey && !item.userId && (
              <p className={styles.sourceState} data-state={rowSourceState(item.layer)}>
                {rowSourceState(item.layer) === "snapshot" && item.layer.kind !== "radar" && "Copia salvata · "}
                {rowStatus(item.layer)}
              </p>
            )}
          </div>
        ))}
      </section>
      {selected && (
        <section
          ref={ref}
          className={styles.detail}
          aria-label="Dettaglio livello"
        >
          <div className={styles.detailHead}>
            <h2>{selected.layer.title}</h2>
            <button
              onClick={close}
              aria-label="Chiudi dettaglio"
              title="Chiudi dettaglio"
            >
              <Icon name="close" />
            </button>
          </div>
          {selected.mapKey || selected.userId ? (
            <>
              <label className={styles.checks}>
                <input
                  type="checkbox"
                  checked={isLayerEnabled(selected.layer)}
                  onChange={(e) =>
                    enableLayer(selected.layer, e.target.checked)
                  }
                />
                Mostra questo livello
              </label>
              <MapLayerControls item={selected} />
            </>
          ) : (
            <>
              {(selected.layer.kind === "pcr" ||
                selected.layer.kind === "aia" ||
                selected.layer.kind === "buildings") &&
                (twin.selection || selected.layer.pcrVariable) && (
                  <TwinPanel inspectorOnly />
                )}
              <LayerInfo layer={selected.layer} />
            </>
          )}
        </section>
      )}
      <QuickLayers />
      <section className={styles.browseSection} aria-label="Esplora i livelli">
        <h2>{explore}</h2>
        <CatalogExplorer mode="sidebar" />
      </section>
      {!!app.userPolygons.length && (
        <details>
          <summary>Aree salvate · {app.userPolygons.length}</summary>
          {app.userPolygons.map((p) => (
            <div className={styles.actions} key={p.id}>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("fvg:fitbounds", {
                      detail: { bounds: p.bounds, padding: 64 },
                    }),
                  )
                }
              >
                {p.name}
              </button>
              <button
                aria-label={"Elimina area · " + p.name}
                onClick={() => app.removeUserPolygon(p.id)}
              >
                Elimina
              </button>
            </div>
          ))}
        </details>
      )}
      <details className={styles.review}>
        <summary>Fonti e aggiornamenti</summary>
        <p className={styles.caption}>
          Sensori: verifica ogni minuto durante la consultazione. Cataloghi e
          cartografie: sincronizzazione ogni {state.catalog?.refreshHours ?? 6}{" "}
          ore, rispettando la cadenza della fonte. Ogni scheda riporta data di
          osservazione ed eventuali errori.
        </p>
        <button
          onClick={() => {
            useRegionalStore.setState((s) => ({
              refreshKey: s.refreshKey + 1,
            }));
            useTwinStore.setState((s) => ({ refreshKey: s.refreshKey + 1 }));
          }}
        >
          Verifica adesso
        </button>
      </details>
    </div>
  );
}
function rowSourceState(l: LayerDefinition) {
  const entry = useRegionalStore.getState().entries[l.id];
  const twin = useTwinStore.getState();
  const feed = l.kind === "radar" ? twin.radarFeed : l.pcrVariable ? twin.sensorsFeed : null;
  if (l.status !== "ready" || entry?.error || l.refreshError || feed?.error) return "attention";
  return entry?.snapshot || feed?.snapshot ? "snapshot" : "neutral";
}
function rowStatus(l: LayerDefinition) {
  if (l.status !== "ready") return "Da revisionare";
  const e = useRegionalStore.getState().entries[l.id];
  if (l.kind === "radar") {
    const s = useTwinStore.getState();
    return s.radarFeed.error
      ? "Errore fonte · apri Info"
      : s.radarFeed.snapshot
        ? "Snapshot salvato · apri Info"
        : s.radar
          ? "Radar · " + ageLabel(s.radar.ms)
          : "In attesa del prodotto radar";
  }
  if (l.pcrVariable) {
    const s = useTwinStore.getState(),
      rows = variableMeasures(s.measures, l.pcrVariable);
    const latest = Math.max(0, ...rows.map((m) => m.ms));
    return `${rows.length} stazioni${latest ? " · " + ageLabel(latest) : s.sensorsFeed.loading ? " · lettura fonte…" : ""}${s.sensorsFeed.error ? " · fonte non raggiunta" : ""}`;
  }
  if (e?.loading) return "Caricamento…";
  if (e?.error) return "Errore fonte · apri Info";
  if (l.liveKind === "pcr" && e?.data)
    return e.data.features.length + " stazioni con osservazioni";
  if ((l.live || l.pollUrl) && e?.data) {
    const times = e.data.features
      .map((f) => Date.parse(String(f.properties?.__observedAt)))
      .filter(Number.isFinite);
    return (
      e.data.features.length +
      " punti osservati" +
      (times.length ? " · " + ageLabel(Math.max(...times)) : "")
    );
  }
  if (l.refreshError) return "Ultimo aggiornamento fallito · dato conservato";
  return [
    l.count !== undefined
      ? l.count.toLocaleString("it-IT") + " elementi"
      : l.live
        ? "Osservazioni OGS"
        : null,
    l.dataDate ? "Dato: " + date(l.dataDate) : l.cadence,
  ]
    .filter(Boolean)
    .join(" · ");
}
function LayerInfo({ layer: l }: { layer: LayerDefinition }) {
  const radar = useTwinStore((s) => s.radar),
    radarFeed = useTwinStore((s) => s.radarFeed);
  const s = useRegionalStore(),
    selection = s.selection?.layerId === l.id ? s.selection : null,
    entry = s.entries[l.id];
  const selected =
    selection &&
    (entry?.data?.features.find(
      (f) =>
        f.properties?.__featureId === selection.feature.properties?.__featureId,
    ) ??
      selection.feature);
  const p = selected?.properties;
  const point =
    selected?.geometry.type === "Point" ? selected.geometry.coordinates : null;
  const coincident = point
    ? [
        ...new Map(
          entry?.data?.features
            .filter(
              (f) =>
                f.geometry.type === "Point" &&
                f.geometry.coordinates[0] === point[0] &&
                f.geometry.coordinates[1] === point[1],
            )
            .map((f) => [f.properties?.__featureId, f]) ?? [],
        ).values(),
      ]
    : [];
  const oldSelection = !!(
    selection &&
    entry?.data &&
    !entry.data.features.some(
      (f) =>
        f.properties?.__featureId === selection.feature.properties?.__featureId,
    )
  );
  const view = presentation(l);
  const range = !view.local && view.type !== "direction" ? metricRange(l, entry?.data) : null,
    depths = entry?.data
      ? [
          ...new Set(
            entry.data.features
              .map((f) => f.properties?.__depth)
              .filter((v) => v !== undefined && v !== "" && v !== null)
              .map(String),
          ),
        ].sort((a, b) => Number(a) - Number(b))
      : [];
  const fit = () => {
    if (l.pcrVariable) {
      useTwinStore.setState({ variable: l.pcrVariable });
      window.dispatchEvent(new CustomEvent("fvg:twin-fit"));
    } else if (l.bounds)
      window.dispatchEvent(
        new CustomEvent("fvg:regional-fit", { detail: l.bounds }),
      );
    closeOnMobile();
  };
  return (
    <>
      {l.kind === "radar" && (
        <>
          <p className={styles.caption}>
            {radar
              ? "Ora del prodotto: " + formatTime(radar.ms)
              : "Nessuna immagine radar disponibile."}
          </p>
          {radarFeed.loading && <p role="status">Verifica del radar…</p>}
          {radarFeed.error && (
            <p className={styles.error}>
              Fonte non raggiunta: {radarFeed.error}. L’eventuale immagine
              conservata mantiene la propria data.
            </p>
          )}
          {radarFeed.snapshot && (
            <p className={styles.caption}>
              Snapshot salvato; non è una conferma del radar corrente.
            </p>
          )}
        </>
      )}
      {oldSelection && (
        <p className={styles.caption}>
          Questo dettaglio appartiene alla versione precedente dei dati.
          Seleziona di nuovo un elemento sulla mappa per leggere la versione
          aggiornata.
        </p>
      )}
      {coincident.length > 1 && (
        <label className={styles.field}>
          Elementi nello stesso punto
          <Select
            label="Elementi nello stesso punto"
            value={String(p?.__featureId ?? "")}
            onChange={(value) => {
              const feature = coincident.find(
                (f) => String(f.properties?.__featureId) === value,
              );
              if (feature)
                useRegionalStore.setState({
                  selection: { layerId: l.id, feature },
                });
            }}
            options={coincident.map((f, i) => ({
              value: String(f.properties?.__featureId),
              label:
                `${i + 1}. ${String(f.properties?.__name ?? "Elemento")}` +
                (f.properties?.__depth
                  ? " · " + String(f.properties.__depth) + " m"
                  : "") +
                (f.properties?.__displayValue !== undefined
                  ? " · " +
                    String(f.properties.__displayValue) +
                    " " +
                    String(f.properties.__unit ?? "")
                  : ""),
            }))}
          />
        </label>
      )}
      {p && (
        <>
          <h3>{String(p.__name ?? "Elemento selezionato")}</h3>
          {(p.__displayValue !== undefined || p.__value !== undefined) && (
            <div className={styles.value}>
              {typeof p.__value === "number" && !p.__censored
                ? formatValue(p.__value)
                : String(p.__displayValue ?? "")}{" "}
              <span>{String(p.__unit ?? l.metric?.unit ?? "")}</span>
            </div>
          )}
          {p.__observedAt && (
            <p className={styles.caption}>
              Osservazione:{" "}
              {l.live || l.pollUrl || l.liveKind === "pcr"
                ? formatTime(Date.parse(String(p.__observedAt)))
                : date(String(p.__observedAt))}
            </p>
          )}
          {p.__depth !== undefined && p.__depth !== "" && (
            <p>Profondità nella fonte: {String(p.__depth)} m</p>
          )}
          {p.qualita && (
            <p className={styles.caption}>
              Qualità: {String(p.qualita)} · QC {String(p.qualita_qc)}
            </p>
          )}
          {p.__censored && (
            <p className={styles.caption}>
              Limite analitico: il valore censurato non è stato convertito in
              una concentrazione misurata.
            </p>
          )}
        </>
      )}
      {l.liveKind === "pcr" &&
        p &&
        typeof p.stationId === "number" &&
        typeof p.sensorId === "number" &&
        typeof p.__value === "number" && (
          <Series
            measure={{
              stationId: p.stationId,
              sensorId: p.sensorId,
              name: String(p.__name),
              lon: point?.[0] ?? 0,
              lat: point?.[1] ?? 0,
              value: p.__value,
              time: String(p.__observedAt),
              ms: Date.parse(String(p.__observedAt)),
            }}
            unitOverride={l.metric?.unit ?? ""}
          />
        )}
      <div className={styles.representation}>
        <strong>{view.title}</strong>
        <p>{view.description}</p>
        {l.overview && <p>Panoramica: {l.overview.count.toLocaleString("it-IT")} {l.overview.kind === "areas" ? "piccole aree" : "record"}. {l.overview.resolutionKm === 0 ? "I riferimenti indicano posizioni interne ai perimetri, non la loro estensione." : `I gruppi sono riferimenti di navigazione raggruppati su celle di circa ${l.overview.resolutionKm ?? 7} km; non indicano posizioni esatte.`}</p>}
        {(view.density && l.kind === "geojson" || l.overview) && <label className={styles.field}>Rappresentazione
          <Select label="Rappresentazione sulla mappa" value={s.display[l.id] ?? "auto"} onChange={(value) => setRegionalDisplay(l.id, value as DisplayMode)} options={[
            { value: "auto", label: l.kind === "buildings" ? "Panoramica → edifici" : l.overview?.kind === "areas" ? "Riferimenti → perimetri" : "Gruppi → singoli elementi" },
            { value: "points", label: l.kind === "buildings" ? "Solo edifici al dettaglio" : l.overview?.kind === "areas" ? "Solo perimetri" : "Singoli elementi" },
            ...(view.density ? [{ value: "density", label: "Densità dei record censiti" }] : []),
          ]} />
        </label>}
        {s.display[l.id] === "density" && <p>Densità relativa: indica dove si concentrano i record del censimento. Non rappresenta un’intensità misurata, una copertura completa o un livello di rischio.</p>}
      </div>
      <p>{l.description}</p>
      <p className={styles.caption}>{l.note}</p>
      {l.status === "blocked" ? (
        <p className={styles.error}>{l.problem}</p>
      ) : (
        <>
          <label className={styles.checks}>
            <input
              type="checkbox"
              checked={isLayerEnabled(l)}
              onChange={(e) => enableLayer(l, e.target.checked)}
            />
            Mostra questo livello
          </label>
          <label className={styles.field}>
            Opacità · {Math.round((s.opacity[l.id] ?? defaultOpacity(l)) * 100)}
            %
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={s.opacity[l.id] ?? defaultOpacity(l)}
              onChange={(e) => setRegionalOpacity(l.id, Number(e.target.value))}
            />
          </label>
        </>
      )}
      {range && (
        <div
          className={styles.scale}
          style={{ "--layer-low": view.colors[0], "--layer-color": view.colors[1], "--layer-high": view.colors[2], "--layer-midpoint": !l.pcrVariable && range[0] < 0 && range[1] > 0 ? `${-range[0] / (range[1] - range[0]) * 100}%` : "50%" } as CSSProperties}
        >
          <span>{formatValue(range[0])}</span>
          <i aria-hidden="true" />
          <span>
            {formatValue(range[1])} {l.metric?.unit}
          </span>
        </div>
      )}
      {depths.length > 1 && (
        <label className={styles.field}>
          Profondità nella fonte
          <Select
            label="Profondità nella fonte"
            value={s.filters[l.id] ?? ""}
            onChange={(value) =>
              useRegionalStore.setState((st) => ({
                filters: { ...st.filters, [l.id]: value },
              }))
            }
            options={[
              { value: "", label: "Tutte le profondità" },
              ...depths.map((d) => ({
                value: d,
                label:
                  (Number.isFinite(Number(d)) ? formatValue(Number(d)) : d) +
                  " m",
              })),
            ]}
          />
        </label>
      )}
      {(l.bounds || l.pcrVariable) && (
        <button onClick={fit}>Inquadra il livello</button>
      )}
      {entry?.loading && (
        <p role="status" className={styles.caption}>
          Lettura dei dati…
        </p>
      )}
      {(entry?.error || l.refreshError) && (
        <p className={styles.error}>
          Aggiornamento non riuscito: {entry?.error ?? l.refreshError}.{" "}
          {entry?.data ? "Conservo i dati disponibili con la loro data." : ""}
        </p>
      )}
      {entry?.snapshot && (l.live || l.pollUrl) && (
        <p className={styles.caption}>
          Snapshot salvato; la fonte corrente non è disponibile.
        </p>
      )}
      <details>
        <summary>Fonte, date e copertura</summary>
        <dl className={styles.metadata}>
          <div>
            <dt>Fonte</dt>
            <dd>
              {l.provider} ·{" "}
              <a href={l.sourceUrl} target="_blank" rel="noreferrer">
                {l.sourceId}
              </a>
            </dd>
          </div>
          <div>
            <dt>Aggiornamento</dt>
            <dd>{l.cadence}</dd>
          </div>
          <div>
            <dt>Acquisizione dei dati salvati</dt>
            <dd>
              {l.retrievedAt
                ? formatTime(Date.parse(l.retrievedAt))
                : "Vedi fonte e provenienza del livello"}
            </dd>
          </div>
          {l.dataDate && (
            <div>
              <dt>Data del dato</dt>
              <dd>{date(l.dataDate)}</dd>
            </div>
          )}
          <div>
            <dt>Licenza</dt>
            <dd>
              <a href={l.licenseUrl} target="_blank" rel="noreferrer">
                {l.license}
              </a>
            </dd>
          </div>
          {l.count !== undefined && (
            <div>
              <dt>Copertura</dt>
              <dd>
                {l.count.toLocaleString("it-IT")} geometrie visualizzabili
                {l.sourceCount !== undefined
                  ? " · " +
                    l.sourceCount.toLocaleString("it-IT") +
                    " righe della fonte nella finestra acquisita"
                  : ""}
              </dd>
            </div>
          )}
        </dl>
        {l.warnings?.map((w) => (
          <p key={w} className={styles.caption}>
            {w}
          </p>
        ))}
      </details>
      {p && (
        <details>
          <summary>Attributi della fonte</summary>
          <dl className={styles.metadata}>
            {Object.entries(p)
              .filter(([k, v]) => !k.startsWith("__") && v !== null && v !== "")
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </>
  );
}
