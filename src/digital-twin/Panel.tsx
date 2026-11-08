import { useEffect, useRef, useState } from "react";
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
  variableMeasures,
  type Measure,
  type Variable,
} from "./data";
import styles from "./Twin.module.css";
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
            ? "Snapshot salvato · 8/11/2026"
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
export function TwinPanel() {
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
  const stationId =
    s.selection?.kind === "sensor" ? s.selection.stationId : null;
  const sensor = rows.find((x) => x.stationId === stationId);
  const request = () =>
    useTwinStore.setState((state) => ({ refreshKey: state.refreshKey + 1 }));
  return (
    <section className={styles.panel} aria-label="Digital twin regionale">
      <div className={styles.heading}>
        <h2>Città, costa e attività</h2>
        <p>Trieste–Monfalcone</p>
      </div>
      <div className={styles.section}>
        <fieldset className={styles.mobileVariables}>
          <legend>Dati sulla mappa</legend>
          <div>
            {Object.entries(VARIABLES).map(([id, variable]) => (
              <button
                key={id}
                type="button"
                aria-pressed={s.variable === id}
                title={variable.label}
                onClick={() => useTwinStore.setState({ variable: id as Variable })}
              >
                {variable.shortLabel}
              </button>
            ))}
          </div>
        </fieldset>
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
                if (window.matchMedia("(max-width: 768px), (max-height: 500px) and (pointer: coarse)").matches)
                  useAppStore.setState({ drawerOpen: false });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className={`${styles.field} ${styles.desktopVariable}`}>
          Osservazioni PCR
          <select
            aria-label="Osservazioni PCR"
            value={s.variable}
            onChange={(e) =>
              useTwinStore.setState({ variable: e.target.value as Variable })
            }
          >
            {Object.entries(VARIABLES).map(([id, v]) => (
              <option key={id} value={id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.layerToggles} role="group" aria-label="Livelli aggiuntivi">
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
          {rows.length} stazioni per questa variabile in regione · {recent} con
          misura negli ultimi 45 minuti.
        </p>
        <div className={styles.legend}>
          {[v.min, (v.min + v.max) / 2, v.max].map((n, i) => (
            <span key={n}>
              <i style={{ background: v.colors[i] }} />
              {n}
              {i === 2 ? "+" : ""} {v.unit}
            </span>
          ))}
        </div>
        <p className={styles.caption}>
          Grigio: misura precedente o ora da verificare. Colori del valore,
          senza soglie di pericolo.
        </p>
        {s.variable === "wind" && (
          <p className={styles.caption}>
            Frecce verso cui soffia il vento misurato alla stazione. Non
            rappresentano una simulazione di dispersione.
          </p>
        )}
        {s.variable === "sea" && (
          <p className={styles.caption}>
            Riferimento IGM42 dichiarato dalla fonte; qualità del singolo valore
            da verificare. Non è una quota di allagamento.
          </p>
        )}
        <p className={styles.caption}>
          Edifici visibili da zoom 12. Usa Trieste o Monfalcone per esplorare
          l’estratto.
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
      <div className={styles.section}>
        <h3>Osservazioni e aggiornamenti</h3>
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
          Aggiorna adesso
        </button>
        <Feed label="Sensori PCR" feed={s.sensorsFeed} now={now} />
        <p className={styles.caption}>
          Le misure hanno orari individuali. Campioni verificati a intervalli di
          15 minuti; la frequenza varia per sensore.
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
      </div>
      <div ref={inspector} className={styles.section}>
        <h3>Esplora un oggetto</h3>
        <p className={styles.caption}>
          Tocca un sensore, uno stabilimento o un edificio sulla mappa.
        </p>
        <label className={styles.field}>
          Stazione
          <select
            aria-label="Stazione"
            value={
              s.selection?.kind === "sensor"
                ? String(s.selection.stationId)
                : ""
            }
            onChange={(e) =>
              useTwinStore.setState({
                selection: e.target.value
                  ? { kind: "sensor", stationId: Number(e.target.value) }
                  : null,
              })
            }
          >
            <option value="">Seleziona una stazione</option>
            {rows.map((m) => (
              <option key={m.stationId} value={m.stationId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {sensor && (
          <>
            <h3>{sensor.name}</h3>
            <div className={styles.value}>
              {formatValue(sensor.value)} <span>{v.unit}</span>
            </div>
            <p className={styles.caption}>{formatTime(sensor.ms)}</p>
            <Freshness ms={sensor.ms} now={now} />
            <Series measure={sensor} />
          </>
        )}
        {s.selection?.kind === "sensor" && !sensor && (
          <p className={styles.caption}>
            Questa stazione non ha una misura della variabile selezionata nella
            risposta disponibile.
          </p>
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
          Fonte asset: Regione FVG / IRDAT, edificato DBS e autorizzazioni AIA.
          Estratti acquisiti l’8/11/2026. Base edifici 2017–2020: 3.303
          geometrie a Trieste e 4.849 a Monfalcone. 1.284 geometrie senza
          altezza utilizzabile restano piatte. IODL 2.0 secondo condizioni IRDAT
          e metadati delle risorse.
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
      <div className={styles.section}>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            setTwinActive(false);
            useAppStore.setState({ drawerOpen: true });
          }}
        >
          Torna alla mappa frane
        </button>
      </div>
    </section>
  );
}
function Series({ measure }: { measure: Measure }) {
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
              m.sensorId === measure.sensorId,
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
  const a = state.rows,
    lo = Math.min(...a.map((m) => m.value)),
    hi = Math.max(...a.map((m) => m.value)),
    first = a[0]!,
    last = a[a.length - 1]!,
    span = last.ms - first.ms || 1;
  const d = a
    .map(
      (m, i) =>
        `${i && m.ms - a[i - 1]!.ms <= 45 * 60000 ? "L" : "M"}${12 + ((m.ms - first.ms) / span) * 236},${96 - ((m.value - lo) / (hi - lo || 1)) * 68}`,
    )
    .join(" ");
  return (
    <div className={styles.series}>
      <p className={styles.caption}>Ultime 24 ore · {a.length} osservazioni</p>
      <svg
        viewBox="0 0 260 130"
        role="img"
        aria-label={`Serie osservata di ${measure.name}, da ${formatTime(first.ms)} a ${formatTime(last.ms)}`}
      >
        <text x="12" y="16">
          {formatValue(hi)} {VARIABLES[useTwinStore.getState().variable].unit}
        </text>
        <path d={d} />
        <text x="12" y="122">
          {new Date(first.ms).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </text>
        <text x="210" y="122">
          {new Date(last.ms).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </text>
      </svg>
      <p className={styles.caption}>
        {formatTime(first.ms)} → {formatTime(last.ms)}. Interruzioni oltre 45
        minuti lasciate visibili.
      </p>
    </div>
  );
}
