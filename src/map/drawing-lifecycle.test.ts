import { afterEach, expect, it, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import { useAppStore } from "@/app/store";
const calls = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock("terra-draw", () => ({
  TerraDraw: class {
    start() {
      calls.start();
    }
    stop() {
      calls.stop();
    }
    setMode() {}
    on() {}
    getSnapshot() {
      return [];
    }
  },
  TerraDrawPolygonMode: class {},
}));
vi.mock("terra-draw-maplibre-gl-adapter", () => ({
  TerraDrawMapLibreGLAdapter: class {},
}));
import { startDrawing, stopDrawing } from "./drawing";
afterEach(() => {
  stopDrawing();
  useAppStore.setState({ drawingMode: false });
  vi.clearAllMocks();
});
it("does not install a stale drawing adapter after asynchronous imports resolve", async () => {
  useAppStore.setState({ drawingMode: true });
  const pending = startDrawing({} as MLMap);
  stopDrawing();
  await pending;
  expect(calls.start).not.toHaveBeenCalled();
});
it("waits for a usable style and then installs exactly one adapter", async () => {
  useAppStore.setState({ drawingMode: true });
  await startDrawing({} as MLMap, () => false);
  expect(calls.start).not.toHaveBeenCalled();
  await startDrawing({} as MLMap, () => true);
  expect(calls.start).toHaveBeenCalledTimes(1);
  stopDrawing();
  expect(calls.stop).toHaveBeenCalledTimes(1);
});
