import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("starts with J.2 active and threshold 0.50", () => {
    const s = useAppStore.getState();
    expect(s.model).toBe("j2");
    expect(s.threshold).toBe(0.5);
    expect(s.basemap).toBe("outdoors");
    expect(s.layers.iffi).toBe(true);
    expect(s.drawerOpen).toBe(true);
    expect(s.legendOpen).toBe(true);
  });

  it("setModel switches active model", () => {
    useAppStore.getState().setModel("j3");
    expect(useAppStore.getState().model).toBe("j3");
  });

  it("toggleZone adds/removes a zone from the active set", () => {
    useAppStore.getState().setSelectedZones(["Hills"]);
    useAppStore.getState().toggleZone("Prealpine");
    expect(useAppStore.getState().selectedZones).toContain("Prealpine");
    useAppStore.getState().toggleZone("Hills");
    expect(useAppStore.getState().selectedZones).toEqual(["Prealpine"]);
  });

  it("toggleDrawer flips drawerOpen", () => {
    expect(useAppStore.getState().drawerOpen).toBe(true);
    useAppStore.getState().toggleDrawer();
    expect(useAppStore.getState().drawerOpen).toBe(false);
  });
});
