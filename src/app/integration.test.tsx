import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
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
  it("renders topbar, map placeholder and drawer groups", () => {
    render(<App />);
    expect(screen.getByText("FVG Landslide")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /J\.2/ })).toBeInTheDocument();
    // group headers (UPPERCASE in DOM, case-insensitive match)
    expect(screen.getByRole("button", { name: /^view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^monitoring/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^model/i })).toBeInTheDocument();
  });

  it("switches model when clicking J.3", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /J\.3/ }));
    expect(useAppStore.getState().model).toBe("j3");
  });

  it("toggles drawer via the handle", () => {
    render(<App />);
    expect(useAppStore.getState().drawerOpen).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /toggle side panel/i }));
    expect(useAppStore.getState().drawerOpen).toBe(false);
  });
});
