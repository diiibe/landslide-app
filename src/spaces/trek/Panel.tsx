import { useEffect } from "react";
import { Icon } from "@/ui/Icon";
import { Select } from "@/ui/Select";
import { useAppStore } from "@/app/store";
import { useExperienceStore, selectObject } from "../store";
import { useSpaceClock } from "../useClock";
import { focusAt } from "../navigation";
import { SeriesChart } from "../SeriesChart";
import { Header, Method, Stats, Toggle } from "../nature/common";
import { inspectNatureObject } from "../nature/selection";
import {
  FIRMWARE,
  NODES,
  nodeState,
  samples,
  windowReport,
  stateTone,
  stateLabel,
  firmwareJSON,
  type TrekNode,
} from "./model";
import { setTrekScenario, useTrekStore } from "./store";
import network from "./network.json";
import css from "../nature/Nature.module.css";
import styles from "./Trek.module.css";
const fmt = (n: number, digits = 1) =>
  n.toLocaleString("it-IT", { maximumFractionDigits: digits });
const date = (n: number) =>
  new Date(n).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function locate(node: TrekNode) {
  inspectNatureObject(node.id);
  focusAt(node.coordinates as [number, number], 16);
}
const method = (
  <Method>
    <p>
      Telemetria, rilevamenti BLE, collegamenti e consegne sono simulati. Nessun
      dispositivo è installato né collegato. I conteggi BLE indicano dispositivi
      rilevati nell’intervallo, non persone uniche; non si sommano nodi diversi
      per stimare visitatori.
    </p>
    <p>
      Il modello si ispira alla specifica v0.2: ESP32-S3, E220 e due INA219
      (linea ESP32 e radio), campioni ogni 9–11 minuti nella demo. Il firmware
      pubblico implementa ancora un progetto precedente e non è validato sul
      campo; Master, cloud e app sono da realizzare. Non sono simulati
      temperatura, meteo, stato di carica o autonomia: la specifica non fornisce
      queste misure.
    </p>
    <p>
      Il percorso deriva da OpenStreetMap. Postazioni e topologia sono una
      proposta virtuale, non una mappa di copertura radio, un itinerario
      verificato o un servizio di soccorso.
    </p>
    <p>
      <a
        href={`${FIRMWARE.url}/tree/${FIRMWARE.commit}`}
        target="_blank"
        rel="noreferrer"
      >
        Firmware · revisione {FIRMWARE.commit.slice(0, 8)}
      </a>{" "}
      ·{" "}
      <a
        href="https://www.parcodolomitifriulane.it/sentiero-geologico/sentiero-geologico-montanaia-meluzzo/"
        target="_blank"
        rel="noreferrer"
      >
        Parco · contesto territoriale
      </a>{" "}
      ·{" "}
      <a href={network.provenance.url} target="_blank" rel="noreferrer">
        © OpenStreetMap · ODbL
      </a>
    </p>
  </Method>
);
export function TrekPanel({ tools }: { tools: boolean }) {
  const time = useSpaceClock(),
    s = useTrekStore(),
    selected = useExperienceStore((e) => e.selectedId),
    replay = useExperienceStore((e) => e.replayTime);
  const node = NODES.find((n) => n.id === selected);
  useEffect(() => {
    if (selected && NODES.some((n) => n.id === selected))
      useTrekStore.setState({ nodeId: selected });
  }, [selected]);
  const report = windowReport(time, s.hours, s.scenario),
    states = NODES.map((n) => nodeState(n, time, s.scenario));
  const chosen = NODES.find((n) => n.id === s.nodeId) ?? NODES[0]!;
  return (
    <div className={`${css.root} ${styles.root}`}>
      {!tools && (
        <Header
          title={node ? node.name : "Segnavia in Val Meluzzo"}
          icon="trailMarker"
          inspection={!!node}
        >
          {node
            ? `Nodo ${node.number} · ${fmt(node.distanceM / 1000)} km dal Master sul tracciato OSM`
            : "Val Meluzzo · Parco delle Dolomiti Friulane"}
        </Header>
      )}
      <div className={styles.notice}>
        <strong>Demo · nessuna rete fisica collegata</strong>
        <span>
          {replay === null ? "Ora simulata" : "Replay fisso"} · {date(time)} ·
          Roma
        </span>
      </div>
      <div className={styles.controls}>
        <Select
          label="Istante della demo"
          value={replay === null ? "live" : "fixed"}
          options={[
            ...(replay !== null
              ? [{ value: "fixed", label: `Fisso · ${date(replay)}` }]
              : []),
            { value: "live", label: "Ora attuale" },
            { value: "30", label: "30 minuti fa · replay" },
            { value: "60", label: "1 ora fa · replay" },
            { value: "180", label: "3 ore fa · replay" },
            { value: "360", label: "6 ore fa · replay" },
          ]}
          onChange={(v) => {
            if (v === "fixed") return;
            useExperienceStore.setState({
              replayTime: v === "live" ? null : Date.now() - Number(v) * 60000,
            });
          }}
        />
        <Select
          label="Finestra di confronto"
          value={String(s.hours)}
          options={[
            { value: "6", label: "Ultime 6 ore" },
            { value: "24", label: "Ultime 24 ore" },
          ]}
          onChange={(v) =>
            useTrekStore.setState({ hours: Number(v) as 6 | 24 })
          }
        />
      </div>
      {s.scenario.mode !== "normal" && (
        <p className={styles.exercise}>
          Esercizio:{" "}
          {s.scenario.mode === "uplink"
            ? "collegamento Master–cloud interrotto per 40 minuti"
            : "tensione ridotta sul nodo 106"}
          , dal {date(s.scenario.since)}. Le letture precedenti non cambiano.
        </p>
      )}
      {tools ? (
        <>
          <Select
            label="Estensione SmartTrek"
            value={s.tool}
            options={[
              { value: "passages", label: "Passaggi BLE" },
              { value: "power", label: "Alimentazione" },
              { value: "delivery", label: "Trasmissione e buffer" },
            ]}
            onChange={(v) =>
              useTrekStore.setState({ tool: v as typeof s.tool })
            }
          />
          {s.tool === "passages" ? (
            <Passages time={time} />
          ) : (
            <>
              <Select
                label="Segnavia da controllare"
                value={s.nodeId}
                options={NODES.map((n) => ({
                  value: n.id,
                  label: `${n.number} · ${n.name.replace("Segnavia · ", "")}`,
                }))}
                onChange={(v) => useTrekStore.setState({ nodeId: v })}
              />
              {s.tool === "power" ? (
                <Power node={chosen} time={time} />
              ) : (
                <Delivery node={chosen} time={time} />
              )}
            </>
          )}
        </>
      ) : node ? (
        <>
          <button className={styles.back} onClick={() => selectObject(null)}>
            <Icon name="arrow" />
            Torna alla rete
          </button>
          <NodeDetails node={node} time={time} />
        </>
      ) : (
        <>
          <Stats
            items={[
              ["Postazioni virtuali", 8],
              [
                "Campioni recenti",
                `${states.filter((n) => n.status !== "delayed").length}/8`,
              ],
              ["Record confermati · finestra", report.confirmed],
              ["Record in attesa · modello", report.waiting],
            ]}
          />
          <div className={styles.controls}>
            <Toggle
              label="Tracciato OSM"
              value={s.showRoute}
              onChange={() =>
                useTrekStore.setState({ showRoute: !s.showRoute })
              }
            />
            <Toggle
              label="Topologia logica"
              value={s.showLinks}
              onChange={() =>
                useTrekStore.setState({ showLinks: !s.showLinks })
              }
            />
          </div>
          {s.showLinks && (
            <p className={css.muted}>
              Tratteggi: instradamento ipotizzato verso il Master. Non indicano
              portata, linea di vista o copertura LoRa.
            </p>
          )}
          <Select
            label="Colore dei punti"
            value={s.view}
            options={[
              { value: "health", label: "Stato del campione" },
              { value: "passages", label: "Dispositivi BLE · ultimo campione" },
            ]}
            onChange={(v) =>
              useTrekStore.setState({ view: v as "health" | "passages" })
            }
          />
          <div className={styles.legend}>
            {Object.entries(stateLabel).map(([id, label]) => (
              <span key={id}>
                <i
                  style={{
                    background: stateTone[id as keyof typeof stateTone],
                  }}
                />
                {label}
              </span>
            ))}
          </div>
          <button
            onClick={() => {
              if (
                window.matchMedia(
                  "(max-width:768px), (max-height:500px) and (pointer:coarse)",
                ).matches
              )
                useAppStore.setState({ drawerOpen: false });
              window.dispatchEvent(new CustomEvent("fvg:trek-fit"));
            }}
          >
            <Icon name="map" />
            Inquadra la rete
          </button>
          <section>
            <h3>Apri un segnavia</h3>
            <div className={styles.nodes}>
              {NODES.map((n) => {
                const state = nodeState(n, time, s.scenario);
                return (
                  <button key={n.id} onClick={() => selectObject(n.id)}>
                    <span className={styles.number}>
                      <i style={{ background: stateTone[state.status] }} />
                      {n.number}
                    </span>
                    <span>
                      <strong>{n.name}</strong>
                      <small>
                        {stateLabel[state.status]} · campione{" "}
                        {date(state.sample.at)}
                      </small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                );
              })}
            </div>
          </section>
          <button
            onClick={() => {
              useExperienceStore.setState({ tab: "tools" });
              useAppStore.setState({ drawerOpen: true });
            }}
          >
            <Icon name="extensions" />
            Apri gli strumenti SmartTrek
          </button>
        </>
      )}
      {method}
    </div>
  );
}
function NodeDetails({ node, time }: { node: TrekNode; time: number }) {
  const scenario = useTrekStore((s) => s.scenario),
    r = nodeState(node, time, scenario),
    v = r.sample;
  return (
    <>
      <p className={styles.state} style={{ borderColor: stateTone[r.status] }}>
        {stateLabel[r.status]} · età campione {fmt(r.age / 60000, 0)} min
      </p>
      <Stats
        items={[
          ["Dispositivi BLE · intervallo", v.ble],
          ["Check-in app · intervallo", v.checkins],
          ["Potenza totale", `${fmt(v.powerMw)} mW`],
          [
            "Ricezione LoRa demo",
            node.role === "master" ? "Master locale" : `${v.linkRssi} dBm`,
          ],
        ]}
      />
      <p className={css.muted}>
        Dispositivi unici nel solo intervallo del nodo. Stessa persona o
        dispositivo può comparire di nuovo altrove.
      </p>
      <dl className={styles.timestamps}>
        <div>
          <dt>Campione sintetico</dt>
          <dd>{date(v.at)}</dd>
        </div>
        <div>
          <dt>Ricevuto dal Master demo</dt>
          <dd>{date(v.masterAt)}</dd>
        </div>
        <div>
          <dt>Confermato nel DB demo</dt>
          <dd>{date(v.cloudAt)}</dd>
        </div>
      </dl>
      <button onClick={() => locate(node)}>
        <Icon name="map" />
        Mostra sulla mappa
      </button>
      <button
        onClick={() => {
          useTrekStore.setState({ tool: "power", nodeId: node.id });
          useExperienceStore.setState({ tab: "tools" });
        }}
      >
        <Icon name="extensions" />
        Controlla questo segnavia
      </button>
    </>
  );
}
function Passages({ time }: { time: number }) {
  const s = useTrekStore(),
    report = windowReport(time, s.hours, s.scenario),
    rows = NODES.map((n) => {
      const items = report.stored.filter((r) => r.nodeId === n.id);
      return {
        n,
        ble: items.reduce((v, r) => v + r.ble, 0),
        app: items.reduce((v, r) => v + r.checkins, 0),
        count: items.length,
      };
    }),
    max = Math.max(1, ...rows.map((r) => r.ble));
  return (
    <section className={styles.task}>
      <h3>Confronta i rilevamenti, non le persone</h3>
      <p>
        Solo campioni già confermati nel cloud demo nelle ultime {s.hours} ore.
        La stessa persona può comparire in più nodi o intervalli.
      </p>
      <div className={styles.bars}>
        {rows.map((r) => (
          <div key={r.n.id}>
            <span>
              {r.n.number}
              {r.n.role === "master" ? " · Master" : ""}
            </span>
            <div className={styles.bar}>
              <span style={{ width: `${(r.ble / max) * 100}%` }} />
            </div>
            <strong>{r.ble}</strong>
            <small>
              {r.app} check-in · {r.count} campioni
            </small>
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          download(
            "smarttrek-passaggi-demo.csv",
            `nodo;dispositivi_intervalli;checkin;campioni;ore;simulato\n${rows.map((r) => `${r.n.number};${r.ble};${r.app};${r.count};${s.hours};true`).join("\n")}`,
            "text/csv;charset=utf-8",
          )
        }
      >
        <Icon name="fileData" />
        Esporta il confronto CSV
      </button>
    </section>
  );
}
function Power({ node, time }: { node: TrekNode; time: number }) {
  const s = useTrekStore(),
    current = nodeState(node, time, s.scenario).sample,
    history = samples(node, time - s.hours * 3600000, time, s.scenario).filter(
      (r) => r.cloudAt <= time,
    );
  return (
    <section className={styles.task}>
      <h3 data-space-inspection>{node.number} · due linee da controllare</h3>
      <div className={styles.rails}>
        {[
          ["ESP32", current.espMv, current.espMa],
          ["Radio E220", current.radioMv, current.radioMa],
        ].map(([name, mv, ma]) => (
          <div key={name}>
            <h4>{name}</h4>
            <strong>{fmt(Number(mv) / 1000, 3)} V</strong>
            <span>{fmt(Number(ma))} mA</span>
            <small>{fmt((Number(mv) * Number(ma)) / 1000)} mW</small>
          </div>
        ))}
      </div>
      <p>
        Potenza totale: <strong>{fmt(current.powerMw)} mW</strong>. Campione del{" "}
        {date(current.at)}.
      </p>
      {!current.timeSynced && (
        <p className={styles.exercise}>
          Ora del nodo non sincronizzata. La data è ricostruita dal simulatore;
          non attribuisce precisione all’orologio del dispositivo.
        </p>
      )}
      <SeriesChart
        key={`${node.id}-${s.hours}`}
        points={history.map((r) => ({ time: r.at, value: r.powerMw }))}
        unit="mW"
        color="#86b79b"
        label="Storico sintetico della potenza totale già ricevuta"
      />
      <p className={css.muted}>
        Soglia dimostrativa: 3,15–3,45 V per linea. Nessuna misura di carica o
        stima di autonomia: la baseline descrive un’alimentazione di banco, non
        una batteria caratterizzata.
      </p>
      <ScenarioControl time={time} />
      <button onClick={() => locate(node)}>
        <Icon name="map" />
        Mostra sulla mappa
      </button>
      <details>
        <summary>Campione JSON · nomi e unità della specifica</summary>
        <pre className={styles.json}>
          {JSON.stringify(firmwareJSON(node, current), null, 2)}
        </pre>
        <button
          onClick={() =>
            download(
              `smarttrek-${node.number}-demo.json`,
              JSON.stringify(firmwareJSON(node, current), null, 2),
              "application/json",
            )
          }
        >
          <Icon name="fileData" />
          Esporta campione JSON demo
        </button>
      </details>
    </section>
  );
}
function ScenarioControl({ time }: { time: number }) {
  const scenario = useTrekStore((s) => s.scenario);
  return (
    <Select
      label="Esercizio della rete · simulato"
      value={scenario.mode}
      options={[
        { value: "normal", label: "Funzionamento ordinario" },
        { value: "uplink", label: "Master senza cloud · prova di 40 min" },
        { value: "supply", label: "Tensione bassa · nodo 106" },
      ]}
      onChange={(v) => setTrekScenario(v as typeof scenario.mode, time)}
    />
  );
}
function Delivery({ node, time }: { node: TrekNode; time: number }) {
  const s = useTrekStore(),
    report = windowReport(time, s.hours, s.scenario),
    mine = report.all.filter((r) => r.nodeId === node.id),
    last = mine[mine.length - 1],
    waiting = report.pending.filter((r) => r.nodeId === node.id).length;
  return (
    <section className={styles.task}>
      <h3 data-space-inspection>Segui i dati del nodo {node.number}</h3>
      <p>
        Una ricezione radio non è una conferma di salvataggio. La demo tiene
        separate le tre fasi.
      </p>
      <ScenarioControl time={time} />
      <ol className={styles.pipeline}>
        <li>
          <strong>1 · Campioni creati</strong>
          <span>
            {mine.length} nella finestra di {s.hours} ore
          </span>
        </li>
        <li>
          <strong>2 · Ricevuti dal Master</strong>
          <span>
            {mine.filter((r) => r.masterAt <= time).length} · inoltro locale
            simulato
          </span>
        </li>
        <li>
          <strong>3 · Confermati nel DB demo</strong>
          <span>
            {mine.filter((r) => r.cloudAt <= time).length} · {waiting} ancora in
            attesa
          </span>
        </li>
      </ol>
      <p className={styles.balance}>
        Rete intera · {report.total} creati = {report.confirmed} confermati +{" "}
        {report.waiting} in attesa
      </p>
      {last && (
        <dl className={styles.timestamps}>
          <div>
            <dt>Ultimo campione generato</dt>
            <dd>{date(last.at)}</dd>
          </div>
          <div>
            <dt>Arrivo al Master</dt>
            <dd>
              {last.masterAt <= time
                ? date(last.masterAt)
                : "In transito simulato"}
            </dd>
          </div>
          <div>
            <dt>Conferma DB</dt>
            <dd>
              {last.cloudAt <= time
                ? date(last.cloudAt)
                : "Non ancora confermato"}
            </dd>
          </div>
        </dl>
      )}
      <p className={css.muted}>
        Il buffer è calcolato dal simulatore, non letto da un Master offline.
        Dopo la prova di 40 minuti il modello svuota la coda; non misura
        latenza, affidabilità o prestazioni RF reali. Le conferme durabili sono
        un requisito ancora da riconciliare nel progetto v0.2.
      </p>
      <button onClick={() => locate(node)}>
        <Icon name="map" />
        Inquadra il segnavia
      </button>
    </section>
  );
}
