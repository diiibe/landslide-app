import styles from "./widgets.module.css";

export interface KVRow {
  label: string;
  value: string;
  unit?: string | undefined;
}

interface Props {
  rows: KVRow[];
}

export function KVTable({ rows }: Props) {
  return (
    <table className={styles.kv}>
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
