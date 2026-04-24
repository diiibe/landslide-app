import { useAppStore } from "@/app/store";
import type { Basemap, ModelId } from "@/app/types";
import styles from "./LayersPanel.module.css";

const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: "outdoors", label: "Outdoors" },
  { id: "light", label: "Light" },
  { id: "satellite", label: "Satellite" },
];

const MODELS: { id: ModelId; label: string }[] = [
  { id: "j2", label: "J.2" },
  { id: "j3", label: "J.3" },
];

export function LayersPanel() {
  const open = useAppStore((s) => s.layersPanelOpen);
  const toggle = useAppStore((s) => s.toggleLayersPanel);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);

  return (
    <div className={styles.panel} data-open={open}>
      <button type="button" className={styles.head} aria-expanded={open} onClick={toggle}>
        <span className={styles.ttl}>Layers</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>
          <div className={styles.g}>
            <div className={styles.gTtl}>Model</div>
            <div className={styles.bmRow}>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={styles.bm}
                  data-kind={m.id === "j2" ? "outdoors" : "satellite"}
                  data-active={model === m.id}
                  onClick={() => setModel(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.g}>
            <div className={styles.gTtl}>Basemap</div>
            <div className={styles.bmRow}>
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={styles.bm}
                  data-kind={b.id}
                  data-active={basemap === b.id}
                  onClick={() => setBasemap(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.g}>
            <div className={styles.gTtl}>Overlays</div>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.susceptibility}
                onChange={() => toggleLayer("susceptibility")}
              />
              <span className={styles.itemName}>Susceptibility ({model.toUpperCase()})</span>
              <span className={styles.itemState}>{layers.susceptibility ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input type="checkbox" checked={layers.iffi} onChange={() => toggleLayer("iffi")} />
              <span className={styles.itemName}>IFFI landslides</span>
              <span className={styles.itemState}>{layers.iffi ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.zoneBoundaries}
                onChange={() => toggleLayer("zoneBoundaries")}
              />
              <span className={styles.itemName}>Zone boundaries</span>
              <span className={styles.itemState}>{layers.zoneBoundaries ? "on" : "off"}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
