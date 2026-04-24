import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import type { Threshold, Zone, ZoneStat } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import { Histogram } from "./widgets/Histogram";
import { ZoneBars } from "./widgets/ZoneBars";
import { useMapStats } from "@/map/useMapStats";
import styles from "./AnalyticsPanel.module.css";

const THRESHOLDS: { t: Threshold; use: string }[] = [
  { t: 0.3, use: "screening" },
  { t: 0.5, use: "operational" },
  { t: 0.7, use: "priority" },
  { t: 0.85, use: "high conf." },
];

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
    fetch(`${import.meta.env.BASE_URL}data/zones_${model}.json`)
      .then((r) => r.json())
      .then((d) => setData(d as ZoneStat[]))
      .catch(() => setData([]));
  }, [model]);
  return data;
}

export function AnalyticsPanel() {
  const threshold = useAppStore((s) => s.threshold);
  const setThreshold = useAppStore((s) => s.setThreshold);
  const zoneStats = useZoneStats();
  const live = useMapStats();

  // Per-threshold percentage from current viewport (live), or "—" if no data.
  const pctAt = (t: number): string => {
    if (!live) return "—";
    let n = 0;
    // Re-derive from histogram (10 bins). For threshold t, count cells with
    // p >= t by summing bins where the lower-bound matches.
    for (let i = 0; i < live.histogram.length; i++) {
      const lo = i / 10;
      if (lo + 0.05 >= t) n += live.histogram[i] ?? 0;
    }
    if (live.cells_visible === 0) return "—";
    return ((n / live.cells_visible) * 100).toFixed(1);
  };

  // Per-zone bars: prefer live (viewport-local mean) if available, fallback to global stats JSON.
  const zoneBarRows: { zone: Zone; mean_p: number; color: string }[] = (() => {
    const source = live && live.mean_by_zone.length > 0 ? live.mean_by_zone : zoneStats.map((z) => ({ zone: z.zone, mean_p: z.mean_p }));
    return [...source]
      .sort((a, b) => b.mean_p - a.mean_p)
      .map((z) => ({ zone: z.zone, mean_p: z.mean_p, color: colorForMeanP(z.mean_p) }));
  })();

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
                  {pctAt(t)}
                  {pctAt(t) !== "—" && <span style={{ marginLeft: 1 }}>%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Probability" className={styles.prob}>
        <KVTable
          rows={[
            { label: "Mean", value: live ? live.prob.mean.toFixed(2) : "—" },
            { label: "Median", value: live ? live.prob.median.toFixed(2) : "—" },
            { label: "p99", value: live ? live.prob.p99.toFixed(2) : "—" },
            {
              label: `Above ${threshold.toFixed(2)}`,
              value: live ? live.prob.above_threshold_pct.toFixed(1) : "—",
              unit: live ? "%" : undefined,
            },
          ]}
        />
        <div style={{ marginTop: 10 }}>
          <Histogram bins={live ? live.histogram : new Array(10).fill(0)} />
        </div>
      </Section>
      <Section title="Mean probability by zone" className={styles.byzone}>
        {zoneBarRows.length === 0 ? (
          <div style={{ padding: 4, color: "var(--c-text-soft)", fontSize: 11 }}>
            No data in view.
          </div>
        ) : (
          <ZoneBars rows={zoneBarRows} />
        )}
      </Section>
    </>
  );
}
