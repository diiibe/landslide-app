import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import type { Threshold, Zone, ZoneStat } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import { Histogram } from "./widgets/Histogram";
import { ZoneBars } from "./widgets/ZoneBars";
import styles from "./AnalyticsPanel.module.css";

const THRESHOLDS: { t: Threshold; use: string }[] = [
  { t: 0.3, use: "screening" },
  { t: 0.5, use: "operational" },
  { t: 0.7, use: "priority" },
  { t: 0.85, use: "high conf." },
];

const PCT_BY_T: Record<Threshold, string> = {
  0.3: "31.0",
  0.5: "8.3",
  0.7: "2.1",
  0.85: "0.4",
};

const SAMPLE_HIST = [92, 64, 46, 30, 22, 18, 14, 11, 9, 7];

function colorForMeanP(p: number): string {
  if (p < 0.1) return "#D9E4CF";
  if (p < 0.2) return "#B6BF93";
  if (p < 0.3) return "#8BB26B";
  if (p < 0.5) return "#D9A441";
  if (p < 0.7) return "#D25524";
  return "#7A1F10";
}

function useZoneStats(): ZoneStat[] {
  const model = useAppStore((s) => s.model);
  const [data, setData] = useState<ZoneStat[]>([]);
  useEffect(() => {
    fetch(`/data/zones_${model}.json`)
      .then((r) => r.json())
      .then((d) => setData(d as ZoneStat[]))
      .catch(() => setData([]));
  }, [model]);
  return data;
}

export function AnalyticsPanel() {
  const threshold = useAppStore((s) => s.threshold);
  const setThreshold = useAppStore((s) => s.setThreshold);
  const zones = useZoneStats();

  const rows = [...zones]
    .sort((a, b) => b.mean_p - a.mean_p)
    .map<{ zone: Zone; mean_p: number; color: string }>((z) => ({
      zone: z.zone,
      mean_p: z.mean_p,
      color: colorForMeanP(z.mean_p),
    }));

  return (
    <>
      <Section title="Decision thresholds" className={styles.thr}>
        <table className={styles.thrTable}>
          <tbody>
            {THRESHOLDS.map(({ t, use }) => (
              <tr
                key={t}
                className={threshold === t ? "active" : undefined}
                onClick={() => setThreshold(t)}
              >
                <td>
                  ≥ {t.toFixed(2)} <span className={styles.use}>{use}</span>
                </td>
                <td>
                  {PCT_BY_T[t]}
                  <span style={{ marginLeft: 1 }}>%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Probability" className={styles.prob}>
        <KVTable
          rows={[
            { label: "Mean", value: "0.18" },
            { label: "Median", value: "0.11" },
            { label: "p99", value: "0.86" },
            { label: "Above 0.50", value: "8.3", unit: "%" },
          ]}
        />
        <div style={{ marginTop: 10 }}>
          <Histogram bins={SAMPLE_HIST} />
        </div>
      </Section>
      <Section title="Mean probability by zone" className={styles.byzone}>
        <ZoneBars rows={rows} />
      </Section>
    </>
  );
}
