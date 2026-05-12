import { useAppStore } from "@/app/store";
import type { Basemap, ModelId } from "@/app/types";
import { ColorButton } from "./ColorButton";
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
                  data-kind={m.id}
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
            {/* Roads + Trails sensitivity sliders live in the floating
                SensitivityPanel (mounted in App.tsx) — see
                src/map-overlays/SensitivityPanel.tsx. */}
          </div>
          <UserLayersSection />
          <UserPolygonsSection />
        </div>
      </div>
    </div>
  );
}

function UserLayersSection() {
  const userLayers = useAppStore((s) => s.userLayers);
  const updateUserLayer = useAppStore((s) => s.updateUserLayer);
  const removeUserLayer = useAppStore((s) => s.removeUserLayer);
  if (userLayers.length === 0) return null;
  return (
    <div className={styles.g}>
      <div className={styles.gTtl}>Tracks &amp; overlays</div>
      {userLayers.map((l) => (
        <div key={l.id} className={styles.userRow}>
          <input
            type="checkbox"
            className={styles.userCheck}
            checked={l.visible}
            onChange={() => updateUserLayer(l.id, { visible: !l.visible })}
            aria-label={`Show ${l.name}`}
          />
          <ColorButton
            value={l.color}
            onChange={(hex) => updateUserLayer(l.id, { color: hex })}
            ariaLabel={`Colour for ${l.name}`}
            size={22}
            disabled={l.colorMode === "riskHeatmap"}
          />
          <button
            type="button"
            className={styles.userHeat}
            data-active={l.colorMode === "riskHeatmap"}
            aria-pressed={l.colorMode === "riskHeatmap"}
            aria-label={
              l.colorMode === "riskHeatmap"
                ? `Switch ${l.name} back to solid colour`
                : `Tint ${l.name} with the trails risk heatmap`
            }
            title={
              l.colorMode === "riskHeatmap"
                ? "Solid colour"
                : "Tint with the trails risk heatmap"
            }
            onClick={() =>
              updateUserLayer(l.id, {
                colorMode: l.colorMode === "riskHeatmap" ? "solid" : "riskHeatmap",
              })
            }
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 13l3-3 3 2 3-5 2 3" />
              <circle cx="13" cy="3" r="1" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.userName}
            title={l.name}
            onClick={() => {
              if (l.bounds) {
                window.dispatchEvent(
                  new CustomEvent("fvg:fitbounds", {
                    detail: { bounds: l.bounds, padding: 80 },
                  }),
                );
              }
            }}
          >
            {l.name}
          </button>
          <button
            type="button"
            className={styles.userDel}
            aria-label={`Remove ${l.name}`}
            title="Remove this layer"
            onClick={() => removeUserLayer(l.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function UserPolygonsSection() {
  const polygons = useAppStore((s) => s.userPolygons);
  const removeUserPolygon = useAppStore((s) => s.removeUserPolygon);
  if (polygons.length === 0) return null;
  return (
    <div className={styles.g}>
      <div className={styles.gTtl}>Saved areas</div>
      {polygons.map((p) => (
        <div key={p.id} className={styles.userRow}>
          <span
            className={styles.userSwatch}
            style={{ background: p.color, border: 0 }}
            aria-hidden="true"
          />
          <button
            type="button"
            className={styles.userName}
            title={`${p.stats.cellsAboveThreshold} cells ≥ ${p.stats.threshold.toFixed(
              2,
            )} · ${p.stats.areaKm2.toFixed(1)} km²`}
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("fvg:fitbounds", {
                  detail: { bounds: p.bounds, padding: 64 },
                }),
              );
              window.dispatchEvent(
                new CustomEvent("fvg:show-polygon-stats", { detail: { id: p.id } }),
              );
            }}
          >
            {p.name}
          </button>
          <button
            type="button"
            className={styles.userDel}
            aria-label={`Remove ${p.name}`}
            title="Remove this area"
            onClick={() => removeUserPolygon(p.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
