import { useAppStore } from "@/app/store";
import type { V2Layer } from "@/app/types";
import { V2_CLASS_COLORS } from "@/map/layers/modelV2";
import styles from "./Legend.module.css";

/** What a red v2 cell means, per layer. Plain Italian on purpose: the
 *  class says how much a cell resembles where the inventory mapped
 *  landslides of that kind, never that one will happen there. */
const V2_LEGEND: Record<V2Layer, { title: string; copy: string }> = {
  bodies: {
    title: "Corpi di frana",
    copy:
      "Rosso: la cella somiglia ai luoghi dove l'inventario ha mappato " +
      "corpi di frana. Non significa che qui avverrà una frana.",
  },
  diffuse: {
    title: "Zone diffuse",
    copy:
      "Rosso: la cella somiglia ai luoghi dove l'inventario ha mappato " +
      "zone diffuse di crollo e frane superficiali. Non significa che qui " +
      "avverrà una frana.",
  },
};

export function Legend() {
  const open = useAppStore((s) => s.legendOpen);
  const toggle = useAppStore((s) => s.toggleLegend);
  const comuniOn = useAppStore((s) => s.layers.comuni);
  const v2Layer = useAppStore((s): V2Layer | null =>
    s.layers.v2Bodies ? "bodies" : s.layers.v2Diffuse ? "diffuse" : null,
  );
  return (
    <div className={styles.legend} data-open={open}>
      <button type="button" className={styles.head} aria-expanded={open} onClick={toggle}>
        <span className={styles.ttl}>{v2Layer ? "Modello v2" : "Susceptibility"}</span>
        <span className={styles.miniRamp} aria-hidden="true" />
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>
          {v2Layer ? (
            <V2LegendBody layer={v2Layer} />
          ) : (
            <>
              <div className={styles.ramp} />
              <div className={styles.ticks}>
                <span>0.0</span><span>0.3</span><span>0.5</span><span>0.7</span><span>1.0</span>
              </div>
            </>
          )}
          <div className={styles.iffiRow}>
            <i />
            <span>Catalogued landslide (IFFI)</span>
          </div>
          {comuniOn && (
            <section className={styles.section}>
              <h4 className={styles.title}>Comune choropleth</h4>
              <p className={styles.sub}>Mean susceptibility (p) across each comune.</p>
              <div className={styles.ramp} aria-hidden="true" />
              <div className={styles.rampLabels}>
                <span>low</span><span>high</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function V2LegendBody({ layer }: { layer: V2Layer }) {
  const { title, copy } = V2_LEGEND[layer];
  return (
    <section className={styles.v2} aria-label={title}>
      <h4 className={styles.title}>{title}</h4>
      <ol className={styles.v2Classes}>
        {V2_CLASS_COLORS.map((c, i) => (
          <li key={c}>
            <i style={{ background: c }} aria-hidden="true" />
            <span>{i + 1}</span>
          </li>
        ))}
      </ol>
      <div className={styles.rampLabels}>
        <span>meno simile</span><span>più simile</span>
      </div>
      <p className={styles.v2Copy}>{copy}</p>
      <p className={styles.v2Note}>Classi: quintili delle celle del dominio, 20% ciascuna.</p>
    </section>
  );
}
