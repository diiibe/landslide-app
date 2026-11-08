import { describe, expect, it } from "vitest";
import { rewriteMapboxUrl } from "./mapboxUrl";
const token = "pk.test-public-token";
describe("Mapbox HTTP URL adapter", () => {
  it("routes font stacks through the versioned Fonts API", () => {
    const path =
      "mapbox/DIN%20Pro%20Regular,Arial%20Unicode%20MS%20Regular/0-255.pbf";
    expect(
      rewriteMapboxUrl(`mapbox://fonts/${path}`, undefined, token).url,
    ).toBe(`https://api.mapbox.com/fonts/v1/${path}?access_token=${token}`);
  });
  it("does not duplicate a version prefix or discard an existing query", () => {
    expect(
      rewriteMapboxUrl(
        "mapbox://fonts/v1/mapbox/Open%20Sans%20Regular/256-511.pbf?fresh=true",
        undefined,
        token,
      ).url,
    ).toBe(
      `https://api.mapbox.com/fonts/v1/mapbox/Open%20Sans%20Regular/256-511.pbf?fresh=true&access_token=${token}`,
    );
  });
  it("preserves HTTP resources and leaves missing-token requests unchanged", () => {
    const http = "https://example.com/fonts/font/0-255.pbf";
    expect(rewriteMapboxUrl(http, undefined, token)).toEqual({ url: http });
    const uri = "mapbox://fonts/mapbox/Open%20Sans%20Regular/0-255.pbf";
    expect(rewriteMapboxUrl(uri, undefined, undefined)).toEqual({ url: uri });
  });
  it("retains sprite and tileset rewriting", () => {
    expect(
      rewriteMapboxUrl(
        "mapbox://sprites/mapbox/outdoors-v12@2x.png",
        undefined,
        token,
      ).url,
    ).toBe(
      `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/sprite@2x.png?access_token=${token}`,
    );
    expect(
      rewriteMapboxUrl("mapbox://mapbox.terrain-rgb", undefined, token).url,
    ).toBe(
      `https://api.mapbox.com/v4/mapbox.terrain-rgb.json?secure&access_token=${token}`,
    );
  });
});
