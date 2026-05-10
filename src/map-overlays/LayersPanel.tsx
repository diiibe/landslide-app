import {
  GAMMA_MAX,
  GAMMA_MIN,
  paramsEqual,
  RADIUS_MAX,
  RADIUS_MIN,
  SENS_MAX,
  SENS_MIN,
  useAppStore,
  type LayerNetwork,
  type RiskParams,
} from "@/app/store";
import type { Basemap, ModelId } from "@/app/types";
import styles from "./LayersPanel.module.css";

const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: "outdoors", label: "Outdoors" },
  { id: "light", label: "Light" },
  { id: "satellite", label: "Satellite" },
  { id: "dark", label: "Dark" },
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
  const riskParams = useAppStore((s) => s.riskParams);
  const riskParamsDefaults = useAppStore((s) => s.riskParamsDefaults);
  const setRiskParam = useAppStore((s) => s.setRiskParam);
  const lockRiskParams = useAppStore((s) => s.lockRiskParams);

  return (
    <div className={styles.panel} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls="layers-panel-body"
        aria-label={open ? "Collapse layers panel" : "Expand layers panel"}
        onClick={toggle}
      >
        <span className={styles.ttl}>Layers</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap} id="layers-panel-body">
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
                  aria-pressed={model === m.id}
                  title={`Use model ${m.label}`}
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
                  aria-pressed={basemap === b.id}
                  title={`Use ${b.label} basemap`}
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
              <span className={styles.itemName}>
                Susceptibility ({model.toUpperCase()}) · cells ≥ thr
              </span>
              <span className={styles.itemState}>{layers.susceptibility ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.smoothHeatmap}
                onChange={() => toggleLayer("smoothHeatmap")}
              />
              <span className={styles.itemName}>Smooth heatmap (KDE)</span>
              <span className={styles.itemState}>{layers.smoothHeatmap ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.dtm}
                onChange={() => toggleLayer("dtm")}
              />
              <span className={styles.itemName}>Study area · DTM hillshade</span>
              <span className={styles.itemState}>{layers.dtm ? "on" : "off"}</span>
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
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.roads}
                onChange={() => toggleLayer("roads")}
              />
              <span className={styles.itemName}>Roads</span>
              <span className={styles.itemState}>{layers.roads ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.trails}
                onChange={() => toggleLayer("trails")}
              />
              <span className={styles.itemName}>Trails (sentieri)</span>
              <span className={styles.itemState}>{layers.trails ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.comuni}
                onChange={() => toggleLayer("comuni")}
              />
              <span className={styles.itemName}>Comune choropleth</span>
              <span className={styles.itemState}>{layers.comuni ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.poiCritical}
                onChange={() => toggleLayer("poiCritical")}
              />
              <span className={styles.itemName}>Critical structures</span>
              <span className={styles.itemState}>{layers.poiCritical ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.poiHuts}
                onChange={() => toggleLayer("poiHuts")}
              />
              <span className={styles.itemName}>Alpine huts</span>
              <span className={styles.itemState}>{layers.poiHuts ? "on" : "off"}</span>
            </label>
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
    </div>
  );
}

interface RiskParamsControlProps {
  network: LayerNetwork;
  model: ModelId;
  params: RiskParams;
  defaults: RiskParams;
  onChange: (key: keyof RiskParams, v: number) => void;
  onLock: () => void;
}

function RiskParamsControl(props: RiskParamsControlProps) {
  const { network, model, params, defaults, onChange, onLock } = props;
  const dirty = !paramsEqual(params, defaults);
  const label = network === "roads" ? "Roads" : "Trails";
  return (
    <div className={styles.paramsBlock}>
      <div className={styles.paramsHead}>
        <span>
          {label} risk · {model.toUpperCase()}
        </span>
        <button
          type="button"
          className={styles.lockBtn}
          data-active={!dirty}
          onClick={onLock}
          title={dirty
            ? `Save current params as default for ${label.toLowerCase()} on ${model.toUpperCase()}`
            : "Current values match the saved default"}
          aria-label="Lock as default"
        >
          {dirty ? "🔓" : "🔒"}
        </button>
      </div>
      <ParamSlider
        id={`sens-${network}`}
        title="Sensitivity"
        suffix="×"
        decimals={2}
        min={SENS_MIN}
        max={SENS_MAX}
        step={0.05}
        value={params.sensitivity}
        onChange={(v) => onChange("sensitivity", v)}
      />
      <ParamSlider
        id={`gamma-${network}`}
        title="Gamma"
        suffix=""
        decimals={2}
        min={GAMMA_MIN}
        max={GAMMA_MAX}
        step={0.05}
        value={params.gamma}
        onChange={(v) => onChange("gamma", v)}
      />
      <ParamSlider
        id={`radius-${network}`}
        title="Radius"
        suffix=" cells"
        decimals={0}
        min={RADIUS_MIN}
        max={RADIUS_MAX}
        step={1}
        value={params.radius}
        onChange={(v) => onChange("radius", v)}
      />
    </div>
  );
}

interface ParamSliderProps {
  id: string;
  title: string;
  suffix: string;
  decimals: number;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}

function ParamSlider(props: ParamSliderProps) {
  const { id, title, suffix, decimals, min, max, step, value, onChange } = props;
  return (
    <div className={styles.paramRow}>
      <label htmlFor={id}>{title}</label>
      <span className={styles.val}>
        {value.toFixed(decimals)}
        {suffix}
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
