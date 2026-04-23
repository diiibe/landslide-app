import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/app/store";
import { ViewPanel } from "./ViewPanel";

describe("ViewPanel", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("renders the current threshold from the store", () => {
    useAppStore.getState().setThreshold(0.7);
    render(<ViewPanel />);
    expect(screen.getByText("≥ 0.70")).toBeInTheDocument();
  });

  it("updates when threshold changes", () => {
    const { rerender } = render(<ViewPanel />);
    useAppStore.getState().setThreshold(0.85);
    rerender(<ViewPanel />);
    expect(screen.getByText("≥ 0.85")).toBeInTheDocument();
  });
});
