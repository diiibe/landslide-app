import { useMemo, useState } from "react";
import { Icon } from "@/ui/Icon";
import { Select } from "@/ui/Select";
import { experience, DEMO_NOTE } from "./experiences";
import { selectObject, setScenario, useExperienceStore } from "./store";
import {
  dailyEntries,
  demand,
  formatValue,
  history,
  localTime,
  presence,
  reading,
  simulatedEvents,
  TIME,
  trafficAt,
  zonePeople,
} from "./simulation";
import { useSpaceClock } from "./useClock";
import { SeriesChart } from "./SeriesChart";
import { focusAt, zoneCenter } from "./navigation";
import type { DemoSensor, DemoZone, Experience, Metric } from "./types";
import styles from "./Panel.module.css";
const LABELS: Record<Metric, string> = {
  power: "Energia assorbita",
  solar: "Generazione solare",
  temperature: "Temperatura",
  vibration: "Vibrazioni",
  pressure: "Pressione",
  water: "Portata acqua",
  moisture: "Umidità del suolo",
  humidity: "Umidità relativa",
  tank: "Livello riserva",
  entries: "Passaggi",
  people: "Presenze",
  parking: "Posti liberi",
  co2: "CO₂",
  flow: "Flussi veicolari",
  speed: "Velocità",
  queue: "Code",
  wind: "Vento",
  lift: "Transiti impianto",
};
const clock = (t: number) =>
  new Date(t).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
export function DemoPanel() {
  const id = useExperienceStore((s) => s.activeId),
    selected = useExperienceStore((s) => s.selectedId),
    time = useSpaceClock(),
    scene = experience(id);
  if (!scene || scene.id === "landslides") return null;
  const sensor = scene.sensors.find((a) => a.id === selected),
    zone = scene.zones.find((z) => z.id === selected),
    route = scene.routes.find((r) => r.id === selected);
  return (
    <div
      className={styles.panel}
      style={{ "--space-tone": scene.tone } as React.CSSProperties}
    >
      <section className={styles.intro}>
        <span className={styles.badge} data-demo="true">
          Demo simulata · nessun dato aziendale reale
        </span>
        {!selected && (
          <>
            <h2>{scene.title}</h2>
            <p className={styles.caption}>
              {scene.subtitle} · riferimento {scene.reference.name}
            </p>
          </>
        )}
      </section>
      {sensor ? (
        <SensorInspector scene={scene} sensor={sensor} time={time} />
      ) : zone ? (
        <ZoneInspector scene={scene} zone={zone} time={time} />
      ) : route ? (
        <section className={styles.section}>
          <Back />
          <h2>{route.name}</h2>
          <p className={styles.caption}>
            Tracciato dell’esperienza dimostrativa ·{" "}
            {scene.id === "traffic" ? "sezione stradale" : "percorso di sito"}
          </p>
          {scene.id === "traffic" && (
            <>
              <div className={styles.kpis}>
                <div>
                  <strong>
                    {formatValue(
                      trafficAt(
                        scene,
                        time,
                        useExperienceStore.getState().scenario,
                        scene.routes.indexOf(route),
                      ).flow,
                      "veicoli/h",
                    )}
                  </strong>
                  <span>Passaggi/h sulla sezione</span>
                </div>
                <div>
                  <strong>
                    {formatValue(
                      trafficAt(
                        scene,
                        time,
                        useExperienceStore.getState().scenario,
                        scene.routes.indexOf(route),
                      ).speed,
                      "km/h",
                    )}
                  </strong>
                  <span>km/h simulati</span>
                </div>
              </div>
              <p className={styles.caption}>
                La velocità deriva da una relazione dimostrativa tra domanda e
                capacità. Non è una previsione di traffico.
              </p>
            </>
          )}
          <button
            onClick={() =>
              focusAt(
                route.coordinates[Math.floor(route.coordinates.length / 2)]!,
                15,
              )
            }
          >
            <Icon name="map" />
            Mostra il percorso
          </button>
          <p className={styles.caption}>
            I simboli in movimento rappresentano un flusso aggregato, non mezzi
            o persone tracciati.
          </p>
        </section>
      ) : (
        <Overview scene={scene} time={time} />
      )}
      {selected && (
        <>
          <Timeline time={time} />
          <ScenarioControls scene={scene} />
        </>
      )}
      <details>
        <summary>Riferimento, metodo e attendibilità</summary>
        <p>{scene.reference.note}</p>
        <p>
          <a href={scene.reference.url} target="_blank" rel="noreferrer">
            Consulta il riferimento geografico
          </a>
        </p>
        <p>
          {DEMO_NOTE}. Nessuna affiliazione o collaborazione con le aziende è
          implicita. Le soglie sono illustrative, non limiti di sicurezza
          certificati.
        </p>
        <p>
          La simulazione segue l’orologio e ricostruisce lo stato corrente
          quando ritorni. Grafici e replay sono campioni generati dallo stesso
          modello, non osservazioni storiche. Profili giornalieri, permanenze e
          scenari sono ipotesi esplorative.
        </p>
        {scene.id === "traffic" && (
          <p>
            Geometrie OpenStreetMap. Passaggi su sezioni diverse possono contare
            più volte lo stesso percorso; i simboli animati sono una
            rappresentazione del flusso.
          </p>
        )}
        {scene.id === "retail" && (
          <p>
            Gli ingressi sono passaggi, non visitatori unici. Le presenze
            derivano da ingressi e tempi di permanenza sintetici; il totale è
            ripartito tra negozi e spazi comuni rispettando le capienze
            dimostrative. Non sono rilevati volti, dispositivi o identità.
          </p>
        )}
      </details>
    </div>
  );
}
function Back() {
  return (
    <div className={styles.backRow}>
      <button
        aria-label="Torna alla panoramica dello spazio"
        onClick={() => useExperienceStore.setState({ selectedId: null })}
      >
        <Icon name="arrow" />
      </button>
      <small>Panoramica dello spazio</small>
    </div>
  );
}
function Overview({ scene, time }: { scene: Experience; time: number }) {
  const scenario = useExperienceStore((s) => s.scenario),
    filter = useExperienceStore((s) => s.filter);
  const values = scene.sensors.map((a) => ({
    sensor: a,
    ...reading(scene, a, time, scenario),
  }));
  const affected = values.filter((a) => a.status !== "normal");
  let kpis: { value: string; unit?: string; label: string }[] = [];
  const sum = (metric: Metric) =>
    values
      .filter((a) => a.sensor.metric === metric)
      .reduce((s, a) => s + a.value, 0);
  const val = (id: string) =>
    values.find((a) => a.sensor.id === id)?.value ?? 0;
  if (scene.id === "industry")
    kpis = [
      {
        value: formatValue(Math.max(0, sum("power") - sum("solar")), "kW"),
        unit: "kW",
        label: "Prelievo di sito simulato",
      },
      {
        value: formatValue(sum("solar"), "kW"),
        unit: "kW",
        label: "Generazione solare",
      },
      {
        value: formatValue(sum("flow"), "veicoli/h"),
        label: "Passaggi mezzi/h",
      },
      { value: String(affected.length), label: "Letture fuori dal profilo" },
    ];
  else if (scene.id === "vineyard")
    kpis = [
      {
        value: formatValue(
          sum("moisture") /
            values.filter((a) => a.sensor.metric === "moisture").length,
          "%",
        ),
        unit: "%",
        label: "Umidità media delle sonde",
      },
      {
        value: formatValue(sum("water"), "m³/h"),
        unit: "m³/h",
        label: "Portata irrigua totale",
      },
      {
        value: String(presence(scene, time, scenario)),
        label: "Presenze in visita",
      },
      {
        value: formatValue(val("v-tank"), "%"),
        unit: "%",
        label: "Riserva idrica virtuale",
      },
    ];
  else if (scene.id === "retail")
    kpis = [
      {
        value: formatValue(dailyEntries(scene, time, scenario), "persone"),
        label: "Passaggi in ingresso oggi",
      },
      {
        value: String(presence(scene, time, scenario)),
        label: "Persone virtuali presenti",
      },
      {
        value: formatValue(demand(scene, time, scenario), "passaggi/h"),
        unit: "/h",
        label: "Flusso in ingresso",
      },
      { value: String(val("r-park")), label: "Posti auto disponibili" },
    ];
  else if (scene.id === "traffic") {
    const states = scene.routes.map((_, i) =>
        trafficAt(scene, time, scenario, i),
      ),
      flow = states.reduce((s, v) => s + v.flow, 0);
    kpis = [
      {
        value: formatValue(flow, "veicoli/h"),
        unit: "/h",
        label: "Passaggi sulle sezioni",
      },
      {
        value: formatValue(
          states.reduce((s, v) => s + v.speed * v.flow, 0) / (flow || 1),
          "km/h",
        ),
        unit: "km/h",
        label: "Velocità media ponderata",
      },
      {
        value: String(states.reduce((s, v) => s + v.queue, 0)),
        label: "Veicoli nelle code simulate",
      },
      { value: String(val("t-park")), label: "Posti interscambio demo" },
    ];
  } else
    kpis = [
      {
        value: String(presence(scene, time, scenario)),
        label: "Visitatori virtuali presenti",
      },
      {
        value: formatValue(val("m-wind"), "km/h"),
        unit: "km/h",
        label: "Vento in quota simulato",
      },
      {
        value: formatValue(val("m-lift"), "persone/h"),
        unit: "/h",
        label: "Transiti impianto demo",
      },
      { value: String(val("m-parking")), label: "Posti auto disponibili" },
    ];
  const metrics = [...new Set(scene.sensors.map((a) => a.metric))],
    people = zonePeople(scene, time, scenario);
  return (
    <>
      <div className={styles.kpis}>
        {kpis.map((k) => (
          <div key={k.label}>
            <strong>
              {k.value} {k.unit && <small>{k.unit}</small>}
            </strong>
            <span>{k.label}</span>
          </div>
        ))}
      </div>
      {["retail", "vineyard", "mountain"].includes(scene.id) &&
        demand(scene, time, scenario) === 0 && (
          <div className={styles.loading}>
            Ora sei nella fascia di chiusura del modello. Sensori e servizi
            continuano a evolvere. Usa la timeline per esplorare una giornata
            attiva.
            <button
              onClick={() =>
                useExperienceStore.setState({
                  replayTime: mostRecent(scene.id === "retail" ? 17 : 13),
                  playback: false,
                })
              }
            >
              Esplora una giornata attiva
            </button>
          </div>
        )}
      <Timeline time={time} />
      <details>
        <summary>Prova uno scenario</summary>
        <ScenarioControls scene={scene} />
      </details>
      {affected.length > 0 && (
        <section className={styles.section}>
          <div className={styles.subhead}>
            <h3>Da osservare nello scenario</h3>
            <small>{affected.length}</small>
          </div>
          <div className={styles.list}>
            {affected.slice(0, 3).map((a) => (
              <button
                key={a.sensor.id}
                onClick={() => selectObject(a.sensor.id)}
              >
                <span>
                  <strong>{a.sensor.name}</strong>
                  <small className={styles.status} data-status={a.status}>
                    {a.label} · simulato
                  </small>
                </span>
                <b className={styles.value}>
                  {formatValue(a.value, a.sensor.unit)}{" "}
                  <small>{a.sensor.unit}</small>
                </b>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </section>
      )}
      <section className={styles.section}>
        <div className={styles.subhead}>
          <h3>
            {scene.id === "retail"
              ? "Negozi e spazi comuni"
              : "Esplora le zone"}
          </h3>
          <small>{scene.zones.length}</small>
        </div>
        <div className={`${styles.list} ${styles.zones}`}>
          {scene.zones.map((z) => (
            <button
              key={z.id}
              className={styles.zoneRow}
              onClick={() => selectObject(z.id)}
            >
              <span
                className={styles.zoneDot}
                style={{ background: z.color }}
              />
              <span>
                <strong>{z.name}</strong>
                <small>
                  {z.kind} ·{" "}
                  {scene.sensors.filter((a) => a.zone === z.id).length} sensori
                  {people[z.id] !== undefined
                    ? ` · ${people[z.id]} persone`
                    : ""}
                </small>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <h3>Sensori della demo</h3>
        <Select
          label="Filtra i sensori per misura"
          value={filter}
          onChange={(v) =>
            useExperienceStore.setState({ filter: v as Metric | "all" })
          }
          options={[
            {
              value: "all",
              label: `Tutte le misure · ${scene.sensors.length}`,
            },
            ...metrics.map((m) => ({ value: m, label: LABELS[m] })),
          ]}
        />
        <div className={styles.list}>
          {values
            .filter((a) => filter === "all" || a.sensor.metric === filter)
            .map((a) => (
              <button
                key={a.sensor.id}
                onClick={() => selectObject(a.sensor.id)}
              >
                <Icon name="sensor" />
                <span>
                  <strong>{a.sensor.name}</strong>
                  <small>{LABELS[a.sensor.metric]}</small>
                </span>
                <span className={styles.value}>
                  {formatValue(a.value, a.sensor.unit)}
                  <small> {a.sensor.unit}</small>
                </span>
              </button>
            ))}
        </div>
      </section>
      <section className={styles.section}>
        <h3>Nel ritmo dello spazio</h3>
        <div className={`${styles.list} ${styles.events}`}>
          {simulatedEvents(scene, time).map((e) => (
            <button
              key={e.id}
              onClick={() => {
                selectObject(e.zone);
                useExperienceStore.setState({
                  replayTime: e.time,
                  playback: false,
                });
              }}
            >
              <time dateTime={new Date(e.time).toISOString()}>
                {clock(e.time)}
              </time>
              <span>
                <strong>{e.title}</strong>
                <p>Evento del modello · esplora quel momento</p>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
function SensorInspector({
  scene,
  sensor,
  time,
}: {
  scene: Experience;
  sensor: DemoSensor;
  time: number;
}) {
  const scenario = useExperienceStore((s) => s.scenario),
    [hours, setHours] = useState(24);
  const sample = reading(scene, sensor, time, scenario),
    minute = Math.floor(time / TIME.MIN);
  const points = useMemo(
    () => history(scene, sensor, minute * TIME.MIN, scenario, hours),
    [scene, sensor, minute, scenario, hours],
  );
  const ordinary = useMemo(
    () =>
      scenario.id === "normal"
        ? undefined
        : history(
            scene,
            sensor,
            minute * TIME.MIN,
            { id: "normal", since: 0 },
            hours,
          ),
    [scene, sensor, minute, scenario.id, hours],
  );
  return (
    <section
      className={styles.section}
      aria-label="Scheda del sensore simulato"
    >
      <Back />
      <div>
        <small>{LABELS[sensor.metric]} · sensore dimostrativo</small>
        <h2>{sensor.name}</h2>
      </div>
      <div>
        <div className={styles.metric}>
          {formatValue(sample.value, sensor.unit)} <small>{sensor.unit}</small>
        </div>
        <span className={styles.status} data-status={sample.status}>
          {sample.label} · simulato
        </span>
      </div>
      <p className={styles.caption}>{sensor.note}</p>
      <button onClick={() => focusAt(sensor.coordinates)}>
        <Icon name="map" />
        Mostra sulla mappa
      </button>
      <div className={styles.subhead}>
        <h3>Andamento simulato</h3>
        <div className={styles.pills}>
          {[6, 24].map((n) => (
            <button
              key={n}
              aria-pressed={hours === n}
              onClick={() => setHours(n)}
            >
              {n} h
            </button>
          ))}
        </div>
      </div>
      <SeriesChart
        key={sensor.id}
        points={points}
        {...(ordinary?{comparison:ordinary}:{})}
        unit={sensor.unit}
        color={scene.tone}
        label={`${sensor.name}, ultimi ${hours} ore simulate`}
        {...(sensor.high !== undefined
          ? { limit: sensor.high }
          : sensor.low !== undefined
            ? { limit: sensor.low }
            : {})}
      />
      <p className={styles.caption}>
        97 campioni generati dal modello. Trascina il cursore o usa le frecce
        per confrontare i valori. Nessun dato osservato è usato in questa serie.
      </p>
      {(sensor.high !== undefined || sensor.low !== undefined) && (
        <div className={styles.loading}>
          Fascia dimostrativa:{" "}
          {sensor.low !== undefined ? `da ${sensor.low}` : "fino a"}{" "}
          {sensor.high !== undefined ? sensor.high : ""} {sensor.unit}. Serve
          all’esplorazione della demo, non a valutazioni di sicurezza.
        </div>
      )}
      <div className={styles.actions}>
        <button onClick={() => selectObject(sensor.zone)}>
          <Icon name="areaData" />
          Esplora la zona
        </button>
        <button
          onClick={() =>
            useExperienceStore.setState({
              selectedId: null,
              filter: sensor.metric,
            })
          }
        >
          Altre misure simili
        </button>
      </div>
    </section>
  );
}
function ZoneInspector({
  scene,
  zone,
  time,
}: {
  scene: Experience;
  zone: DemoZone;
  time: number;
}) {
  const scenario = useExperienceStore((s) => s.scenario),
    assets = scene.sensors.filter((a) => a.zone === zone.id),
    people = zonePeople(scene, time, scenario)[zone.id];
  return (
    <section className={styles.section} aria-label="Scheda della zona simulata">
      <Back />
      <div>
        <small>{zone.kind} · zona dimostrativa</small>
        <h2>{zone.name}</h2>
      </div>
      {people !== undefined && (
        <div className={styles.kpis}>
          <div>
            <strong>{people}</strong>
            <span>Persone virtuali presenti</span>
          </div>
          <div>
            <strong>
              {zone.capacity
                ? `${Math.round((people / zone.capacity) * 100)}%`
                : "—"}
            </strong>
            <span>Capienza dimostrativa utilizzata</span>
          </div>
        </div>
      )}
      <button onClick={() => focusAt(zoneCenter(zone.geometry), 16.8)}>
        <Icon name="map" />
        Inquadra la zona
      </button>
      <div className={styles.list}>
        {assets.map((a) => {
          const v = reading(scene, a, time, scenario);
          return (
            <button key={a.id} onClick={() => selectObject(a.id)}>
              <Icon name="sensor" />
              <span>
                <strong>{a.name}</strong>
                <small>{LABELS[a.metric]}</small>
              </span>
              <span className={styles.value}>
                {formatValue(v.value, a.unit)}
                <small> {a.unit}</small>
              </span>
              <Icon name="chevron" />
            </button>
          );
        })}
      </div>
      {!assets.length && (
        <p className={styles.caption}>
          Questa zona serve come contesto del modello. Seleziona un sensore
          nelle zone vicine per leggere le misure.
        </p>
      )}
      <p className={styles.caption}>
        Il perimetro è illustrativo. Le presenze sono aggregate e sintetiche;
        non localizzano persone reali.
      </p>
    </section>
  );
}
function mostRecent(hour: number) {
  const now = Date.now();
  for (
    let t = Math.floor(now / TIME.MIN) * TIME.MIN;
    t > now - 30 * TIME.HOUR;
    t -= TIME.MIN
  )
    if (Math.abs(localTime(t).hour - hour) < 0.001) return t;
  return now;
}
function Timeline({ time }: { time: number }) {
  const wallNow = useSpaceClock(true);
  const replay = useExperienceStore((s) => s.replayTime),
    playing = useExperienceStore((s) => s.playback),
    minutes =
      replay === null
        ? 1440
        : Math.max(
            0,
            Math.min(1440, 1440 - Math.round((wallNow - replay) / TIME.MIN)),
          );
  return (
    <section
      className={styles.timeline}
      aria-label="Timeline della simulazione"
    >
      <div className={styles.subhead}>
        <h3>{replay === null ? "Ora della simulazione" : "Replay simulato"}</h3>
        <time dateTime={new Date(time).toISOString()}>
          {new Date(time).toLocaleString("it-IT", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Rome",
          })}
        </time>
      </div>
      <details {...(replay !== null ? { open: true } : {})}>
        <summary>Esplora le ultime 24 ore</summary>
        <label>
          Orario della simulazione
          <input
            type="range"
            aria-label="Orario della simulazione"
            min="0"
            max="1440"
            step="5"
            value={minutes}
            onChange={(e) =>
              useExperienceStore.setState({
                replayTime:
                  Date.now() - (1440 - Number(e.target.value)) * TIME.MIN,
                playback: false,
              })
            }
          />
        </label>
        <div className={styles.actions}>
          {[
            [8, "08:00"],
            [13, "13:00"],
            [17, "17:00"],
          ].map(([hour, label]) => (
            <button
              key={hour}
              onClick={() =>
                useExperienceStore.setState({
                  replayTime: mostRecent(Number(hour)),
                  playback: false,
                })
              }
            >
              {label}
            </button>
          ))}
          <button
            aria-pressed={replay === null}
            onClick={() =>
              useExperienceStore.setState({ replayTime: null, playback: false })
            }
          >
            Adesso
          </button>
        </div>
        {replay !== null && (
          <button
            onClick={() => useExperienceStore.setState({ playback: !playing })}
          >
            {playing ? "Pausa replay" : "Riproduci · 1 minuto al secondo"}
          </button>
        )}
      </details>
      <small>
        {replay === null
          ? "Segue l’orologio locale, anche quando ritorni dopo una pausa."
          : "Vista storica sintetica. Gli indicatori e la mappa mostrano lo stesso istante."}
      </small>
    </section>
  );
}
function ScenarioControls({ scene }: { scene: Experience }) {
  const s = useExperienceStore((s) => s.scenario);
  return (
    <section className={styles.section}>
      <h3>Prova un’altra ipotesi</h3>
      <div className={styles.scenarioGrid}>
        {scene.scenarios.map((v) => (
          <button
            key={v.id}
            aria-pressed={s.id === v.id}
            onClick={() => setScenario(v.id)}
          >
            {v.title}
          </button>
        ))}
      </div>
      <p className={styles.caption}>
        {scene.scenarios.find((v) => v.id === s.id)?.detail}{" "}
        {s.id !== "normal"
          ? `Ipotesi attivata alle ${clock(s.since)}. Prima di quell’istante vale il ciclo ordinario.`
          : "Nessun comando viene inviato a impianti reali."}
      </p>
    </section>
  );
}
