import { useRef, useState } from "react";
import { useAppStore } from "@/app/store";
import { parseUserFile, UPLOAD_ACCEPT } from "@/lib/upload";
import styles from "./IconButtons.module.css";

/**
 * Topbar entry-point for user uploads. Renders a single icon button that
 * opens the native file picker accepting .gpx / .geojson / .json / .kml.
 * On successful parse the file becomes a UserLayer in the store and is
 * rendered as the luminous track stack defined by userLayer.ts.
 *
 * Drag & drop on the map is wired separately (App.tsx → useMapDropZone)
 * to keep this component focused on the keyboard / mouse flow.
 */
export function UploadButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const addUserLayer = useAppStore((s) => s.addUserLayer);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    let lastLayerBounds: [[number, number], [number, number]] | null = null;
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseUserFile(file);
        const layer = addUserLayer(parsed);
        if (layer.bounds) lastLayerBounds = layer.bounds;
      } catch (e) {
        failures.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    if (failures.length) {
      setError(failures.join(" · "));
      setTimeout(() => setError(null), 6000);
    }
    // Zoom to the last successfully added track for instant feedback.
    if (lastLayerBounds) {
      window.dispatchEvent(
        new CustomEvent("fvg:fitbounds", {
          detail: { bounds: lastLayerBounds, padding: 80 },
        }),
      );
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.btn}
        title="Upload track or overlay (GPX, GeoJSON, KML)"
        aria-label="Upload track or overlay"
        aria-busy={busy}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
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
          <path d="M8 11V2.4" />
          <path d="M4.6 5.8L8 2.4l3.4 3.4" />
          <path d="M2.5 11.5v1.4a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.4" />
        </svg>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void handleFiles(e.currentTarget.files);
          // Reset so re-uploading the same filename fires `change`.
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
