import { useAppStore } from "@/app/store";
import type { V2Layer } from "@/app/types";
import { useModelV2 } from "@/lib/modelV2";
import { v2ClassColor } from "@/map/layers/modelV2";
import { V2_FULL_FIT_NOTE } from "@/map/popups";
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
  const iffiOn = useAppStore((s) => s.layers.iffi);
  const comuniOn = useAppStore((s) => s.layers.comuni);
  const v2Layer = useAppStore((s): V2Layer | null =>
    s.layers.v2Bodies ? "bodies" : s.layers.v2Diffuse ? "diffuse" : null,
  );
  if (!v2Layer && !iffiOn) return null;
  return (
    <div className={styles.legend} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className={styles.ttl}>
          {v2Layer ? "Suscettibilità frane" : "Frane censite"}
        </span>
        <span className={styles.miniRamp} aria-hidden="true" />
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>
          {v2Layer && <V2LegendBody layer={v2Layer} />}
          {iffiOn && (
            <div className={styles.iffiRow}>
              <i />
              <span>Frana censita · IFFI</span>
            </div>
          )}
          {comuniOn && (
            <section className={styles.section}>
              <h4 className={styles.title}>Comune choropleth</h4>
              <p className={styles.sub}>
                Mean susceptibility (p) across each comune.
              </p>
              <div className={styles.ramp} aria-hidden="true" />
              <div className={styles.rampLabels}>
                <span>low</span>
                <span>high</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** Class swatches and shares come from `model_v2.json`: the pipeline may
 *  have collapsed tied quantiles into fewer than five classes, and the
 *  real share of cells per class is shown rather than an assumed 20%. */
function V2LegendBody({ layer }: { layer: V2Layer }) {
  const { title, copy } = V2_LEGEND[layer];
  const v2 = useModelV2();
  const cutoff = useAppStore((s) => s.susceptibilityStyle[layer].minClass);
  const stats = v2.status === "ready" ? v2.data.layers[layer] : null;
  const n = stats?.classes ?? 5;
  return (
    <section className={styles.v2} aria-label={title}>
      <h4 className={styles.title}>{title}</h4>
      <ol
        className={styles.v2Classes}
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      >
        {Array.from({ length: n }, (_, i) => (
          <li key={i} style={{ opacity: i + 1 < cutoff ? 0.3 : 1 }}>
            <i
              style={{ background: v2ClassColor(i + 1, n) }}
              aria-hidden="true"
            />
            <span>{i + 1}</span>
          </li>
        ))}
      </ol>
      <div className={styles.rampLabels}>
        <span>meno simile</span>
        <span>più simile</span>
      </div>
      <p className={styles.v2Copy}>
        Visibili le classi da {Math.min(cutoff, n)} a {n}.
      </p>
      <p className={styles.v2Copy}>{copy}</p>
      <p className={styles.v2Note}>{V2_FULL_FIT_NOTE}</p>
      {stats && (
        <p className={styles.v2Note}>
          Classi per quantili; quote effettive:{" "}
          {stats.shares.map(pct).join(", ")}.
        </p>
      )}
    </section>
  );
}
