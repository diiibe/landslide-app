import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/ui/Icon";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "./store";
import { catalogItems } from "./catalog";
import { enableLayer, isLayerEnabled } from "./builtins";
import styles from "./QuickLayers.module.css";
const QUICK_LAYERS: { id: string; label: string; icon: IconName }[] = [
  { id: "map-v2Bodies", label: "Corpi di frana", icon: "mountain" },
  { id: "map-v2Diffuse", label: "Zone diffuse", icon: "areaData" },
  { id: "pcr-temperature", label: "Temperatura", icon: "weather" },
  { id: "pcr-humidity", label: "Umidità", icon: "water" },
  { id: "pcr-wind", label: "Vento", icon: "air" },
  { id: "pcr-rain", label: "Pioggia · 24 h", icon: "weather" },
  { id: "pcr-radar", label: "Radar pioggia", icon: "rasterData" },
  { id: "pcr-hydro", label: "Livelli dei fiumi", icon: "waves" },
  { id: "map-roads", label: "Strade", icon: "mobility" },
  { id: "map-trails", label: "Sentieri", icon: "trailMarker" },
];
export function QuickLayers() {
  const catalog = useRegionalStore((s) => s.catalog);
  useRegionalStore((s) => s.enabled);
  useAppStore((s) => s.layers);
  const items = catalogItems(catalog?.layers ?? []);
  return <section className={styles.section} aria-labelledby="quick-layers-title">
    <div className={styles.heading}><h2 id="quick-layers-title">Scelte rapide</h2><span>Mostra o nascondi</span></div>
    <div className={styles.grid}>{QUICK_LAYERS.map((quick) => {
      const layer = items.find((i) => i.layer.id === quick.id)?.layer;
      if (!layer) return null;
      const on = isLayerEnabled(layer);
      return <button key={quick.id} type="button" disabled={layer.status !== "ready"} aria-pressed={on} aria-label={`${on ? "Nascondi" : "Mostra"} · ${layer.title}`} title={layer.description} style={{ "--quick-tone": layer.color } as CSSProperties} onClick={() => enableLayer(layer, !on)}>
        <Icon name={quick.icon} className={styles.symbol} /><span>{quick.label}</span><Icon name={on ? "eye" : "eyeOff"} className={styles.eye} />
      </button>;
    })}</div>
  </section>;
}
