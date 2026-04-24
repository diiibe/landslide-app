import type { Map as MLMap } from "maplibre-gl";

export const IFFI_SOURCE = "iffi";
export const IFFI_FILL = "iffi-fill";
export const IFFI_LINE = "iffi-line";

export function addIffi(m: MLMap, visible: boolean): void {
  if (!m.getSource(IFFI_SOURCE)) {
    m.addSource(IFFI_SOURCE, {
      type: "vector",
      url: `pmtiles://${import.meta.env.BASE_URL}tiles/iffi.pmtiles`,
    });
  }
  if (!m.getLayer(IFFI_FILL)) {
    m.addLayer({
      id: IFFI_FILL,
      type: "fill",
      source: IFFI_SOURCE,
      "source-layer": "iffi",
      paint: { "fill-color": "#7A1F10", "fill-opacity": 0.12 },
    });
  }
  if (!m.getLayer(IFFI_LINE)) {
    m.addLayer({
      id: IFFI_LINE,
      type: "line",
      source: IFFI_SOURCE,
      "source-layer": "iffi",
      paint: { "line-color": "#7A1F10", "line-width": 1.2 },
    });
  }
  setIffiVisible(m, visible);
}

export function setIffiVisible(m: MLMap, visible: boolean): void {
  const v = visible ? "visible" : "none";
  for (const id of [IFFI_FILL, IFFI_LINE]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v);
  }
}
