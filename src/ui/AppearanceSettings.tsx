import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/store";
import { PALETTES, useAppearance } from "./appearance";
import { Icon } from "./Icon";
import buttons from "@/topbar/IconButtons.module.css";
import styles from "./AppearanceSettings.module.css";

export function AppearanceSettings() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const { palette, motion, setPalette, setMotion } = useAppearance();
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) {
      el.showModal();
      el.querySelector<HTMLButtonElement>(
        'button[aria-label="Chiudi impostazioni"]',
      )?.focus();
    } else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <>
      <button
        className={buttons.btn}
        type="button"
        title="Impostazioni"
        aria-label="Impostazioni"
        aria-haspopup="dialog"
        aria-controls="appearance-settings"
        aria-expanded={open}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setOpen(true);
        }}
      >
        <Icon name="settings" />
      </button>
      <dialog
        ref={dialog}
        id="appearance-settings"
        className={styles.dialog}
        aria-labelledby="appearance-title"
        onCancel={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <header className={styles.header}>
          <div>
            <Icon name="settings" />
            <h1 id="appearance-title">Aspetto dell’app</h1>
          </div>
          <button
            type="button"
            aria-label="Chiudi impostazioni"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className={styles.content}>
          <fieldset className={styles.section}>
            <legend>Tema</legend>
            <div className={styles.segmented}>
              {(["light", "dark"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="appearance-theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  <span>
                    <Icon name={value === "light" ? "sun" : "moon"} />
                    {value === "light" ? "Chiaro" : "Scuro"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.section} aria-describedby="palette-help">
            <legend>Palette dell’interfaccia</legend>
            <p id="palette-help">
              I colori dei dati sulla mappa restano invariati.
            </p>
            <div className={styles.palettes}>
              {PALETTES.map((option) => (
                <label className={styles.palette} key={option.id}>
                  <input
                    type="radio"
                    name="appearance-palette"
                    value={option.id}
                    checked={palette === option.id}
                    onChange={() => setPalette(option.id)}
                  />
                  <span className={styles.paletteBody}>
                    <span className={styles.swatches} aria-hidden="true">
                      {option.swatches.map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                    <span className={styles.paletteName}>
                      {option.name}
                      <Icon name="check" />
                    </span>
                    <span className={styles.description}>
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className={styles.motion}>
            <span>
              <strong>Animazioni dell’interfaccia</strong>
              <small>
                Transizioni brevi nelle aperture e nelle selezioni. Rispetta il
                movimento ridotto del dispositivo.
              </small>
            </span>
            <input
              type="checkbox"
              checked={motion}
              onChange={(event) => setMotion(event.target.checked)}
            />
            <span className={styles.switch} aria-hidden="true" />
          </label>
        </div>
        <footer className={styles.footer}>
          <Icon name="check" />
          Preferenze salvate su questo dispositivo.
        </footer>
      </dialog>
    </>
  );
}
