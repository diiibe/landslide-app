import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SpacePanel } from "./SpacePanel";
import { useExperienceStore } from "./store";

vi.mock("@/regional/Panel", () => ({ RegionalPanel: () => null }));
afterEach(() => {
  useExperienceStore.setState({ activeId: null, selectedId: null });
  vi.unstubAllGlobals();
});
it("moves keyboard focus into a sensor sheet and back to the overview heading", async () => {
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
    f(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  useExperienceStore.setState({
    activeId: "industry",
    selectedId: null,
    tab: "overview",
    filter: "all",
  });
  render(<SpacePanel />);
  const sensor = screen.getAllByRole("button", { name: /Pressa 01/ })[0]!;
  sensor.focus();
  fireEvent.click(sensor);
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Pressa 01" })).toHaveFocus(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Torna alla panoramica dello spazio" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Officina connessa" }),
    ).toHaveFocus(),
  );
});
