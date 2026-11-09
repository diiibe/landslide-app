import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("@/map/MapView", () => ({
  MapView: () => <div data-testid="map-stub" />,
}));
import App from "./App";
import { useAppStore } from "./store";
import { useRegionalStore } from "@/regional/store";
beforeEach(() => {
  useAppStore.getState().reset();
  useRegionalStore.setState({
    catalog: null,
    catalogError: null,
    catalogOpen: false,
    enabled: {},
    query: "",
    selection: null,
    detailId: null,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
});
describe("Unified catalog experience", () => {
  it("personalizes appearance without changing active data and stops Escape before the drawer", () => {
    render(<App />);
    const before = useAppStore.getState().layers;
    fireEvent.click(screen.getByRole("button", { name: "Impostazioni" }));
    const dialog = screen.getByRole("dialog", { name: "Aspetto dell’app" });
    expect(
      within(dialog).getByRole("button", { name: "Chiudi impostazioni" }),
    ).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Laguna/ }));
    expect(document.documentElement.dataset.palette).toBe("lagoon");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Scuro" }));
    expect(useAppStore.getState().theme).toBe("dark");
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /Animazioni/ }),
    );
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(useAppStore.getState().layers).toBe(before);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Aspetto dell’app" }),
    ).toBeNull();
    expect(useAppStore.getState().drawerOpen).toBe(true);
  });
  it("shows current mappings and active layers without obsolete model selectors or analysis tabs", () => {
    render(<App />);
    expect(screen.getByText("FriulView")).toBeInTheDocument();
    expect(screen.getByTestId("map-stub")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Analisi" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^J\.[23]$/ })).toBeNull();
    const active = screen.getByRole("region", { name: "Livelli attivi" });
    expect(
      within(active).getByRole("button", {
        name: "Corpi di frana · Suscettibilità",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(active).getByRole("button", {
        name: "Corpi di frana · Suscettibilità",
      }),
    );
    expect(screen.getByRole("slider", { name: /Soglia/ })).toHaveValue("3");
  });
  it("focuses the catalog search after opening and returns focus to the input after clearing", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Catalogo" }));
    const dialog = screen.getByRole("dialog", { name: "Catalogo dei dati" });
    const search = within(dialog).getByRole("searchbox", {
      name: "Cerca nel catalogo",
    });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "zone diffuse" } });
    const clear = within(dialog).getByRole("button", {
      name: "Svuota · Cerca nel catalogo",
    });
    clear.focus();
    fireEvent.click(clear);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });
  it("closes the catalog with Escape even while a non-empty search input has focus", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Catalogo" }));
    const search = screen
      .getByRole("dialog", { name: "Catalogo dei dati" })
      .querySelector("input")!;
    fireEvent.change(search, { target: { value: "scuole" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(useRegionalStore.getState().catalogOpen).toBe(false);
    expect(useAppStore.getState().drawerOpen).toBe(true);
  });
  it("opens the central catalog and adds a layer while keeping the catalog open", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Catalogo" }));
    const dialog = screen.getByRole("dialog", { name: "Catalogo dei dati" });
    const search = within(dialog).getByRole("searchbox", {
      name: "Cerca nel catalogo",
    });
    fireEvent.change(search, { target: { value: "zone diffuse" } });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Aggiungi alla mappa · Zone diffuse · Suscettibilità",
      }),
    );
    expect(useAppStore.getState().layers.v2Diffuse).toBe(true);
    expect(useAppStore.getState().layers.v2Bodies).toBe(false);
    expect(useRegionalStore.getState().catalogOpen).toBe(true);
    expect(
      within(dialog).getByRole("button", {
        name: "Rimuovi dalla mappa · Zone diffuse · Suscettibilità",
      }),
    ).toBeInTheDocument();
  });
  it("opens a thematic folder and navigates back using the filesystem breadcrumb", () => {
    render(<App />);
    const explorer = screen.getByRole("region", { name: "Esplora i livelli" });
    fireEvent.click(
      within(explorer).getByRole("button", { name: /Frane e versanti/ }),
    );
    fireEvent.click(
      within(explorer).getByRole("button", { name: /Modello territoriale/ }),
    );
    expect(
      within(explorer).getByRole("button", {
        name: "Zone diffuse · Suscettibilità",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(explorer).getByRole("button", { name: "Tutti i dati" }),
    );
    expect(
      within(explorer).getByRole("button", { name: /Meteo e precipitazioni/ }),
    ).toBeInTheDocument();
  });
  it("searches globally from an expanded thematic folder and restores the folder when cleared", () => {
    render(<App />);
    const explorer = screen.getByRole("region", { name: "Esplora i livelli" });
    const folder = within(explorer).getByRole("button", {
      name: /Frane e versanti/,
    });
    fireEvent.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "true");
    const search = screen.getByRole("searchbox", { name: "Cerca nei livelli" });
    fireEvent.change(search, { target: { value: "strade" } });
    expect(
      within(explorer).getByRole("button", { name: "Strade" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(explorer).getByRole("button", { name: "Azzera ricerca" }),
    );
    expect(
      within(
        within(explorer).getByRole("navigation", { name: "Cartelle dei dati" }),
      ).getByRole("button", { name: /Frane e versanti/ }),
    ).toHaveAttribute("aria-expanded", "true");
  });
  it("shows catalog failures in the sidebar and offers a retry instead of implying missing data", () => {
    useRegionalStore.setState({ catalogError: "HTTP 503" });
    render(<App />);
    const explorer = screen.getByRole("region", { name: "Esplora i livelli" });
    expect(within(explorer).getByRole("alert")).toHaveTextContent(
      "Catalogo regionale non raggiungibile",
    );
    const previous = useRegionalStore.getState().refreshKey;
    fireEvent.click(
      within(explorer).getByRole("button", { name: "Riprova adesso" }),
    );
    expect(useRegionalStore.getState().refreshKey).toBe(previous + 1);
  });
  it("restores the legend after drawing without changing the saved legend preference", () => {
    render(<App />);
    const previous = useAppStore.getState().legendOpen;
    const preferredDrawer = useAppStore.getState().drawerOpen;
    expect(
      screen.getByRole("button", { name: "Suscettibilità frane" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Strumenti" }));
    fireEvent.click(screen.getByRole("button", { name: "Disegna un’area" }));
    expect(
      screen.queryByRole("button", { name: "Suscettibilità frane" }),
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Sulla mappa" }),
    ).toBeNull();
    expect(useAppStore.getState().drawerOpen).toBe(preferredDrawer);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(
      screen.getByRole("button", { name: "Suscettibilità frane" }),
    ).toBeInTheDocument();
    expect(useAppStore.getState().legendOpen).toBe(previous);
    expect(useAppStore.getState().drawerOpen).toBe(preferredDrawer);
    expect(
      screen.getByRole("complementary", { name: "Sulla mappa" }),
    ).toBeInTheDocument();
  });
  it("closes the overlay drawer without changing which data layers are active", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /chiudi sulla mappa/i }),
    );
    expect(useAppStore.getState().drawerOpen).toBe(false);
    expect(useAppStore.getState().layers.v2Bodies).toBe(true);
  });
});
