import type { Map as MLMap } from "maplibre-gl";

let _map: MLMap | null = null;
const subs = new Set<() => void>();

export function setMap(m: MLMap | null): void {
  _map = m;
  // Expose for debugging from the browser console.
  if (typeof window !== "undefined") {
    (window as unknown as { __mlmap: MLMap | null }).__mlmap = m;
  }
  subs.forEach((fn) => fn());
}

export function getMap(): MLMap | null {
  return _map;
}

/** Subscribe to map-ready transitions. Returns an unsubscribe fn. */
export function subscribeMap(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
