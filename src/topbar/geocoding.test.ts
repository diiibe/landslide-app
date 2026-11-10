import { expect, it } from "vitest";
import { asSuggestion, geocodingURL } from "./geocoding";
const address = {
  id: "a",
  geometry: { type: "Point", coordinates: [13.235, 46.064] },
  properties: {
    feature_type: "address",
    name: "Via Mercatovecchio 1",
    place_formatted: "Udine",
    coordinates: { accuracy: "interpolated" },
  },
};
it("keeps the house number, context, estimated accuracy and address-level zoom", () => {
  expect(asSuggestion(address)).toMatchObject({
    name: "Via Mercatovecchio 1",
    fullName: "Via Mercatovecchio 1, Udine",
    kind: "Indirizzo",
    zoom: 17.5,
    precision: "Posizione stimata",
  });
  expect(
    asSuggestion({
      ...address,
      properties: {
        ...address.properties,
        feature_type: "street",
        name: "Via Mercatovecchio",
      },
    }),
  ).toMatchObject({ kind: "Via", zoom: 15.5, precision: "" });
});
it("rejects malformed features instead of sending invalid coordinates to the map", () => {
  for (const value of [
    null,
    {},
    { ...address, geometry: { type: "Point", coordinates: [NaN, 46] } },
    { ...address, geometry: { type: "Point", coordinates: [13, 100] } },
    { ...address, properties: { name: "Bad" } },
    { ...address, geometry: { type: "Polygon", coordinates: [13, 46] } },
  ])
    expect(asSuggestion(value)).toBeNull();
});
it("requests streets and addresses in Italian within the current search area", () => {
  const url = new URL(geocodingURL("Via Roma 12, Tavagnacco", "test"));
  expect(url.pathname).toBe("/search/geocode/v6/forward");
  expect(url.searchParams.get("q")).toBe("Via Roma 12, Tavagnacco");
  expect(url.searchParams.get("types")).toContain("street,address");
  expect(url.searchParams.get("language")).toBe("it");
});
