import { AirDialog } from "./Dialog";
import { useAirCompact } from "./useAirCompact";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/ui/Icon";
import { Select } from "@/ui/Select";
import { SearchField } from "@/ui/SearchField";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "../store";
import {
  aggregate,
  AIR_BASE,
  AIA_COLORS,
  CATEGORY_NAMES,
  covers,
  day,
  distance,
  filteredAia,
  fmt,
  inventoryDomain,
  LAYER_NAMES,
  MEASURE_NAMES,
  normal,
  observationDates,
  paired,
  QUESTIONS,
  read,
  SECTOR_NAMES,
  stationDomain,
  stationTone,
  stackSite,
} from "./model";
import {
  airFocus,
  closeAirControls,
  inspectAir,
  openAirControls,
  setAirDate,
  setAirLayer,
  setAirOpacity,
  toggleAirQuestion,
  useAirStore,
} from "./store";
import { sampleSoil } from "./soil";
import type {
  AiaCategory,
  AirLayer,
  AirQuestion,
  AirView,
  Measure,
  Pollutant,
  Sector,
  SoilReading,
} from "./types";
import { AirDossier } from "./report";
import css from "./Air.module.css";
const groups: [string, AirLayer[]][] = [
  ["Rilevazioni", ["observations", "stack"]],
  ["Emissioni stimate", ["inventory"]],
  ["Territorio", ["world", "industrial", "commercial"]],
  ["Attività autorizzate", ["aia"]],
];
const layerNotes: Record<AirLayer, string> = {
  corine: "Copernicus / EEA · 100 m · confronto storico",
  observations: "Misure in aria · µg/m³",
  stack: "NOx, polveri, SO₂ · mg/Nm³",
  inventory: "INEMAR 2023 · t/anno · altezza 3D simbolica",
  world: "WorldCover 2021 · edificato, colture, boschi",
  industrial: "Destinazioni dei piani FVG · date per record",
  commercial: "Destinazioni dei piani FVG · date per record",
  aia: "Registro regionale · punti e heatmap",
};
const tools: {
  view: AirView | "report";
  title: string;
  detail: string;
  icon: IconName;
}[] = [
  {
    view: "inventory",
    title: "Confronta le sorgenti",
    detail: "Industria, riscaldamento e traffico nello stesso Comune",
    icon: "airCompare",
  },
  {
    view: "observations",
    title: "Confronta due centraline",
    detail: "Due stazioni, stesso parametro e date confrontabili",
    icon: "airStations",
  },
  {
    view: "stack",
    title: "Consulta il camino di Fanna",
    detail: "Tre serie: NOx, polveri e SO₂, giorno per giorno",
    icon: "airStack",
  },
  {
    view: "aia",
    title: "Dove si concentrano le attività?",
    detail: "Filtra il registro AIA e leggi punti e heatmap",
    icon: "airRegistry",
  },
  {
    view: "landcover",
    title: "Leggi il contesto territoriale",
    detail: "Suolo e destinazioni industriali e commerciali",
    icon: "territory",
  },
  {
    view: "report",
    title: "Componi il dossier",
    detail: "Raccogli dati, fonti e configurazione della mappa",
    icon: "fileData",
  },
];
function Status() {
  const s = useAirStore(),
    [sources, setSources] = useState(false);
  return (
    <>
      <div className={css.status}>
        <span>
          {s.loading
            ? "Controllo delle fonti…"
            : "Dati reali · tempi distinti per fonte"}
        </span>
        <button
          aria-label="Aggiorna le fonti dello Spazio"
          disabled={s.loading}
          onClick={() =>
            useAirStore.setState((x) => ({ refreshKey: x.refreshKey + 1 }))
          }
        >
          <Icon name="network" />
        </button>
        <button onClick={() => setSources(true)}>Fonti e metodo</button>
      </div>
      {s.error && (
        <p role="alert" className={css.warning}>
          {s.error}
        </p>
      )}
      <AirDialog
        open={sources}
        onClose={() => setSources(false)}
        title="Fonti e metodo"
      >
        <p>
          Le osservazioni sono statistiche giornaliere, le emissioni sono stime
          annuali. I controlli automatici non cambiano la frequenza o la
          validazione della fonte.
        </p>
        {[...(s.data?.sources ?? []), ...(s.context?.sources ?? [])].map(
          (source, i) => (
            <article className={css.source} key={source.id ?? i}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title} ↗
              </a>
              <p>
                {source.kind} · {source.period}
              </p>
              <p>{source.note}</p>
              <small>{source.license}</small>
              {source.id &&
                (s.data?.sourceStatus[source.id] ||
                  s.context?.sourceStatus?.[source.id]) && (
                  <SourceHealth source={source.id} />
                )}
            </article>
          ),
        )}
        <a href={`${AIR_BASE}NOTICE.txt`} target="_blank" rel="noreferrer">
          Attribuzioni e trasformazioni dei dati ↗
        </a>
      </AirDialog>
    </>
  );
}
export function SourceHealth({ source }: { source: string }) {
  const s = useAirStore(),
    status = s.data?.sourceStatus[source] ?? s.context?.sourceStatus?.[source];
  if (!status)
    return (
      <p className={css.muted}>
        Fonte storica · data e versione nella documentazione.
      </p>
    );
  const latest = status.latestMeasurement;
  return (
    <div className={css.health}>
      {latest && (
        <span>
          Ultima misura:{" "}
          {/^\d{4}-\d{2}-\d{2}$/.test(latest) ? day(latest) : latest}
        </span>
      )}
      <span>
        Ultimo controllo:{" "}
        {new Date(status.checkedAt).toLocaleString("it-IT", {
          timeZone: "Europe/Rome",
        })}
      </span>
      <span>{status.cadence}</span>
      {status.error && (
        <p role="alert" className={css.warning}>
          Aggiornamento non riuscito. Ultima copia conservata: {status.error}
        </p>
      )}
      {latest &&
        /^\d{4}-\d{2}-\d{2}$/.test(latest) &&
        Date.parse(status.checkedAt) - Date.parse(latest + "T12:00:00Z") >
          3 * 86400000 && (
          <p className={css.warning}>
            La fonte non espone ancora giorni più recenti: non sono dati in
            diretta.
          </p>
        )}
    </div>
  );
}
export function AirPanel() {
  const s = useAirStore(),
    tab = useExperienceStore((x) => x.tab),
    [report, setReport] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      titleRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [s.inspector?.view, s.inspector?.tool, tab]);
  const compact = useAirCompact(),
    drawerOpen = useAppStore((x) => x.drawerOpen);
  const toolMenu = tab === "tools" && !s.inspector;
  return (
    <div className={css.panel} data-air-panel>
      <Status />
      {compact && drawerOpen && !s.controls && <AirTimeline />}
      {!s.data ? (
        <p role="status">
          {s.loading
            ? "Caricamento dello Spazio…"
            : "Nessun archivio disponibile. Riprova l’aggiornamento."}
        </p>
      ) : s.inspector ? (
        <>
          <button
            className={css.back}
            onClick={() => useAirStore.setState({ inspector: null })}
          >
            <Icon name="arrow" />
            {s.inspector.tool ? "Tutte le estensioni" : "Tutti i livelli"}
          </button>
          <h2 className={css.inspectorTitle} ref={titleRef} tabIndex={-1}>
            {s.inspector.tool
              ? tools.find((t) => t.view === s.inspector?.view)?.title
              : LAYER_NAMES[s.inspector.layer]}
          </h2>
          <button
            aria-pressed={s.layers[s.inspector.layer]}
            onClick={() =>
              setAirLayer(s.inspector!.layer, !s.layers[s.inspector!.layer])
            }
          >
            {s.layers[s.inspector.layer] ? "Nascondi" : "Mostra"}{" "}
            {LAYER_NAMES[s.inspector.layer]} sulla mappa
          </button>
          <ToolGuide view={s.inspector.view} />
          <AirReading
            view={s.inspector.view}
            full
            onReport={() => setReport(true)}
          />
        </>
      ) : toolMenu ? (
        <>
          <h2 ref={titleRef} tabIndex={-1}>
            Estensioni
          </h2>
          <p className={css.muted}>
            Confronta i dati, leggi il territorio e conserva i risultati.
          </p>
          {[
            ["Confronti e rilevazioni", tools.slice(0, 3)],
            ["Territorio e attività", tools.slice(3, 5)],
            ["Risultati", tools.slice(5)],
          ].map(([label, items]) => (
            <section className={css.group} key={String(label)}>
              <h3>{String(label)}</h3>
              {(items as typeof tools).map((t) => (
                <button
                  className={css.extension}
                  key={t.view}
                  onClick={() =>
                    t.view === "report"
                      ? setReport(true)
                      : inspectAir(t.view, true)
                  }
                >
                  <Icon name={t.icon} />
                  <span>
                    <strong>{t.title}</strong>
                    <small>{t.detail}</small>
                  </span>
                  <Icon name="chevron" />
                </button>
              ))}
            </section>
          ))}
        </>
      ) : (
        <>
          <p className={css.muted}>
            Apri una lettura o attiva i singoli livelli. Le misure e il contesto
            restano sovrapponibili.
          </p>
          <div className={css.questions}>
            {(Object.keys(QUESTIONS) as AirQuestion[]).map((q) => {
              const item = QUESTIONS[q],
                active = s.questions.includes(q),
                n = item.layers.filter(
                  (k) => s.layers[k] && s.opacity[k] > 0,
                ).length;
              return (
                <button
                  key={q}
                  className={css.question}
                  aria-pressed={
                    active ? (n === item.layers.length ? true : "mixed") : false
                  }
                  aria-controls="air-map-controls"
                  onClick={() => toggleAirQuestion(q)}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                    <span className={css.questionState}>
                      {active
                        ? n === item.layers.length
                          ? `Attiva · ${n} livelli`
                          : `${n}/${item.layers.length} livelli · gruppo modificato`
                        : "Mostra sulla mappa"}
                    </span>
                  </span>
                  <Icon name="chevron" />
                </button>
              );
            })}
          </div>
          <p className={css.muted}>
            {Object.values(s.layers).filter(Boolean).length}{" "}
            {Object.values(s.layers).filter(Boolean).length === 1
              ? "livello visibile"
              : "livelli visibili"}
          </p>
          {groups.map(([label, keys]) => (
            <section key={label} className={css.group}>
              <h3>{label}</h3>
              {keys.map((key) => (
                <div
                  className={css.layerRow}
                  data-visible={s.layers[key]}
                  key={key}
                >
                  <button
                    className={css.eye}
                    aria-label={`${s.layers[key] ? "Nascondi" : "Mostra"} ${LAYER_NAMES[key]}`}
                    aria-pressed={s.layers[key]}
                    onClick={() => setAirLayer(key, !s.layers[key])}
                  >
                    <Icon name="eye" />
                  </button>
                  <button
                    className={css.layerName}
                    onClick={() =>
                      inspectAir(
                        [
                          "world",
                          "industrial",
                          "commercial",
                          "corine",
                        ].includes(key)
                          ? "landcover"
                          : (key as AirView),
                        false,
                        key,
                      )
                    }
                  >
                    <strong>{LAYER_NAMES[key]}</strong>
                    <small>{layerNotes[key]}</small>
                  </button>
                  <button
                    className={css.layerControl}
                    aria-label={`Controlli sulla mappa · ${LAYER_NAMES[key]}`}
                    aria-expanded={
                      s.controls?.key === key && !s.controls.question
                    }
                    aria-controls="air-map-controls"
                    disabled={!s.layers[key]}
                    onClick={() =>
                      s.controls?.key === key && !s.controls.question
                        ? closeAirControls()
                        : openAirControls(key)
                    }
                  >
                    <Icon name="tools" />
                  </button>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
      <AirDossier open={report} onClose={() => setReport(false)} />
    </div>
  );
}
function ToolGuide({ view }: { view: AirView }) {
  const guides: Record<AirView, [string[], string]> = {
    inventory: [
      [
        "Scegli un Comune e NOx, PM10 o PM2.5.",
        "Confronta industria, combustione non industriale e traffico.",
        "Apri il dettaglio dei macrosettori per leggere le stime originali.",
      ],
      "Ottieni quantità annue in t/anno, non concentrazioni respirate oggi.",
    ],
    observations: [
      [
        "Scegli centralina A, centralina B e lo stesso parametro.",
        "Leggi le due serie: verde A, ocra B.",
        "Lo scarto A − B usa solo le date valide in entrambe, fino al giorno scelto.",
      ],
      "Uno scarto positivo indica valori mediamente più alti in A nel campione confrontabile. Non identifica la causa.",
    ],
    stack: [
      [
        "Leggi insieme NOx, polveri e SO₂: scale verticali indipendenti.",
        "Scegli il giorno dai pulsanti o dal grafico.",
        "Controlla la qualità: giornate non valide e vuote restano mancanti.",
      ],
      "Misure pubblicate del gas al camino in mg/Nm³, distinte dall’aria esterna.",
    ],
    aia: [
      [
        "Filtra attività, ragione sociale o Comune.",
        "Scegli punti, heatmap o entrambe le rappresentazioni.",
        "Apri un punto per leggere codice, stato e fonte del record.",
      ],
      "La concentrazione delle registrazioni AIA non è una mappa dell’inquinamento.",
    ],
    landcover: [
      [
        "Sovrapponi copertura del suolo e destinazioni industriali o commerciali.",
        "Tocca un perimetro per leggere data e variante.",
        "Apri la domanda sul territorio per campionare un pixel WorldCover.",
      ],
      "Copertura osservata e previsioni del piano hanno fonti e date distinte. Non dimostrano esposizione o causalità.",
    ],
  };
  const [steps, result] = guides[view];
  return (
    <details className={css.guide}>
      <summary>Come funziona e cosa ottieni</summary>
      <ol>
        {steps.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
      <p>{result}</p>
    </details>
  );
}
function Options<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className={css.options}>
      <legend>{label}</legend>
      <div>
        {items.map(([id, name]) => (
          <button
            key={id}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function AirChart({
  series,
  labels,
  onDate,
}: {
  series: { date: string; value: number | null }[][];
  labels: string[];
  onDate?: (date: string) => void;
}) {
  const values = series.flatMap((ss) =>
      ss.flatMap((r) => (r.value === null ? [] : [r.value])),
    ),
    max = Math.max(1, ...values) * 1.08,
    n = Math.max(2, ...series.map((ss) => ss.length));
  const xy = (i: number, v: number) => [
      34 + (i / (n - 1)) * 278,
      135 - (v / max) * 123,
    ],
    dates = series[0] ?? [];
  return (
    <figure className={css.chart}>
      <figcaption>{labels.join(" / ")}</figcaption>
      <svg
        viewBox="0 0 320 155"
        role={onDate ? "group" : "img"}
        tabIndex={onDate ? 0 : undefined}
        aria-label={
          labels.join(" / ") + (onDate ? ". Frecce per cambiare giorno." : "")
        }
        onKeyDown={(e) => {
          if (!onDate || !dates.length) return;
          const i = Math.max(
            0,
            dates.findIndex((r) => r.date === useAirStore.getState().stackDate),
          );
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          onDate(
            dates[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? dates.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        dates.length - 1,
                        i + (e.key === "ArrowRight" ? 1 : -1),
                      ),
                    )
            ]!.date,
          );
        }}
      >
        <title>{labels.join(" / ")}</title>
        {[0, 1, 2, 3].map((i) => {
          const y = xy(0, (max * i) / 3)[1];
          return (
            <g key={i}>
              <line x1="34" x2="312" y1={y} y2={y} />
              <text x="29" y={y! + 3} textAnchor="end">
                {fmt((max * i) / 3, 1)}
              </text>
            </g>
          );
        })}
        {series.map((ss, k) => {
          let part = "";
          const paths: string[] = [];
          for (let i = 0; i < ss.length; i++) {
            const v = ss[i]!.value;
            if (v === null) {
              if (part) paths.push(part);
              part = "";
            } else part += (part ? "L" : "M") + xy(i, v).join(",");
          }
          if (part) paths.push(part);
          return (
            <g key={k} className={k ? css.seriesB : css.seriesA}>
              {paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
              {ss.map((r, i) =>
                r.value === null ? null : (
                  <circle
                    key={r.date}
                    cx={xy(i, r.value)[0]}
                    cy={xy(i, r.value)[1]}
                    r={
                      onDate && r.date === useAirStore.getState().stackDate
                        ? 3.5
                        : 2
                    }
                    onClick={() => onDate?.(r.date)}
                  />
                ),
              )}
            </g>
          );
        })}
        {!values.length && (
          <text x="170" y="80" textAnchor="middle">
            Nessun dato valido
          </text>
        )}
      </svg>
      <div className={css.chartDates}>
        <span>{dates[0] ? day(dates[0].date) : ""}</span>
        <span>{dates.at(-1) ? day(dates.at(-1)!.date) : ""}</span>
      </div>
    </figure>
  );
}
function Territory({ station = false }: { station?: boolean }) {
  const s = useAirStore(),
    m =
      s.data?.municipalities.features.find(
        (f) => String(f.properties.istat) === s.municipalityId,
      ) ?? s.data?.municipalities.features[0],
    st = s.data?.stations.find((f) => f.id === s.stationId),
    point = st?.coordinates,
    [soil, setSoil] = useState<SoilReading | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (station && point && s.world) {
      void sampleSoil(point, s.world).then((v) => {
        if (!cancelled) setSoil(v);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [station, point, s.world]);
  if (!s.data || !m) return null;
  const name = normal(m.properties.name),
    industrial = s.context?.industrialZones.features.filter((f) =>
      station && point
        ? covers(f.geometry, point)
        : normal(f.properties.municipality) === name,
    ),
    commercial = s.context?.commercialZones.features.filter((f) =>
      station && point
        ? covers(f.geometry, point)
        : normal(f.properties.municipality) === name,
    ),
    aia = s.data.aia.features.filter((f) =>
      station && point
        ? distance(point, f.geometry.coordinates) <= 1000
        : normal(f.properties.municipality) === name,
    );
  return (
    <section className={css.territory}>
      <h3>Leggi il dato nel suo territorio</h3>
      <dl>
        {station && (
          <>
            <dt>Copertura del pixel · 2021</dt>
            <dd>
              {soil?.point[0] === point?.[0] &&
              soil?.point[1] === point?.[1] &&
              soil?.status === "ready"
                ? soil.name
                : soil?.status === "outside"
                  ? "Fuori dall’estratto"
                  : soil?.status === "error"
                    ? "Campione non leggibile"
                    : soil?.status === "missing"
                      ? "Campione mancante"
                      : "Lettura della copertura…"}
            </dd>
          </>
        )}
        <dt>
          {station
            ? "Perimetri industriali nel punto"
            : "Perimetri industriali/artigianali"}
        </dt>
        <dd>{industrial?.length ?? "—"}</dd>
        <dt>
          {station
            ? "Perimetri commerciali nel punto"
            : "Perimetri commerciali"}
        </dt>
        <dd>{commercial?.length ?? "—"}</dd>
        <dt>
          {station ? "AIA entro 1 km · campione locale" : "Registrazioni AIA"}
        </dt>
        <dd>{aia.length}</dd>
      </dl>
      <details>
        <summary>Fonti e limiti di questo incrocio</summary>
        <p>
          {station
            ? "Classe del pixel 2021 alla coordinata pubblicata (~13 m), non un rilievo del sito. La centralina misura nel proprio punto; le distanze usano posizioni amministrative AIA."
            : "Conteggi di record e perimetri del piano: non sono numero di imprese attive né quote delle emissioni."}{" "}
          Vicinanza e destinazione del piano non identificano la causa delle
          concentrazioni. Le date urbanistiche restano quelle dei record.
        </p>
      </details>
    </section>
  );
}
export function AirReading({
  view,
  full = false,
  onReport,
}: {
  view: AirView;
  full?: boolean;
  onReport?: () => void;
}) {
  const s = useAirStore(),
    threeD = useAppStore((x) => x.view3D),
    d = s.data;
  if (!d) return <p role="status">Caricamento dei dati…</p>;
  const m =
      d.municipalities.features.find(
        (f) => String(f.properties.istat) === s.municipalityId,
      ) ?? d.municipalities.features[0]!,
    station = d.stations.find((f) => f.id === s.stationId) ?? d.stations[0]!,
    comparison = d.stations.find((f) => f.id === s.compareId),
    dates = observationDates(d),
    current = read(station, s.measure, s.date),
    valid = (station.series[s.measure] ?? []).filter(
      (r) => r.date <= s.date && r.value !== null,
    ),
    previous = valid.filter((r) => r.date < s.date).at(-1),
    delta =
      current !== null && previous?.value != null
        ? current - previous.value
        : null;
  return (
    <div className={css.reading}>
      {view === "inventory" ? (
        <>
          <Select
            label="Comune"
            value={String(m.properties.istat)}
            options={d.municipalities.features.map((f) => ({
              value: String(f.properties.istat),
              label: f.properties.name,
            }))}
            onChange={(municipalityId) =>
              useAirStore.setState({ municipalityId })
            }
          />
          <Options<Pollutant>
            label="Inquinante stimato"
            value={s.poll}
            items={[
              ["NOx", "NOx"],
              ["PM10", "PM10"],
              ["PM2_5", "PM2.5"],
            ]}
            onChange={(poll) => useAirStore.setState({ poll })}
          />
          <div className={css.readingValue}>
            <strong>{m.properties.name}</strong>
            <output>
              {fmt(aggregate(m, s.poll, s.sector).value)} <small>t/anno</small>
            </output>
            <span>{SECTOR_NAMES[s.sector]} · anno 2023</span>
          </div>
          <Scale kind="inventory" />
          <div className={css.sectors}>
            {(Object.keys(SECTOR_NAMES) as Sector[]).map((key) => (
              <button
                aria-pressed={s.sector === key}
                key={key}
                onClick={() => useAirStore.setState({ sector: key })}
              >
                <span>
                  {SECTOR_NAMES[key]}
                  <small>
                    {key === "industry"
                      ? "Combustione e processi · SNAP 3 + 4"
                      : key === "nonindustrial"
                        ? "Macrosettore SNAP 2"
                        : key === "road"
                          ? "Macrosettore SNAP 7"
                          : "Somma disponibile senza doppioni"}
                  </small>
                </span>
                <b>{fmt(aggregate(m, s.poll, key).value)}</b>
                <i
                  aria-hidden="true"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((aggregate(m, s.poll, key).value ?? 0) / Math.max(0.000001, aggregate(m, s.poll, "all").value ?? 1)) * 100))}%`,
                  }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              useAppStore.getState().setView3D(!useAppStore.getState().view3D);
            }}
            aria-pressed={threeD}
          >
            Altezza 3D simbolica
          </button>
          <p className={css.muted}>
            Quantità annue stimate, non concentrazioni nell’aria. L’altezza 3D è
            simbolica; non è una nube né l’altezza degli impianti. I vuoti non
            diventano zero.
          </p>
          <Territory />
          <details>
            <summary>Dettaglio completo dei macrosettori</summary>
            <dl className={css.dataList}>
              {m.properties.sectors.map((row) => (
                <div key={row.code}>
                  <dt>
                    {row.code} · {row.name}
                  </dt>
                  <dd>{fmt(row.values[s.poll])} t/anno</dd>
                </div>
              ))}
            </dl>
          </details>
          <SourceHealth source="inemar" />
        </>
      ) : view === "observations" ? (
        <>
          <Options<Measure>
            label="Parametro delle centraline"
            value={s.measure}
            items={Object.entries(MEASURE_NAMES) as [Measure, string][]}
            onChange={(measure) => useAirStore.setState({ measure })}
          />
          <Select
            label="Centralina A · linea verde"
            value={station.id}
            options={d.stations.map((st) => ({ value: st.id, label: st.name }))}
            onChange={(stationId) => useAirStore.setState({ stationId })}
          />
          <div className={css.readingValue}>
            <strong>{station.name}</strong>
            <output>
              {fmt(read(station, s.measure, s.date), 1)} <small>µg/m³</small>
            </output>
            <span>
              {day(s.date)} ·{" "}
              {s.measure === "no2"
                ? "massimo orario della giornata"
                : "media giornaliera"}
            </span>
            <span>
              {delta === null
                ? "Confronto precedente non disponibile"
                : `${delta > 0 ? "+" : ""}${fmt(delta, 1)} µg/m³ rispetto al ${day(previous!.date)}`}
            </span>
            <span>
              {valid.length}/{dates.filter((date) => date <= s.date).length}{" "}
              giornate disponibili · min{" "}
              {fmt(
                valid.length ? Math.min(...valid.map((r) => r.value!)) : null,
                1,
              )}{" "}
              · max{" "}
              {fmt(
                valid.length ? Math.max(...valid.map((r) => r.value!)) : null,
                1,
              )}{" "}
              µg/m³
            </span>
          </div>
          <Scale kind="observations" />
          <AirChart
            series={[
              dates.map((date) => ({
                date,
                value: date <= s.date ? read(station, s.measure, date) : null,
              })),
              dates.map((date) => ({
                date,
                value:
                  date <= s.date ? read(comparison, s.measure, date) : null,
              })),
            ]}
            labels={[`${MEASURE_NAMES[s.measure]} · µg/m³ · A verde, B ocra`]}
          />
          <details open={full || undefined}>
            <summary>Confronta due centraline</summary>
            <Select
              label="Centralina B · linea ocra"
              value={s.compareId}
              options={d.stations.map((st) => ({
                value: st.id,
                label: st.name,
              }))}
              onChange={(compareId) => useAirStore.setState({ compareId })}
            />
            <Comparison />
            <p>
              Il grafico conserva le due serie disponibili. Lo scarto usa solo
              date valide in entrambe, fino al giorno scelto.
            </p>
          </details>
          <Territory station />
          <details>
            <summary>Tutte le centraline del giorno</summary>
            <div className={css.records}>
              {d.stations.map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    useAirStore.setState({ stationId: st.id });
                    airFocus(st.coordinates);
                  }}
                >
                  <i
                    style={{
                      background: stationTone(
                        read(st, s.measure, s.date),
                        stationDomain(d, s.measure),
                      ),
                    }}
                  />
                  <span>{st.name}</span>
                  <b>{fmt(read(st, s.measure, s.date), 1)}</b>
                </button>
              ))}
            </div>
          </details>
          <SourceHealth source={s.measure} />
          <p className={css.muted}>
            Il flag di dati insufficienti non certifica la validazione
            giornaliera, mensile o annuale. Le statistiche di giorni mancanti
            non vengono prolungate.
          </p>
        </>
      ) : view === "stack" ? (
        <>
          <h3>Fanna Cementi · {day(s.stackDate)}</h3>
          <p className={css.muted}>
            Medie giornaliere al camino in mg/Nm³. Scale verticali indipendenti;
            nessuna conversione in concentrazioni nell’aria esterna.
          </p>
          {(
            [
              ["NOx", "Ossidi di azoto · NOx"],
              ["dust", "Polveri"],
              ["SO2", "Biossido di zolfo · SO₂"],
            ] as const
          ).map(([key, name]) => (
            <section key={key}>
              <div className={css.stackMetric}>
                <strong>{name}</strong>
                <b>
                  {fmt(d.sme.find((r) => r.date === s.stackDate)?.[key], 1)}{" "}
                  mg/Nm³
                </b>
              </div>
              <AirChart
                series={[
                  d.sme.map((row) => ({ date: row.date, value: row[key] })),
                ]}
                labels={[name + " · mg/Nm³"]}
                onDate={(date) => setAirDate("stack", date)}
              />
            </section>
          ))}
          <div className={css.days}>
            {d.sme.map((row) => (
              <button
                aria-pressed={s.stackDate === row.date}
                key={row.date}
                title={day(row.date)}
                onClick={() => setAirDate("stack", row.date)}
              >
                {row.date.slice(8)}
                <small>{row.date.slice(5, 7)}</small>
              </button>
            ))}
          </div>
          <p>
            {[
              d.sme.find((r) => r.date === s.stackDate)?.rawNOx,
              d.sme.find((r) => r.date === s.stackDate)?.rawDust,
              d.sme.find((r) => r.date === s.stackDate)?.rawSO2,
            ].some((v) => /5s/i.test(v ?? ""))
              ? "Dato non valido (5s): scartate più di cinque medie semiorarie, come indicato dalla fonte."
              : d.sme.find((r) => r.date === s.stackDate)?.status ||
                "Dato non pubblicato"}{" "}
            I qualificatori non numerici restano mancanti, non zero.
          </p>
          <button onClick={() => airFocus(stackSite(d))}>
            Mostra il punto dell’impianto
          </button>
          <a
            href={d.sources.find((f) => f.id === "sme")?.url}
            target="_blank"
            rel="noreferrer"
          >
            Consulta la tabella del gestore ↗
          </a>
          <SourceHealth source="sme" />
          <p className={css.muted}>
            Coordinate del registro AIA, non localizzazione esatta del camino.
            Il dato al camino non è una misura di esposizione né una valutazione
            automatica di conformità.
          </p>
        </>
      ) : view === "aia" ? (
        <AiaReading />
      ) : (
        <LandReading />
      )}
      {full && onReport && (
        <button onClick={onReport}>
          <Icon name="fileData" />
          Prepara il dossier dei dati selezionati
        </button>
      )}
    </div>
  );
}
function Comparison() {
  const s = useAirStore(),
    d = s.data!;
  const a = d.stations.find((st) => st.id === s.stationId),
    b = d.stations.find((st) => st.id === s.compareId),
    rows = paired(a, b, s.measure, observationDates(d), s.date),
    delta = rows.length
      ? rows.reduce((sum, r) => sum + r.a - r.b, 0) / rows.length
      : null;
  return (
    <div className={css.territory}>
      <strong>
        A − B · differenza media{" "}
        {s.measure === "no2" ? "dei massimi" : "giornaliera"}
      </strong>
      <output>
        {delta !== null && delta > 0 ? "+" : ""}
        {fmt(delta)} µg/m³
      </output>
      <p>
        {rows.length} date confrontabili.{" "}
        {a?.id === b?.id
          ? "È la stessa centralina: scegli un secondo sito."
          : "Lo scarto descrive le osservazioni, senza identificare la causa."}
      </p>
    </div>
  );
}
export function Scale({ kind }: { kind: "inventory" | "observations" }) {
  const s = useAirStore();
  if (!s.data) return null;
  const max =
    kind === "inventory"
      ? inventoryDomain(s.data, s.poll)
      : stationDomain(s.data, s.measure);
  return (
    <div className={css.scale}>
      <strong>
        {kind === "inventory"
          ? `${s.poll} · ${SECTOR_NAMES[s.sector]}`
          : `Centraline · ${MEASURE_NAMES[s.measure]}`}
      </strong>
      <div
        className={kind === "inventory" ? css.inventoryRamp : css.stationRamp}
      />
      <div>
        <span>0</span>
        <span>
          {fmt(max, 1)} {kind === "inventory" ? "t/anno" : "µg/m³"}
        </span>
      </div>
      <p>
        {kind === "inventory"
          ? "Scala fissa dell’inventario. Altezza 3D simbolica."
          : "Scala fissa del campione, non classi normative."}{" "}
        Grigio: dato mancante.
      </p>
    </div>
  );
}
function useInspectionFocus(token: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!token) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [token]);
  return ref;
}
function AiaLegend() {
  return (
    <div className={css.coverKey}>
      {Object.entries(AIA_COLORS).map(([key, color]) => (
        <span key={key}>
          <i style={{ background: color }} />
          {CATEGORY_NAMES[key as AiaCategory]}
        </span>
      ))}
    </div>
  );
}
function AiaReading() {
  const s = useAirStore(),
    d = s.data!,
    rows = filteredAia(d, s.aiaCategory, s.aiaQuery, s.aiaMunicipality),
    selected = d.aia.features.find((f) => f.properties.id === s.aiaId),
    ranking = [...new Set(rows.map((f) => f.properties.municipality))]
      .map((name) => ({
        name,
        n: rows.filter((f) => f.properties.municipality === name).length,
      }))
      .sort((a, b) => b.n - a.n);
  const inspection = useInspectionFocus(s.aiaId ?? "");
  return (
    <>
      <Options
        label="Rappresentazione del registro"
        value={s.aiaMode}
        items={[
          ["points", "Punti"],
          ["heatmap", "Heatmap"],
          ["both", "Entrambi"],
        ]}
        onChange={(aiaMode) => useAirStore.setState({ aiaMode })}
      />
      <Options<AiaCategory>
        label="Attività incluse"
        value={s.aiaCategory}
        items={Object.entries(CATEGORY_NAMES) as [AiaCategory, string][]}
        onChange={(aiaCategory) =>
          useAirStore.setState({ aiaCategory, aiaId: null })
        }
      />
      <AiaLegend />
      <SearchField
        label="Cerca attività o Comune"
        value={s.aiaQuery}
        onChange={(aiaQuery) => useAirStore.setState({ aiaQuery })}
        placeholder="Ragione sociale, Comune o codice…"
      />
      <p>
        {rows.length} registrazioni · {ranking.length} Comuni nel filtro
      </p>
      {s.aiaMunicipality && (
        <button onClick={() => useAirStore.setState({ aiaMunicipality: null })}>
          Tutti i Comuni
        </button>
      )}
      {selected && (
        <section className={css.territory} ref={inspection} tabIndex={-1}>
          <h3 data-space-inspection>{selected.properties.name}</h3>
          <p>
            {selected.properties.municipality} · {selected.properties.code}
          </p>
          <p>
            Attività {selected.properties.activity} ·{" "}
            {selected.properties.state}
          </p>
          <button
            onClick={() => {
              setAirLayer("aia", true);
              airFocus(
                selected.geometry.coordinates.slice(0, 2) as [number, number],
                13,
              );
            }}
          >
            Mostra sulla mappa
          </button>
          <a
            href={selected.properties.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Consulta il registro regionale ↗
          </a>
          {/FANNA.*CEMENTI|CEMENT.*FANNA/i.test(selected.properties.name) && (
            <button
              onClick={() => {
                setAirLayer("stack", true);
                inspectAir("stack", true);
              }}
            >
              Ultime misure al camino di Fanna
            </button>
          )}
        </section>
      )}
      <details open>
        <summary>Comuni con più record selezionati</summary>
        <div className={css.records}>
          {ranking.map((r) => (
            <button
              key={r.name}
              onClick={() => useAirStore.setState({ aiaMunicipality: r.name })}
            >
              <span>{r.name}</span>
              <b>{r.n}</b>
            </button>
          ))}
        </div>
      </details>
      <details>
        <summary>Elenco delle attività selezionate</summary>
        <div className={css.records}>
          {rows.map((f) => (
            <button
              key={f.properties.id}
              onClick={() => useAirStore.setState({ aiaId: f.properties.id })}
            >
              <span>
                {f.properties.name}
                <small>
                  {f.properties.municipality} · {f.properties.activity}
                </small>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      </details>
      <button
        aria-pressed={s.layers.industrial}
        onClick={() => setAirLayer("industrial", !s.layers.industrial)}
      >
        Mostra anche le zone industriali/artigianali
      </button>
      <details>
        <summary>Come sono raggruppati i codici</summary>
        <p>
          Produzioni: classi 2–4 e processi 6.1–6.5, 6.7, 6.9, 6.10.
          Allevamenti: 6.6. Rifiuti: classe 5. Le altre autorizzazioni restano
          distinte. Il codice originale e lo stato della fonte sono sempre
          consultabili.
        </p>
      </details>
      <p className={css.muted}>
        La heatmap pesa ogni registrazione allo stesso modo e varia con lo zoom:
        mostra densità di record, non emissioni o qualità dell’aria. Il registro
        AIA non comprende tutte le imprese; un’attività può appartenere a più
        categorie.
      </p>
      <SourceHealth source="aia" />
    </>
  );
}
function LandReading() {
  const s = useAirStore(),
    inspection = useInspectionFocus(
      s.zone
        ? "zone:" + s.zone.properties.id
        : s.soil
          ? JSON.stringify([s.soil.point, s.soil.status])
          : "",
    );
  return (
    <>
      <p>
        La copertura osservata distingue edificato, colture, boschi e acqua. I
        perimetri dei piani aggiungono la destinazione urbanistica, con data e
        variante proprie.
      </p>
      {(["world", "industrial", "commercial"] as AirLayer[]).map((key) => (
        <button
          className={css.landToggle}
          key={key}
          aria-pressed={s.layers[key]}
          onClick={() => setAirLayer(key, !s.layers[key])}
        >
          <Icon name="eye" />
          {LAYER_NAMES[key]}
        </button>
      ))}
      {s.zone && (
        <section className={css.territory} ref={inspection} tabIndex={-1}>
          <h3 data-space-inspection>{s.zone.properties.name}</h3>
          <p>
            {s.zone.properties.municipality} · zona {s.zone.properties.zone} /{" "}
            {s.zone.properties.subzone}
          </p>
          <p>
            Data di validità: {s.zone.properties.validDate || "non indicata"} ·
            variante {s.zone.properties.variant || "non indicata"}
          </p>
          <p>{s.zone.properties.norm}</p>
        </section>
      )}
      {s.soil && (
        <section
          className={css.territory}
          role="status"
          ref={s.zone ? null : inspection}
          tabIndex={-1}
        >
          <h3>Copertura nel punto selezionato</h3>
          <p>
            {s.soil.status === "ready"
              ? `${s.soil.name} · classe ${s.soil.code}`
              : s.soil.status === "loading"
                ? "Lettura del pixel…"
                : s.soil.status === "outside"
                  ? "Fuori dall’estratto locale"
                  : s.soil.status === "error"
                    ? "Campione non leggibile"
                    : "Campione non disponibile"}
          </p>
          <p>
            WorldCover 2021 alla massima risoluzione locale (~13 m), anche
            quando la panoramica è più larga.
          </p>
        </section>
      )}
      <p className={css.muted}>
        Tocca la mappa per leggere un perimetro. Con la domanda sul territorio
        aperta, tocca la copertura per leggere il pixel.
      </p>
      <div className={css.coverKey}>
        {s.world?.classes
          .filter(
            (c) =>
              !s.world?.presentClasses ||
              s.world.presentClasses.includes(c.code),
          )
          .map((c) => (
            <span key={c.code}>
              <i style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
      </div>
      {(s.worldError || s.worldTileError) && (
        <p className={css.warning} role="alert">
          {s.worldError || s.worldTileError}
        </p>
      )}
      {s.contextError && (
        <p className={css.warning} role="alert">
          {s.contextError}
        </p>
      )}
      <details>
        <summary>Confronto storico opzionale · CORINE</summary>
        <button
          aria-pressed={s.layers.corine}
          onClick={() => setAirLayer("corine", !s.layers.corine)}
        >
          CORINE 2018 · servizio Copernicus / EEA
        </button>
        <label className={css.opacity}>
          Opacità CORINE <output>{Math.round(s.opacity.corine * 100)}%</output>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.opacity.corine * 100)}
            onChange={(e) =>
              setAirOpacity("corine", Number(e.target.value) / 100)
            }
          />
        </label>
        <p>
          Servizio esterno a 100 m, unità minima 25 ha. Si alterna a WorldCover;
          la classe 121 unisce industria e commercio.
        </p>
        <a
          href="https://land.copernicus.eu/en/products/corine-land-cover/clc2018"
          target="_blank"
          rel="noreferrer"
        >
          Fonte e legenda ufficiale ↗
        </a>
      </details>
      <details>
        <summary>Provenienza e date del territorio</summary>
        <p>
          ESA WorldCover 2021, prodotto originale 10 m, pixel locali
          ricampionati nearest circa 13 m. I piani conservano le date storiche
          dei record: non sono un catasto attuale. Edificato non significa
          soltanto abitazioni.
        </p>
        <SourceHealth source="industrial" />
        <SourceHealth source="commercial" />
      </details>
    </>
  );
}
export function AirTimeline() {
  const s = useAirStore();
  if (!s.data) return null;
  const active = (["observations", "stack"] as const).filter(
      (k) => s.layers[k] && s.opacity[k] > 0,
    ),
    target = active.includes(s.timeTarget) ? s.timeTarget : active[0];
  if (!target) return null;
  const dates =
      target === "stack"
        ? s.data.sme.map((r) => r.date)
        : observationDates(s.data),
    date = target === "stack" ? s.stackDate : s.date,
    index = Math.max(0, dates.indexOf(date));
  if (!dates.length) return null;
  return (
    <div className={css.timeline} aria-label="Giorno delle rilevazioni">
      {active.length > 1 && (
        <div className={css.timeTargets}>
          {active.map((k) => (
            <button
              key={k}
              aria-pressed={target === k}
              onClick={() => {
                useAirStore.setState({ timeTarget: k });
                if (
                  s.controls &&
                  ["observations", "stack"].includes(s.controls.key)
                )
                  openAirControls(k);
              }}
            >
              {k === "stack" ? "Camino Fanna" : "Aria ambiente"}
            </button>
          ))}
        </div>
      )}
      <button
        aria-label="Giorno precedente"
        disabled={index <= 0}
        onClick={() => setAirDate(target, dates[index - 1]!)}
      >
        ←
      </button>
      <label htmlFor="air-date-range">
        {target === "stack"
          ? "Fanna · giorno pubblicato"
          : "Centraline · giorno osservato"}
        <output>{day(date)}</output>
      </label>
      <button
        aria-label="Giorno successivo"
        disabled={index >= dates.length - 1}
        onClick={() => setAirDate(target, dates[index + 1]!)}
      >
        →
      </button>
      <input
        id="air-date-range"
        aria-label="Scegli il giorno osservato"
        type="range"
        min={0}
        max={dates.length - 1}
        value={index}
        onChange={(e) => setAirDate(target, dates[Number(e.target.value)]!)}
      />
      <button
        className={css.latest}
        onClick={() =>
          useAirStore.setState(
            target === "stack"
              ? { stackDate: dates.at(-1)!, stackFollowLatest: true }
              : { date: dates.at(-1)!, followLatest: true },
          )
        }
      >
        Ultimo disponibile
      </button>
    </div>
  );
}
export function AirMapUI() {
  const active = useExperienceStore((s) => s.activeId),
    drawing = useAppStore((s) => s.drawingMode),
    drawer = useAppStore((s) => s.drawerOpen),
    s = useAirStore(),
    compact = useAirCompact(),
    ref = useRef<HTMLElement>(null),
    [report, setReport] = useState(false);
  useEffect(() => {
    if (
      active !== "air" ||
      !s.controls ||
      !["observations", "stack"].includes(s.controls.key)
    )
      return;
    const target = (["observations", "stack"] as const).filter(
      (k) => s.layers[k] && s.opacity[k] > 0,
    );
    const key = target.includes(s.timeTarget) ? s.timeTarget : target[0];
    if (key && key !== s.controls.key) openAirControls(key);
  }, [active, s.controls, s.timeTarget, s.layers, s.opacity]);
  useEffect(() => {
    if (active !== "air") closeAirControls(false);
  }, [active]);
  useEffect(() => {
    if (!s.controls) return;
    const f = requestAnimationFrame(() =>
      ref.current
        ?.querySelector<HTMLElement>("h2")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(f);
  }, [s.controls, s.focusRequest]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const map = el.parentElement,
        attr = map?.querySelector(".maplibregl-ctrl-attrib"),
        box = map?.getBoundingClientRect(),
        rect = attr?.getBoundingClientRect();
      el.style.setProperty(
        "--air-bottom",
        `${Math.max(68, box && rect ? box.bottom - rect.top + 8 : 68)}px`,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    measure();
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [s.controls, drawer]);
  if (active !== "air" || drawing || !s.data) return null;
  const view = s.controls
      ? (s.controls.question ??
        (["world", "industrial", "commercial", "corine"].includes(
          s.controls.key,
        )
          ? "landcover"
          : (s.controls.key as AirView)))
      : null,
    temporal =
      !!s.controls && ["observations", "stack"].includes(s.controls.key);
  return (
    <>
      <section
        id="air-map-controls"
        data-ui="drawer"
        className={css.dock}
        ref={ref}
        hidden={!s.controls}
        aria-label="Controlli sulla mappa"
        onKeyDownCapture={(e) => {
          if (
            e.key === "Escape" &&
            !(e.target as Element).closest('[role="listbox"],dialog')
          ) {
            e.preventDefault();
            e.stopPropagation();
            closeAirControls();
          }
        }}
      >
        <header>
          <div>
            <span>
              {s.controls?.question
                ? "Domanda sulla mappa"
                : "Controlli sulla mappa"}
            </span>
            <h2 tabIndex={-1}>
              {s.controls?.question
                ? QUESTIONS[s.controls.question].title
                : s.controls
                  ? LAYER_NAMES[s.controls.key]
                  : ""}
            </h2>
          </div>
          <button
            aria-label="Chiudi controlli del livello"
            onClick={() => closeAirControls()}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className={css.dockBody}>
          {view && <AirReading view={view} />}{" "}
          {s.controls && (
            <>
              {s.controls.question !== "landcover" && (
                <label className={css.opacity}>
                  Opacità del livello{" "}
                  <output>
                    {Math.round(s.opacity[s.controls.key] * 100)}%
                  </output>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(s.opacity[s.controls.key] * 100)}
                    onChange={(e) =>
                      setAirOpacity(
                        s.controls!.key,
                        Number(e.target.value) / 100,
                      )
                    }
                  />
                </label>
              )}
              {s.controls.question ? (
                <p className={css.muted}>
                  La × chiude solo il pannello. Premi di nuovo la domanda per
                  disattivare i livelli accesi dal gruppo; quelli già attivi o
                  condivisi restano.
                </p>
              ) : (
                <button
                  onClick={() => inspectAir(view!, false, s.controls!.key)}
                >
                  Apri dati e analisi <Icon name="arrow" />
                </button>
              )}
            </>
          )}
        </div>
        {temporal && <AirTimeline />}
      </section>
      {!temporal && !s.controls && !(drawer && compact) && (
        <div className={css.floatingTimeline}>
          <AirTimeline />
        </div>
      )}
      {!s.controls && (
        <div className={css.mapLegend} data-map-legend>
          <details>
            <summary>
              {Object.values(s.layers).filter(Boolean).length}{" "}
              {Object.values(s.layers).filter(Boolean).length === 1
                ? "livello visibile"
                : "livelli visibili"}{" "}
              · legenda e unità
            </summary>
            {s.layers.inventory && <Scale kind="inventory" />}
            {s.layers.observations && <Scale kind="observations" />}
            {s.layers.aia && (
              <p>
                AIA:{" "}
                {
                  filteredAia(
                    s.data,
                    s.aiaCategory,
                    s.aiaQuery,
                    s.aiaMunicipality,
                  ).length
                }{" "}
                registrazioni. Heatmap = densità, non emissioni.
              </p>
            )}
            {s.layers.aia && <AiaLegend />}
            {s.layers.stack && (
              <p>Fanna · mg/Nm³ al camino, {day(s.stackDate)}.</p>
            )}
            <button onClick={() => setReport(true)}>Prepara il dossier</button>
          </details>
        </div>
      )}
      <AirDossier open={report} onClose={() => setReport(false)} />
    </>
  );
}
