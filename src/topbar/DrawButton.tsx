import { Icon } from "@/ui/Icon";
import { useAppStore } from "@/app/store";
import styles from "./IconButtons.module.css";

/**
 * Polygon-drawing tool toggle. Flips `drawingMode` in the store; the
 * MapView is responsible for wiring the actual terra-draw lifecycle to
 * that flag. Visual state mirrors the lock toggle convention used
 * elsewhere: `aria-pressed` carries the on/off semantics.
 */
export function DrawButton({ labeled = false }: { labeled?: boolean } = {}) {
  const drawing = useAppStore((s) => s.drawingMode);
  const setDrawingMode = useAppStore((s) => s.setDrawingMode);
  return (
    <button
      type="button"
      data-close-tools="true"
      className={styles.btn}
      data-active={drawing}
      title={drawing ? "Termina disegno" : "Disegna e salva un’area geografica"}
      aria-label={drawing ? "Termina disegno" : "Disegna un’area"}
      aria-pressed={drawing}
      onClick={() => setDrawingMode(!drawing)}
    >
      <Icon name="drawPolygon" />
      {labeled && <span>Disegna area</span>}
    </button>
  );
}
