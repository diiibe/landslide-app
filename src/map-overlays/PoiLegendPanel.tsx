import { useState } from "react";
import { useAppStore } from "@/app/store";
import {
  POI_CATEGORIES,
  POI_CATEGORY_LABELS,
  POI_DEFAULT_COLORS,
  type PoiCategory,
} from "@/app/types";
import { ColorButton } from "./ColorButton";
import styles from "./PoiLegendPanel.module.css";

/** All six default POI colours, listed so the palette popover offers
 *  one-tap restore of the original hue per category in addition to
 *  the standard user palette. */
const POI_PALETTE = Object.values(POI_DEFAULT_COLORS);

/**
 * Floating legend for the breathing POI balls. Mounts only when at
 * least one of the two POI groups is on (Critical structures / Alpine
 * huts). Each row shows the human-readable category label and a
 * native colour input bound to the store's `poiColors` map. Changes
 * round-trip through localStorage and update every live POI tier via
 * `applyPoiColors` reactively in MapView.
 */
export function PoiLegendPanel() {
  const layers = useAppStore((s) => s.layers);
  const poiColors = useAppStore((s) => s.poiColors);
  const setPoiColor = useAppStore((s) => s.setPoiColor);
  const resetPoiColors = useAppStore((s) => s.resetPoiColors);
  const [open, setOpen] = useState(true);

  if (!layers.poiCritical && !layers.poiHuts) return null;

  // Two groups: the LayersPanel checkboxes toggle the whole group, but
  // the legend always lists every category so the user knows what to
  // expect when they toggle the group on.
  const groups: { title: string; categories: PoiCategory[]; visible: boolean }[] =
    [
      {
        title: "Critical structures",
        categories: ["hospital", "fire_station", "police", "school"],
        visible: layers.poiCritical,
      },
      {
        title: "Alpine huts",
        categories: ["alpine_hut", "wilderness_hut"],
        visible: layers.poiHuts,
      },
    ];

  const isCustomised = POI_CATEGORIES.some(
    (c) => poiColors[c] !== POI_DEFAULT_COLORS[c],
  );

  return (
    <div className={styles.panel} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls="poi-legend-body"
        aria-label={open ? "Collapse POI legend" : "Expand POI legend"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.ttl}>POI legend</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap} id="poi-legend-body">
        <div className={styles.body}>
          {groups
            .filter((g) => g.visible)
            .map((g) => (
              <div key={g.title} className={styles.group}>
                <div className={styles.groupTitle}>{g.title}</div>
                {g.categories.map((cat) => (
                  <div key={cat} className={styles.row}>
                    <ColorButton
                      value={poiColors[cat]}
                      onChange={(hex) => setPoiColor(cat, hex)}
                      palette={POI_PALETTE}
                      ariaLabel={`Colour for ${POI_CATEGORY_LABELS[cat]}`}
                      size={22}
                    />
                    <span className={styles.name}>{POI_CATEGORY_LABELS[cat]}</span>
                  </div>
                ))}
              </div>
            ))}
          {isCustomised && (
            <button
              type="button"
              className={styles.reset}
              onClick={resetPoiColors}
              title="Restore the default palette"
            >
              Reset to defaults
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
