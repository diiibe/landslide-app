import { useAppStore } from "@/app/store";
import type { Zone } from "@/app/types";
import styles from "./ZonesPill.module.css";

const J2_ZONES: Zone[] = ["Alpine", "Carso", "Hills", "Plain", "Prealpine"];
const J3_ZONES: Zone[] = [
  "Alpine_Snow",
  "Forested_Hills",
  "Rocky_Bare",
  "Steep_Mountain",
  "Transitional_Dry",
];

export function ZonesPill() {
  const model = useAppStore((s) => s.model);
  const selected = useAppStore((s) => s.selectedZones);
  const all = model === "j2" ? J2_ZONES : J3_ZONES;
  const label =
    selected.length === 0 ? `All (${all.length})` : selected.join(" · ");
  return (
    <button
      type="button"
      className={styles.pill}
      onClick={() => {
        // Cycle: none → all → none. Full multi-select UI is a v1.1 feature.
        const next = selected.length === 0 ? [...all] : [];
        useAppStore.getState().setSelectedZones(next);
      }}
    >
      <span className={styles.lbl}>Zones</span>
      <span className={styles.val}>{label}</span>
    </button>
  );
}
