import { useRef, useState } from "react";
import { useAppStore } from "@/app/store";
import { parseBundleFile } from "@/lib/bundle";
import { ExportPanel } from "@/map-overlays/ExportPanel";
import styles from "./IconButtons.module.css";

/**
 * Topbar entry-point for export + import. The export menu is a full
 * modal dialog (ExportPanel) where the user picks format and selects
 * which tracks / saved areas to include. Import stays a single hidden
 * file input — bundle files round-trip back into the store.
 */
export function ExportImportButton() {
  const addUserLayer = useAppStore((s) => s.addUserLayer);
  const addUserPolygon = useAppStore((s) => s.addUserPolygon);
  const fileRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const onExport = () => {
    setExportOpen(true);
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
          aria-label="Export or import data"
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
          >
            Export…
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
      <ExportPanel open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
