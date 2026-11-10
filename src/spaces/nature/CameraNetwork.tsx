import { useState } from "react";
import { Icon } from "@/ui/Icon";
import {
  CAMERAS,
  cameraOnline,
  effortHours,
  type CameraStation,
} from "./wildlife";
import { useNatureStore } from "./store";
import { Locate } from "./common";
import { date, number } from "./format";
import css from "./Nature.module.css";
export function CameraNetwork({
  now,
  hours,
  selected,
  onSelect,
}: {
  now: number;
  hours: number;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const camera = CAMERAS.find((c) => c.id === selected);
  const checks = useNatureStore((s) => s.cameraChecks);
  const effort = effortHours(now, hours);
  return (
    <section className={css.section}>
      <h3>Controlla le postazioni</h3>
      <p>
        Ultime {hours} ore: disponibilità e ore-camera sono simulate. Le note
        documentano un’esercitazione, senza cambiare lo stato del sensore.
      </p>
      <div className={css.result}>
        <strong>
          {number(effort)} ore-camera su {hours * CAMERAS.length}
        </strong>
        <small>
          {number(hours * CAMERAS.length - effort)} ore-camera non disponibili
          nella finestra. Non sono ore di assenza della fauna.
        </small>
      </div>
      <div className={css.list}>
        {CAMERAS.map((c) => (
          <button
            className={css.row}
            key={c.id}
            aria-pressed={c.id === camera?.id}
            onClick={() => onSelect(c.id)}
          >
            <span>
              <strong>{c.name}</strong>
              <small>
                {cameraOnline(c.id, now)
                  ? "Campionamento attivo nel modello"
                  : "Pausa tecnica simulata · controlla la postazione"}
              </small>
            </span>
            <span>
              <Icon name={checks[c.id] ? "check" : "chevron"} />
              <small>
                {checks[c.id] ? "Controllo annotato" : "Apri scheda"}
              </small>
            </span>
          </button>
        ))}
      </div>
      {camera ? (
        <CameraInstallation key={camera.id} camera={camera} />
      ) : (
        <p className={css.empty}>
          Scegli una postazione per controllare posa e installazione.
        </p>
      )}
    </section>
  );
}
export function CameraInstallation({ camera: c }: { camera: CameraStation }) {
  const check = useNatureStore((s) => s.cameraChecks[c.id]);
  const [checks, setChecks] = useState<string[]>([]),
    [note, setNote] = useState("");
  return (
    <section className={css.section} aria-label={`Installazione ${c.name}`}>
      <h3>{c.name} · installazione demo</h3>
      <p>
        {c.habitat} · {c.installation}
      </p>
      <Locate coordinates={c.coordinates} zoom={19} />
      <svg
        className={css.installDiagram}
        viewBox="0 0 320 152"
        role="img"
        aria-label="Schema di posa: camera a 50 centimetri e riferimento a 5 metri, ripresa trasversale al tracciato"
      >
        <path
          d="M20 110H300M52 26V110"
          stroke="var(--c-text-muted)"
          strokeWidth="2"
        />
        <rect
          x="43"
          y="58"
          width="25"
          height="18"
          rx="3"
          fill="var(--c-text)"
        />
        <path
          d="M68 67L255 35V106Z"
          fill="var(--c-selected)"
          stroke="var(--c-action)"
        />
        <path
          d="M225 20V114"
          stroke="var(--c-text-muted)"
          strokeDasharray="4 4"
        />
        <text x="15" y="138">
          50 cm
        </text>
        <text x="123" y="138">
          Riferimento a 5 m
        </text>
        <text x="166" y="18">
          Tracciato OSM
        </text>
      </svg>
      <dl className={css.facts}>
        <div>
          <dt>Orientamento ipotizzato</dt>
          <dd>{c.bearing}° da Nord</dd>
        </div>
        <div>
          <dt>Altezza / bersaglio</dt>
          <dd>
            {c.heightCm} cm / {c.targetDistanceM} m
          </dd>
        </div>
        <div>
          <dt>Settore sulla mappa</dt>
          <dd>
            {c.fov}° · profondità {c.rangeM} m
          </dd>
        </div>
        <div>
          <dt>Campionamento</dt>
          <dd>24 ore · senza esche</dd>
        </div>
      </dl>
      <a
        href={`https://www.openstreetmap.org/way/${c.wayId}`}
        target="_blank"
        rel="noreferrer"
      >
        Consulta il tracciato OSM di riferimento
      </a>
      <small>
        Il settore è uno schema ottico, non una copertura certa del sensore.
        Larghezza, neve, vegetazione, accessi e permessi vanno verificati sul
        posto. Tracciati © OpenStreetMap, posa virtuale; nessuna localizzazione
        di animali reali.
      </small>
      <h4>Registra un controllo dimostrativo</h4>
      {[
        "Batterie e memoria",
        "Ottica libera e fissaggio",
        "Orologio e scatto di prova",
      ].map((item) => (
        <button
          key={item}
          aria-pressed={checks.includes(item)}
          onClick={() =>
            setChecks((v) =>
              v.includes(item) ? v.filter((x) => x !== item) : [...v, item],
            )
          }
        >
          <Icon name={checks.includes(item) ? "check" : "plus"} />
          {item}
        </button>
      ))}
      <label>
        Nota del controllo
        <textarea
          aria-label="Nota controllo fototrappola"
          maxLength={400}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button
        disabled={checks.length !== 3}
        onClick={() =>
          useNatureStore.setState((s) => ({
            cameraChecks: {
              ...s.cameraChecks,
              [c.id]: {
                at: Date.now(),
                note: `Esercitazione: ${checks.join("; ")}. ${note.trim()}`,
              },
            },
          }))
        }
      >
        <Icon name="check" />
        Registra controllo demo
      </button>
      {check && (
        <p role="status">
          Controllo dimostrativo annotato il{" "}
          {date(check.at, {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          . La telemetria simulata non è stata modificata.
        </p>
      )}
      <p>
        <a
          href="https://www.ab.mpg.de/snapshot-europe"
          target="_blank"
          rel="noreferrer"
        >
          Riferimento metodologico: Snapshot Europe
        </a>{" "}
        · Questa piccola rete mirata ai passaggi non è un campionamento casuale
        per stimare densità.
      </p>
    </section>
  );
}
