import { useEffect, useRef, useState } from "react";
import { Select } from "@/ui/Select";
import { useAppStore } from "@/app/store";
import { setTwinActive, useTwinStore, type FeedState } from "./store";
import {
  ageLabel,
  distanceKm,
  formatTime,
  formatValue,
  freshness,
  FRESHNESS_LABEL,
  getJSON,
  parseMeasures,
  PCR_API,
  VARIABLES,
  VARIABLE_GROUPS,
  variableMeasures,
  type Measure,
  type Variable,
} from "./data";
import styles from "./Twin.module.css";
import { ObservedSeriesChart } from "./ObservedSeriesChart";
import { setRegionalEnabled } from "@/regional/store";

const GROUPS = VARIABLE_GROUPS;
const variableEntries = Object.entries(VARIABLES) as [
  Variable,
  (typeof VARIABLES)[Variable],
][];
export function TwinButton() {
  const active = useTwinStore((s) => s.active);
  return (
    <button
      type="button"
      className={styles.mode}
      aria-pressed={active}
      onClick={() => setTwinActive(!active)}
      title="Apri la demo del digital twin regionale"
    >
      Digital twin
    </button>
  );
}
function Freshness({ ms, now }: { ms: number; now: number }) {
  const f = freshness(ms, now);
  return (
    <span className={styles.freshness} data-status={f}>
      {FRESHNESS_LABEL[f]} · {ageLabel(ms, now)}
    </span>
  );
}
function Feed({
  feed,
  label,
  time,
  now,
}: {
  feed: FeedState;
  label: string;
  time?: number;
  now: number;
}) {
  return (
    <div className={styles.feed} aria-live="polite">
      <strong>{label}</strong>
      <span>
        {feed.loading
          ? "Verifica della fonte…"
          : feed.snapshot
            ? "Snapshot salvato · verifica la data dell’osservazione"
            : feed.receivedAt
              ? "Fonte raggiunta alle " +
                new Date(feed.receivedAt).toLocaleTimeString("it-IT")
              : "In attesa della fonte"}
      </span>
      {time !== undefined && (
        <>
          <span>Osservazione: {formatTime(time)}</span>
          <Freshness ms={time} now={now} />
        </>
      )}
      {feed.error && (
        <span className={styles.error}>
          Lettura non riuscita: {feed.error}.{" "}
          {feed.snapshot
            ? "Mostro lo snapshot."
            : "Conservo l’ultimo dato disponibile."}
        </span>
      )}
    </div>
  );
}
export function TwinPanel({
  inspectorOnly = false,
}: { inspectorOnly?: boolean } = {}) {
  const inspector = useRef<HTMLDivElement>(null);
  const s = useTwinStore(),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (s.selection)
      inspector.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [s.selection]);
  useEffect(() => {
    inspector.current?.closest("aside")?.scrollTo?.({ top: 0 });
  }, []);
  const rows = variableMeasures(s.measures, s.variable).sort((a, b) =>
    a.name.localeCompare(b.name, "it"),
  );
  const recent = rows.filter((m) => freshness(m.ms, now) === "recent").length;
  const v = VARIABLES[s.variable];
  const variableOptions = Object.entries(GROUPS).flatMap(([group, label]) =>
    variableEntries
      .filter(([, definition]) => definition.group === group)
      .map(([value, definition]) => ({
        value,
        label: definition.label + " · " + definition.unit,
        group: label,
      })),
  );
  const stationId =
    s.selection?.kind === "sensor" ? s.selection.stationId : null;
  const sensor = rows.find((x) => x.stationId === stationId);
  const otherMeasures = variableEntries.flatMap(([id, definition]) => {
    const measure = s.measures.find(
      (m) => m.stationId === stationId && m.sensorId === definition.id,
    );
    return id !== s.variable && measure ? [{ id, definition, measure }] : [];
  });
  const request = () =>
    useTwinStore.setState((state) => ({ refreshKey: state.refreshKey + 1 }));
  return (
    <section
      className={styles.panel}
      aria-label={
        inspectorOnly ? "Dettaglio osservazioni PCR" : "Digital twin regionale"
      }
    >
      {inspectorOnly ? (
        s.selection?.kind !== "building" && (
          <label className={styles.field}>
            Variabile della stazione
            <Select
              label="Variabile della stazione"
              value={s.variable}
              options={variableOptions}
              onChange={(value) =>
                useTwinStore.setState({ variable: value as Variable })
              }
            />
          </label>
        )
      ) : (
        <>
          <div className={styles.heading}>
            <h2>Città, costa e attività</h2>
            <p>Trieste–Monfalcone</p>
          </div>
          <div className={styles.section}>
            <label className={styles.field}>
              <strong>Dati sulla mappa</strong>
              <Select
                label="Dati sulla mappa · Osservazioni PCR"
                describedBy="twin-variable-description"
                value={s.variable}
                options={variableOptions}
                onChange={(value) =>
                  useTwinStore.setState({ variable: value as Variable })
                }
              />
            </label>
            <p id="twin-variable-description" className={styles.caption}>
              {v.description}
            </p>
            <div
              className={styles.measureSummary}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {rows.length ? (
                <>
                  <strong>{rows.length} stazioni in regione</strong>
                  <span>{recent} con misura negli ultimi 45 minuti</span>
                </>
              ) : (
                <span>
                  {s.sensorsFeed.loading
                    ? "Lettura delle stazioni…"
                    : "Nessuna misura disponibile per questa variabile. Scegli un altro dato o aggiorna la fonte."}
                </span>
              )}
            </div>
            {s.sensorsFeed.snapshot && (
              <p className={styles.caption}>
                Snapshot salvato · la fonte corrente non è disponibile.
              </p>
            )}
            {s.sensorsFeed.error && !s.sensorsFeed.snapshot && (
              <p className={styles.error}>
                Fonte non raggiunta:{" "}
                {s.measures.length
                  ? "conservo le ultime misure"
                  : "nessuna misura ricevuta"}
                .
              </p>
            )}
            {v.comparable && (
              <div
                className={styles.legend}
                aria-label={`Scala di ${v.label}, in ${v.unit}`}
              >
                <div
                  className={styles.colorScale}
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(90deg, ${v.colors.join(", ")})`,
                  }}
                />
                <div className={styles.scaleLabels}>
                  {[v.min, (v.min + v.max) / 2, v.max].map((n) => (
                    <span key={n}>
                      {n === v.min ? "≤ " : n === v.max ? "≥ " : ""}
                      {formatValue(n)} {v.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className={styles.caption}>
              {v.comparable
                ? "Colore e dimensione: valore. Grigio: orario non recente o non valido. Alone: selezione. Nessuna soglia di pericolo."
                : "Cerchi uniformi, senza scala comune. Alone: punto selezionato; verifica l’orario nel dettaglio."}
            </p>
            <button
              type="button"
              className={styles.action}
              disabled={!rows.length}
              onClick={() => {
                window.dispatchEvent(new CustomEvent("fvg:twin-fit"));
                if (
                  window.matchMedia(
                    "(max-width: 768px), (max-height: 500px) and (pointer: coarse)",
                  ).matches
                )
                  useAppStore.setState({ drawerOpen: false });
              }}
            >
              Inquadra stazioni
            </button>

            <div
              className={styles.scenes}
              role="group"
              aria-label="Inquadra la demo"
            >
              {(
                [
                  ["coast", "Costa"],
                  ["trieste", "Trieste"],
                  ["monfalcone", "Monfalcone"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("fvg:twin-scene", { detail: id }),
                    );
                    if (
                      window.matchMedia(
                        "(max-width: 768px), (max-height: 500px) and (pointer: coarse)",
                      ).matches
                    )
                      useAppStore.setState({ drawerOpen: false });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className={styles.layerToggles}
              role="group"
              aria-label="Livelli aggiuntivi"
            >
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.radarOn}
                  onChange={(e) =>
                    useTwinStore.setState({ radarOn: e.target.checked })
                  }
                />
                Radar precipitazioni SRI · mm/h
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.assetsOn}
                  onChange={(e) =>
                    useTwinStore.setState({ assetsOn: e.target.checked })
                  }
                />
                <i className={styles.assetDot} />
                Stabilimenti AIA
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.buildingsOn}
                  onChange={(e) =>
                    useTwinStore.setState({ buildingsOn: e.target.checked })
                  }
                />
                Edifici 2,5D · estratti urbani
              </label>
            </div>
            <p className={styles.caption}>
              Edifici visibili da zoom 12. Usa Trieste o Monfalcone per
              esplorare l’estratto.
            </p>
            {s.assetsError && (
              <p className={styles.error}>
                Stabilimenti non disponibili: {s.assetsError}
              </p>
            )}
            {s.buildingsError && (
              <p className={styles.error}>
                Edifici non disponibili: {s.buildingsError}
              </p>
            )}
          </div>
        </>
      )}
      <div ref={inspector} className={styles.section}>
        <div className={styles.inspectorHeading}>
          <h3>
            {s.selection ? "Dettaglio selezionato" : "Esplora un oggetto"}
          </h3>
          {s.selection && (
            <button
              type="button"
              className={styles.clearSelection}
              aria-label="Chiudi il dettaglio selezionato"
              onClick={() => useTwinStore.setState({ selection: null })}
            >
              Chiudi
            </button>
          )}
        </div>
        <p className={styles.caption}>
          Tocca un sensore, uno stabilimento o un edificio sulla mappa.
        </p>
        {s.selection?.kind !== "building" && (
          <label className={styles.field}>
            Stazione
            <Select
              label="Stazione"
              value={stationId === null ? "" : String(stationId)}
              onChange={(value) =>
                useTwinStore.setState({
                  selection: value
                    ? { kind: "sensor", stationId: Number(value) }
                    : null,
                })
              }
              options={[
                {
                  value: "",
                  label: rows.length
                    ? "Seleziona una stazione"
                    : "Nessuna stazione disponibile",
                },
                ...(stationId !== null && !sensor
                  ? [
                      {
                        value: String(stationId),
                        label:
                          (s.measures.find((m) => m.stationId === stationId)
                            ?.name ?? `Stazione ${stationId}`) +
                          " · dato assente",
                      },
                    ]
                  : []),
                ...rows.map((m) => ({
                  value: String(m.stationId),
                  label: m.name + " · " + formatValue(m.value) + " " + v.unit,
                })),
              ]}
            />
          </label>
        )}
        {sensor && (
          <div
            className={styles.observation}
            key={`${sensor.stationId}:${s.variable}:${sensor.time}`}
          >
            <h3>{sensor.name}</h3>
            <p className={styles.caption}>{v.label}</p>
            <div className={styles.value}>
              {formatValue(sensor.value)} <span>{v.unit}</span>
            </div>
            <p className={styles.caption}>{formatTime(sensor.ms)}</p>
            <Freshness ms={sensor.ms} now={now} />
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                setRegionalEnabled("pcr-" + s.variable, true);
                window.dispatchEvent(
                  new CustomEvent("fvg:twin-station", {
                    detail: sensor.stationId,
                  }),
                );
                if (
                  window.matchMedia(
                    "(max-width: 768px), (max-height: 500px) and (pointer: coarse)",
                  ).matches
                )
                  useAppStore.setState({ drawerOpen: false });
              }}
            >
              Mostra sulla mappa
            </button>
            <Series measure={sensor} />
          </div>
        )}
        {s.selection?.kind === "sensor" && !sensor && (
          <p className={styles.caption}>
            Questa stazione non ha una misura della variabile selezionata nella
            risposta disponibile.
          </p>
        )}
        {stationId !== null && (
          <details className={styles.stationMeasures}>
            <summary>Altre misure della stazione</summary>
            <div className={styles.nearby}>
              {otherMeasures.map(({ id, definition, measure }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => useTwinStore.setState({ variable: id })}
                >
                  <strong>{definition.label}</strong>
                  <span>
                    {formatValue(measure.value)} {definition.unit}
                  </span>
                  <Freshness ms={measure.ms} now={now} />
                </button>
              ))}
              {!otherMeasures.length && (
                <p className={styles.caption}>
                  Nessun’altra variabile disponibile nella risposta della fonte.
                </p>
              )}
            </div>
          </details>
        )}
        {s.selection?.kind === "asset" && (
          <>
            <h3>{s.selection.name}</h3>
            <dl className={styles.details}>
              {[
                ["Comune", s.selection.properties.comune],
                ["Stato amministrativo", s.selection.properties.stato],
                ["Codice AIA", s.selection.properties.codice_regionale_aia],
                ["Attività AIA", s.selection.properties.attivita_aia],
              ].map(([k, value]) => (
                <div key={String(k)}>
                  <dt>{String(k)}</dt>
                  <dd>{String(value || "Non indicato")}</dd>
                </div>
              ))}
            </dl>
            <h3>Stazioni più vicine · {v.label.toLowerCase()}</h3>
            <p className={styles.caption}>
              Misure presso le stazioni, non nello stabilimento. Nessuna
              esposizione o impatto calcolato.
            </p>
            <div className={styles.nearby}>
              {!rows.length && (
                <p className={styles.caption}>
                  Nessuna stazione con questa variabile nella risposta
                  disponibile.
                </p>
              )}
              {rows
                .map((m) => ({
                  m,
                  km: distanceKm(
                    s.selection?.kind === "asset"
                      ? s.selection.coordinates
                      : [0, 0],
                    [m.lon, m.lat],
                  ),
                }))
                .sort((a, b) => a.km - b.km)
                .slice(0, 3)
                .map(({ m, km }) => (
                  <button
                    type="button"
                    key={m.stationId}
                    onClick={() =>
                      useTwinStore.setState({
                        selection: { kind: "sensor", stationId: m.stationId },
                      })
                    }
                  >
                    <strong>{m.name}</strong>
                    <span>
                      {formatValue(m.value)} {v.unit} · {formatValue(km)} km
                    </span>
                    <Freshness ms={m.ms} now={now} />
                  </button>
                ))}
            </div>
            <p className={styles.caption}>
              Registro autorizzativo, estratto 8/11/2026. Non prova attività o
              emissioni istantanee.
            </p>
          </>
        )}
        {s.selection?.kind === "building" && (
          <>
            <h3>Edificio · {String(s.selection.properties.city)}</h3>
            <dl className={styles.details}>
              <div>
                <dt>Identificatore</dt>
                <dd>{String(s.selection.properties.id)}</dd>
              </div>
              <div>
                <dt>Altezza</dt>
                <dd>
                  {s.selection.properties.heightKnown === true ||
                  s.selection.properties.heightKnown === "true"
                    ? formatValue(Number(s.selection.properties.height)) + " m"
                    : "Non disponibile · geometria piatta"}
                </dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{formatValue(Number(s.selection.properties.area))} m²</dd>
              </div>
            </dl>
            <p className={styles.caption}>
              Base Trueortofoto 2017–2020. Estrusione a tetto piano; non è BIM o
              rilievo attuale.
            </p>
          </>
        )}
      </div>
      <details className={styles.section}>
        <summary>Fonti e aggiornamenti</summary>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={s.autoRefresh}
            onChange={(e) =>
              useTwinStore.setState({ autoRefresh: e.target.checked })
            }
          />
          Verifica le fonti ogni minuto
        </label>
        <button
          type="button"
          className={styles.action}
          disabled={s.sensorsFeed.loading || (s.radarOn && s.radarFeed.loading)}
          onClick={request}
        >
          {s.sensorsFeed.loading || (s.radarOn && s.radarFeed.loading)
            ? "Verifica delle fonti…"
            : "Aggiorna adesso"}
        </button>
        <Feed label="Sensori PCR" feed={s.sensorsFeed} now={now} />
        <p className={styles.caption}>
          Le misure hanno orari individuali e frequenze diverse per sensore. La
          verifica ogni minuto non aumenta la frequenza delle osservazioni.
        </p>
        {s.radarOn && (
          <>
            <Feed
              label="Radar PCR · Fossalon SRI"
              feed={s.radarFeed}
              now={now}
              {...(s.radar ? { time: s.radar.ms } : {})}
            />
            <p className={styles.caption}>
              Intensità della precipitazione in mm/h. Poco colore può indicare
              assenza di precipitazione; copertura e dato mancante restano
              distinti nella legenda della fonte. Il polling non aumenta la
              frequenza del prodotto.
            </p>
            <a
              href="https://monitor.protezionecivile.fvg.it/"
              target="_blank"
              rel="noreferrer"
            >
              Radar e legenda ufficiale PCR ↗
            </a>
          </>
        )}
      </details>
      {!inspectorOnly && (
        <details className={styles.section}>
          <summary>Fonti, copertura e limiti</summary>
          <p className={styles.caption}>
            Fonte: Protezione Civile della Regione Friuli Venezia Giulia ·{" "}
            <a
              href="https://monitor.protezionecivile.fvg.it/licenza"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
            . Le osservazioni vengono richieste direttamente alla fonte; la
            verifica si sospende nelle schede non visibili.
          </p>
          <p className={styles.caption}>
            Fonte asset: Regione FVG / IRDAT, edificato DBS e autorizzazioni
            AIA. Estratti acquisiti l’8/11/2026. Base edifici 2017–2020: 3.303
            geometrie a Trieste e 4.849 a Monfalcone. 1.284 geometrie senza
            altezza utilizzabile restano piatte. IODL 2.0 secondo condizioni
            IRDAT e metadati delle risorse.
          </p>
          <p className={styles.caption}>
            Nessun consumo energetico, conteggio del traffico o emissione
            industriale istantanea viene dedotto da queste anagrafiche.
          </p>
          <a
            href={`${import.meta.env.BASE_URL}data/twin/sources.json`}
            target="_blank"
            rel="noreferrer"
          >
            Provenienza degli estratti ↗
          </a>
        </details>
      )}
    </section>
  );
}
export function Series({
  measure,
  unitOverride,
}: {
  measure: Measure;
  unitOverride?: string;
}) {
  const refreshKey = useTwinStore((s) => s.refreshKey);
  const [state, setState] = useState<{
    key: string;
    rows: Measure[];
    error: string | null;
    loading: boolean;
  }>({ key: "", rows: [], error: null, loading: true });
  const key = `${measure.stationId}:${measure.sensorId}:${measure.time}:${refreshKey}`;
  useEffect(() => {
    const ac = new AbortController();
    const end = new Date(),
      start = new Date(end.getTime() - 24 * 3600000),
      stamp = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    const query = new URLSearchParams({
      from: stamp(start),
      to: stamp(end),
      last: "1000",
    });
    void getJSON(
      `${PCR_API}/stations/${measure.stationId}/sensors/${measure.sensorId}/measures?${query}`,
      ac.signal,
    )
      .then((raw) => {
        const rows = parseMeasures(raw, false)
          .filter(
            (m) =>
              m.stationId === measure.stationId &&
              m.sensorId === measure.sensorId &&
              m.ms >= start.getTime() &&
              m.ms <= end.getTime(),
          )
          .sort((a, b) => a.ms - b.ms);
        if (!ac.signal.aborted)
          setState({ key, rows, error: null, loading: false });
      })
      .catch((e) => {
        if (!ac.signal.aborted)
          setState({
            key,
            rows: [],
            error: e instanceof Error ? e.message : "Serie non disponibile",
            loading: false,
          });
      });
    return () => ac.abort();
  }, [key, measure.stationId, measure.sensorId]);
  if (state.key !== key || state.loading)
    return (
      <p className={styles.caption}>Lettura della serie delle ultime 24 ore…</p>
    );
  if (state.error)
    return (
      <p className={styles.caption}>Serie non disponibile: {state.error}</p>
    );
  if (state.rows.length < 2)
    return (
      <p className={styles.caption}>
        Meno di due osservazioni nella serie disponibile.
      </p>
    );
  const definition = variableEntries.find(
    ([, variable]) => variable.id === measure.sensorId,
  )?.[1];
  return (
    <ObservedSeriesChart
      key={key}
      rows={state.rows}
      unit={unitOverride ?? definition?.unit ?? ""}
    />
  );
}
