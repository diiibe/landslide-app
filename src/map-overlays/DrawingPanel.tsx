import { useEffect, useState } from "react";
import { useAppStore, USER_COLOR_PALETTE } from "@/app/store";
import { useExperienceStore } from "@/spaces/store";
import { Icon } from "@/ui/Icon";
import { ColorButton } from "./ColorButton";
import {
  cancelDrawing,
  undoDrawingVertex,
  restartDrawing,
  finishDrawing,
  commitDrawing,
  subscribeDrawingPreview,
  type DrawingPreview,
} from "@/map/drawing";
import styles from "./DrawingPanel.module.css";

/**
 * Floating panel that appears while polygon-drawing mode is on. Two
 * phases:
 *
 *   - **drawing**: live counter for vertices + the running area. The
 *     user is still placing points on the map.
 *   - **ready**: terra-draw closed the polygon (double-tap on the last
 *     vertex). A small form takes over: name input + colour picker +
 *     Save / Discard buttons. Saving persists with computed stats.
 *
 * Cancel from any phase exits drawing mode without saving.
 */
export function DrawingPanel() {
  const drawingMode = useAppStore((s) => s.drawingMode);
  const landslides = useExperienceStore(s => s.activeId === "landslides");
  const polygonCount = useAppStore((s) => s.userPolygons.length);
  const [preview, setPreview] = useState<DrawingPreview>({
    phase: "drawing",
    vertexCount: 0,
    areaKm2: 0,
  });
  const [name, setName] = useState("");
  const [color, setColor] = useState(USER_COLOR_PALETTE[0] ?? "#FFD400");

  useEffect(() => {
    if (!drawingMode) return;
    return subscribeDrawingPreview(setPreview);
  }, [drawingMode]);

  // Pick a default name + colour when a new draw starts. Deferred via
  // a 0-ms timer so the synchronous setState happens outside the
  // effect body (lint: react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!drawingMode) return;
    const id = setTimeout(() => {
      setName(`Area ${polygonCount + 1}`);
      const palette = USER_COLOR_PALETTE;
      const idx = polygonCount % palette.length;
      setColor(palette[idx] ?? "#FFD400");
    }, 0);
    return () => clearTimeout(id);
  }, [drawingMode, polygonCount]);

  if (!drawingMode) return null;

  const ready = preview.phase === "ready";
  return (
    <div className={styles.panel} data-phase={preview.phase} role="dialog" aria-label="Disegno area">
      <div className={styles.head}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.ttl}>
          {ready
            ? "Salva area"
            : preview.phase === "loading"
              ? "Preparazione mappa…"
              : preview.phase === "error"
                ? "Disegno non disponibile"
                : "Disegno…"}
        </span>
        <button className={styles.headClose} aria-label="Annulla disegno" onClick={cancelDrawing}><Icon name="close"/></button>
      </div>
      <div className={styles.body}>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Vertici</span>
          <span className={styles.kvValue}>{preview.vertexCount}</span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Area</span>
          <span className={styles.kvValue}>
            {preview.areaKm2 > 0 ? preview.areaKm2 < .01 ? `${(preview.areaKm2 * 1e6).toLocaleString("it-IT",{maximumSignificantDigits:3})} m²` : `${preview.areaKm2.toLocaleString("it-IT",{maximumFractionDigits:2})} km²` : "—"}
          </span>
        </div>
        {preview.phase === "error" && (
          <p role="alert" className={styles.hint}>
            {preview.error}
          </p>
        )}
        {preview.phase === "loading" && (
          <p role="status" className={styles.hint}>
            Attendi il caricamento della mappa. Potrai poi aggiungere i vertici.
          </p>
        )}
        {preview.phase === "drawing" && (
          <p className={styles.hint}>
            <span className={styles.desktopHint}>Tocca la mappa per aggiungere vertici. Usa Indietro per correggere il punto appena posato, poi Chiudi contorno per completare.</span><span className={styles.mobileHint}>Tocca la mappa per posare i vertici.</span>
          </p>
        )}
        {(preview.phase === "drawing" || ready) && <div className={styles.editActions} role="group" aria-label="Correggi il contorno">
          <button type="button" aria-label="Indietro" title="Rimuovi l’ultimo vertice" onClick={undoDrawingVertex} disabled={ready || !preview.canUndo}><Icon name="arrow" style={{transform:"rotate(180deg)"}}/>Indietro</button>
          <button type="button" onClick={restartDrawing} disabled={!preview.vertexCount}>Riparti da zero</button>
          {!ready && <button type="button" onClick={finishDrawing} disabled={preview.vertexCount < 3}>Chiudi contorno</button>}
        </div>}
        {ready && (
          <>
            <label className={styles.formRow}>
              <span className={styles.kvLabel}>Nome</span>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Nome area"
                autoFocus
              />
            </label>
            <div className={styles.formRow}>
              <span className={styles.kvLabel}>Colore</span>
              <ColorButton
                value={color}
                onChange={setColor}
                ariaLabel="Colore area"
                size={26}
              />
            </div>
          </>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={cancelDrawing}
          >
            {ready ? "Scarta" : "Annulla"}
          </button>
          {ready && (
            <button
              type="button"
              className={styles.save}
              onClick={() => commitDrawing(name, color)}
              disabled={!preview.geometry}
            >
              {landslides ? "Salva e analizza" : "Salva area"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
