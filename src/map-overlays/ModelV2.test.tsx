import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "@/app/store";
import { resetModelV2Cache } from "@/lib/modelV2";
import { ModelV2Panel } from "@/drawer/ModelV2Panel";
import { LayersPanel } from "./LayersPanel";
import { Legend } from "./Legend";
import { ZonesPill } from "./ZonesPill";
import { ThresholdControl } from "./ThresholdControl";

const layer = (metrics: Record<string, number> = {}) => ({
  n_cells: 1000,
  classes: 5,
  edges: [0.01, 0.1, 0.2, 0.3, 0.4, 0.6],
  shares: [0.2, 0.2, 0.2, 0.2, 0.2],
  sources: { oof: 700, holdout: 250, in_sample: 50 },
  metrics,
});

/** A layer whose tied quantiles collapsed to three uneven classes. */
const tiedLayer = {
  ...layer(),
  classes: 3,
  edges: [0.01, 0.02, 0.3, 0.6],
  shares: [0.55, 0.25, 0.2],
};

function stubModelV2(payload: unknown | null) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    payload === null
      ? new Response("not found", { status: 404 })
      : new Response(JSON.stringify(payload)),
  );
}

const READY = { model: "v2", requested_classes: 5, layers: { bodies: layer(), diffuse: layer() } };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetModelV2Cache();
  useAppStore.getState().reset();
});

describe("LayersPanel · Modello v2", () => {
  it("keeps the v2 toggles disabled while model_v2.json is missing", async () => {
    stubModelV2(null);
    render(<LayersPanel />);
    expect(await screen.findByText("Dati non ancora disponibili.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /corpi di frana/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /zone diffuse/i })).toBeDisabled();
  });

  it("shows the two layer toggles and no zone control inside the v2 block", async () => {
    stubModelV2(READY);
    render(<LayersPanel />);
    const block = screen.getByRole("group", { name: "Modello v2" });
    const boxes = within(block).getAllByRole("checkbox");
    expect(boxes.map((b) => b.closest("label")?.textContent)).toEqual([
      expect.stringContaining("Corpi di frana"),
      expect.stringContaining("Zone diffuse"),
    ]);
    expect(within(block).queryByText(/zone boundaries|zones/i)).toBeNull();
  });

  it("switching layers keeps one v2 surface on and turns the J cells off", async () => {
    stubModelV2(READY);
    render(<LayersPanel />);
    const bodies = screen.getByRole("checkbox", { name: /corpi di frana/i });
    const diffuse = screen.getByRole("checkbox", { name: /zone diffuse/i });
    const jCells = screen.getByRole("checkbox", { name: /susceptibility/i });
    await vi.waitFor(() => expect(bodies).toBeEnabled());

    fireEvent.click(bodies);
    expect(bodies).toBeChecked();
    expect(jCells).not.toBeChecked();

    fireEvent.click(diffuse);
    expect(diffuse).toBeChecked();
    expect(bodies).not.toBeChecked();

    fireEvent.click(jCells);
    expect(jCells).toBeChecked();
    expect(diffuse).not.toBeChecked();
  });
});

describe("Legend · Modello v2", () => {
  it("explains what a red bodies cell means and is not a forecast", async () => {
    stubModelV2(READY);
    useAppStore.getState().toggleLayer("v2Bodies");
    render(<Legend />);
    const section = screen.getByRole("region", { name: /corpi di frana/i });
    expect(section).toHaveTextContent(/l'inventario ha mappato corpi di frana/);
    expect(section).toHaveTextContent(/Non significa che qui avverrà una frana/);
    expect(within(section).getAllByRole("listitem")).toHaveLength(5);
    expect(
      await within(section).findByText(/quote effettive: 20%, 20%, 20%, 20%, 20%/),
    ).toBeInTheDocument();
    expect(screen.queryByText("0.3")).toBeNull(); // J ramp ticks are gone
  });

  it("shows the real shares and class count when tied quantiles collapsed", async () => {
    stubModelV2({ ...READY, layers: { bodies: layer(), diffuse: tiedLayer } });
    useAppStore.getState().toggleLayer("v2Diffuse");
    render(<Legend />);
    const section = screen.getByRole("region", { name: /zone diffuse/i });
    expect(await within(section).findByText(/quote effettive: 55%, 25%, 20%/)).toBeInTheDocument();
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(section).not.toHaveTextContent("20% ciascuna");
  });

  it("uses the diffuse wording for the diffuse layer", () => {
    stubModelV2(READY);
    useAppStore.getState().toggleLayer("v2Diffuse");
    render(<Legend />);
    expect(screen.getByRole("region", { name: /zone diffuse/i })).toHaveTextContent(
      /zone diffuse di crollo e frane superficiali/,
    );
  });

  it("keeps the J ramp when no v2 layer is on", () => {
    render(<Legend />);
    expect(screen.getByText("0.3")).toBeInTheDocument();
    expect(screen.queryByText(/Modello v2/)).toBeNull();
  });
});

describe("J-only controls", () => {
  it("hide the zones pill and the p threshold while a v2 layer is on", () => {
    useAppStore.getState().toggleLayer("v2Diffuse");
    const { container } = render(
      <>
        <ZonesPill />
        <ThresholdControl />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ModelV2Panel", () => {
  it("says the metrics are not comparable with J and that none are provided yet", async () => {
    stubModelV2(READY);
    render(<ModelV2Panel />);
    expect(screen.getByText(/non confrontabili con quelle di J\.2\/J\.3/)).toBeInTheDocument();
    expect(await screen.findAllByText("Metriche non ancora fornite.")).toHaveLength(2);
  });

  it("shows only the metrics written into model_v2.json", async () => {
    stubModelV2({
      ...READY,
      layers: { bodies: layer({ "AUC holdout": 0.8123 }), diffuse: layer() },
    });
    render(<ModelV2Panel />);
    expect(await screen.findByText("AUC holdout")).toBeInTheDocument();
    expect(screen.getByText("0.812")).toBeInTheDocument();
    expect(screen.getAllByText("Metriche non ancora fornite.")).toHaveLength(1);
  });
});
