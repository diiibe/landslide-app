import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";

let installed = false;

/**
 * Register the `pmtiles://` protocol with MapLibre GL JS.
 * Called once at map-init time; idempotent.
 */
export function installPmtilesProtocol(): void {
  if (installed) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  installed = true;
}
