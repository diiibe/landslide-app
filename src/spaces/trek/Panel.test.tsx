import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TrekPanel } from "./Panel";
import { useTrekStore } from "./store";
import { useExperienceStore } from "../store";
import { useAppStore } from "@/app/store";
import { NODES } from "./model";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);
beforeEach(() => {
  useExperienceStore.setState({
    activeId: "trek",
    tab: "tools",
    selectedId: null,
    replayTime: null,
  });
  useTrekStore.setState({
    tool: "passages",
    nodeId: "st-101",
    hours: 6,
    scenario: { mode: "normal", since: 0 },
  });
});
afterEach(cleanup);
it("opens a concrete tool and focuses its map action without leaving Extensions", () => {
  render(<TrekPanel tools />);
  fireEvent.click(
    screen.getByRole("combobox", { name: "Estensione SmartTrek" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "Alimentazione" }));
  expect(
    screen.getByRole("heading", { name: /101 · due linee/ }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mostra sulla mappa" }));
  expect(useExperienceStore.getState().tab).toBe("tools");
  expect(useExperienceStore.getState().selectedId).toBe("st-101");
  expect(useAppStore.getState().cameraRequest?.center).toEqual(
    NODES[0]!.coordinates,
  );
});
it("shows the latest measurement and its three separate timestamps in the detail", () => {
  useExperienceStore.setState({ tab: "overview", selectedId: "st-106" });
  render(<TrekPanel tools={false} />);
  expect(screen.getByRole("heading", { name: /106/ })).toBeInTheDocument();
  expect(screen.getByText("Campione sintetico")).toBeInTheDocument();
  expect(screen.getByText("Ricevuto dal Master demo")).toBeInTheDocument();
  expect(screen.getByText("Confermato nel DB demo")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Torna alla rete" }));
  expect(useExperienceStore.getState().selectedId).toBeNull();
});
it("keeps simulated telemetry explicit during a delayed delivery exercise", () => {
  act(() => {
    useTrekStore.setState({
      tool: "delivery",
      scenario: { mode: "uplink", since: Date.now() - 20 * 60000 },
    });
  });
  render(<TrekPanel tools />);
  expect(
    screen.getByText("Demo · nessuna rete fisica collegata"),
  ).toBeInTheDocument();
  expect(screen.getByText("Non ancora confermato")).toBeInTheDocument();
  expect(screen.getByText(/Rete intera/)).toHaveTextContent(
    /creati = .*confermati .*in attesa/,
  );
});

it("describes the exact fixed replay after the panel is remounted", () => {
  const fixed = Date.now() - 6 * 3600000;
  useExperienceStore.setState({ replayTime: fixed });
  const a = render(<TrekPanel tools={false} />);
  expect(
    screen.getByRole("combobox", { name: "Istante della demo" }),
  ).toHaveTextContent("Fisso");
  a.unmount();
  render(<TrekPanel tools={false} />);
  expect(
    screen.getByRole("combobox", { name: "Istante della demo" }),
  ).toHaveTextContent(
    new Date(fixed).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  expect(useExperienceStore.getState().replayTime).toBe(fixed);
});
