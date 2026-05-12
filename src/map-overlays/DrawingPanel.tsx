import { useEffect, useState } from "react";
import { useAppStore, USER_COLOR_PALETTE } from "@/app/store";
import {
  cancelDrawing,
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
    <div className={styles.panel} role="dialog" aria-label="Drawing controls">
      <div className={styles.head}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.ttl}>{ready ? "Save area" : "Drawing…"}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Vertices</span>
          <span className={styles.kvValue}>{preview.vertexCount}</span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvLabel}>Area</span>
          <span className={styles.kvValue}>
            {preview.areaKm2 > 0 ? `${preview.areaKm2.toFixed(2)} km²` : "—"}
          </span>
        </div>
        {!ready && (
          <p className={styles.hint}>
            Tap to add vertices. Double-tap the last vertex to close the
            polygon and save its stats.
          </p>
        )}
        {ready && (
          <>
            <label className={styles.formRow}>
              <span className={styles.kvLabel}>Name</span>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Area name"
                autoFocus
              />
            </label>
            <label className={styles.formRow}>
              <span className={styles.kvLabel}>Colour</span>
              <input
                type="color"
                className={styles.swatch}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Polygon colour"
              />
            </label>
          </>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={cancelDrawing}
          >
            {ready ? "Discard" : "Cancel"}
          </button>
          {ready && (
            <button
              type="button"
              className={styles.save}
              onClick={() => commitDrawing(name, color)}
              disabled={!preview.geometry}
            >
              Save area
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
