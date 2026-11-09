import { useAppStore } from "@/app/store";
import { HAS_MAPBOX_TOKEN } from "@/map/style";
import type { Basemap } from "@/app/types";
import { Icon } from "@/ui/Icon";
import styles from "./BasemapPanel.module.css";
export function BasemapPanel() {
  const open = useAppStore((s) => s.basemapPanelOpen),
    toggle = useAppStore((s) => s.toggleBasemapPanel),
    basemap = useAppStore((s) => s.basemap),
    setBasemap = useAppStore((s) => s.setBasemap);
  const items: { id: Basemap; label: string }[] = HAS_MAPBOX_TOKEN
    ? [
        { id: "outdoors", label: "Rilievo" },
        { id: "light", label: "Chiaro" },
        { id: "satellite", label: "Satellite" },
        { id: "dark", label: "Scuro" },
      ]
    : [{ id: "outdoors", label: "OpenStreetMap" }];
  if (!HAS_MAPBOX_TOKEN) return (
    <div className={styles.single} aria-label="Sfondo mappa: OpenStreetMap">
      <Icon name="map" /><span>OpenStreetMap</span>
    </div>
  );
  return (
    <div className={styles.panel} data-open={open}>
      <button
        className={styles.head}
        aria-expanded={open}
        aria-controls="basemap-panel-body"
        aria-label={
          open ? "Chiudi scelta sfondo mappa" : "Apri scelta sfondo mappa"
        }
        onClick={toggle}
      >
        <Icon name="map" />
        <span>Sfondo mappa</span>
        <Icon name="chevron" className={styles.caret} />
      </button>
      <div className={styles.body} id="basemap-panel-body" hidden={!open}>
        {items.map((b) => (
          <button
            key={b.id}
            aria-pressed={!HAS_MAPBOX_TOKEN || basemap === b.id}
            title={"Usa sfondo " + b.label}
            onClick={() => setBasemap(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
