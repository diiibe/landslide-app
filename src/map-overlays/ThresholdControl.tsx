import { useAppStore } from "@/app/store";
import type { Threshold } from "@/app/types";
import styles from "./ThresholdControl.module.css";

const SNAPS: Threshold[] = [0.3, 0.5, 0.7, 0.85];

/**
 * Floating threshold control on the map. The slider is continuous (0.0–1.0,
 * step 0.05) but UI snaps to the 4 canonical thresholds from the model card
 * when clicking a tick label. The store's `threshold` field accepts only the
 * 4 canonical values, so the slider value is stored in a derived state that
 * snaps to the nearest canonical when committed.
 */
export function ThresholdControl() {
  const threshold = useAppStore((s) => s.threshold);
  const setThreshold = useAppStore((s) => s.setThreshold);

  const onSlide = (v: number) => {
    const nearest = SNAPS.reduce<Threshold>(
      (best, t) => (Math.abs(t - v) < Math.abs(best - v) ? t : best),
      SNAPS[0]!,
    );
    if (nearest !== threshold) setThreshold(nearest);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.lbl}>Threshold</span>
        <span className={styles.val}>p ≥ {threshold.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0.30}
        max={0.85}
        step={0.05}
        value={threshold}
        onChange={(e) => onSlide(Number(e.currentTarget.value))}
        className={styles.slider}
        aria-label="Susceptibility threshold"
      />
      <div className={styles.ticks}>
        {SNAPS.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tick} ${threshold === t ? styles.active : ""}`}
            onClick={() => setThreshold(t)}
            title={
              t === 0.3 ? "screening" :
              t === 0.5 ? "operational" :
              t === 0.7 ? "priority" : "high confidence"
            }
          >
            {t.toFixed(2)}
          </button>
        ))}
      </div>
    </div>
  );
}
