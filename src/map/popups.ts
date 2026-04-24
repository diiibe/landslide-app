import maplibregl, { type Map as MLMap, type MapMouseEvent, type MapGeoJSONFeature } from "maplibre-gl";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";

type LayerMouseEvent = MapMouseEvent & { features?: MapGeoJSONFeature[] };

export function registerPopups(m: MLMap): () => void {
  const onCell = (e: LayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties as {
      cell_id: number;
      p: number;
      zone: string;
      sub_zone: string;
      iffi_hit: boolean;
    };
    new maplibregl.Popup({ closeButton: false, offset: 8, className: "cell-popup" })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-family:var(--font-stack);font-size:12px;color:#23261F">
          <div style="font-weight:700">Cell ${p.cell_id}</div>
          <div>p = <b>${Number(p.p).toFixed(3)}</b></div>
          <div style="color:#7A7A6E">${p.zone} · ${p.sub_zone}</div>
          ${p.iffi_hit ? `<div style="color:#7A1F10">IFFI intersected</div>` : ""}
        </div>`,
      )
      .addTo(m);
  };
  const onIffi = (e: LayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties as {
      id_frana: string;
      tipo_movimento: string;
      comune: string;
      provincia: string;
    };
    new maplibregl.Popup({ closeButton: false, offset: 8 })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-family:var(--font-stack);font-size:12px;color:#23261F">
          <div style="font-weight:700">Frana ${p.id_frana}</div>
          <div>${p.tipo_movimento}</div>
          <div style="color:#7A7A6E">${p.comune} (${p.provincia})</div>
        </div>`,
      )
      .addTo(m);
  };
  m.on("click", SUSCEPT_LAYER, onCell);
  m.on("click", IFFI_FILL, onIffi);
  const cellEnter = () => {
    m.getCanvas().style.cursor = "pointer";
  };
  const cellLeave = () => {
    m.getCanvas().style.cursor = "";
  };
  m.on("mouseenter", SUSCEPT_LAYER, cellEnter);
  m.on("mouseleave", SUSCEPT_LAYER, cellLeave);
  m.on("mouseenter", IFFI_FILL, cellEnter);
  m.on("mouseleave", IFFI_FILL, cellLeave);

  return () => {
    m.off("click", SUSCEPT_LAYER, onCell);
    m.off("click", IFFI_FILL, onIffi);
  };
}
