import type { Zone } from "@/app/types";

interface Row {
  zone: Zone;
  mean_p: number;
  color: string;
}

interface Props {
  rows: Row[];
}

export function ZoneBars({ rows }: Props) {
  return (
    <div style={{ marginTop: 4 }}>
      {rows.map((r) => (
        <div
          key={r.zone}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            padding: "3px 0",
          }}
        >
          <span
            style={{
              width: 58,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: 500,
              color: "var(--c-text-muted)",
            }}
          >
            {r.zone.replace(/_/g, " ")}
          </span>
          <span
            style={{
              flex: 1,
              height: 20,
              background: "#F1ECD9",
              border: "1px solid var(--c-border)",
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.round(r.mean_p * 100)}%`,
                background: r.color,
                borderRadius: "3px 0 0 3px",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "-.02em",
                fontVariantNumeric: "tabular-nums",
                color: "var(--c-text)",
                textShadow: "0 0 2px rgba(253,250,240,.8)",
              }}
            >
              {r.mean_p.toFixed(2)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
