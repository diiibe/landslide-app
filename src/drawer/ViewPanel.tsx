import { useAppStore } from "@/app/store";
import { Section } from "./widgets/Section";
import { KVTable, type KVRow } from "./widgets/KVTable";
import styles from "./ViewPanel.module.css";

const ZONES_TOTAL: Record<"j2" | "j3", number> = { j2: 5, j3: 5 };

export function ViewPanel() {
  const model = useAppStore((s) => s.model);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const threshold = useAppStore((s) => s.threshold);

  const rows: KVRow[] = [
    {
      label: "Zones",
      value: `${selectedZones.length === 0 ? ZONES_TOTAL[model] : selectedZones.length} / ${ZONES_TOTAL[model]}`,
    },
    { label: "Overlay", value: model.toUpperCase() },
    { label: "Threshold", value: `≥ ${threshold.toFixed(2)}` },
    { label: "Model", value: model.toUpperCase() },
  ];
  return (
    <Section className={styles.view}>
      <KVTable rows={rows} />
    </Section>
  );
}
