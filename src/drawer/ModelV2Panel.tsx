import { useModelV2 } from "@/lib/modelV2";
import type { V2Layer } from "@/app/types";
import { V2_LAYERS } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import styles from "./ModelPanel.module.css";

const LAYER_TITLE: Record<V2Layer, string> = {
  bodies: "Corpi di frana",
  diffuse: "Zone diffuse",
};

/**
 * Model v2 metrics, kept in their own drawer group and never next to the
 * J.2/J.3 numbers. Shows only what the model owner writes into
 * `model_v2.json` → `layers.<layer>.metrics`; nothing is derived here.
 */
export function ModelV2Panel() {
  const v2 = useModelV2();
  return (
    <>
      <Section className={styles.v2Note}>
        <p className={styles.v2NoteText}>
          Metriche del modello v2, non confrontabili con quelle di J.2/J.3:
          inventario, dominio e validazione sono diversi.
        </p>
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
      {v2.status === "ready" &&
        V2_LAYERS.map((layer) => {
          const metrics = Object.entries(v2.data.layers[layer].metrics);
          return (
            <Section key={layer} title={LAYER_TITLE[layer]} className={styles.model}>
              {metrics.length === 0 ? (
                <div className={styles.v2Empty}>Metriche non ancora fornite.</div>
              ) : (
                <KVTable rows={metrics.map(([label, v]) => ({ label, value: v.toFixed(3) }))} />
              )}
            </Section>
          );
        })}
    </>
  );
}
