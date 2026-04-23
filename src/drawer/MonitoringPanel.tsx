import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import styles from "./MonitoringPanel.module.css";

const SAMPLE = {
  inView: {
    cells_visible: 283_000,
    cells_total: 676_416,
    coverage_pct: 41.9,
    area_km2: 3_876,
    zones_active: 2,
    zones_total: 5,
  },
  matches: {
    polygons_in_view: 284,
    iffi_cells: 9_412,
    captured: 6_306,
    hit_rate_pct: 67.0,
    precision: 0.271,
  },
  types: [
    { tipo: "Scivolamento", count: 127, cls: "sci" },
    { tipo: "Crollo", count: 68, cls: "cro" },
    { tipo: "Colata rapida", count: 54, cls: "col" },
    { tipo: "Complesso", count: 35, cls: "cmp" },
  ] as const,
};

function fmtK(n: number): string {
  return `${Math.round(n / 1000)}`;
}

export function MonitoringPanel() {
  return (
    <>
      <Section className={styles.inview}>
        <KVTable
          rows={[
            { label: "Cells", value: `${fmtK(SAMPLE.inView.cells_visible)}k / ${fmtK(SAMPLE.inView.cells_total)}k` },
            { label: "Coverage", value: SAMPLE.inView.coverage_pct.toFixed(1), unit: "%" },
            { label: "Area", value: SAMPLE.inView.area_km2.toLocaleString("en"), unit: "km²" },
            { label: "Zones", value: `${SAMPLE.inView.zones_active} / ${SAMPLE.inView.zones_total}` },
          ]}
        />
      </Section>
      <Section className={styles.match}>
        <KVTable
          rows={[
            { label: "Polygons in view", value: String(SAMPLE.matches.polygons_in_view) },
            { label: "IFFI cells", value: SAMPLE.matches.iffi_cells.toLocaleString("en") },
            { label: "Captured ≥ 0.50", value: SAMPLE.matches.captured.toLocaleString("en") },
            { label: "Hit rate", value: SAMPLE.matches.hit_rate_pct.toFixed(1), unit: "%" },
            { label: "Precision", value: SAMPLE.matches.precision.toFixed(3) },
          ]}
        />
      </Section>
      <Section className={styles.types}>
        <table>
          <tbody>
            {SAMPLE.types.map((t) => (
              <tr key={t.tipo} className={t.cls}>
                <td>
                  <i />
                  {t.tipo}
                </td>
                <td>{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
