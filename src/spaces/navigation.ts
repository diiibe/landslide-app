import type { Map } from "maplibre-gl";
import { useAppStore } from "@/app/store";
export function focusAt(center: [number, number], zoom = 16) {
  const m = (window as unknown as { __mlmap?: Map }).__mlmap;
  useAppStore.setState({
    cameraRequest: {
      center,
      zoom,
      bearing: m?.getBearing() ?? 0,
      pitch: m?.getPitch() ?? 0,
    },
    ...((window.matchMedia?.(
      "(max-width:768px), (max-height:500px) and (pointer:coarse)",
    ).matches ?? false)
      ? { drawerOpen: false }
      : {}),
  });
}
export function zoneCenter(p: GeoJSON.Polygon): [number, number] {
  const r = p.coordinates[0]!,
    x = r.map((p) => p[0]!),
    y = r.map((p) => p[1]!);
  return [
    (Math.min(...x) + Math.max(...x)) / 2,
    (Math.min(...y) + Math.max(...y)) / 2,
  ];
}
