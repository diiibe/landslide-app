import { useAppStore } from "@/app/store";
import styles from "./Legend.module.css";

export function Legend() {
  const open = useAppStore((s) => s.legendOpen);
  const toggle = useAppStore((s) => s.toggleLegend);
  return (
    <div className={styles.legend} data-open={open}>
      <button type="button" className={styles.head} aria-expanded={open} onClick={toggle}>
        <span className={styles.ttl}>Susceptibility</span>
        <span className={styles.miniRamp} aria-hidden="true" />
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>
          <div className={styles.ramp} />
          <div className={styles.ticks}>
            <span>0.0</span><span>0.3</span><span>0.5</span><span>0.7</span><span>1.0</span>
          </div>
          <div className={styles.iffiRow}>
            <i />
            <span>Catalogued landslide (IFFI)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
