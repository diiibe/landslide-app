import styles from "./widgets.module.css";

export interface KVRow {
  label: string;
  value: string;
  unit?: string | undefined;
  /** Small second line under the value (e.g. an interval). */
  sub?: string | undefined;
}

interface Props {
  rows: KVRow[];
  ariaLabel?: string | undefined;
  className?: string | undefined;
}

export function KVTable({ rows, ariaLabel, className = "" }: Props) {
  return (
    <table className={`${styles.kv} ${className}`} aria-label={ariaLabel}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>
              {r.value}
              {r.unit && <span className={styles.u}>{r.unit}</span>}
              {r.sub && <span className={styles.sub}>{r.sub}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
