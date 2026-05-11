import { useRef, useState } from "react";
import { useAppStore } from "@/app/store";
import { buildBundle, downloadBundle, parseBundleFile } from "@/lib/bundle";
import styles from "./IconButtons.module.css";

/**
 * Two micro-features under one button: tap → menu with Export bundle /
 * Import bundle. The menu is a barebones <details> so we get keyboard
 * activation + focus management for free.
 *
 * Bundle = a single .geojson that round-trips uploaded layers + drawn
 * polygons with their stats. Import is additive (no merge logic, no
 * dedup); the user can clear via the per-row × in the LayersPanel.
 */
export function ExportImportButton() {
  const userLayers = useAppStore((s) => s.userLayers);
  const userPolygons = useAppStore((s) => s.userPolygons);
  const addUserLayer = useAppStore((s) => s.addUserLayer);
  const addUserPolygon = useAppStore((s) => s.addUserPolygon);
  const fileRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState<string | null>(null);

  const hasData = userLayers.length > 0 || userPolygons.length > 0;

  const onExport = async () => {
    if (!hasData) return;
    const bundle = buildBundle(userLayers, userPolygons);
    await downloadBundle(bundle);
    detailsRef.current?.removeAttribute("open");
  };

  const onImport = () => {
    fileRef.current?.click();
    detailsRef.current?.removeAttribute("open");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { layers, polygons } = parseBundleFile(text);
      for (const l of layers) addUserLayer(l);
      for (const p of polygons) addUserPolygon(p);
    } catch (e) {
      setError((e as Error).message);
      setTimeout(() => setError(null), 6000);
    }
  };

  return (
    <>
      <details ref={detailsRef} className={styles.menuWrap}>
        <summary
          className={styles.btn}
          title="Export / import your tracks and saved areas"
          aria-label="Export or import bundle"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 11v1.4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
            <path d="M8 2.4v8" />
            <path d="M4.6 6.8L8 10.4l3.4-3.6" />
          </svg>
        </summary>
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={onExport}
            disabled={!hasData}
          >
            Export bundle…
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={onImport}
          >
            Import bundle…
          </button>
        </div>
      </details>
      <input
        ref={fileRef}
        type="file"
        accept=".geojson,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          void onFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
        aria-hidden="true"
      />
      {error && (
        <div role="status" aria-live="polite" className={styles.uploadErr}>
          {error}
        </div>
      )}
    </>
  );
}
