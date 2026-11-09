import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAppearance, useAppearance } from "./appearance";

beforeEach(() => {
  localStorage.clear();
  useAppearance.getState().setPalette("forest");
  useAppearance.getState().setMotion(true);
});
describe("Appearance preferences", () => {
  it("restores validated preferences and rejects malformed stored settings", () => {
    localStorage.setItem(
      "fvg:appearance",
      JSON.stringify({ palette: "lagoon", motion: false }),
    );
    expect(readAppearance()).toEqual({ palette: "lagoon", motion: false });
    localStorage.setItem("fvg:appearance", "{bad");
    expect(readAppearance()).toEqual({ palette: "forest", motion: true });
    localStorage.setItem(
      "fvg:appearance",
      JSON.stringify({ palette: "unknown", motion: "false" }),
    );
    expect(readAppearance()).toEqual({ palette: "forest", motion: true });
  });
  it("applies and persists each preference while retaining the other", () => {
    useAppearance.getState().setPalette("earth");
    useAppearance.getState().setMotion(false);
    expect(document.documentElement.dataset.palette).toBe("earth");
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(readAppearance()).toEqual({ palette: "earth", motion: false });
  });
  it("keeps preferences functional when persistence is unavailable", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("unavailable");
      });
    try {
      useAppearance.getState().setPalette("graphite");
      expect(document.documentElement.dataset.palette).toBe("graphite");
    } finally {
      spy.mockRestore();
    }
  });
});
