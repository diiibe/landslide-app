import { LandslideClassPicker } from "@/ui/LandslideClassPicker";
import { selectedClasses, withClasses, classSum, classSelectionText } from "@/lib/landslideClasses";
import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import { Icon } from "@/ui/Icon";
import { v2ClassColor } from "@/map/layers/modelV2";
import { ModelV2Panel } from "@/drawer/ModelV2Panel";
import { analyseArea } from "./analysis/client";
import type { AnalysisResult } from "./analysis/core";
import {
  AREA_PRESETS,
  drawArea,
  savedArea,
  selectArea,
  useExperienceStore,
  type AreaSelection,
} from "./store";
import styles from "./Panel.module.css";
const number = (n: number, d = 2) =>
  n !== 0 && Math.abs(n) < 10 ** -d
    ? n.toLocaleString("it-IT", {
        maximumSignificantDigits: 3,
        notation: Math.abs(n) < 1e-6 ? "scientific" : "standard",
      })
    : n.toLocaleString("it-IT", { maximumFractionDigits: d });
const km = (m: number) => number(m / 1e6, m < 1e6 ? 3 : 2);
const percent = (a: number, b: number) =>
  b ? `${number((a / b) * 100, 1)}%` : "—";
function exportArea(area: AreaSelection, result: AnalysisResult) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          name: area.name,
          geometry: area.geometry,
          generatedAt: new Date().toISOString(),
          source: "HazardFVG model v2 · original grid",
          note: "Punteggi di somiglianza, non probabilità di frana. Reti OSM semplificate 3 m e campionate per segmenti ≤60 m.",
          ...result,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `friulview-analisi-${area.id.replace(/[^a-z0-9-]/gi, "")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function preset(p: (typeof AREA_PRESETS)[number]) {
  selectArea({ id: p.id, name: p.name, geometry: p.geometry, saved: false });
  useAppStore.setState({
    cameraRequest: { center: p.center, zoom: 11, bearing: 0, pitch: 0 },
  });
}
export function FranePanel() {
  const area = useExperienceStore((s) => s.area),
    probe = useExperienceStore((s) => s.probe),
    polygons = useAppStore((s) => s.userPolygons);
  const which = useAppStore(s => s.layers.v2Diffuse ? "diffuse" : "bodies");
  const settings = useAppStore(s => s.susceptibilityStyle[which]);
  return (
    <div className={styles.panel}>
      <section className={styles.intro}>
        <span className={styles.badge}>Mappature reali · griglia 120 m</span>
        <LandslideClassPicker value={selectedClasses(settings)} onChange={classes =>
          useAppStore.setState(s => ({ susceptibilityStyle: { ...s.susceptibilityStyle, [which]: withClasses(s.susceptibilityStyle[which], classes) } }))}/>
        {!area && (
          <>
            <h2>Leggi il territorio, zona per zona.</h2>
            <p className={styles.caption}>
              Scegli un’area e confronta corpi di frana, franosità diffusa e
              contesto. L’analisi usa la griglia completa, anche fuori
              dall’inquadratura.
            </p>
          </>
        )}
        <div className={styles.actions}>
          <button className={styles.primary} onClick={drawArea}>
            <Icon name="areaData" />
            {area ? "Nuova zona" : "Disegna zona"}
          </button>
          <button
            aria-pressed={probe}
            onClick={() => {
              useExperienceStore.setState({ probe: !probe });
              if (!probe) useAppStore.setState({ drawerOpen: false });
            }}
          >
            <Icon name="pointData" />
            {probe ? "Annulla punto" : "Analizza un punto"}
          </button>
        </div>
        {probe && (
          <p role="status" className={styles.loading}>
            Tocca la mappa: verrà analizzata una zona con raggio indicativo di
            600 m.
          </p>
        )}
      </section>
      {area ? (
        <AreaInspector key={area.id} area={area} />
      ) : (
        <section className={styles.empty}>
          <Icon name="mountain" />
          <strong>Da quale zona partiamo?</strong>
          <p>
            Traccia il contorno oppure esplora una delle aree geografiche di
            esempio. I risultati sono calcolati sui dati reali.
          </p>
          <div className={styles.presetList}>
            {AREA_PRESETS.map((p) => (
              <button key={p.id} onClick={() => preset(p)}>
                <Icon name="areaData" />
                <span>
                  <strong>{p.name}</strong>
                  <small>Apri la zona e calcola le statistiche</small>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>
      )}
      <ContextLayers />
      {polygons.length > 0 && (
        <section className={styles.section}>
          <div className={styles.subhead}>
            <h3>Le tue zone</h3>
            <small>{polygons.length}</small>
          </div>
          <div className={styles.list}>
            {polygons.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  savedArea(p.id);
                  window.dispatchEvent(
                    new CustomEvent("fvg:regional-fit", { detail: p.bounds }),
                  );
                }}
              >
                <span
                  className={styles.zoneDot}
                  style={{ background: p.color }}
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {km(p.stats.areaKm2 * 1e6)} km² · ricalcola sulla mappatura
                    corrente
                  </small>
                </span>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </section>
      )}
      <details>
        <summary>Come leggere i risultati</summary>
        <p>
          Le classi sono quantili del punteggio di somiglianza con l’inventario.
          Non sono probabilità di frana né un’indicazione di pericolo imminente.
          Le aree prive di mappatura sono riportate separatamente.
        </p>
        <p>
          La superficie di ogni classe è l’intersezione della zona con le celle
          originali, calcolata in UTM 33N. Le celle di bordo contribuiscono
          soltanto per la parte interna. Media e quantili del punteggio sono
          pesati per superficie.
        </p>
        <ModelV2Panel />
      </details>
    </div>
  );
}
function ContextLayers() {
  const ls = useAppStore((s) => s.layers),
    ready = useExperienceStore((s) => s.contextReady),
    error = useExperienceStore((s) => s.contextError);
  return (
    <section className={styles.section}>
      <h3>Reti e punti di contesto</h3>
      <div className={styles.actions}>
        {(
          [
            ["roads", "Strade", "mobility"],
            ["trails", "Sentieri", "lineData"],
            ["poiCritical", "Strutture", "services"],
            ["poiHuts", "Rifugi", "mountain"],
          ] as const
        ).map(([key, title, icon]) => (
          <button
            key={key}
            aria-pressed={ls[key]}
            onClick={() => useAppStore.getState().toggleLayer(key)}
          >
            <Icon name={icon} />
            {title} {ls[key] ? "✓" : ""}
          </button>
        ))}
      </div>
      <p className={styles.caption}>
        Strade e sentieri seguono la classe della mappatura selezionata,
        campionata in segmenti di massimo 60 m. Il grigio indica assenza di
        copertura.
      </p>
      {!ready && !error && (
        <p role="status" className={styles.caption}>
          Preparazione delle reti di contesto…
        </p>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button
            onClick={() => useExperienceStore.setState({ contextError: null })}
          >
            Riprova reti
          </button>
        </div>
      )}
    </section>
  );
}
function AreaInspector({ area }: { area: AreaSelection }) {
  const which = useAppStore((s) => (s.layers.v2Diffuse ? "diffuse" : "bodies")),
    settings = useAppStore((s) => s.susceptibilityStyle[which]),
    tab = useExperienceStore((s) => s.analysisTab),
    [attempt, setAttempt] = useState(0),
    [record, setRecord] = useState<{
      key: string;
      result?: AnalysisResult;
      error?: string;
    }>({ key: "" }),
    [name, setName] = useState(area.name);
  const context = tab === "context" || !!record.result?.networks,
    key = `${area.id}:${context}:${attempt}`;
  useEffect(() => {
    let disposed = false;
    void analyseArea(area.geometry, context)
      .then((result) => {
        if (!disposed) setRecord({ key, result });
      })
      .catch((e) => {
        if (!disposed)
          setRecord((previous) => ({
            key,
            ...(previous.result ? { result: previous.result } : {}),
            error: e instanceof Error ? e.message : "Analisi non disponibile.",
          }));
      });
    return () => {
      disposed = true;
    };
  }, [area.geometry, context, key]);
  const data = record.result,
    loading = record.key !== key,
    current = data?.layers[which],
    chosen = selectedClasses(settings);
  const setClasses = (classes: number[]) =>
    useAppStore.setState((s) => ({
      susceptibilityStyle: {
        ...s.susceptibilityStyle,
        [which]: withClasses(s.susceptibilityStyle[which], classes),
      },
    }));
  const save = () => {
    const bounds = area.geometry.coordinates[0]!,
      xs = bounds.map((p) => p[0]!),
      ys = bounds.map((p) => p[1]!);
    const p = useAppStore.getState().addUserPolygon({
      name: name.trim() || area.name,
      geometry: area.geometry,
      bounds: [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ],
      color: "#4d79ae",
      stats: {
        areaKm2: (data?.areaM2 ?? 0) / 1e6,
        cellsVisible: null,
        cellsAboveThreshold: null,
        meanP: null,
        medianP: null,
        iffiCount: null,
        threshold: null,
        model: null,
        unavailableReason:
          "Statistiche aggiornate disponibili nello spazio Frane FVG.",
      },
    });
    selectArea({ id: p.id, name: p.name, geometry: p.geometry, saved: true });
  };
  return (
    <section className={styles.section} aria-label="Analisi della zona">
      <div className={styles.subhead}>
        <div>
          <small>Zona selezionata</small>
          <h2>{area.name}</h2>
        </div>
        <button
          className={styles.subtle}
          aria-label="Chiudi analisi zona"
          onClick={() => useExperienceStore.setState({ area: null })}
        >
          <Icon name="close" />
        </button>
      </div>
      <div
        className={styles.pills}
        role="group"
        aria-label="Mappatura analizzata"
      >
        {(
          [
            ["bodies", "Corpi di frana", "v2Bodies"],
            ["diffuse", "Franosità diffusa", "v2Diffuse"],
          ] as const
        ).map(([id, label, key]) => (
          <button
            key={id}
            aria-pressed={which === id}
            onClick={() => {
              if (which !== id) useAppStore.getState().toggleLayer(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && !data && (
        <div className={styles.loading} role="status">
          Caricamento dell’indice completo e calcolo delle intersezioni… La
          prima analisi può richiedere qualche secondo.
        </div>
      )}
      {record.error && (
        <div className={styles.error} role="alert">
          {record.error}
          <button onClick={() => setAttempt((v) => v + 1)}>
            Riprova analisi
          </button>
        </div>
      )}
      {data && current && (
        <>
          <div className={styles.kpis}>
            <div>
              <strong>
                {km(data.areaM2)} <small>km²</small>
              </strong>
              <span>Area selezionata</span>
            </div>
            <div>
              <strong>{percent(current.coveredM2, data.areaM2)}</strong>
              <span>Coperta dalla mappatura</span>
            </div>
            <div>
              <strong>{percent(classSum(current.classes, chosen), current.coveredM2)}</strong>
              <span>Area mappata · {classSelectionText(chosen).toLowerCase()}</span>
            </div>
            <div>
              <strong>{number(current.cells, 0)}</strong>
              <span>Celle con intersezione</span>
            </div>
          </div>
          {current.coveredM2 < data.areaM2 * 0.999 && (
            <p className={styles.caption}>
              {km(Math.max(0, data.areaM2 - current.coveredM2))} km² senza
              mappatura. Non sono inclusi nelle percentuali delle classi.
            </p>
          )}
          <div
            className={styles.pills}
            role="tablist"
            aria-label="Approfondimenti zona"
          >
            {(
              [
                ["distribution", "Distribuzione"],
                ["context", "Contesto"],
                ["compare", "Confronto"],
              ] as const
            ).map(([id, title]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => useExperienceStore.setState({ analysisTab: id })}
              >
                {title}
              </button>
            ))}
          </div>
          {tab === "distribution" && (
            <>
              <div>
                <h3>Superficie per classe</h3>
                <p className={styles.caption}>
                  Tocca una classe per mostrarla o nasconderla sulla mappa.
                </p>
              </div>
              <div className={styles.classRows}>
                {current.classes.map((a, i) => (
                  <button
                    key={i}
                    aria-label={`Classe ${i + 1} sulla mappa`}
                    aria-pressed={chosen.includes(i + 1)}
                    onClick={() => setClasses(chosen.includes(i + 1) ? chosen.filter(c => c !== i + 1) : [...chosen, i + 1])}
                  >
                    <b>{i + 1}</b>
                    <span className={styles.classTrack}>
                      <i
                        style={{
                          width: current.coveredM2
                            ? `${(a / current.coveredM2) * 100}%`
                            : "0%",
                          background: v2ClassColor(i + 1, 5),
                        }}
                      />
                    </span>
                    <span className={styles.classNumbers}>
                      {percent(a, current.coveredM2)} · {km(a)} km²
                    </span>
                  </button>
                ))}
              </div>
              <table className={styles.table}>
                <tbody>
                  {[
                    ["Punteggio medio", current.mean],
                    ["Mediana pesata", current.median],
                    ["90° percentile", current.p90],
                    ["Minimo", current.min],
                    ["Massimo", current.max],
                  ].map(([label, value]) => (
                    <tr key={String(label)}>
                      <th>{label}</th>
                      <td>{value === null ? "—" : number(Number(value), 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.caption}>
                I punteggi non sono percentuali di rischio. Le classi ordinano
                la somiglianza con l’inventario all’interno di ciascuna
                mappatura.
              </p>
            </>
          )}
          {tab === "compare" && (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Indicatore</th>
                    <th>Corpi</th>
                    <th>Diffusa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Copertura</th>
                    {(["bodies", "diffuse"] as const).map((k) => (
                      <td key={k}>
                        {percent(data.layers[k].coveredM2, data.areaM2)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>{classSelectionText(chosen)}</th>
                    {(["bodies", "diffuse"] as const).map((k) => (
                      <td key={k}>
                        {percent(
                          classSum(data.layers[k].classes, chosen),
                          data.layers[k].coveredM2,
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>Mediana</th>
                    {(["bodies", "diffuse"] as const).map((k) => (
                      <td key={k}>
                        {data.layers[k].median === null
                          ? "—"
                          : number(data.layers[k].median!, 4)}
                      </td>
                    ))}
                  </tr>
                  {[1, 2, 3, 4, 5].map((cls) => (
                    <tr key={cls}>
                      <th>Classe {cls}</th>
                      {(["bodies", "diffuse"] as const).map((k) => (
                        <td key={k}>
                          {percent(
                            data.layers[k].classes[cls - 1]!,
                            data.layers[k].coveredM2,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.caption}>
                Due mappature distinte: la stessa classe esprime un rango
                simile, non la stessa probabilità. Il confronto non somma né
                fonde i modelli.
              </p>
            </>
          )}
          {tab === "context" &&
            (data.networks ? (
              <>
                <h3>Reti che attraversano la zona</h3>
                {(["roads", "trails"] as const).map((k) => {
                  const net = data.networks![k],
                    parts = which === "bodies" ? net.bodiesKm : net.diffuseKm;
                  return (
                    <div key={k}>
                      <div className={styles.subhead}>
                        <strong>{k === "roads" ? "Strade" : "Sentieri"}</strong>
                        <span>{number(net.totalKm, 2)} km</span>
                      </div>
                      <div className={styles.networkBar}>
                        {net.totalKm > 0 &&
                          parts.map((v, i) => (
                            <span
                              key={i}
                              title={`${i === 0 ? "Senza mappatura" : `Classe ${i}`}: ${number(v)} km`}
                              style={{
                                flex: v || 0.00001,
                                background:
                                  i === 0 ? "#9ba7a0" : v2ClassColor(i, 5),
                              }}
                            />
                          ))}
                      </div>
                      <small>
                        {number(classSum(parts, chosen, 0))} km
                        nelle classi selezionate · {number(parts[0] ?? 0)} km senza
                        copertura.
                      </small>
                    </div>
                  );
                })}
                <p className={styles.caption}>
                  OpenStreetMap · geometrie semplificate di 3 m, campionamento
                  di classe sul centro di segmenti ≤60 m. Le lunghezze sono
                  tagliate sul confine della zona; non rappresentano chiusure
                  stradali.
                </p>
                <h3>Punti di contesto · {data.poi?.length ?? 0}</h3>
                {data.poi?.length ? (
                  <div className={styles.list}>
                    {data.poi.map((p, i) => (
                      <button
                        key={`${p.name}-${i}`}
                        onClick={() =>
                          useAppStore.setState({
                            cameraRequest: {
                              center: [p.coordinates[0]!, p.coordinates[1]!],
                              zoom: 15,
                              bearing: 0,
                              pitch: 0,
                            },
                          })
                        }
                      >
                        <Icon name="pointData" />
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {{
                              school: "Scuola",
                              police: "Forze dell’ordine",
                              hospital: "Struttura sanitaria",
                              fire_station: "Vigili del fuoco",
                              alpine_hut: "Rifugio alpino",
                              wilderness_hut: "Bivacco",
                            }[p.category] ?? p.category}
                          </small>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.caption}>
                    Nessun punto del dataset di contesto ricade nella zona.
                  </p>
                )}
              </>
            ) : (
              <div className={styles.loading} role="status">
                Caricamento completo di strade, sentieri e punti di contesto… I
                dati di suscettibilità restano disponibili.
              </div>
            ))}
          <div className={styles.actions}>
            <button onClick={() => exportArea(area, data)}>
              <Icon name="fileData" />
              Esporta analisi
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("fvg:regional-fit", {
                    detail: [
                      [
                        Math.min(
                          ...area.geometry.coordinates[0]!.map((p) => p[0]!),
                        ),
                        Math.min(
                          ...area.geometry.coordinates[0]!.map((p) => p[1]!),
                        ),
                      ],
                      [
                        Math.max(
                          ...area.geometry.coordinates[0]!.map((p) => p[0]!),
                        ),
                        Math.max(
                          ...area.geometry.coordinates[0]!.map((p) => p[1]!),
                        ),
                      ],
                    ],
                  }),
                )
              }
            >
              <Icon name="map" />
              Inquadra zona
            </button>
          </div>
          {!area.saved && (
            <div className={styles.field}>
              <label htmlFor="zone-name">Conserva questa zona</label>
              <input
                id="zone-name"
                type="text"
                value={name}
                maxLength={70}
                onChange={(e) => setName(e.target.value)}
              />
              <button onClick={save} disabled={!name.trim()}>
                <Icon name="plus" />
                Salva zona
              </button>
            </div>
          )}
          <small>
            Indice {data.version} · calcolo sull’intera zona, indipendente dallo
            zoom.
          </small>
        </>
      )}
    </section>
  );
}
