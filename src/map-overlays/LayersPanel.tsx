import type { ReactNode } from "react";
import { useAppStore } from "@/app/store";
import type { AppState, OverlayGroup } from "@/app/store";
import type { Basemap, ModelId } from "@/app/types";
import { ColorButton } from "./ColorButton";
import styles from "./LayersPanel.module.css";

/** Keys of `state.layers` belonging to each overlay group. Used to count
 *  the active items so the group header can display a "n / total on"
 *  badge even while collapsed. */
const OVERLAY_GROUP_KEYS: Record<OverlayGroup, readonly (keyof AppState["layers"])[]> = {
  landslide: ["susceptibility", "smoothHeatmap", "iffi", "zoneBoundaries"],
  flood: ["flood", "pai", "diff"],
  context: ["dtm", "roads", "trails", "comuni", "poiCritical", "poiHuts"],
};

const OVERLAY_GROUP_LABEL: Record<OverlayGroup, string> = {
  landslide: "Frane",
  flood: "Alluvioni",
  context: "Contesto",
};

const FLOOD_VIEWS: { id: AppState["floodView"]; label: string; hint: string }[] = [
  { id: "combined", label: "Combined", hint: "PAI-style 3-class map (P1 + P2 + P3)" },
  { id: "P3", label: "P3", hint: "Severe danger only (red)" },
  { id: "P2plus", label: "P2", hint: "Medium danger only, no P3 (orange)" },
  { id: "P1plus", label: "P1", hint: "Low danger only, no P2/P3 (yellow)" },
];

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
  const floodView = useAppStore((s) => s.floodView);
  const setFloodView = useAppStore((s) => s.setFloodView);
  const floodOpacity = useAppStore((s) => s.floodOpacity);
  const setFloodOpacity = useAppStore((s) => s.setFloodOpacity);
  const paiOpacity = useAppStore((s) => s.paiOpacity);
  const setPaiOpacity = useAppStore((s) => s.setPaiOpacity);
  const diffOpacity = useAppStore((s) => s.diffOpacity);
  const setDiffOpacity = useAppStore((s) => s.setDiffOpacity);

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
          <OverlaySection id="landslide">
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
          </OverlaySection>
          <OverlaySection id="flood">
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.flood}
                onChange={() => toggleLayer("flood")}
              />
              <span className={styles.itemName}>Flood overlay (ml-flood-mapping)</span>
              <span className={styles.itemState}>{layers.flood ? "on" : "off"}</span>
            </label>
            <div className={styles.bmRow} aria-disabled={!layers.flood}>
              {FLOOD_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={styles.bm}
                  data-kind={v.id}
                  data-active={floodView === v.id}
                  aria-pressed={floodView === v.id}
                  title={v.hint}
                  disabled={!layers.flood}
                  onClick={() => setFloodView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <label className={styles.item} aria-disabled={!layers.flood}>
              <span className={styles.itemName}>Flood opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={floodOpacity}
                disabled={!layers.flood}
                onChange={(e) => setFloodOpacity(Number(e.target.value))}
                style={{ flex: 1, marginLeft: 8 }}
                aria-label="Flood overlay opacity"
              />
              <span className={styles.itemState}>{Math.round(floodOpacity * 100)}%</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.pai}
                onChange={() => toggleLayer("pai")}
              />
              <span className={styles.itemName}>PAI fasce (ground truth)</span>
              <span className={styles.itemState}>{layers.pai ? "on" : "off"}</span>
            </label>
            <label className={styles.item} aria-disabled={!layers.pai}>
              <span className={styles.itemName}>PAI opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={paiOpacity}
                disabled={!layers.pai}
                onChange={(e) => setPaiOpacity(Number(e.target.value))}
                style={{ flex: 1, marginLeft: 8 }}
                aria-label="PAI overlay opacity"
              />
              <span className={styles.itemState}>{Math.round(paiOpacity * 100)}%</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.diff}
                onChange={() => toggleLayer("diff")}
              />
              <span className={styles.itemName}>
                Model vs PAI (🟢 agree · 🔵 model · 🟣 PAI)
              </span>
              <span className={styles.itemState}>{layers.diff ? "on" : "off"}</span>
            </label>
            <label className={styles.item} aria-disabled={!layers.diff}>
              <span className={styles.itemName}>Diff opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={diffOpacity}
                disabled={!layers.diff}
                onChange={(e) => setDiffOpacity(Number(e.target.value))}
                style={{ flex: 1, marginLeft: 8 }}
                aria-label="Difference overlay opacity"
              />
              <span className={styles.itemState}>{Math.round(diffOpacity * 100)}%</span>
            </label>
          </OverlaySection>
          <OverlaySection id="context">
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
          </OverlaySection>
          <UserLayersSection />
          <UserPolygonsSection />
        </div>
      </div>
    </div>
  );
}

/** Collapsible overlay category. The header is a button that toggles
 *  the body, the body lazy-collapses via grid-template-rows so the
 *  enter/exit animation stays measurement-free (same trick the outer
 *  panel uses). A right-aligned count badge ("3/4") summarises active
 *  items so the user can read the panel state without expanding it. */
function OverlaySection({ id, children }: { id: OverlayGroup; children: ReactNode }) {
  const open = useAppStore((s) => s.overlayGroupOpen[id]);
  const toggle = useAppStore((s) => s.toggleOverlayGroup);
  const layers = useAppStore((s) => s.layers);
  const keys = OVERLAY_GROUP_KEYS[id];
  const active = keys.reduce((n, k) => n + (layers[k] ? 1 : 0), 0);
  const total = keys.length;
  const bodyId = `overlay-section-${id}`;
  return (
    <div className={styles.g} data-grp-open={open}>
      <button
        type="button"
        className={styles.gHead}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => toggle(id)}
      >
        <span className={styles.gTtl}>{OVERLAY_GROUP_LABEL[id]}</span>
        <span
          className={styles.gCount}
          data-on={active > 0}
          aria-label={`${active} of ${total} overlays active`}
        >
          {active}/{total}
        </span>
        <span className={styles.gCaret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.gWrap} id={bodyId}>
        <div className={styles.gBody}>{children}</div>
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
  const updateUserPolygon = useAppStore((s) => s.updateUserPolygon);
  if (polygons.length === 0) return null;
  return (
    <div className={styles.g}>
      <div className={styles.gTtl}>Saved areas</div>
      {polygons.map((p) => (
        <div key={p.id} className={styles.userRow}>
          <ColorButton
            value={p.color}
            onChange={(hex) => updateUserPolygon(p.id, { color: hex })}
            ariaLabel={`Colour for ${p.name}`}
            size={22}
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
