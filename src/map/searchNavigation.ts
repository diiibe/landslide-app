import maplibregl, { type Map as MLMap } from "maplibre-gl";
import { useAppStore } from "@/app/store";
import { focusAt } from "@/spaces/navigation";
export function mountSearchNavigation(map: MLMap) {
  let marker: maplibregl.Marker | null = null;
  function clear() {
    marker?.remove();
    marker = null;
  }
  const onFly = (e: Event) => {
    const d = (
      e as CustomEvent<{
        lng: number;
        lat: number;
        zoom?: number;
        label?: string;
        precision?: string;
      }>
    ).detail;
    if (
      !d ||
      !Number.isFinite(d.lng) ||
      !Number.isFinite(d.lat) ||
      Math.abs(d.lng) > 180 ||
      Math.abs(d.lat) > 90
    )
      return;
    clear();
    const node = document.createElement("div");
    node.className = "fvg-search-pin";
    node.setAttribute("role", "img");
    node.setAttribute(
      "aria-label",
      [d.label ?? "Risultato della ricerca", d.precision]
        .filter(Boolean)
        .join(" · "),
    );
    marker = new maplibregl.Marker({ element: node, anchor: "center" })
      .setLngLat([d.lng, d.lat])
      .addTo(map);
    focusAt(
      [d.lng, d.lat],
      typeof d.zoom === "number" && Number.isFinite(d.zoom)
        ? Math.max(5, Math.min(19, d.zoom))
        : 12,
    );
  };
  window.addEventListener("fvg:flyto", onFly);
  const unsub = useAppStore.subscribe((s, p) => {
    if (s.search !== p.search && !s.search.placeName)
      clear();
  });
  return () => {
    window.removeEventListener("fvg:flyto", onFly);
    unsub();
    clear();
  };
}
