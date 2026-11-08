import { useId, useState } from "react";
import { formatTime, formatValue, type Measure } from "./data";
import styles from "./Twin.module.css";

/** Inspect observed samples without changing the latest observations on the map. */
export function ObservedSeriesChart({ rows, unit }: { rows: Measure[]; unit: string }) {
  const id = useId();
  const [index, setIndex] = useState<number | null>(null);
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const selectedIndex = Math.min(index ?? rows.length - 1, rows.length - 1);
  const selected = rows[selectedIndex]!;
  const lo = Math.min(...rows.map((m) => m.value));
  const hi = Math.max(...rows.map((m) => m.value));
  const span = last.ms - first.ms || 1;
  const x = (m: Measure) => 12 + ((m.ms - first.ms) / span) * 236;
  const y = (m: Measure) => hi === lo ? 62 : 96 - ((m.value - lo) / (hi - lo)) * 68;
  const d = rows.map((m, i) =>
    `${i && m.ms - rows[i - 1]!.ms <= 45 * 60000 ? "L" : "M"}${x(m)},${y(m)}`,
  ).join(" ");
  const hour = (ms: number) => new Date(ms).toLocaleTimeString("it-IT", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  });
  return (
    <div className={styles.series}>
      <p className={styles.caption}>Ultime 24 ore · {rows.length} osservazioni</p>
      <svg viewBox="0 0 260 130" role="img"
        aria-label={`Serie osservata di ${first.name}, da ${formatTime(first.ms)} a ${formatTime(last.ms)}`}>
        <text x="12" y="16">{formatValue(hi)} {unit}</text>
        <text x="248" y="16" textAnchor="end">min {formatValue(lo)}</text>
        <line x1="12" x2="248" y1="96" y2="96" className={styles.chartAxis} />
        <path d={d} />
        {rows.map((m) => <circle key={`${m.ms}:${m.sensorId}`} cx={x(m)} cy={y(m)} r="1.8" className={styles.chartSample} />)}
        <line x1={x(selected)} x2={x(selected)} y1="24" y2="100" className={styles.chartCursor} />
        <circle cx={x(selected)} cy={y(selected)} r="4" className={styles.chartSelected} />
        <text x="12" y="122">{hour(first.ms)}</text>
        <text x="248" y="122" textAnchor="end">{hour(last.ms)}</text>
      </svg>
      <label className={styles.field} htmlFor={id}>Esplora i campioni osservati</label>
      <input id={id} className={styles.sampleSlider} type="range" min="0" max={rows.length - 1}
        value={selectedIndex} onChange={(event) => setIndex(Number(event.target.value))}
        aria-valuetext={`${formatTime(selected.ms)}, ${formatValue(selected.value)} ${unit}`}
        aria-describedby={`${id}-readout`} />
      <output id={`${id}-readout`} className={styles.sampleReadout} htmlFor={id}>
        <strong>{formatValue(selected.value)} {unit}</strong>
        <span>{formatTime(selected.ms)}</span>
      </output>
      <p className={styles.caption}>Lettura storica: la mappa mostra le ultime misure disponibili. Interruzioni oltre 45 minuti lasciate visibili.</p>
    </div>
  );
}
