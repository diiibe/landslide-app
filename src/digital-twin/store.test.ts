import { afterEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/app/store";
import { setTwinActive, useTwinStore } from "./store";
afterEach(() => {
  setTwinActive(false);
  useAppStore.getState().reset();
});
describe("digital twin workspace", () => {
  it("restores the exact hazard configuration and 3D setting on exit", () => {
    useAppStore.getState().reset();
    useAppStore.setState({ view3D: false });
    useAppStore.getState().toggleLayer("flood");
    const before = { ...useAppStore.getState().layers };
    setTwinActive(true);
    expect(useTwinStore.getState().active).toBe(true);
    expect(Object.values(useAppStore.getState().layers).every((v) => !v)).toBe(
      true,
    );
    expect(useAppStore.getState().view3D).toBe(true);
    setTwinActive(false);
    expect(useAppStore.getState().layers).toEqual(before);
    expect(useAppStore.getState().view3D).toBe(false);
  });
  it("does not replace the saved configuration when activation is repeated", () => {
    const before = { ...useAppStore.getState().layers };
    setTwinActive(true);
    setTwinActive(true);
    setTwinActive(false);
    expect(useAppStore.getState().layers).toEqual(before);
  });
});
