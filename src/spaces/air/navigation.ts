import bbox from "@turf/bbox";
import type { Map as MLMap, PaddingOptions } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { useExperienceStore } from "../store";
import { AIR_EXPERIENCE } from "./experience";
import { useAirStore } from "./store";

/** Frame the study once on entry; its data extent is never a navigation fence. */
export function mountAirNavigation(map: MLMap) {
  const originalBounds = map.getMaxBounds()?.toArray() ?? null;
  const container = map.getContainer();
  let active = false, pending = false, frame = 0, disposed = false;
  let ready = map.isStyleLoaded();
  function cancel() {
    pending = false;
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function fit() {
    frame = 0;
    if (!active || !pending || !ready || disposed) return;
    const data = useAirStore.getState().data;
    const box = container.getBoundingClientRect();
    if (!data?.municipalities.features.length || box.width <= 0 || box.height <= 0) return;
    const bounds = bbox(data.municipalities);
    if (!bounds.every(Number.isFinite)) return;

    // The shared map already reserves the drawer. Add only the extra clearance
    // for the Space bar, map commands and bottom controls, without retaining it.
    const current = { top: 0, right: 0, bottom: 0, left: 0, ...map.getPadding() };
    const required = {
      top: Math.max(32, current.top),
      right: current.right + 32,
      bottom: current.bottom + 80,
      left: current.left + 32,
    };
    const bar = document.querySelector<HTMLElement>("[data-map-space-bar]")?.getBoundingClientRect();
    if (bar?.height) required.top = Math.max(required.top, bar.bottom - box.top + 20);
    const commands = document.querySelector<HTMLElement>('[aria-label="Comandi mappa"]')?.getBoundingClientRect();
    if (commands?.height) {
      if (box.width - current.right < 600)
        required.top = Math.max(required.top, commands.bottom - box.top + 20);
      else required.right = Math.max(required.right, box.right - commands.left + 32);
    }
    // Keep a useful viewport even on a short screen with an open sheet.
    const availableHeight = Math.max(1, box.height - current.top - current.bottom);
    const vertical = required.top + required.bottom - current.top - current.bottom;
    const scale = Math.min(1, availableHeight * 0.45 / vertical);
    const padding: PaddingOptions = {
      top: (required.top - current.top) * scale,
      bottom: (required.bottom - current.bottom) * scale,
      left: required.left - current.left,
      right: required.right - current.right,
    };
    pending = false;
    map.fitBounds([[bounds[0]!, bounds[1]!], [bounds[2]!, bounds[3]!]], {
      // MapLibre fitBounds uses these margins only for its camera calculation.
      padding, maxZoom: 10, bearing: 0, pitch: 0, duration: 0,
    });
  }
  function schedule() {
    if (!active || !pending || disposed) return;
    cancelAnimationFrame(frame);
    // React commits the drawer first; shared safe-area padding runs next frame.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(fit); });
  }
  const loading = () => { ready = false; };
  const loaded = () => { ready = true; schedule(); };
  function changed() {
    const next = useExperienceStore.getState().activeId === "air";
    if (next === active) return;
    active = next;
    cancel();
    map.setMaxBounds(active ? null : originalBounds);
    if (active) { pending = true; schedule(); }
  }
  const unsubscribeSpace = useExperienceStore.subscribe(changed);
  const unsubscribeData = useAirStore.subscribe((s, p) => {
    if (s.data !== p.data) schedule();
  });
  const unsubscribeCamera = useAppStore.subscribe((s, p) => {
    if (!active) return;
    const camera = s.cameraRequest;
    const entryCamera = camera &&
      camera.center[0] === AIR_EXPERIENCE.center[0] &&
      camera.center[1] === AIR_EXPERIENCE.center[1] &&
      camera.zoom === AIR_EXPERIENCE.zoom && camera.pitch === 0 && camera.bearing === 0;
    // openExperience resets 3D in the same update as its default camera.
    if ((s.view3D !== p.view3D && !entryCamera) || s.drawingMode) cancel();
    // Saved views and explicit navigation take precedence over the entry frame.
    if (camera && camera !== p.cameraRequest && !entryCamera) cancel();
  });
  const userMove = (event: { originalEvent?: Event }) => { if (event.originalEvent) cancel(); };
  container.addEventListener("pointerdown", cancel, { passive: true });
  container.addEventListener("wheel", cancel, { passive: true });
  const navigationEvents = ["fvg:flyto", "fvg:fitbounds", "fvg:regional-fit"];
  for (const event of navigationEvents) window.addEventListener(event, cancel);
  map.on("resize", schedule);
  map.on("movestart", userMove);
  map.on("styledataloading", loading);
  map.on("style.load", loaded);
  changed();
  return () => {
    disposed = true;
    cancel();
    unsubscribeSpace(); unsubscribeData(); unsubscribeCamera();
    container.removeEventListener("pointerdown", cancel);
    container.removeEventListener("wheel", cancel);
    for (const event of navigationEvents) window.removeEventListener(event, cancel);
    map.off("resize", schedule);
    map.off("movestart", userMove);
    map.off("styledataloading", loading);
    map.off("style.load", loaded);
    if (active) map.setMaxBounds(originalBounds);
  };
}
