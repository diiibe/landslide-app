import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("starts on the regional map with landslides opt-in", () => {
    const s = useAppStore.getState();
    expect(s.model).toBe("j3");
    expect(s.threshold).toBe(0.5);
    expect(s.basemap).toBe("outdoors");
    expect(s.layers.iffi).toBe(false);
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

  // P2.13 — clampParams must reject NaN / non-finite / missing values and
  // fall back to defaults. The bug was `Number(undefined)` = NaN, which
  // then `clamp(NaN, lo, hi)` propagated unchanged.
  describe("clampParams (P2.13) rejects malformed values", () => {
    it("setRiskParam with NaN falls back to default (sensitivity = 1)", () => {
      useAppStore.getState().setRiskParam("roads", "j3", "sensitivity", NaN);
      const s = useAppStore.getState().riskParams.roads.j3;
      expect(Number.isFinite(s.sensitivity)).toBe(true);
      expect(s.sensitivity).toBe(1);
    });

    it("setRiskParam with Infinity falls back to default", () => {
      useAppStore.getState().setRiskParam("roads", "j3", "gamma", Infinity);
      const s = useAppStore.getState().riskParams.roads.j3;
      expect(Number.isFinite(s.gamma)).toBe(true);
      // Infinity is non-finite → falls back to DEFAULT_PARAMS.gamma (1.5),
      // not to the clamped GAMMA_MAX.
      expect(s.gamma).toBe(1.5);
    });

    it("setRiskParam with a finite out-of-range value clamps (does not reset)", () => {
      // Sanity: a finite value above SENS_MAX (10) must still clamp, not
      // bounce back to default.
      useAppStore.getState().setRiskParam("roads", "j3", "sensitivity", 9999);
      expect(useAppStore.getState().riskParams.roads.j3.sensitivity).toBe(10);
    });

    it("rejects malformed localStorage payload (NaN / missing keys / wrong types)", async () => {
      // Re-import the module with a poisoned localStorage so loadSensDefaults
      // hits every malformed branch in one go. vitest's resetModules gives
      // us a fresh module-level singleton.
      const { vi } = await import("vitest");
      window.localStorage.setItem(
        "fvg:sensitivity-defaults",
        JSON.stringify({
          roads: {
            j2: { sensitivity: "not a number", gamma: null, radius: undefined },
            j3: { sensitivity: NaN, gamma: Infinity, radius: -Infinity },
          },
          trails: {
            j2: {}, // missing keys entirely
            // j3 missing entirely
          },
        }),
      );
      vi.resetModules();
      const mod = await import("./store");
      const params = mod.useAppStore.getState().riskParamsDefaults;
      for (const net of ["roads", "trails"] as const) {
        for (const model of ["j2", "j3"] as const) {
          const p = params[net][model];
          expect(Number.isFinite(p.sensitivity)).toBe(true);
          expect(Number.isFinite(p.gamma)).toBe(true);
          expect(Number.isFinite(p.radius)).toBe(true);
          expect(p.sensitivity).toBeGreaterThanOrEqual(0.1);
          expect(p.sensitivity).toBeLessThanOrEqual(10);
          expect(p.gamma).toBeGreaterThanOrEqual(0.3);
          expect(p.gamma).toBeLessThanOrEqual(4);
          expect(p.radius).toBeGreaterThanOrEqual(0);
          expect(p.radius).toBeLessThanOrEqual(8);
        }
      }
      window.localStorage.removeItem("fvg:sensitivity-defaults");
    });
  });

  // P2.14 — when another tab locks a parameter, our store should pick up
  // the new defaults on the next `storage` event so the "dirty" indicator
  // doesn't lie until the user reloads.
  describe("cross-tab riskParamsDefaults sync (P2.14)", () => {
    it("re-hydrates riskParamsDefaults when localStorage changes from another tab", () => {
      // Simulate tab B writing fresh defaults.
      const payload = {
        roads: {
          j2: { sensitivity: 3.3, gamma: 1.7, radius: 4 },
          j3: { sensitivity: 3.3, gamma: 1.7, radius: 4 },
        },
        trails: {
          j2: { sensitivity: 2.2, gamma: 2.1, radius: 3 },
          j3: { sensitivity: 2.2, gamma: 2.1, radius: 3 },
        },
      };
      window.localStorage.setItem(
        "fvg:sensitivity-defaults",
        JSON.stringify(payload),
      );
      // Dispatch the synthetic storage event our listener wires up.
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "fvg:sensitivity-defaults",
          newValue: JSON.stringify(payload),
        }),
      );
      const after = useAppStore.getState().riskParamsDefaults;
      expect(after.roads.j3.sensitivity).toBe(3.3);
      expect(after.trails.j2.gamma).toBeCloseTo(2.1, 5);
      window.localStorage.removeItem("fvg:sensitivity-defaults");
    });
  });
});

/* Current maps can be overlaid; legacy surfaces remain incompatible. */
describe("independent model v2 layers", () => {
  beforeEach(() => { useAppStore.getState().reset(); });

  it("keeps all susceptibility surfaces off before entering their space", () => {
    const { layers } = useAppStore.getState();
    expect(layers.v2Bodies).toBe(false);
    expect(layers.v2Diffuse).toBe(false);
    expect(layers.susceptibility).toBe(false);
    expect(layers.smoothHeatmap).toBe(false);
  });

  it("turning bodies on hides the J surfaces but keeps IFFI", () => {
    useAppStore.setState(s=>({layers:{...s.layers,v2Bodies:false,iffi:true,susceptibility:true,smoothHeatmap:true}}));
    useAppStore.getState().toggleLayer("v2Bodies");
    const { layers } = useAppStore.getState();
    expect(layers.v2Bodies).toBe(true);
    expect(layers.susceptibility).toBe(false);
    expect(layers.smoothHeatmap).toBe(false);
    expect(layers.iffi).toBe(true);
  });

  it("keeps both current maps on until each is explicitly disabled", () => {
    const s = useAppStore.getState();
    s.toggleLayer("v2Bodies");
    s.toggleLayer("v2Diffuse");
    expect(useAppStore.getState().layers).toMatchObject({v2Bodies: true, v2Diffuse: true});
    s.toggleLayer("v2Bodies");
    expect(useAppStore.getState().layers).toMatchObject({v2Bodies: false, v2Diffuse: true});
    s.toggleLayer("v2Diffuse");
    expect(useAppStore.getState().layers).toMatchObject({v2Bodies: false, v2Diffuse: false});
  });

  it("both v2 layers can be off at once", () => {
    const s = useAppStore.getState();
    s.toggleLayer("v2Diffuse");
    s.toggleLayer("v2Diffuse");
    const { layers } = useAppStore.getState();
    expect(layers.v2Bodies).toBe(false);
    expect(layers.v2Diffuse).toBe(false);
  });

  it("turning a J surface on hides the active v2 layer", () => {
    const s = useAppStore.getState();
    s.toggleLayer("v2Diffuse");
    s.toggleLayer("susceptibility");
    let { layers } = useAppStore.getState();
    expect(layers.susceptibility).toBe(true);
    expect(layers.v2Diffuse).toBe(false);

    s.toggleLayer("v2Bodies"); // clears smoothHeatmap and susceptibility
    s.toggleLayer("smoothHeatmap");
    ({ layers } = useAppStore.getState());
    expect(layers.smoothHeatmap).toBe(true);
    expect(layers.v2Bodies).toBe(false);
  });

  it("turning inventory off leaves the selected v2 layer alone", () => {
    useAppStore.setState(s=>({layers:{...s.layers,v2Bodies:true,iffi:true}}));
    const s = useAppStore.getState();
    s.toggleLayer("iffi");
    expect(useAppStore.getState().layers.v2Bodies).toBe(true);
  });

  it("flood and context overlays are independent of v2", () => {
    useAppStore.setState(s=>({layers:{...s.layers,v2Bodies:true}}));
    const s = useAppStore.getState();
    s.toggleLayer("flood");
    s.toggleLayer("roads");
    const { layers } = useAppStore.getState();
    expect(layers.flood).toBe(true);
    expect(layers.roads).toBe(true);
    expect(layers.v2Bodies).toBe(true);
  });
});
