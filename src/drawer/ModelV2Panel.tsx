import { useModelV2 } from "@/lib/modelV2";
import type { V2MetricRow } from "@/lib/schemas";
import type { V2Layer } from "@/app/types";
import { V2_LAYERS } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable, type KVRow } from "./widgets/KVTable";
import styles from "./ModelPanel.module.css";

const LAYER_TITLE: Record<V2Layer, string> = {
  bodies: "Corpi di frana",
  diffuse: "Zone diffuse",
};

function toKV(r: V2MetricRow): KVRow {
  if (r.unit === "%") return { label: r.label, value: r.value.toFixed(2), unit: "%" };
  const ci = r.ci ? `(${r.ci[0].toFixed(3)}–${r.ci[1].toFixed(3)})` : undefined;
  return { label: r.label, value: r.value.toFixed(3), sub: ci };
}

/**
 * Model v2 metrics, kept in their own drawer group and never next to the
 * J.2/J.3 numbers. Shows only what the model owner writes into
 * `pipelines/model_v2_metrics.json` (copied into `model_v2.json` →
 * `metrics` at build time); nothing is derived here.
 */
export function ModelV2Panel() {
  const v2 = useModelV2();
  const metrics = v2.status === "ready" ? v2.data.metrics : null;
  return (
    <>
      <Section className={styles.v2Note}>
        <ul className={styles.v2Notes}>
          {metrics?.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>
            Le metriche misurano la corrispondenza con l’inventario di riferimento;
            non descrivono la probabilità di un evento futuro.
          </li>
        </ul>
      </Section>
      {v2.status === "loading" && (
        <Section className={styles.model}>
          <div className={styles.v2Empty}>Loading…</div>
        </Section>
      )}
      {v2.status === "missing" && (
        <Section className={styles.model}>
          <div className={styles.v2Empty}>Dati non ancora disponibili.</div>
        </Section>
      )}
      {metrics && metrics.groups.length === 0 && (
        <Section className={styles.model}>
          <div className={styles.v2Empty}>Metriche non ancora fornite.</div>
        </Section>
      )}
      {metrics?.groups.map((g) => (
        <Section key={g.title} title={g.title} ariaLabel={g.title} className={styles.model}>
          {g.detail && <p className={styles.v2Detail}>{g.detail}</p>}
          {V2_LAYERS.filter((l) => g.layers[l].length > 0).map((l) => (
            <div key={l} className={styles.v2Layer}>
              <h4 className={styles.v2LayerTitle}>{LAYER_TITLE[l]}</h4>
              <KVTable
                ariaLabel={LAYER_TITLE[l]}
                className={styles.v2Kv}
                rows={g.layers[l].map(toKV)}
              />
            </div>
          ))}
        </Section>
      ))}
    </>
  );
}
