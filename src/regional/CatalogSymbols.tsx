import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/ui/Icon";
import type { CatalogItem, ThemeId } from "./catalog";
import styles from "./CatalogSymbols.module.css";

import { CATEGORY } from "./catalogAppearance";

export function CategoryIcon({ theme }: { theme: ThemeId }) {
  const { icon, tone } = CATEGORY[theme];
  return <span className={styles.category} data-tone={tone} aria-hidden="true"><Icon name={icon} /></span>;
}
export function LayerSymbol({ item }: { item: CatalogItem }) {
  const l = item.layer;
  const geometry = l.geometryTypes ?? [];
  const kinds = new Set(geometry.map((g) => g.includes("Point") ? "pointData" : g.includes("Line") ? "lineData" : g.includes("Polygon") ? "areaData" : "layers"));
  const icon: IconName = item.userId ? "fileData"
    : l.kind === "pcr" || l.live || l.liveKind === "pcr" ? "sensor"
      : item.mapKey === "roads" || item.mapKey === "trails" ? "lineData"
        : item.mapKey === "poiCritical" || item.mapKey === "poiHuts" ? "pointData"
          : item.mapKey === "iffi" || l.kind === "buildings" ? "areaData"
            : l.kind === "raster" || l.kind === "radar" || item.mapKey ? "rasterData"
              : kinds.size === 1 ? [...kinds][0]! : "layers";
  return <span className={styles.symbol} style={{ "--symbol-color": l.color } as CSSProperties} aria-hidden="true"><Icon name={icon} /></span>;
}
