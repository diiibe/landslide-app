import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { QuickLayers } from "./QuickLayers";
import { CatalogRow } from "./CatalogBrowser";
import { catalogItems } from "./catalog";
import { useAppStore } from "@/app/store";
import { useRegionalStore } from "./store";
const initialLayers = useAppStore.getState().layers;
beforeEach(() => {
  useAppStore.setState({ layers: { ...initialLayers, v2Bodies: false, v2Diffuse: false, roads: false, trails: false } });
  useRegionalStore.setState({ catalog: null, enabled: { "pcr-wind": false }, detailId: null });
});
afterEach(() => useAppStore.setState({ layers: initialLayers }));
it("toggles the same ten layers as the catalog, including changes from other controls", () => {
  const humidity = catalogItems([]).find((i) => i.layer.id === "pcr-humidity")!;
  function CatalogContext() {
    useRegionalStore((s) => s.enabled);
    return <><QuickLayers /><CatalogRow item={humidity} compact /></>;
  }
  render(<CatalogContext />);
  expect(screen.getByRole("region", { name: "Scelte rapide" }).querySelectorAll("button")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Mostra · Corpi di frana · Suscettibilità" }));
  expect(useAppStore.getState().layers.v2Bodies).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Mostra · Umidità aria" }));
  expect(useRegionalStore.getState().enabled["pcr-humidity"]).toBe(true);
  expect(screen.getByRole("button", { name: "Rimuovi dalla mappa · Umidità aria" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Rimuovi dalla mappa · Umidità aria" }));
  expect(screen.getByRole("button", { name: "Mostra · Umidità aria" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Mostra · Umidità aria" }).querySelector('[data-icon="eyeOff"]')).toBeTruthy();
  act(() => useRegionalStore.setState({ enabled: { "pcr-wind": true } }));
  expect(screen.getByRole("button", { name: "Nascondi · Vento" })).toHaveAttribute("aria-pressed", "true");
});

it("keeps all ten quick choices selected together and only switches off the chosen one", () => {
  render(<QuickLayers />);
  const quick=screen.getByRole("group",{name:"Selezione multipla dei livelli rapidi"});
  for(const button of quick.querySelectorAll("button")) fireEvent.click(button);
  expect([...quick.querySelectorAll("button")].every(b=>b.getAttribute("aria-pressed")==="true")).toBe(true);
  expect(screen.getByRole("status")).toHaveTextContent("10 attivi");
  expect(useAppStore.getState().layers).toMatchObject({v2Bodies:true,v2Diffuse:true,roads:true,trails:true});
  expect(useRegionalStore.getState().enabled).toMatchObject({"pcr-temperature":true,"pcr-humidity":true,"pcr-wind":true,"pcr-rain":true,"pcr-radiation":true,"pcr-hydro":true});
  fireEvent.click(screen.getByRole("button",{name:"Nascondi · Umidità aria"}));
  expect(quick.querySelectorAll('[aria-pressed="true"]')).toHaveLength(9);
  expect(screen.getByRole("status")).toHaveTextContent("9 attivi");
  expect(useRegionalStore.getState().enabled["pcr-temperature"]).toBe(true);
  expect(useAppStore.getState().layers.v2Bodies).toBe(true);
  expect(useAppStore.getState().layers.v2Diffuse).toBe(true);
});
