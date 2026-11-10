import { it, expect, vi, afterEach } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { useAppStore } from "@/app/store";
const created = vi.hoisted(
  () =>
    [] as { element: HTMLElement; removed: boolean; coordinates?: number[] }[],
);
vi.mock("maplibre-gl", () => ({
  default: {
    Marker: class {
      value: { element: HTMLElement; removed: boolean; coordinates?: number[] };
      constructor(o: { element: HTMLElement }) {
        this.value = { element: o.element, removed: false };
        created.push(this.value);
      }
      setLngLat(p: number[]) {
        this.value.coordinates = p;
        return this;
      }
      addTo() {
        return this;
      }
      remove() {
        this.value.removed = true;
        return this;
      }
    },
  },
}));
import { mountSearchNavigation } from "./searchNavigation";
afterEach(() => {
  useAppStore.setState({
    search: { query: "", placeName: null },
    cameraRequest: null,
  });
  created.length = 0;
});
it("places one accessible search marker, restores the requested scale, clears and disposes it", () => {
  const map = {} as MLMap;
  const dispose = mountSearchNavigation(map);
  useAppStore.setState({
    search: { query: "Via Roma 12", placeName: "Via Roma 12" },
  });
  const event = () =>
    window.dispatchEvent(
      new CustomEvent("fvg:flyto", {
        detail: {
          lng: 13.2,
          lat: 46.1,
          zoom: 17.5,
          label: "Via Roma 12",
          precision: "Posizione stimata",
        },
      }),
    );
  event();
  expect(created).toHaveLength(1);
  expect(created[0]?.element.getAttribute("aria-label")).toContain(
    "Posizione stimata",
  );
  expect(useAppStore.getState().cameraRequest).toMatchObject({
    zoom: 17.5,
    center: [13.2, 46.1],
  });
  event();
  expect(created[0]?.removed).toBe(true);
  useAppStore.setState({ search: { query: "Via Nuova", placeName: null } });
  expect(created[1]?.removed).toBe(true);
  dispose();
  event();
  expect(created).toHaveLength(2);
});
it("ignores invalid positions and bounds the zoom before changing the camera", () => {
  const dispose = mountSearchNavigation({} as MLMap);
  window.dispatchEvent(
    new CustomEvent("fvg:flyto", { detail: { lng: NaN, lat: 46, zoom: 17 } }),
  );
  expect(created).toHaveLength(0);
  window.dispatchEvent(
    new CustomEvent("fvg:flyto", { detail: { lng: 13.2, lat: 46, zoom: 100 } }),
  );
  expect(useAppStore.getState().cameraRequest?.zoom).toBe(19);
  dispose();
});
