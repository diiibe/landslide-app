import type { MapMouseEvent } from "maplibre-gl";
import { useExperienceStore } from "./store";
// Delegated MapLibre handlers may receive another wrapper for the same DOM event.
// Keep consumption tied to the original click, even after probe mode is cleared.
const consumed = new WeakSet<object>();
export function consumeProbeClick(event: MapMouseEvent) {
  consumed.add(event.originalEvent ?? event);
}
export function isProbeClick(event: MapMouseEvent) {
  return (
    useExperienceStore.getState().probe ||
    consumed.has(event.originalEvent ?? event)
  );
}
