import { CameraNetwork } from "./CameraNetwork";
import { useMemo, useState, useEffect, useRef } from "react";
import { Icon } from "@/ui/Icon";
import { Select } from "@/ui/Select";
import { SearchField } from "@/ui/SearchField";
import { useExperienceStore } from "../store";
import { useSpaceClock } from "../useClock";
import { exportReport } from "../tools/exportReport";
import {
  CAMERAS,
  SPECIES,
  captures,
  effortHours,
  cameraOnline,
  captureLabel,
  speciesName,
  type Capture,
  type Review,
} from "./wildlife";
import { useNatureStore } from "./store";
import { Header, Method, Stats, InspectBack, Locate, ToolNav } from "./common";
import { date, number } from "./format";
import css from "./Nature.module.css";
export function WildlifePanel({ tools }: { tools: boolean }) {
  const clock = useSpaceClock(true),
    minute = Math.floor(clock / 60000) * 60000,
    s = useNatureStore(),
    selected = useExperienceStore((e) => e.selectedId);
  const [hours, setHours] = useState(24),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(12),
    [reviewFilter, setReviewFilter] = useState(tools ? "uncertain" : "all"),
    [tool, setTool] = useState<"review" | "network">("review");
  const events = useMemo(() => captures(minute, hours), [minute, hours]),
    effort = useMemo(() => effortHours(minute, hours), [minute, hours]);
  const camera = CAMERAS.find((c) => c.id === selected),
    cameraId = camera?.id ?? s.camera;
  const list = events.filter(
    (c) =>
      (cameraId === "all" || c.camera === cameraId) &&
      (s.species === "all" || captureLabel(c, s.reviews[c.id]) === s.species) &&
      `${labelName(captureLabel(c, s.reviews[c.id]))} ${c.camera} ${CAMERAS.find((cam) => cam.id === c.camera)?.name ?? ""} camera ${c.camera.slice(4)}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (reviewFilter === "all" ||
        (reviewFilter === "pending"
          ? !s.reviews[c.id]
          : !s.reviews[c.id] && c.confidence < s.threshold)),
  );
  const current = events.find((c) => c.id === s.captureId);
  const uncertain = events.filter(
      (c) => !s.reviews[c.id] && c.confidence < s.threshold,
    ),
    reviewed = events.filter((c) => s.reviews[c.id]),
    animals = events.filter(
      (c) => !["unknown", "empty"].includes(captureLabel(c, s.reviews[c.id])),
    );
  const speciesCounts = SPECIES.map((spec) => ({
    ...spec,
    count: animals.filter((c) => captureLabel(c, s.reviews[c.id]) === spec.id)
      .length,
  }));
  const activity = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: events.filter(
      (c) => Number(date(c.time, { hour: "2-digit", hourCycle: "h23" })) === h,
    ).length,
  }));
  const maxActivity = Math.max(1, ...activity.map((v) => v.count));
  const opener = useRef<HTMLButtonElement | null>(null);
  const choose = (id: string, button: HTMLButtonElement) => {
    opener.current = button;
    useNatureStore.setState({ captureId: id });
  };
  const titleRef = useRef<HTMLHeadingElement>(null),
    currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    titleRef.current?.focus({ preventScroll: true });
    titleRef.current?.scrollIntoView?.({ block: "start" });
  }, [currentId]);
  return (
    <div
      className={css.root}
      style={{ "--nature-tone": "#bba273" } as React.CSSProperties}
    >
      <span className={css.tag}>
        <Icon name="camera" />
        Rete e visione simulate ·{" "}
        {date(clock, { hour: "2-digit", minute: "2-digit" })} Roma
      </span>
      {!tools && (
        <Header
          title={tools ? "Strumenti del fototrappolaggio" : "Tracce nel bosco"}
          icon={tools ? "extensions" : "camera"}
        >
          {tools
            ? "Revisiona le catture o prepara il controllo delle postazioni."
            : "Otto postazioni virtuali lungo percorsi OSM, con posa e orientamento espliciti. Catture e identificazioni restano simulate."}
        </Header>
      )}
      {!tools && (
        <details className={css.notice}>
          <summary>Simulazione · immagini e score generati</summary>
          <p>
            Nessuna fotografia o inferenza reale. Le scene sono immagini
            generate e le proposte di specie sono generate da un modello
            sintetico. Le percentuali non sono confidenze calibrate di un vision
            model.
          </p>
        </details>
      )}
      {tools && (
        <ToolNav
          value={tool}
          onChange={(v) => {
            setTool(v);
            if (v === "network" && cameraId === "all")
              useNatureStore.setState({ camera: CAMERAS[0]!.id });
            useNatureStore.setState({ captureId: null });
          }}
          items={[
            {
              id: "review",
              title: "Revisiona catture",
              description: "Conferma, correggi e scarica gli esiti",
              icon: "paw",
            },
            {
              id: "network",
              title: "Controlla rete",
              description: "Posa, disponibilità e registro dei controlli",
              icon: "camera",
            },
          ]}
        />
      )}
      {tools && tool === "network" ? (
        <CameraNetwork
          now={minute}
          hours={hours}
          selected={cameraId}
          onSelect={(id) => {
            useExperienceStore.setState({ selectedId: null });
            useNatureStore.setState({ camera: id });
          }}
        />
      ) : (
        <>
          {camera && (
            <section className={css.section}>
              <InspectBack />
              <h2 data-space-inspection>{camera.name}</h2>
              <p>
                {camera.habitat} ·{" "}
                {cameraOnline(camera.id, minute)
                  ? "campionamento attivo nel modello"
                  : "pausa tecnica simulata"}
              </p>
              <Locate coordinates={camera.coordinates} zoom={19} />
              {!tools && (
                <button
                  onClick={() => {
                    setTool("network");
                    useNatureStore.setState({ camera: camera.id });
                    useExperienceStore.setState({ tab: "tools" });
                  }}
                >
                  Controlla questa postazione
                </button>
              )}
            </section>
          )}
          {!tools ? (
            <Stats
              items={[
                ["Catture nella finestra", events.length],
                ["Da rivedere sotto soglia", uncertain.length],
                [
                  "Sforzo simulato",
                  <>
                    {number(effort)}
                    <small>ore-camera effettive su {hours * 8} possibili</small>
                  </>,
                ],
                ["Revisionate nella sessione", reviewed.length],
              ]}
            />
          ) : (
            <p className={css.muted}>
              {uncertain.length} sotto soglia da rivedere · {reviewed.length}{" "}
              revisionate nella finestra
            </p>
          )}
          <div className={css.toolbar}>
            <label>
              Intervallo
              <Select
                label="Finestra del fototrappolaggio"
                value={String(hours)}
                onChange={(v) => {
                  setHours(Number(v));
                  setLimit(12);
                }}
                options={[
                  { value: "6", label: "Ultime 6 ore" },
                  { value: "24", label: "Ultime 24 ore" },
                  { value: "72", label: "Ultime 72 ore" },
                ]}
              />
            </label>
            <label>
              Fototrappola
              <Select
                label="Fototrappola"
                value={cameraId}
                onChange={(v) => {
                  useExperienceStore.setState({ selectedId: null });
                  useNatureStore.setState({ camera: v });
                  setLimit(12);
                }}
                options={[
                  { value: "all", label: "Tutta la rete" },
                  ...CAMERAS.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </label>
          </div>
          {tools && (
            <>
              <button
                className={css.primaryAction}
                disabled={!list.length}
                onClick={(event) => choose(list[0]!.id, event.currentTarget)}
              >
                <Icon name="paw" />
                Apri la prima cattura della coda
              </button>
              <section className={css.section}>
                <label>
                  Soglia per la coda di revisione ·{" "}
                  {Math.round(s.threshold * 100)}%
                  <input
                    type="range"
                    min={0.5}
                    max={0.99}
                    step={0.01}
                    aria-label="Soglia di revisione"
                    value={s.threshold}
                    onChange={(e) =>
                      useNatureStore.setState({
                        threshold: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <small>
                  Ordina il lavoro umano: non elimina catture o specie dalla
                  mappa.
                </small>
              </section>
              <details>
                <summary>Sforzo e attività · riepilogo</summary>
                <section className={css.section}>
                  <h3>Sforzo e attività, non abbondanza</h3>
                  <Stats
                    items={[
                      [
                        "Catture per 100 giorni-camera",
                        effort
                          ? number((events.length / (effort / 24)) * 100)
                          : "Non disponibile",
                      ],
                      [
                        "Specie proposte o revisionate",
                        speciesCounts.filter((c) => c.count > 0).length,
                      ],
                    ]}
                  />
                  <div
                    className={css.activity}
                    role="img"
                    aria-label="Distribuzione oraria delle catture in ora locale di Roma"
                  >
                    {activity.map((b) => (
                      <div
                        key={b.hour}
                        style={{
                          height: `${Math.max(2, (b.count / maxActivity) * 100)}%`,
                          flex: 1,
                          background: "var(--nature-tone)",
                          borderRadius: "2px 2px 0 0",
                        }}
                        title={`${b.hour}:00 · ${b.count} catture`}
                      />
                    ))}
                  </div>
                  <div className={css.axis}>
                    <span>00:00</span>
                    <span>12:00</span>
                    <span>23:00 · Roma</span>
                  </div>
                  <div className={css.meters}>
                    {speciesCounts.map((b) => (
                      <div className={css.meter} key={b.id}>
                        <span>{b.name}</span>
                        <div className={css.track}>
                          <i
                            style={{
                              transform: `scaleX(${b.count / Math.max(1, ...speciesCounts.map((c) => c.count))})`,
                              background: b.color,
                            }}
                          />
                        </div>
                        <b>{b.count}</b>
                      </div>
                    ))}
                  </div>
                  <small>
                    Conteggi di catture, incluse ricomparse. Il tasso è
                    normalizzato sulle ore di funzionamento simulate; non stima
                    densità, popolazione o individui distinti.
                  </small>
                </section>
              </details>
            </>
          )}
          {current && (
            <section className={css.section} aria-label="Scheda della cattura">
              <div className={css.sectionHead}>
                <h3 ref={titleRef} tabIndex={-1}>
                  Cattura ·{" "}
                  {CAMERAS.find((c) => c.id === current.camera)?.name.slice(-2)}
                </h3>
                <button
                  aria-label="Chiudi scheda cattura"
                  onClick={() => {
                    useNatureStore.setState({ captureId: null });
                    if (opener.current?.isConnected)
                      opener.current.focus({ preventScroll: true });
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
              <CaptureReview
                key={current.id}
                capture={current}
                onNext={() => {
                  const next = list.find(
                    (c) => c.id !== current.id && !s.reviews[c.id],
                  );
                  useNatureStore.setState({ captureId: next?.id ?? null });
                  if (!next && opener.current?.isConnected)
                    opener.current.focus({ preventScroll: true });
                }}
              />
            </section>
          )}
          {s.captureId && !current && (
            <p role="status" className={css.empty}>
              La cattura selezionata è fuori dall’intervallo. Amplia la finestra
              oppure scegline un’altra.
            </p>
          )}
          <section className={css.section}>
            <div className={css.queueTitle}>
              <h3>{tools ? "Coda di revisione" : "Registro delle catture"}</h3>
              <b>{list.length}</b>
            </div>
            <SearchField
              label="Cerca una cattura"
              value={query}
              onChange={(v) => {
                setQuery(v);
                setLimit(12);
              }}
              placeholder="Specie o fototrappola…"
            />
            <div className={css.toolbar}>
              <label>
                Specie o esito
                <Select
                  label="Specie o esito"
                  value={s.species}
                  onChange={(v) => {
                    useNatureStore.setState({ species: v });
                    setLimit(12);
                  }}
                  options={[
                    { value: "all", label: "Tutti gli esiti" },
                    ...SPECIES.map((a) => ({ value: a.id, label: a.name })),
                    { value: "empty", label: "Cattura vuota" },
                    { value: "unknown", label: "Non identificabile" },
                  ]}
                />
              </label>
              <label>
                Revisione
                <Select
                  label="Stato della revisione"
                  value={reviewFilter}
                  onChange={(v) => {
                    setReviewFilter(v);
                    setLimit(12);
                  }}
                  options={[
                    { value: "all", label: "Tutte" },
                    { value: "pending", label: "Non revisionate" },
                    { value: "uncertain", label: "Sotto soglia, da rivedere" },
                  ]}
                />
              </label>
            </div>
            {!list.length ? (
              <p className={css.empty}>
                Nessuna cattura con questi filtri. Prova un intervallo più ampio
                o tutta la rete.
              </p>
            ) : (
              <div className={css.list}>
                {list.slice(0, limit).map((c) => (
                  <button
                    className={css.row}
                    key={c.id}
                    aria-pressed={current?.id === c.id}
                    onClick={(event) => choose(c.id, event.currentTarget)}
                  >
                    <span>
                      <strong>
                        <Icon name={s.reviews[c.id] ? "check" : "paw"} />{" "}
                        {labelName(captureLabel(c, s.reviews[c.id]))}
                      </strong>
                      <small>
                        {date(c.time, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · camera {c.camera.slice(4)}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {s.reviews[c.id]
                          ? "Revisionata"
                          : `${Math.round(c.confidence * 100)}%`}
                      </strong>
                      <small>
                        {s.reviews[c.id]
                          ? "sessione locale"
                          : c.confidence < s.threshold
                            ? "Da rivedere"
                            : "Proposta demo"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {list.length > limit && (
              <button onClick={() => setLimit(limit + 12)}>
                Mostra altre catture · {list.length - limit} rimanenti
              </button>
            )}
          </section>
        </>
      )}
      <div className={css.legend}>
        <span>
          <i style={{ background: "#88b699" }} />
          Camera attiva
        </span>
        <span>
          <i style={{ background: "#d6a75c" }} />
          Ultima proposta sotto soglia
        </span>
        <span>
          <i style={{ background: "#8e9a95" }} />
          Pausa simulata
        </span>
      </div>
      <Method>
        <p>
          La simulazione usa eventi identificati da camera e ora assoluta,
          ricostruibili al riavvio. Specie prevalentemente notturne compaiono
          più spesso di notte; brevi indisponibilità riducono lo sforzo. La
          finestra si aggiorna ogni minuto mentre lo Spazio è visibile, con
          orario Europa/Roma.
        </p>
        <p>
          Immagini generate, classi e score sono dimostrativi: nessun servizio
          vision viene chiamato e nessuna foto viene caricata. La stessa
          immagine illustrativa della specie è riutilizzata in catture diverse.
          Una rete reale richiederebbe foto autorizzate, un modello validato sul
          territorio e controllo umano; qui non inferiamo presenze reali o
          conteggi di animali unici.
        </p>
        <p>
          Le revisioni restano nella memoria di questa sessione e sono
          esportabili. Non addestrano un modello e non sono salvate su un
          server. La posa delle camere è inventata, con bersaglio di ripresa a
          cinque metri sui tracciati OSM di riferimento. Le posizioni non sono
          localizzazioni di fauna sensibile e richiederebbero verifica sul
          terreno e autorizzazioni.
        </p>
      </Method>
      <button
        onClick={() =>
          exportReport("wildlife", {
            space: "wildlife",
            mode: "simulation",
            asOf: new Date(minute).toISOString(),
            hours,
            cameraHours: effort,
            threshold: s.threshold,
            captures: events,
            cameraChecks: s.cameraChecks,
            stations: CAMERAS,
            reviews: Object.fromEntries(
              events
                .filter((c) => s.reviews[c.id])
                .map((c) => [c.id, s.reviews[c.id]]),
            ),
            note: "Catture, score e scene sintetici. Nessuna inferenza vision reale; nessuna stima di individui.",
          })
        }
      >
        <Icon name="fileData" />
        Esporta catture e revisioni
      </button>
    </div>
  );
}
const labelName = (id: string) =>
  id === "empty"
    ? "Cattura vuota"
    : id === "unknown"
      ? "Non identificabile"
      : speciesName(id);
export function CaptureReview({
  capture: c,
  onNext,
}: {
  capture: Capture;
  onNext?: () => void;
}) {
  const review = useNatureStore((s) => s.reviews[c.id]),
    [correction, setCorrection] = useState<Review["label"]>(
      review?.label ?? (c.empty ? "empty" : c.species),
    );
  const commit = (label: Review["label"]) =>
    useNatureStore.setState((s) => ({
      reviews: { ...s.reviews, [c.id]: { label, at: Date.now() } },
    }));
  return (
    <>
      <CameraScene capture={c} />
      <div className={`${css.classification} ${review ? css.reviewed : ""}`}>
        <small>Proposta del classificatore simulato</small>
        <header>
          <strong>{c.empty ? "Cattura vuota" : speciesName(c.species)}</strong>
          <output>{Math.round(c.confidence * 100)}%</output>
        </header>
        <div className={css.confidence}>
          <span>Classe proposta</span>
          <span>{Math.round(c.confidence * 100)}%</span>
          <div className={css.track}>
            <i style={{ transform: `scaleX(${c.confidence})` }} />
          </div>
          <span>Alternativa · {speciesName(c.alternative)}</span>
          <span>{Math.round((1 - c.confidence) * 75)}%</span>
        </div>
        <small>
          Score dimostrativi, non probabilità validate. L’immagine non è il
          risultato di un vision model.
        </small>
        {review && (
          <p role="status">
            <Icon name="check" /> Revisionata nella sessione:{" "}
            <strong>{labelName(review.label)}</strong>
          </p>
        )}
        <button onClick={() => commit(c.empty ? "empty" : c.species)}>
          <Icon name="check" />
          Conferma la proposta
        </button>
        <label>
          Correggi l’identificazione
          <Select
            label="Correzione della specie"
            value={correction}
            onChange={(v) => setCorrection(v as Review["label"])}
            options={[
              ...SPECIES.map((s) => ({ value: s.id, label: s.name })),
              { value: "empty", label: "Cattura vuota" },
              { value: "unknown", label: "Non identificabile" },
            ]}
          />
        </label>
        <button onClick={() => commit(correction)}>Salva revisione demo</button>
        {onNext && (
          <button
            onClick={() => {
              commit(correction);
              onNext();
            }}
          >
            Salva e passa alla successiva
          </button>
        )}
      </div>
    </>
  );
}
export function CameraScene({ capture: c }: { capture: Capture }) {
  const index = SPECIES.findIndex((s) => s.id === c.species),
    column = index % 3,
    row = Math.floor(index / 3);
  return (
    <div
      className={css.frame}
      role="img"
      aria-label={`Immagine generata ${c.empty ? "del bosco vuoto" : `di ${speciesName(c.species)}`}, non una cattura reale`}
    >
      {!c.empty && (
        <div
          className={css.generatedImage}
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}images/wildlife-atlas.png)`,
            backgroundPosition: `${column * 50}% ${row * 100}%`,
            filter: c.night ? "grayscale(1) brightness(0.9)" : "none",
          }}
        />
      )}
      <svg viewBox="0 0 320 240" aria-hidden="true">
        {c.empty ? (
          <>
            <rect width="320" height="240" fill="#1d2823" />
            {[15, 65, 108, 231, 280, 310].map((x, i) => (
              <g key={x} opacity={0.25 + i * 0.07}>
                <path
                  d={`M${x} 0v210`}
                  stroke="#6a7866"
                  strokeWidth={i % 2 ? 9 : 16}
                />
                <path
                  d={`M${x} 65l-26-30m26 74 24-43`}
                  stroke="#6a7866"
                  strokeWidth="5"
                />
              </g>
            ))}
            <path d="M0 209Q90 165 160 200T320 190V240H0" fill="#3e503e" />
          </>
        ) : null}
      </svg>
      <span>
        Immagine generata · esempio {c.empty ? "vuoto" : "della specie"}
      </span>
      <time>
        {date(c.time, {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · evento simulato
      </time>
    </div>
  );
}
