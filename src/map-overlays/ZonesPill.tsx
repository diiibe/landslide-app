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
  const v2On = useAppStore((s) => s.layers.v2Bodies || s.layers.v2Diffuse);
  const all = model === "j2" ? J2_ZONES : J3_ZONES;
  const label =
    selected.length === 0 ? `All (${all.length})` : selected.join(" · ");
  // Zones belong to J.2/J.3; model v2 has none, so hide the control
  // while a v2 layer is the visible surface.
  if (v2On) return null;
  return (
    <button
      type="button"
      className={styles.pill}
      aria-pressed={selected.length > 0}
      aria-label={
        selected.length === 0
          ? `All ${all.length} zones active. Click to clear selection.`
          : `${selected.length} zones selected. Click to reset to all.`
      }
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
