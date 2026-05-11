import { useAppStore } from "@/app/store";
import { RiskParamsControl } from "./RiskParamsControl";
import styles from "./SensitivityPanel.module.css";

/**
 * Floating panel that hosts the per-network risk shaping sliders for
 * Roads and Trails. Mounts conditionally on `layers.roads || layers.trails`
 * — disappears entirely when both networks are off — and each network's
 * sub-block within it is rendered only when its layer is active. The
 * panel sits immediately to the left of the LayersPanel on the right
 * edge of the map.
 */
export function SensitivityPanel() {
  const open = useAppStore((s) => s.sensitivityPanelOpen);
  const toggle = useAppStore((s) => s.toggleSensitivityPanel);
  const layers = useAppStore((s) => s.layers);
  const model = useAppStore((s) => s.model);
  const riskParams = useAppStore((s) => s.riskParams);
  const riskParamsDefaults = useAppStore((s) => s.riskParamsDefaults);
  const setRiskParam = useAppStore((s) => s.setRiskParam);
  const lockRiskParams = useAppStore((s) => s.lockRiskParams);

  // Mount-condition: at least one of the two networks must be visible
  // for the sensitivity sliders to do anything. Returning null fully
  // unmounts so the slot doesn't reserve layout space (matters on
  // mobile, where every floating panel competes for the right edge).
  if (!layers.roads && !layers.trails) return null;

  return (
    <div className={styles.panel} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls="sensitivity-panel-body"
        aria-label={open ? "Collapse sensitivity panel" : "Expand sensitivity panel"}
        onClick={toggle}
      >
        <span className={styles.ttl}>Sensitivity</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap} id="sensitivity-panel-body">
        <div className={styles.body}>
          {layers.roads && (
            <RiskParamsControl
              network="roads"
              model={model}
              params={riskParams.roads[model]}
              defaults={riskParamsDefaults.roads[model]}
              onChange={(k, v) => setRiskParam("roads", model, k, v)}
              onLock={() => lockRiskParams("roads", model)}
            />
          )}
          {layers.trails && (
            <RiskParamsControl
              network="trails"
              model={model}
              params={riskParams.trails[model]}
              defaults={riskParamsDefaults.trails[model]}
              onChange={(k, v) => setRiskParam("trails", model, k, v)}
              onLock={() => lockRiskParams("trails", model)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
