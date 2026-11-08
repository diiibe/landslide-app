import styles from "./widgets.module.css";

export interface KVRow {
  label: string;
  value: string;
  unit?: string | undefined;
}

interface Props {
  rows: KVRow[];
  ariaLabel?: string | undefined;
}

export function KVTable({ rows, ariaLabel }: Props) {
  return (
    <table className={styles.kv} aria-label={ariaLabel}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>
              {r.value}
              {r.unit && <span className={styles.u}>{r.unit}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
