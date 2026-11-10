import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";

let installed = false;
const TRANSPARENT_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 96, 96, 96, 96, 0, 0, 0, 5, 0, 1, 165, 246, 69, 64, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

/**
 * Register the `pmtiles://` protocol with MapLibre GL JS.
 * Called once at map-init time; idempotent.
 */
export function installPmtilesProtocol(): void {
  if (installed) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", async (request, controller) => {
    const response = await protocol.tile(request, controller);
    // PMTiles uses null for missing raster tiles. MapLibre 5.24's image queue
    // never settles that response, leaving sparse boundary tiles "loading".
    // A transparent pixel is the same no-data result and decodes on WebKit too.
    return response.data === null && request.type !== "json"
      ? { ...response, data: TRANSPARENT_PNG.slice() }
      : response;
  });
  installed = true;
}
