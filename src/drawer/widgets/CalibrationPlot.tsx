import { useMemo } from "react";
import styles from "./CalibrationPlot.module.css";

interface Bin {
  p_pred: number;
  observed: number;
}

const BIN_COLORS = [
  "#8BB26B", "#8BB26B", "#B6BF93", "#D9A441", "#D9A441",
  "#D25524", "#D25524", "#7A1F10", "#7A1F10",
];

function toXY(b: Bin): [number, number] {
  const x = 28 + b.p_pred * 200;
  const y = 122 - b.observed * 110;
  return [x, y];
}

interface Props {
  bins: Bin[];
}

export function CalibrationPlot({ bins }: Props) {
  const points = useMemo(() => bins.map(toXY), [bins]);
  const curve = useMemo(
    () => points.map(([x, y]) => `${x},${y}`).join(" "),
    [points],
  );
  const gapPoints = useMemo(() => {
    const fwd = points.map(([x, y]) => `${x},${y}`);
    const back = [...bins].reverse().map((b) => {
      const [x] = toXY(b);
      const yDiag = 122 - b.p_pred * 110;
      return `${x},${yDiag}`;
    });
    return [...fwd, ...back].join(" ");
  }, [bins, points]);

  return (
    <div className={styles.plot}>
      <svg viewBox="0 0 240 150" preserveAspectRatio="none">
        <line className={styles.gridLine} x1="78"  y1="12" x2="78"  y2="122" />
        <line className={styles.gridLine} x1="128" y1="12" x2="128" y2="122" />
        <line className={styles.gridLine} x1="178" y1="12" x2="178" y2="122" />
        <line className={styles.gridLine} x1="28" y1="94.5" x2="228" y2="94.5" />
        <line className={styles.gridLine} x1="28" y1="67"   x2="228" y2="67" />
        <line className={styles.gridLine} x1="28" y1="39.5" x2="228" y2="39.5" />
        <line className={styles.axisLine} x1="28" y1="12"  x2="28"  y2="122" />
        <line className={styles.axisLine} x1="28" y1="122" x2="228" y2="122" />
        <polygon className={styles.gapArea} points={gapPoints} />
        <line className={styles.diag} x1="28" y1="122" x2="228" y2="12" />
        <polyline className={styles.curve} points={curve} />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            className={styles.dot}
            cx={x}
            cy={y}
            r={3}
            fill={BIN_COLORS[i] ?? "#3E5E72"}
            style={{ animationDelay: `${0.7 + i * 0.08}s` }}
          >
            <title>{`bin ${bins[i]!.p_pred.toFixed(2)} · obs ${bins[i]!.observed.toFixed(2)}`}</title>
          </circle>
        ))}
        <text className={styles.axisTick} x="28"  y="134" textAnchor="middle">0</text>
        <text className={styles.axisTick} x="78"  y="134" textAnchor="middle">.25</text>
        <text className={styles.axisTick} x="128" y="134" textAnchor="middle">.5</text>
        <text className={styles.axisTick} x="178" y="134" textAnchor="middle">.75</text>
        <text className={styles.axisTick} x="228" y="134" textAnchor="middle">1</text>
        <text className={styles.axisTick} x="22" y="124" textAnchor="end">0</text>
        <text className={styles.axisTick} x="22" y="70"  textAnchor="end">.5</text>
        <text className={styles.axisTick} x="22" y="15"  textAnchor="end">1</text>
        <text className={styles.axisLabel} x="128" y="146" textAnchor="middle">Predicted</text>
        <text
          className={styles.axisLabel}
          x="10"
          y="70"
          textAnchor="middle"
          transform="rotate(-90 10 70)"
        >
          Observed
        </text>
      </svg>
    </div>
  );
}
