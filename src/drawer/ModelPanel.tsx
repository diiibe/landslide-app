import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import type { ModelStats } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import { CalibrationPlot } from "./widgets/CalibrationPlot";
import styles from "./ModelPanel.module.css";

function useModelStats(): ModelStats | null {
  const model = useAppStore((s) => s.model);
  const [data, setData] = useState<ModelStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/data/model_${model}.json`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d as ModelStats);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [model]);
  return data;
}

export function ModelPanel() {
  const model = useAppStore((s) => s.model);
  const stats = useModelStats();

  if (!stats) {
    return (
      <Section className={styles.model}>
        <div style={{ padding: 8, color: "var(--c-text-soft)" }}>Loading…</div>
      </Section>
    );
  }

  const maxGap = Math.max(
    ...stats.calibration.map((b) => Math.abs(b.observed - b.p_pred)),
  );

  return (
    <>
      <Section title="Calibration pooled" className={styles.calib}>
        <KVTable
          rows={[
            { label: "ECE", value: stats.ece.toFixed(3) },
            { label: "Brier", value: stats.brier.toFixed(3) },
            { label: "Bins", value: String(stats.calibration.length) },
            { label: "Max gap", value: maxGap.toFixed(2) },
          ]}
        />
        <CalibrationPlot bins={stats.calibration} />
      </Section>
      <Section title={`Model ${model.toUpperCase()}`} className={styles.model}>
        <KVTable
          rows={[
            { label: "AUC pooled", value: stats.auc_pooled.toFixed(3) },
            { label: "PR-AUC", value: stats.pr_auc.toFixed(3) },
            { label: "ECE", value: stats.ece.toFixed(3) },
            { label: "Brier", value: stats.brier.toFixed(3) },
            { label: "Cells trained", value: `${Math.round(stats.cells_trained / 1000)}`, unit: "k" },
            { label: "CV folds", value: String(stats.cv_folds) },
          ]}
        />
      </Section>
    </>
  );
}
