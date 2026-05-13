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
 * Floating legend for the breathing POI points. Mounts only when at
 * least one of the two POI groups is on (Critical structures / Alpine
 * huts). Each row shows:
 *   • a visibility checkbox bound to `poiCategoryVisible[cat]` so the
 *     user can hide individual categories within an active group;
 *   • a colour swatch bound to `poiColors[cat]`;
 *   • the human-readable category label.
 *
 * Visibility and colour changes round-trip through localStorage and
 * are applied reactively in MapView (`applyPoiCategoryFilter` /
 * `applyPoiColors`).
 */
export function PoiLegendPanel() {
  const layers = useAppStore((s) => s.layers);
  const poiColors = useAppStore((s) => s.poiColors);
  const poiCategoryVisible = useAppStore((s) => s.poiCategoryVisible);
  const setPoiColor = useAppStore((s) => s.setPoiColor);
  const togglePoiCategory = useAppStore((s) => s.togglePoiCategory);
  const resetPoiColors = useAppStore((s) => s.resetPoiColors);
  const [open, setOpen] = useState(true);

  if (!layers.poiCritical && !layers.poiHuts) return null;

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
                  <label key={cat} className={styles.row}>
                    <input
                      type="checkbox"
                      className={styles.check}
                      checked={poiCategoryVisible[cat]}
                      onChange={() => togglePoiCategory(cat)}
                      aria-label={`Show ${POI_CATEGORY_LABELS[cat]}`}
                    />
                    <ColorButton
                      value={poiColors[cat]}
                      onChange={(hex) => setPoiColor(cat, hex)}
                      palette={POI_PALETTE}
                      ariaLabel={`Colour for ${POI_CATEGORY_LABELS[cat]}`}
                      size={22}
                      disabled={!poiCategoryVisible[cat]}
                    />
                    <span
                      className={styles.name}
                      data-dim={!poiCategoryVisible[cat]}
                    >
                      {POI_CATEGORY_LABELS[cat]}
                    </span>
                  </label>
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
