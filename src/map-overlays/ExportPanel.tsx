import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/store";
import {
  downloadBlob,
  exportBundle,
  exportFlatGeoJson,
  exportGpx,
  exportPng,
  type ExportFormat,
  type ExportSelection,
} from "@/lib/export";
import styles from "./ExportPanel.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  bundle: "FVG bundle (re-importable)",
  geojson: "GeoJSON (flat, for QGIS / viewers)",
  gpx: "GPX (tracks + waypoints)",
  png: "PNG screenshot of the current map",
};

const FORMAT_HINT: Record<ExportFormat, string> = {
  bundle:
    "Includes per-polygon stats and the magic key required by Import bundle.",
  geojson:
    "Flat FeatureCollection. Polygons carry their stats as fvg:* properties.",
  gpx:
    "Lines become tracks, points become waypoints, polygons become a closed ring track. Stats and risk tinting are dropped.",
  png:
    "Captures whatever is currently visible on the map canvas. No selection needed.",
};

/**
 * Modal-ish export dialog. Floats over the map; click on the
 * backdrop or the Cancel button to dismiss. Three sections:
 *   1. Format selector (radios).
 *   2. Selection (per-layer + per-polygon checkboxes). Hidden for PNG.
 *   3. Action row (Export + Cancel).
 */
export function ExportPanel({ open, onClose }: Props) {
  const userLayers = useAppStore((s) => s.userLayers);
  const userPolygons = useAppStore((s) => s.userPolygons);

  const [format, setFormat] = useState<ExportFormat>("bundle");
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [selectedPolygons, setSelectedPolygons] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Select everything by default whenever the panel opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setSelectedLayers(new Set(userLayers.map((l) => l.id)));
      setSelectedPolygons(new Set(userPolygons.map((p) => p.id)));
      setError(null);
    }, 0);
    return () => clearTimeout(t);
  }, [open, userLayers, userPolygons]);

  const hasData = userLayers.length > 0 || userPolygons.length > 0;
  const sel: ExportSelection = useMemo(
    () => ({ layerIds: selectedLayers, polygonIds: selectedPolygons }),
    [selectedLayers, selectedPolygons],
  );
  const needsSelection = format !== "png";
  const selectionEmpty =
    needsSelection && selectedLayers.size === 0 && selectedPolygons.size === 0;

  const toggleLayer = (id: string) =>
    setSelectedLayers((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const togglePolygon = (id: string) =>
    setSelectedPolygons((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectAll = () => {
    setSelectedLayers(new Set(userLayers.map((l) => l.id)));
    setSelectedPolygons(new Set(userPolygons.map((p) => p.id)));
  };
  const selectNone = () => {
    setSelectedLayers(new Set());
    setSelectedPolygons(new Set());
  };

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      if (format === "png") {
        const map = (window as unknown as { __mlmap?: maplibregl.Map }).__mlmap;
        if (!map) throw new Error("Map not available yet.");
        const { blob, filename } = await exportPng(map);
        downloadBlob(blob, filename);
      } else if (format === "bundle") {
        const { blob, filename } = exportBundle(userLayers, userPolygons, sel);
        downloadBlob(blob, filename);
      } else if (format === "geojson") {
        const { blob, filename } = exportFlatGeoJson(userLayers, userPolygons, sel);
        downloadBlob(blob, filename);
      } else if (format === "gpx") {
        const { blob, filename } = exportGpx(userLayers, userPolygons, sel);
        downloadBlob(blob, filename);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Export data"
        aria-modal="true"
      >
        <div className={styles.head}>
          <span className={styles.ttl}>Export</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Close export dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Format</legend>
            {(Object.keys(FORMAT_LABEL) as ExportFormat[]).map((f) => (
              <label key={f} className={styles.radioRow}>
                <input
                  type="radio"
                  name="export-format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                />
                <span className={styles.radioName}>{FORMAT_LABEL[f]}</span>
              </label>
            ))}
            <p className={styles.hint}>{FORMAT_HINT[format]}</p>
          </fieldset>

          {needsSelection && hasData && (
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>
                What to include
                <span className={styles.sectionActions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={selectAll}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={selectNone}
                  >
                    None
                  </button>
                </span>
              </legend>
              {userLayers.length > 0 && (
                <div className={styles.subSection}>
                  <div className={styles.subTitle}>Uploaded tracks</div>
                  {userLayers.map((l) => (
                    <label key={l.id} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={selectedLayers.has(l.id)}
                        onChange={() => toggleLayer(l.id)}
                      />
                      <span
                        className={styles.swatch}
                        style={{ background: l.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.rowName}>{l.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {userPolygons.length > 0 && (
                <div className={styles.subSection}>
                  <div className={styles.subTitle}>Saved areas</div>
                  {userPolygons.map((p) => (
                    <label key={p.id} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={selectedPolygons.has(p.id)}
                        onChange={() => togglePolygon(p.id)}
                      />
                      <span
                        className={styles.swatch}
                        style={{ background: p.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.rowName}>{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {needsSelection && !hasData && (
            <p className={styles.hint}>
              No tracks or saved areas yet. Upload a GPX or draw a polygon
              first.
            </p>
          )}

          {error && (
            <div role="status" aria-live="polite" className={styles.err}>
              {error}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.export}
            onClick={handleExport}
            disabled={busy || selectionEmpty}
          >
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
