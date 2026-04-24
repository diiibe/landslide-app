import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import { useMapStats } from "@/map/useMapStats";
import styles from "./MonitoringPanel.module.css";

const TYPE_CLASS: Record<string, string> = {
  Scivolamento: "sci",
  Crollo: "cro",
  "Colata rapida": "col",
  Complesso: "cmp",
};

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function MonitoringPanel() {
  const stats = useMapStats();

  if (!stats) {
    return (
      <>
        <Section className={styles.inview}>
          <div style={{ padding: 6, color: "var(--c-text-soft)", fontSize: 11 }}>
            Pan or zoom the map to compute live statistics…
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <Section className={styles.inview}>
        <KVTable
          rows={[
            { label: "Cells", value: `${fmtK(stats.cells_visible)} / ${fmtK(stats.cells_total)}` },
            {
              label: "Coverage",
              value: ((stats.cells_visible / stats.cells_total) * 100).toFixed(1),
              unit: "%",
            },
            { label: "Area", value: stats.area_km2.toLocaleString("en", { maximumFractionDigits: 0 }), unit: "km²" },
            { label: "Zones", value: `${stats.zones_active} / ${stats.zones_total}` },
          ]}
        />
      </Section>
      <Section className={styles.match}>
        <KVTable
          rows={[
            { label: "Polygons in view", value: String(stats.iffi_polygons_in_view) },
            { label: "IFFI cells", value: stats.iffi_cells.toLocaleString("en") },
            { label: "Captured", value: stats.captured_above_threshold.toLocaleString("en") },
            { label: "Hit rate", value: (stats.hit_rate * 100).toFixed(1), unit: "%" },
            { label: "Precision", value: stats.precision.toFixed(3) },
          ]}
        />
      </Section>
      <Section className={styles.types}>
        {stats.iffi_by_type.length === 0 ? (
          <div style={{ padding: 4, color: "var(--c-text-soft)", fontSize: 11 }}>
            No IFFI polygons in view.
          </div>
        ) : (
          <table>
            <tbody>
              {stats.iffi_by_type.slice(0, 6).map((t) => (
                <tr key={t.tipo} className={TYPE_CLASS[t.tipo] ?? "cmp"}>
                  <td>
                    <i />
                    {t.tipo}
                  </td>
                  <td>{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
