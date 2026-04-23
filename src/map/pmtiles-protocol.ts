import { Protocol } from "pmtiles";
import mapboxgl from "mapbox-gl";

let installed = false;

/**
 * Register the `pmtiles://` protocol with Mapbox GL JS.
 *
 * `addProtocol` is present on `mapboxgl` at runtime but the v3 type defs
 * dropped it from the default-export surface. We cast to bypass the missing
 * type rather than augmenting the upstream module.
 */
type AddProtocol = (
  name: string,
  fn: (req: unknown, abort: AbortController) => Promise<{ data: ArrayBuffer }>,
) => void;

export function installPmtilesProtocol(): void {
  if (installed) return;
  const protocol = new Protocol();
  const mb = mapboxgl as unknown as { addProtocol: AddProtocol };
  mb.addProtocol("pmtiles", protocol.tile as unknown as Parameters<AddProtocol>[1]);
  installed = true;
}
