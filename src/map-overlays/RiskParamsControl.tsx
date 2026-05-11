import {
  GAMMA_MAX,
  GAMMA_MIN,
  paramsEqual,
  RADIUS_MAX,
  RADIUS_MIN,
  SENS_MAX,
  SENS_MIN,
  type LayerNetwork,
  type RiskParams,
} from "@/app/store";
import type { ModelId } from "@/app/types";
import styles from "./RiskParamsControl.module.css";

interface RiskParamsControlProps {
  network: LayerNetwork;
  model: ModelId;
  params: RiskParams;
  defaults: RiskParams;
  onChange: (key: keyof RiskParams, v: number) => void;
  onLock: () => void;
}

/**
 * Per-(network × model) risk shaping sliders + a lock button that
 * persists the current values as the default. Extracted from
 * LayersPanel so the new floating SensitivityPanel can reuse the same
 * sub-block without code duplication.
 */
export function RiskParamsControl(props: RiskParamsControlProps) {
  const { network, model, params, defaults, onChange, onLock } = props;
  const dirty = !paramsEqual(params, defaults);
  const label = network === "roads" ? "Roads" : "Trails";
  // P1.15: dynamic, descriptive aria-label so the toggle reads correctly
  // in both states. `aria-pressed` reflects the "saved" / "matches
  // default" state so SR users get state info alongside the visual
  // border tint. The inline SVG (stroke-only) replaces the emoji so the
  // visual signal works in monochrome / colourblind viewing too.
  const ariaLabel = dirty
    ? "Save current parameters as default"
    : "Defaults match current values";
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
          title={
            dirty
              ? `Save current params as default for ${label.toLowerCase()} on ${model.toUpperCase()}`
              : "Current values match the saved default"
          }
          aria-pressed={!dirty}
          aria-label={ariaLabel}
        >
          {dirty ? (
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 2.5h8v11l-4-2.5-4 2.5z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 2.5h8v11l-4-2.5-4 2.5z" />
              <path
                d="M5.8 7.4l1.6 1.6 3-3"
                fill="none"
                stroke="var(--c-surface, #fff)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
      <ParamSlider
        kind={network}
        prop="sensitivity"
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
        kind={network}
        prop="gamma"
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
        kind={network}
        prop="radius"
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
  // P1.16: structured `kind` + `prop` derive both the slider `id` and
  // the value-span `id` from the same source — `aria-describedby` needs
  // them in lockstep.
  kind: LayerNetwork;
  prop: keyof RiskParams;
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
  const { kind, prop, title, suffix, decimals, min, max, step, value, onChange } =
    props;
  const sliderId = `risk-${kind}-${prop}`;
  const valId = `${sliderId}-val`;
  // P1.16: `aria-valuetext` so screen readers announce the human-formatted
  // value ("1.5 ×", "2.0", "0 cells") instead of the raw number. The
  // visible `<span class="val">` is wired in via `aria-describedby` so SRs
  // pick it up as additional context tied to the slider.
  const valueText = `${value.toFixed(decimals)}${suffix}`;
  return (
    <div className={styles.paramRow}>
      <label htmlFor={sliderId}>{title}</label>
      <span id={valId} className={styles.val}>
        {valueText}
      </span>
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        aria-describedby={valId}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
