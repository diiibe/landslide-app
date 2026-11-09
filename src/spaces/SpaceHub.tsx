import { useState } from "react";
import { Icon } from "@/ui/Icon";
import { SearchField } from "@/ui/SearchField";
import { saveSpace, removeSpace, useSpaces } from "@/ui/spacesStore";
import { EXPERIENCES } from "./experiences";
import { openExperience, restoreView, useExperienceStore } from "./store";
import { MiniMap } from "./MiniMap";
import styles from "./Spaces.module.css";
export function SpaceHub() {
  const [tab, setTab] = useState<"explore" | "saved">("explore"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState<"all" | "real" | "demo">("all"),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const { spaces, storageError } = useSpaces(),
    active = useExperienceStore((s) => s.activeId);
  const scenes = EXPERIENCES.filter(
    (s) =>
      (filter === "all" ||
        (filter === "real" ? s.id === "landslides" : s.id !== "landslides")) &&
      `${s.title} ${s.subtitle} ${s.reference.name} ${s.description}`
        .toLocaleLowerCase("it")
        .includes(query.toLocaleLowerCase("it")),
  );
  return (
    <div className={styles.hub}>
      <div
        className={styles.hubTabs}
        role="tablist"
        aria-label="Esplora o ritrova uno spazio"
      >
        <button
          role="tab"
          aria-selected={tab === "explore"}
          onClick={() => setTab("explore")}
        >
          Esplora gli spazi
        </button>
        <button
          role="tab"
          aria-selected={tab === "saved"}
          onClick={() => setTab("saved")}
        >
          Viste salvate <span>{spaces.length}</span>
        </button>
      </div>
      {tab === "explore" ? (
        <>
          <div className={styles.hubIntro}>
            <div>
              <h2>Entra, esplora, approfondisci.</h2>
              <p>
                Ogni spazio ha una mappa, i suoi dati e gli strumenti per
                leggerli.
              </p>
            </div>
            <span className={styles.hubCount}>6 esperienze</span>
          </div>
          <SearchField
            label="Cerca uno spazio"
            value={query}
            onChange={setQuery}
            placeholder="Frane, industria, vigneto, viabilità…"
          />
          <div
            className={styles.filters}
            role="group"
            aria-label="Tipi di spazio"
          >
            {(
              [
                ["all", "Tutti"],
                ["real", "Dati reali"],
                ["demo", "Demo simulate"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.experiences}>
            {scenes.map((s) => (
              <button
                key={s.id}
                className={styles.experience}
                data-active={active === s.id}
                onClick={() => openExperience(s.id)}
                style={{ "--space-tone": s.tone } as React.CSSProperties}
              >
                <div className={styles.preview}>
                  <MiniMap scene={s} />
                  <span className={styles.kind}>
                    {s.id === "landslides" ? "Dati reali" : "Demo simulata"}
                  </span>
                </div>
                <div className={styles.cardCopy}>
                  <span className={styles.place}>
                    <Icon name={s.icon} />
                    {s.subtitle}
                  </span>
                  <strong>{s.title}</strong>
                  <p>{s.description}</p>
                  <span className={styles.cardBottom}>
                    <span>
                      {s.id === "landslides"
                        ? "2 mappature · griglia 120 m"
                        : `${s.sensors.length} sensori · ${s.zones.length} zone`}
                    </span>
                    <Icon name="arrow" />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {!scenes.length && (
            <p role="status">Nessuno spazio corrisponde alla ricerca.</p>
          )}
          <p className={styles.disclosure}>
            Le demo sono esperienze indipendenti: perimetri, sensori e misure
            sono simulati. I nomi delle aziende servono come riferimenti
            geografici, senza affiliazione.
          </p>
        </>
      ) : (
        <section className={styles.saved}>
          <h2>Ritrova il tuo punto di vista</h2>
          <p>
            Salva livelli, sfondo e inquadratura. Le osservazioni continuano ad
            aggiornarsi.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                saveSpace(name.trim(), active ?? undefined);
                setName("");
                setMessage("Vista salvata su questo dispositivo.");
                setError("");
              } catch {
                setError(
                  "Non è stato possibile salvare questa vista. Riprova.",
                );
              }
            }}
          >
            <label>
              Nome dello spazio
              <input
                required
                maxLength={70}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Il mio monitoraggio della costa"
              />
            </label>
            <button
              className={styles.primary}
              disabled={!name.trim() || spaces.length >= 30}
            >
              <Icon name="plus" />
              Salva vista
            </button>
          </form>
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          {storageError && (
            <p role="alert">
              Il browser non consente il salvataggio: le modifiche restano solo
              in questa sessione.
            </p>
          )}
          {spaces.length === 30 && (
            <p role="status">
              Limite di 30 viste raggiunto. Rimuovine una per salvarne un’altra.
            </p>
          )}
          {!spaces.length && (
            <div className={styles.empty}>
              <Icon name="spaces" />
              <strong>La tua prima vista, pronta da ritrovare</strong>
              <p>
                Scegli uno spazio o i dati sulla mappa, poi assegna un nome qui.
              </p>
            </div>
          )}
          <div className={styles.savedList}>
            {spaces.map((v) => (
              <article key={v.id}>
                <button onClick={() => restoreView(v)}>
                  <Icon name="spaces" />
                  <span>
                    <strong>{v.name}</strong>
                    <small>
                      {Object.values(v.layers).filter(Boolean).length +
                        Object.values(v.enabled).filter(Boolean).length}{" "}
                      livelli ·{" "}
                      {new Date(v.savedAt).toLocaleDateString("it-IT")}
                    </small>
                  </span>
                  <Icon name="arrow" />
                </button>
                <button
                  aria-label={`Elimina spazio · ${v.name}`}
                  onClick={() => removeSpace(v.id)}
                >
                  <Icon name="close" />
                </button>
              </article>
            ))}
          </div>
          <p className={styles.disclosure}>
            Su questo dispositivo · fino a 30 viste. Usa Strumenti → Esporta per
            conservare i tuoi file personali.
          </p>
        </section>
      )}
    </div>
  );
}
