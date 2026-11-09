import { useId, useState } from "react";
import { formatValue } from "./simulation";
import styles from "./Panel.module.css";
export function SeriesChart({
  points,
  unit,
  color,
  label,
  limit,
  comparison,
}: {
  points: { time: number; value: number }[];
  unit: string;
  color: string;
  label: string;
  limit?: number;
  comparison?: { time: number; value: number }[];
}) {
  const [index, setIndex] = useState<number | null>(null),
    id = useId();
  if (!points.length) return <p>Nessun campione disponibile.</p>;
  const current =
      points[Math.min(index ?? points.length - 1, points.length - 1)]!,
    values = [...points, ...(comparison ?? [])].map((p) => p.value);
  let low = Math.min(...values),
    high = Math.max(...values);
  const span = high - low;
  if (span < 0.001) {
    low = Math.max(0, low - 1);
    high += 1;
  } else {
    low -= span * 0.12;
    high += span * 0.12;
    if (values.every((v) => v >= 0)) low = Math.max(0, low);
  }
  const x = (i: number) => 12 + (i / (points.length - 1 || 1)) * 296,
    y = (v: number) => 124 - ((v - low) / (high - low)) * 106;
  const path = points
      .map(
        (p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
      )
      .join(" "),
    at = Math.min(index ?? points.length - 1, points.length - 1);
  return (
    <div className={styles.chart}>
      <div className={styles.chartReadout}>
        <output aria-live={index === null ? "off" : "polite"} id={id}>
          <strong>
            {formatValue(current.value, unit)} <small>{unit}</small>
          </strong>
          <span>
            {new Date(current.time).toLocaleString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "short",
              timeZone: "Europe/Rome",
            })}
          </span>
        </output>
        {index !== null && (
          <button onClick={() => setIndex(null)}>Ultimo</button>
        )}
      </div>
      {comparison && (
        <p className={styles.caption}>
          Linea continua: ipotesi selezionata · tratteggio: ciclo ordinario allo
          stesso istante.
        </p>
      )}
      <div className={styles.axis}>
        <span>{formatValue(high, unit)}</span>
        <span>{unit}</span>
      </div>
      <svg
        viewBox="0 0 320 144"
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return;
          const rect = e.currentTarget.getBoundingClientRect();
          setIndex(
            Math.round(
              Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) *
                (points.length - 1),
            ),
          );
        }}
        onPointerLeave={() => setIndex(null)}
      >
        <path
          d="M12 124H308M12 71H308M12 18H308"
          stroke="var(--c-border)"
          strokeWidth=".7"
          fill="none"
        />
        {limit !== undefined && limit > low && limit < high && (
          <path
            d={`M12 ${y(limit)}H308`}
            stroke="#d18543"
            strokeDasharray="4 3"
          />
        )}
        {comparison && (
          <path
            d={comparison
              .map(
                (p, i) =>
                  `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
              )
              .join(" ")}
            stroke="var(--c-text-muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
          />
        )}
        <path d={`${path} L308,124 L12,124 Z`} fill={color} fillOpacity=".09" />
        <path
          d={path}
          stroke={color}
          strokeWidth="2.2"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d={`M${x(at)} 18V124`}
          stroke={color}
          strokeWidth=".7"
          strokeDasharray="2 3"
        />
        <circle
          cx={x(at)}
          cy={y(current.value)}
          r="4"
          fill={color}
          stroke="var(--c-surface)"
          strokeWidth="2"
        />
      </svg>
      <div className={styles.axis}>
        <span>
          Min {formatValue(low, unit)} {unit}
        </span>
        <span>Scala del grafico</span>
      </div>
      <div className={styles.axis}>
        <span>
          {new Date(points[0]!.time).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Rome",
          })}
        </span>
        <span>
          {new Date(points.at(-1)!.time).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Rome",
          })}
        </span>
      </div>
      <label className={styles.seriesSlider}>
        Esplora i campioni
        <input
          type="range"
          min="0"
          max={points.length - 1}
          value={at}
          aria-label="Esplora la serie simulata"
          aria-describedby={id}
          aria-valuetext={`${formatValue(current.value, unit)} ${unit}, ${new Date(current.time).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}`}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
