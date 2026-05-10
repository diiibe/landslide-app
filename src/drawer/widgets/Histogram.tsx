import { useMemo } from "react";
import { rampColorAt } from "@/map/style";

// Single source of truth: sample the map's RAMP_STOPS at the midpoint of
// each of the 10 histogram bins so the colors match the cells on the map.
// The previous hardcoded list duplicated stops and drifted from the
// real ramp (P3 nit).
const RAMP = Array.from({ length: 10 }, (_, i) => rampColorAt((i + 0.5) / 10));

interface Props {
  bins: number[];
}

export function Histogram({ bins }: Props) {
  const max = useMemo(() => Math.max(1, ...bins), [bins]);
  return (
    <div>
      <div
        style={{
          height: 52,
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          padding: "0 2px",
          borderBottom: "1px solid var(--c-border)",
        }}
      >
        {bins.map((v, i) => (
          <span
            key={i}
            title={`bin ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`}
            style={{
              flex: 1,
              height: `${Math.round((v / max) * 100)}%`,
              background: RAMP[i],
              borderRadius: "1px 1px 0 0",
              transition: "filter .15s var(--e-quart)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--c-text-soft)",
          marginTop: 5,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".04em",
        }}
      >
        <span>0.0</span><span>0.3</span><span>0.5</span><span>0.7</span><span>1.0</span>
      </div>
    </div>
  );
}
