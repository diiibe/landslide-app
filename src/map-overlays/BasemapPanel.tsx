import { useAppStore } from "@/app/store";
import type { Basemap } from "@/app/types";
import styles from "./LayersPanel.module.css";

/**
 * Floating Basemap picker. Used to live inside the LayersPanel as a
 * sub-section; was promoted to its own panel so the basemap choice
 * doesn't compete visually with overlay toggles + model selector for
 * the limited vertical real estate of the right-hand column.
 *
 * Visual classes (`panel`, `head`, `ttl`, `caret`, `wrap`, `body`,
 * `bm`, `bmRow`) are shared with LayersPanel via the same CSS module —
 * the two panels are siblings stacked in a flex column inside
 * `.rightStack` (App.module.css), so we drop the absolute positioning
 * the panel class used to carry. The `.panel--inStack` modifier removes
 * `position: absolute / top / right` so the parent flex layout drives
 * placement.
 */
export function BasemapPanel() {
  const open = useAppStore((s) => s.basemapPanelOpen);
  const toggle = useAppStore((s) => s.toggleBasemapPanel);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);

  const items: { id: Basemap; label: string }[] = [
    { id: "outdoors", label: "Outdoors" },
    { id: "light", label: "Light" },
    { id: "satellite", label: "Satellite" },
    { id: "dark", label: "Dark" },
  ];

  return (
    <div className={`${styles.panel} ${styles.panelInStack}`} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls="basemap-panel-body"
        aria-label={open ? "Collapse basemap panel" : "Expand basemap panel"}
        onClick={toggle}
      >
        <span className={styles.ttl}>Basemap</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap} id="basemap-panel-body">
        <div className={styles.body}>
          <div className={styles.g}>
            <div className={styles.bmRow}>
              {items.map((b) => (
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
        </div>
      </div>
    </div>
  );
}
