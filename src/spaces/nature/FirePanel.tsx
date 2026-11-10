import { inspectNatureObject } from "./selection";
import bbox from "@turf/bbox";
import { FireComparison } from "./FireComparison";
import { useState } from "react";
import { Icon } from "@/ui/Icon";
import { Select } from "@/ui/Select";
import { useExperienceStore, selectObject } from "../store";
import { focusAt } from "../navigation";
import { exportReport } from "../tools/exportReport";
import {
  AIR_OBSERVATIONS,
  AIR_SITES,
  FIRE_DAYS,
  FIRE_EVENTS,
  FIRE_SOURCES,
  airValue,
} from "./fire";
import { useNatureStore } from "./store";
import {
  Header,
  Method,
  Stats,
  InspectBack,
  Locate,
  Toggle,
  ToolNav,
} from "./common";
import { date, number } from "./format";
import css from "./Nature.module.css";
export function FirePanel({ tools }: { tools: boolean }) {
  const s = useNatureStore(),
    selected = useExperienceStore((e) => e.selectedId),
    [tool, setTool] = useState<"air" | "perimeters">("air");
  const day = FIRE_DAYS[s.fireDay]!,
    observations = AIR_OBSERVATIONS.filter((o) => o.date === day),
    perimeters = s.fireData?.features ?? [];
  const polygon = perimeters.find(
      (f) => `fire-${f.properties?.id}` === selected,
    ),
    site = AIR_SITES.find((a) => a.id === selected);
  const step = (delta: number) =>
    useNatureStore.setState({
      fireDay: Math.max(0, Math.min(FIRE_DAYS.length - 1, s.fireDay + delta)),
      firePlaying: false,
    });
  const changeDay = (value: number) =>
    useNatureStore.setState({ fireDay: value, firePlaying: false });
  return (
    <div
      className={css.root}
      style={{ "--nature-tone": "#d78655" } as React.CSSProperties}
    >
      <span className={css.tag}>
        <Icon name="fire" />
        Archivio documentato · agosto 2026
      </span>
      {!tools && (
        <Header
          title={tools ? "Strumenti dell’evento" : "Amariana · dopo il fuoco"}
          icon={tools ? "extensions" : "fire"}
        >
          {tools
            ? "Scegli un’attività. Ogni strumento lavora su dati e date documentati."
            : "Tolmezzo–Amaro. Luoghi, misure e decisioni durante l’emergenza."}
        </Header>
      )}
      {!tools && (
        <details className={css.notice}>
          <summary>Evento storico · guida alla lettura</summary>
          <p>
            Le date di agosto restano visibili durante l’esplorazione. Le
            superfici EFFIS sono contorni finali; non descrivono il fronte del
            fuoco in ogni giornata. Non è un’allerta attuale.
          </p>
        </details>
      )}
      {s.fireError && (
        <p role="alert">
          {s.fireError}
          {s.fireData ? " · Conservata la copia precedente." : ""}
        </p>
      )}
      {!tools && (
        <div className={css.actions}>
          <Toggle
            label="Superfici EFFIS"
            value={s.showPerimeters}
            onChange={() =>
              useNatureStore.setState({ showPerimeters: !s.showPerimeters })
            }
          />
          <Toggle
            label="Misure dell’aria"
            value={s.showAir}
            onChange={() => useNatureStore.setState({ showAir: !s.showAir })}
          />
        </div>
      )}
      {tools && (
        <ToolNav
          value={tool}
          onChange={setTool}
          items={[
            {
              id: "air",
              title: "Confronta PM10",
              description: "Due campioni, differenza e scheda esportabile",
              icon: "air",
            },
            {
              id: "perimeters",
              title: "Consulta perimetri",
              description: "Localizza le quattro schede finali EFFIS",
              icon: "areaData",
            },
          ]}
        />
      )}
      {!tools && (
        <section
          className={css.timeline}
          aria-label="Cronologia delle misure ARPA"
        >
          <div className={css.timelineHeader}>
            <div>
              <small>Campagna ARPA · giorno selezionato</small>
              <output>
                {date(day, { day: "numeric", month: "long", year: "numeric" })}
              </output>
            </div>
            <button
              aria-label={
                s.firePlaying
                  ? "Pausa cronologia"
                  : "Riproduci giornate osservate"
              }
              aria-pressed={s.firePlaying}
              onClick={() =>
                useNatureStore.setState({
                  firePlaying: !s.firePlaying,
                  ...(!s.firePlaying && s.fireDay === 5 ? { fireDay: 0 } : {}),
                })
              }
            >
              <Icon name={s.firePlaying ? "close" : "arrow"} />
            </button>
          </div>
          <label>
            Giornate documentate
            <input
              aria-label="Giorno della campagna ARPA"
              type="range"
              min={0}
              max={5}
              step={1}
              value={s.fireDay}
              onChange={(e) => changeDay(Number(e.target.value))}
            />
          </label>
          <div className={css.axis}>
            <span>14 agosto</span>
            <span>19 agosto</span>
          </div>
          <div className={css.pager}>
            <button disabled={s.fireDay === 0} onClick={() => step(-1)}>
              Precedente
            </button>
            <small>{observations.length} misure disponibili</small>
            <button disabled={s.fireDay === 5} onClick={() => step(1)}>
              Successivo
            </button>
          </div>
        </section>
      )}
      {polygon && (!tools || tool === "perimeters") ? (
        <section className={css.section}>
          {tools ? (
            <button
              className={css.back}
              onClick={() => useExperienceStore.setState({ selectedId: null })}
            >
              Torna ai perimetri
            </button>
          ) : (
            <InspectBack />
          )}
          <Header
            inspection
            title={`Scheda EFFIS ${polygon.properties?.id}`}
            icon="areaData"
          >
            {String(polygon.properties?.COMMUNE)} · rilevamento satellitare
          </Header>
          <Locate
            coordinates={(() => {
              const b = bbox(polygon);
              return [(b[0]! + b[2]!) / 2, (b[1]! + b[3]!) / 2] as [
                number,
                number,
              ];
            })()}
            beforeLocate={() =>
              useNatureStore.setState({ showPerimeters: true })
            }
            zoom={13.5}
          />
          <Stats
            items={[
              [
                "AREA_HA nella fonte",
                <>
                  {number(Number(polygon.properties?.AREA_HA))}
                  <small>ha · singola scheda</small>
                </>,
              ],
              [
                "Inizio nella scheda",
                String(polygon.properties?.FIREDATE ?? "").slice(0, 10),
              ],
            ]}
          />
          <dl className={css.facts}>
            {["FIREDATE", "FINALDATE", "LASTUPDATE"].map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{String(polygon.properties?.[k] ?? "Non disponibile")}</dd>
              </div>
            ))}
          </dl>
          <p className={css.muted}>
            Date originali senza attribuire un fuso non dichiarato. FIREDATE e
            FINALDATE non sono l’innesco e lo spegnimento ufficiali. Eventuali
            incongruenze fra date sono conservate dalla fonte.
          </p>
          {s.coincidentIds.length > 1 && (
            <label>
              Schede in questa posizione
              <Select
                label="Schede satellitari sovrapposte"
                value={selected ?? ""}
                onChange={inspectNatureObject}
                options={s.coincidentIds.map((id) => ({
                  value: id,
                  label: `EFFIS ${id.replace("fire-", "")}`,
                }))}
              />
            </label>
          )}
        </section>
      ) : !tools && site ? (
        <section className={css.section}>
          <InspectBack />
          <Header inspection title={site.name} icon="air">
            Localizzazione indicativa della località, non posizione GPS del
            prelievo.
          </Header>
          <Locate coordinates={site.coordinates} zoom={14} />
          <AirChart station={site.id} />
        </section>
      ) : null}
      {tools ? (
        <>
          {tool === "air" ? (
            <FireComparison />
          ) : (
            <>
              <div className={css.notice} role="note">
                <strong>
                  Evoluzione del contorno: non disponibile nei dati importati
                </strong>
                <p>
                  Queste geometrie sono finali. Le date nelle schede non sono
                  versioni successive dello stesso fronte. La cronologia ARPA
                  cambia le misure dell’aria, non il perimetro.
                </p>
                <a
                  href="https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment"
                  target="_blank"
                  rel="noreferrer"
                >
                  Come EFFIS rileva le superfici
                </a>
              </div>
              <section className={css.section}>
                <div className={css.sectionHead}>
                  <h3>Superfici satellitari finali</h3>
                  <small>{perimeters.length} schede</small>
                </div>
                <p className={css.muted}>
                  Riquadro Tolmezzo–Amaro, agosto 2026. Gli eventi vicini sono
                  mantenuti distinti: non sommiamo questi record come ettari
                  unici dell’Amariana.
                </p>
                <div className={css.list}>
                  {perimeters.map((f) => (
                    <button
                      className={css.row}
                      key={String(f.properties?.id)}
                      onClick={() =>
                        useExperienceStore.setState({
                          selectedId: `fire-${f.properties?.id}`,
                          inspectionRequest:
                            useExperienceStore.getState().inspectionRequest + 1,
                        })
                      }
                    >
                      <span>
                        <strong>EFFIS {String(f.properties?.id)}</strong>
                        <small>
                          {String(f.properties?.COMMUNE)} ·{" "}
                          {String(f.properties?.FIREDATE).slice(0, 10)}
                        </small>
                      </span>
                      <span>
                        <strong>
                          {number(Number(f.properties?.AREA_HA))} ha
                        </strong>
                        <small>AREA_HA della fonte</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <section className={css.section}>
            <h3>Misure nel giorno selezionato</h3>
            <div className={css.list} key={day}>
              {observations.map((o) => (
                <button
                  className={`${css.row} ${css.refresh}`}
                  key={`${o.site}-${o.time}`}
                  onClick={() => selectObject(o.site)}
                >
                  <span>
                    <strong>
                      {AIR_SITES.find((a) => a.id === o.site)?.name}
                    </strong>
                    <small>
                      {date(day)} · {o.time} · ora riportata nella fonte
                    </small>
                  </span>
                  <span>
                    <strong>{airValue(o)}</strong>
                    <small>µg/m³ · PM10 istantaneo</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className={css.section}>
            <h3>Decisioni e comunicati</h3>
            {FIRE_EVENTS.map((event) => (
              <article className={css.event} key={event.date}>
                <time>
                  {date(event.date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
                <h4>{event.title}</h4>
                <p>{event.text}</p>
                <div className={css.actions}>
                  <a href={event.source} target="_blank" rel="noreferrer">
                    Leggi la fonte
                  </a>
                  <button onClick={() => focusAt(event.center, 13)}>
                    <Icon name="map" />
                    Inquadra il luogo
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
      <div className={css.mapLegend}>
        Arancio trasparente: perimetri EFFIS finali. Cerchi: misure PM10 del
        giorno, più grandi per valori maggiori; nessuna interpolazione del fumo
        fra località.
      </div>
      <Method>
        <p>
          Perimetri: © Unione europea / Copernicus EMS / JRC–EFFIS, CC BY 4.0.
          Selezione per riquadro e selezione delle schede con FIREDATE
          nell’agosto 2026; conversione GML→GeoJSON, senza disegnare perimetri
          presunti. L’archivio è ricontrollato ogni 6 ore quando il workflow
          dati è attivo.
        </p>
        <p>
          PM10: fatti numerici trascritti dalle tabelle ARPA FVG del 14–19
          agosto. Sono misure speditive istantanee da contaparticelle, non
          confrontabili con il limite normativo della media giornaliera.
          Intervalli e misure ripetute sono conservati. Le località sulla mappa
          sono riferimenti approssimativi: nessuna coordinata GPS di
          campionamento è dichiarata nel bollettino.
        </p>
        <p>
          Le ordinanze sono qui documenti storici, senza dedurre apertura o
          sicurezza attuale dei percorsi. La cronologia avanza fra osservazioni,
          non simula dispersione o propagazione.
        </p>
        <p>
          <a href={FIRE_SOURCES.arpa} target="_blank" rel="noreferrer">
            Tabelle e metodo ARPA
          </a>{" "}
          ·{" "}
          <a href={FIRE_SOURCES.effis} target="_blank" rel="noreferrer">
            Licenza EFFIS
          </a>{" "}
          ·{" "}
          <a href={FIRE_SOURCES.commune} target="_blank" rel="noreferrer">
            Comune di Tolmezzo
          </a>
        </p>
      </Method>
      <button
        onClick={() =>
          exportReport("fire", {
            space: "fire",
            mode: "historical",
            generatedAt: new Date().toISOString(),
            selectedDay: day,
            air: {
              source: FIRE_SOURCES.arpa,
              note: "Misure istantanee; coordinate indicative; nessuna media giornaliera",
              observations: AIR_OBSERVATIONS,
            },
            perimeters: s.fireData,
            events: FIRE_EVENTS,
          })
        }
      >
        <Icon name="fileData" />
        Esporta dossier documentato
      </button>
    </div>
  );
}
export function AirChart({ station }: { station: string }) {
  const points = AIR_OBSERVATIONS.filter((o) => o.site === station),
    [selected, setSelected] = useState(0);
  const max = Math.max(...points.map((p) => p.high)),
    span = Date.parse("2026-08-20") - Date.parse("2026-08-14");
  const x = (p: (typeof points)[number]) =>
    30 +
    ((Date.parse(`${p.date}T${p.time}:00+02:00`) - Date.parse("2026-08-14")) /
      span) *
      270;
  const y = (v: number) => 126 - (v / max) * 100;
  const current = points[Math.min(selected, points.length - 1)]!;
  return (
    <div className={css.section}>
      <svg
        className={css.chart}
        viewBox="0 0 330 165"
        role="img"
        aria-label={`Campioni PM10 a ${AIR_SITES.find((a) => a.id === station)?.name}. Punti singoli e intervalli, senza interpolazione.`}
      >
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line
              x1="30"
              x2="315"
              y1={y(v)}
              y2={y(v)}
              stroke="var(--c-border)"
            />
            <text x="5" y={y(v) - 4}>
              {Math.round(v)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={`${p.date}-${p.time}`}>
            <line
              x1={x(p)}
              x2={x(p)}
              y1={y(p.high)}
              y2={y(p.low)}
              stroke="#d58a59"
              strokeWidth="4"
            />
            <circle
              cx={x(p)}
              cy={y(p.high)}
              r={i === selected ? 5 : 3}
              fill={i === selected ? "var(--c-text)" : "#d58a59"}
            />
          </g>
        ))}
        <text x="30" y="151">
          14 ago
        </text>
        <text x="264" y="151">
          19 ago
        </text>
        <text x="265" y="16">
          µg/m³
        </text>
      </svg>
      <label>
        Esamina i campioni
        <input
          type="range"
          aria-label="Campione PM10"
          min={0}
          max={points.length - 1}
          step={1}
          value={Math.min(selected, points.length - 1)}
          onChange={(e) => setSelected(Number(e.target.value))}
        />
      </label>
      <output>
        {date(current.date)} · {current.time}:{" "}
        <strong>{airValue(current)} µg/m³</strong>
      </output>
      <small>
        Campioni a orari diversi. Il tratto verticale conserva il range
        riportato; i giorni senza misura rimangono vuoti. Nessun confronto con
        soglie giornaliere.
      </small>
    </div>
  );
}
