import { it, expect } from "vitest";
import { catalogItems, filterItems } from "./catalog";
const filters = {
  query: "",
  theme: "",
  provider: "",
  type: "",
  cadence: "",
  availability: "",
};
it("puts current mappings and sensors in one catalog without exposing retired susceptibility surfaces", () => {
  const items = catalogItems([]);
  expect(items.some((i) => i.mapKey === "v2Bodies")).toBe(true);
  expect(items.some((i) => i.layer.id === "pcr-wind")).toBe(true);
  expect(
    items.some(
      (i) =>
        i.mapKey === "susceptibility" ||
        i.mapKey === "smoothHeatmap" ||
        i.mapKey === "zoneBoundaries",
    ),
  ).toBe(false);
  expect(new Set(items.map((i) => i.layer.id)).size).toBe(items.length);
});
it("combines word search, thematic folder, type and cadence without conflating historical maps with live sensors", () => {
  const items = catalogItems([]);
  const found = filterItems(
    items,
    {
      ...filters,
      query: "temperatura ARIA",
      theme: "meteo",
      type: "Sensore",
      cadence: "Monitoraggio continuo",
    },
    () => false,
  );
  expect(found.map((i) => i.layer.id)).toEqual(["pcr-temperature"]);
  expect(
    filterItems(
      items,
      { ...filters, theme: "frane", type: "Sensore" },
      () => false,
    ),
  ).toEqual([]);
});
it("matches accent-insensitive queries and the actual enabled state across both catalog origins", () => {
  const items = catalogItems([]);
  const found = filterItems(
    items,
    { ...filters, query: "suscettibilita", availability: "active" },
    (l) => l.id === "map-v2Diffuse",
  );
  expect(found.map((i) => i.layer.id)).toEqual(["map-v2Diffuse"]);
});
