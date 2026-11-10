import { inspectNatureObject } from "./selection";
import { parkWorklist, downloadWorklist } from "./worklist";
import { useState } from "react";
import { Icon } from "@/ui/Icon";
import { SearchField } from "@/ui/SearchField";
import { Select } from "@/ui/Select";
import { useRegionalStore } from "@/regional/store";
import { useExperienceStore, selectObject } from "../store";
import { exportReport } from "../tools/exportReport";
import {
  useNatureStore,
  treeId,
  treeMatches,
  treeFamilyColor,
  addToPlan,
  type TreeFeature,
} from "./store";
import { Header, Method, Stats, InspectBack, Locate, ToolNav } from "./common";
import { date, number } from "./format";
import { groupTrees, orderPlan } from "./park";
import css from "./Nature.module.css";
export function ParkPanel({ tools }: { tools: boolean }) {
  const s = useNatureStore(),
    selected = useExperienceStore((e) => e.selectedId),
    [limit, setLimit] = useState(15),
    [tool, setTool] = useState<"visit" | "archive">("visit");
  const trees = s.trees.filter((t) => treeMatches(t, s)),
    tree = s.trees.find((t) => treeId(t) === selected),
    families = groupTrees(s.trees, "familia"),
    species = groupTrees(s.trees, "specie"),
    dates = groupTrees(s.trees, "data_rilievo");
  const plan = s.plan.flatMap((id) => {
      const t = s.trees.find((t) => treeId(t) === id);
      return t ? [t] : [];
    }),
    completed = plan.filter((t) => s.inspections[treeId(t)]).length,
    orphaned = s.plan.length - plan.length;
  const familiesShown = groupTrees(trees, "familia"),
    prox = orderPlan(s.plan, s.trees);
  return (
    <div
      className={css.root}
      style={{ "--nature-tone": "#6da47b" } as React.CSSProperties}
    >
      <span className={css.tag}>
        <Icon name="tree" />
        ERPAC · archivio reale / gestione demo
      </span>
      {!tools && (
        <Header
          title={
            tools ? "Organizza i sopralluoghi" : "Villa Manin · patrimonio vivo"
          }
          icon={tools ? "extensions" : "tree"}
        >
          {tools
            ? "Seleziona esemplari, registra le verifiche e scarica una lista di lavoro."
            : "Esplora specie e caratteri documentati degli alberi geolocalizzati."}
        </Header>
      )}
      {!tools && (
        <details className={css.notice}>
          <summary>Rilievi 2001–2002 · come leggerli</summary>
          <p>
            Le condizioni riportate sono quelle dell’archivio, non diagnosi
            attuali. Le nuove annotazioni sono un’esercitazione e restano
            separate.
          </p>
        </details>
      )}
      {s.treeLoading && <p role="status">Verifica del censimento ERPAC…</p>}
      {s.treeError && (
        <div role="alert">
          {s.treeError}
          {s.trees.length ? " · Resta visibile la copia precedente." : ""}
          <button
            onClick={() =>
              useRegionalStore.setState((r) => ({
                refreshKey: r.refreshKey + 1,
              }))
            }
          >
            Riprova il censimento
          </button>
        </div>
      )}
      {!tools && (
        <Stats
          items={[
            ["Posizioni consultabili", s.trees.length],
            ["Righe della fonte", s.treeInputRows],
            [
              "Specie nelle posizioni",
              species.filter((a) => a.label !== "Non indicato").length,
            ],
            [
              "Famiglie nelle posizioni",
              families.filter((a) => a.label !== "Non indicato").length,
            ],
          ]}
        />
      )}
      {tools && (
        <ToolNav
          value={tool}
          onChange={setTool}
          items={[
            {
              id: "visit",
              title: "Prepara sopralluogo",
              description: "Seleziona, annota e scarica la lista di lavoro",
              icon: "tree",
            },
            {
              id: "archive",
              title: "Verifica archivio",
              description: "Date e coordinate disponibili nella fonte",
              icon: "fileData",
            },
          ]}
        />
      )}
      {tree && (!tools || tool === "visit") && (
        <section className={css.section}>
          {tools ? (
            <button
              className={css.back}
              onClick={() => useExperienceStore.setState({ selectedId: null })}
            >
              <Icon name="arrow" />
              Torna al giro
            </button>
          ) : (
            <InspectBack />
          )}
          <TreeDetails key={treeId(tree)} tree={tree} />
        </section>
      )}
      {tools ? (
        <>
          {tool === "visit" ? (
            <section className={css.section}>
              <div className={css.sectionHead}>
                <h3>Il giro di sopralluogo</h3>
                <small>Simulazione · questa sessione</small>
              </div>
              <div
                className={css.progress}
                role="progressbar"
                aria-label="Sopralluoghi demo completati"
                aria-valuemin={0}
                aria-valuemax={plan.length || 1}
                aria-valuenow={completed}
              >
                <i
                  style={{
                    transform: `scaleX(${completed / Math.max(1, plan.length)})`,
                  }}
                />
              </div>
              <p>
                <strong>
                  {completed} di {plan.length}
                </strong>{" "}
                schede annotate nell’esercitazione
              </p>
              <label>
                Tempo ipotizzato per esemplare · {s.minutes} minuti
                <input
                  type="range"
                  min={3}
                  max={30}
                  step={1}
                  aria-label="Minuti ipotizzati per sopralluogo"
                  value={s.minutes}
                  onChange={(e) =>
                    useNatureStore.setState({ minutes: Number(e.target.value) })
                  }
                />
              </label>
              <Stats
                items={[
                  [
                    "Tempo di sola attività",
                    <>
                      {plan.length * s.minutes}
                      <small>min · trasferimenti esclusi</small>
                    </>,
                  ],
                  [
                    "Distanza nell’ordine proposto",
                    <>
                      {number(prox.distance)}
                      <small>m in linea d’aria, non percorso</small>
                    </>,
                  ],
                ]}
              />
              <small>
                L’ordine di prossimità parte dal primo albero inserito. Non
                verifica sentieri, accessi, ostacoli o condizioni di sicurezza.
              </small>
              <div className={css.actions}>
                <button
                  disabled={plan.length < 2}
                  onClick={() =>
                    useNatureStore.setState({
                      plan: [
                        ...prox.ids,
                        ...s.plan.filter((id) => !prox.ids.includes(id)),
                      ],
                    })
                  }
                >
                  <Icon name="map" />
                  Ordina per prossimità
                </button>
                <button
                  disabled={!s.plan.length}
                  onClick={() => useNatureStore.setState({ plan: [] })}
                >
                  Svuota il giro
                </button>
              </div>
              {orphaned > 0 && (
                <p role="status">
                  {orphaned} riferimenti non sono nella versione corrente:
                  conservati nell’esportazione, esclusi dai calcoli.
                </p>
              )}
              {!plan.length ? (
                <p className={css.empty}>
                  Cerca un albero qui sotto o toccalo sulla mappa, poi scegli
                  «Aggiungi al giro». Nessun intervento reale sarà programmato.
                </p>
              ) : (
                <div className={css.list}>
                  {plan.map((t, i) => (
                    <button
                      className={css.row}
                      key={treeId(t)}
                      onClick={() =>
                        useExperienceStore.setState({
                          selectedId: treeId(t),
                          inspectionRequest:
                            useExperienceStore.getState().inspectionRequest + 1,
                        })
                      }
                    >
                      <span>
                        <strong>
                          {i + 1}.{" "}
                          {String(t.properties.specie ?? "Specie non indicata")}
                        </strong>
                        <small>
                          Etichetta {String(t.properties.prog ?? "—")} ·{" "}
                          {String(t.properties.dove ?? "Località non indicata")}
                        </small>
                      </span>
                      <span>
                        <Icon
                          name={s.inspections[treeId(t)] ? "check" : "chevron"}
                        />
                        <small>
                          {s.inspections[treeId(t)]
                            ? "Annotato demo"
                            : "Da simulare"}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                disabled={!plan.length}
                onClick={() =>
                  downloadWorklist(parkWorklist(plan, s.inspections, s.minutes))
                }
              >
                <Icon name="fileData" />
                Scarica lista di lavoro CSV
              </button>
            </section>
          ) : (
            <section className={css.section}>
              <h3>Qualità e copertura dell’archivio</h3>
              <p className={css.muted}>
                {s.treeInputRows - s.trees.length} righe non hanno coordinate
                utilizzabili. Non le posizioniamo artificialmente e non
                deduciamo che siano alberi mancanti o abbattuti.
              </p>
              <div
                className={css.progress}
                role="img"
                aria-label={`${s.trees.length} posizioni su ${s.treeInputRows} righe`}
              >
                <i
                  style={{
                    transform: `scaleX(${s.trees.length / Math.max(1, s.treeInputRows)})`,
                  }}
                />
              </div>
              <p>
                {number((s.trees.length / Math.max(1, s.treeInputRows)) * 100)}%
                delle righe è localizzabile
              </p>
              <small>
                Una riga incompleta può anche essere un frammento del rilievo:
                il numero di righe non è un conteggio certo di alberi.
              </small>
              <div className={css.facts}>
                {dates.slice(0, 5).map((d) => (
                  <div key={d.label}>
                    <dt>
                      {d.label === "Non indicato"
                        ? "Data assente"
                        : d.label.slice(0, 10)}
                    </dt>
                    <dd>{d.count} posizioni</dd>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
      {(!tools || tool === "visit") && (
        <section className={css.section}>
          <h3>
            {tools ? "Aggiungi esemplari al giro" : "Esplora il censimento"}
          </h3>
          <SearchField
            label="Cerca alberi nel censimento"
            value={s.treeQuery}
            onChange={(v) => {
              useNatureStore.setState({ treeQuery: v });
              setLimit(15);
            }}
            placeholder="Specie, famiglia, etichetta, zona…"
          />
          <div className={css.toolbar}>
            <label>
              Famiglia botanica
              <Select
                label="Famiglia botanica"
                value={s.family}
                onChange={(v) => {
                  useNatureStore.setState({ family: v });
                  setLimit(15);
                }}
                options={[
                  { value: "all", label: "Tutte le famiglie" },
                  ...families.map((a) => ({
                    value: a.label,
                    label: `${a.label} · ${a.count}`,
                  })),
                ]}
              />
            </label>
            <label>
              Colore sulla mappa
              <Select
                label="Colore degli alberi"
                value={s.treeMode}
                onChange={(v) =>
                  useNatureStore.setState({
                    treeMode: v as "family" | "condition",
                  })
                }
                options={[
                  { value: "family", label: "Famiglia botanica" },
                  { value: "condition", label: "Condizione storica" },
                ]}
              />
            </label>
          </div>
          {s.treeMode === "family" ? (
            <div className={css.legend}>
              {familiesShown.slice(0, 6).map((f) => (
                <span key={f.label}>
                  <i
                    style={{
                      background: treeFamilyColor({
                        properties: { familia: f.label },
                      }),
                    }}
                  />
                  {f.label} · {f.count}
                </span>
              ))}
              {familiesShown.length > 6 && (
                <span>
                  Altre {familiesShown.length - 6} famiglie · vedi scheda
                </span>
              )}
            </div>
          ) : (
            <div className={css.legend}>
              <span>
                <i style={{ background: "#89b89d" }} />
                Indicazione storica stabile / sicura
              </span>
              <span>
                <i style={{ background: "#d7a76b" }} />
                Indicazione storica di instabilità
              </span>
              <span>
                <i style={{ background: "#a2a9ba" }} />
                Altro / non indicato
              </span>
            </div>
          )}
          <div className={css.sectionHead}>
            <small>{trees.length} posizioni corrispondenti</small>
            {(s.treeQuery || s.family !== "all") && (
              <button
                onClick={() => {
                  useNatureStore.setState({ treeQuery: "", family: "all" });
                  setLimit(15);
                }}
              >
                Azzera filtri
              </button>
            )}
          </div>
          {tools && (
            <button
              className={css.primaryAction}
              disabled={
                !trees.slice(0, 20).some((t) => !s.plan.includes(treeId(t)))
              }
              onClick={() =>
                useNatureStore.setState((state) => ({
                  plan: [
                    ...new Set([
                      ...state.plan,
                      ...trees.slice(0, 20).map(treeId),
                    ]),
                  ],
                }))
              }
            >
              <Icon name="plus" />
              Aggiungi {Math.min(20, trees.length)}{" "}
              {trees.length === 1 ? "risultato" : "risultati"} al giro
            </button>
          )}
          {tools && trees.length > 20 && (
            <small>
              Si aggiungono i primi 20 risultati. Restringi la ricerca per
              preparare un giro mirato.
            </small>
          )}
          <div className={css.list}>
            {trees.slice(0, limit).map((t) => (
              <button
                className={css.row}
                aria-pressed={selected === treeId(t)}
                key={treeId(t)}
                onClick={() =>
                  tools
                    ? useExperienceStore.setState({
                        selectedId: treeId(t),
                        inspectionRequest:
                          useExperienceStore.getState().inspectionRequest + 1,
                      })
                    : selectObject(treeId(t))
                }
              >
                <span>
                  <strong>
                    <i
                      className={css.dot}
                      style={{ background: treeFamilyColor(t) }}
                    />
                    {String(t.properties.specie ?? "Specie non indicata")}
                  </strong>
                  <small>
                    {String(t.properties.familia ?? "Famiglia assente")} ·
                    etichetta {String(t.properties.prog ?? "—")}
                  </small>
                </span>
                <span>
                  {s.plan.includes(treeId(t)) ? (
                    <Icon name="check" />
                  ) : (
                    <Icon name="chevron" />
                  )}
                </span>
              </button>
            ))}
          </div>
          {!trees.length && !s.treeLoading && (
            <p className={css.empty}>
              Nessuna posizione disponibile con questi filtri. Prova un’altra
              specie o azzera la ricerca.
            </p>
          )}
          {trees.length > limit && (
            <button onClick={() => setLimit(limit + 20)}>
              Mostra altri esemplari · {trees.length - limit} rimanenti
            </button>
          )}
        </section>
      )}
      <Method>
        <p>
          Fonte: ERPAC / Open Data Regione FVG, «Alberi di Villa Manin», dataset
          uqpq-dr8x, Italian Open Data License. Le proprietà sono conservate con
          i nomi originali; il campo PIHF è la forma della chioma, non un
          punteggio di salute.
        </p>
        <p>
          Il catalogo regionale è ricontrollato ogni 5 minuti e il suo
          aggiornamento attiva la ricarica dello Spazio. Il provider non
          dichiara una frequenza regolare: l’ultima acquisizione non rende
          recenti i rilievi.{" "}
          {s.treeRetrieved
            ? `Acquisizione: ${date(s.treeRetrieved, { day: "numeric", month: "long", year: "numeric" })}.`
            : "La data di acquisizione non è ancora disponibile."}
        </p>
        <p>
          Nessuna stima di CO₂, età, altezza o copertura attuale è derivata da
          campi che non le misurano. Colori e condizioni sono storici; gli
          alberi possono essere cambiati da allora. Il giro e le annotazioni
          sono esercitazioni locali esportabili, non documenti di valutazione
          fitostatica.
        </p>
        <p>
          <a
            href="https://www.dati.friuliveneziagiulia.it/Ambiente/Alberi-di-Villa-Manin/uqpq-dr8x"
            target="_blank"
            rel="noreferrer"
          >
            Dataset ERPAC
          </a>{" "}
          ·{" "}
          <a
            href="https://www.villamanin.it/informazioni-botaniche-e-ambientali/"
            target="_blank"
            rel="noreferrer"
          >
            Il parco di Villa Manin
          </a>
        </p>
      </Method>
      <button
        onClick={() =>
          exportReport("park", {
            space: "park",
            mode: "historical-inventory-with-simulated-work",
            generatedAt: new Date().toISOString(),
            source: "ERPAC / Open Data FVG · uqpq-dr8x",
            sourceRetrievedAt: s.treeRetrieved,
            plan: s.plan,
            minutesPerTree: s.minutes,
            inspections: s.inspections,
            features: plan,
            note: "Rilievi storici. Annotazioni simulate nella sessione; nessuna diagnosi attuale o modifica della fonte.",
          })
        }
      >
        <Icon name="fileData" />
        Esporta giro e annotazioni demo
      </button>
    </div>
  );
}
export function TreeDetails({ tree: t }: { tree: TreeFeature }) {
  const id = treeId(t),
    s = useNatureStore(),
    [note, setNote] = useState(
      s.inspections[id]?.note ??
        "Controllo dimostrativo dell’etichetta e della scheda. Da verificare con un sopralluogo reale.",
    );
  const coincident = s.coincidentIds.flatMap((key) => {
    const f = s.trees.find((t) => treeId(t) === key);
    return f ? [f] : [];
  });
  return (
    <>
      <Header
        inspection
        title={String(t.properties.specie ?? "Specie non indicata")}
        icon="tree"
      >
        Etichetta {String(t.properties.prog ?? "—")} ·{" "}
        {String(t.properties.familia ?? "Famiglia non indicata")}
      </Header>
      {coincident.length > 1 && (
        <label>
          Tutti gli esemplari nello stesso punto
          <Select
            label="Esemplari nella stessa posizione"
            value={id}
            onChange={inspectNatureObject}
            options={coincident.map((f) => ({
              value: treeId(f),
              label: `${f.properties.prog ?? treeId(f)} · ${f.properties.specie ?? "Specie assente"}`,
            }))}
          />
        </label>
      )}
      <Locate
        coordinates={t.geometry.coordinates.slice(0, 2) as [number, number]}
        beforeLocate={() => {
          if (!treeMatches(t, useNatureStore.getState()))
            useNatureStore.setState({ treeQuery: "", family: "all" });
        }}
        zoom={18}
      />
      <dl className={css.facts}>
        {[
          ["Zona", "dove"],
          ["Data del rilievo", "data_rilievo"],
          ["Condizione storica (STT)", "stt_st"],
          ["Vigore storico (SVV)", "svv_sv"],
          ["Forma chioma (PIHF)", "pihf_pih"],
          ["Portamento (PIP)", "pip_pi"],
        ].map(([name, key]) => (
          <div key={key}>
            <dt>{name}</dt>
            <dd>{String(t.properties[key!] ?? "Non indicato")}</dd>
          </div>
        ))}
      </dl>
      <div className={css.actions}>
        <button
          aria-pressed={s.plan.includes(id)}
          onClick={() => addToPlan(id)}
        >
          <Icon name={s.plan.includes(id) ? "check" : "plus"} />
          {s.plan.includes(id) ? "Nel giro · rimuovi" : "Aggiungi al giro demo"}
        </button>
      </div>
      <details>
        <summary>Annotazione di sopralluogo simulato</summary>
        <div className={css.section}>
          <p>Questa nota non certifica lo stato attuale dell’albero.</p>
          <label>
            Nota dell’esercitazione
            <textarea
              aria-label="Nota del sopralluogo simulato"
              maxLength={600}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            disabled={!note.trim()}
            onClick={() =>
              useNatureStore.setState((state) => ({
                plan: state.plan.includes(id)
                  ? state.plan
                  : [...state.plan, id],
                inspections: {
                  ...state.inspections,
                  [id]: { at: Date.now(), note: note.trim() },
                },
              }))
            }
          >
            <Icon name="check" />
            Registra sopralluogo demo
          </button>
          {s.inspections[id] && (
            <p role="status">
              Annotazione simulata registrata alle{" "}
              {date(s.inspections[id]!.at, {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              di questa sessione.
            </p>
          )}
        </div>
      </details>
      <details>
        <summary>Tutti i campi originali</summary>
        <dl className={css.facts}>
          {Object.entries(t.properties)
            .filter(([k]) => !k.startsWith("__"))
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  {typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v ?? "Non indicato")}
                </dd>
              </div>
            ))}
        </dl>
      </details>
    </>
  );
}
