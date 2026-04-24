import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub the MapView — jsdom has no WebGL, and we're only testing the chrome here.
vi.mock("@/map/MapView", () => ({
  MapView: () => <div data-testid="map-stub" />,
}));

import App from "./App";
import { useAppStore } from "./store";

beforeEach(() => {
  useAppStore.getState().reset();
  // Stub fetch for public/data/*.json so tests don't need a server.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("model_")) {
      return new Response(
        JSON.stringify({
          model: "j2",
          auc_pooled: 0.802,
          pr_auc: 0.363,
          ece: 0.006,
          brier: 0.080,
          cells_trained: 676416,
          cv_folds: 378,
          zones: [],
          calibration: Array.from({ length: 9 }, (_, i) => ({
            p_pred: (i + 0.5) / 10,
            observed: (i + 0.5) / 10,
          })),
        }),
      );
    }
    if (url.includes("zones_")) return new Response("[]");
    return new Response("{}");
  });
});

describe("App integration", () => {
  it("renders brand, map stub and drawer groups", () => {
    render(<App />);
    expect(screen.getByText("FVG Landslide")).toBeInTheDocument();
    expect(screen.getByTestId("map-stub")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^monitoring/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^model/i })).toBeInTheDocument();
  });

  it("switches model via the LayersPanel J.3 button", () => {
    render(<App />);
    // Two J.3 buttons exist: the one in LayersPanel and… well, only one now.
    const j3 = screen.getAllByRole("button", { name: /^J\.3$/ })[0]!;
    fireEvent.click(j3);
    expect(useAppStore.getState().model).toBe("j3");
  });

  it("toggles drawer via the handle", () => {
    render(<App />);
    expect(useAppStore.getState().drawerOpen).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /toggle side panel/i }));
    expect(useAppStore.getState().drawerOpen).toBe(false);
  });
});
