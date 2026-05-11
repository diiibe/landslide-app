import { useAppStore } from "@/app/store";
import styles from "./IconButtons.module.css";

/**
 * Polygon-drawing tool toggle. Flips `drawingMode` in the store; the
 * MapView is responsible for wiring the actual terra-draw lifecycle to
 * that flag. Visual state mirrors the lock toggle convention used
 * elsewhere: `aria-pressed` carries the on/off semantics.
 */
export function DrawButton() {
  const drawing = useAppStore((s) => s.drawingMode);
  const setDrawingMode = useAppStore((s) => s.setDrawingMode);
  return (
    <button
      type="button"
      className={styles.btn}
      data-active={drawing}
      title={drawing ? "Stop drawing" : "Draw an area to save stats for"}
      aria-label={drawing ? "Stop drawing" : "Draw an area"}
      aria-pressed={drawing}
      onClick={() => setDrawingMode(!drawing)}
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
        <path d="M2.5 3l3 11 3-4 4 1z" />
        <path d="M11.5 11l1.5 1.5" />
      </svg>
    </button>
  );
}
