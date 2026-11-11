// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
vi.hoisted(() => vi.stubEnv("VITE_MAPBOX_TOKEN", "test-token"));
import { SearchLocality } from "./SearchLocality";
import { useAppStore } from "@/app/store";
const feature = (name: string) => ({
  id: name,
  geometry: { type: "Point", coordinates: [13.235, 46.064] },
  properties: {
    feature_type: "address",
    name,
    place_formatted: "Udine",
    coordinates: { accuracy: "rooftop" },
  },
});
const response = (name: string) =>
  new Response(JSON.stringify({ features: [feature(name)] }), { status: 200 });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState({ search: { query: "", placeName: null } });
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const type = async (value: string) => {
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
  await act(() => vi.advanceTimersByTimeAsync(230));
};
it("selects a civic address and does not reopen or refetch the picked name", async () => {
  fetcher.mockResolvedValue(response("Via Mercatovecchio 1"));
  const events: unknown[] = [];
  const listener = (e: Event) => events.push((e as CustomEvent).detail);
  window.addEventListener("fvg:flyto", listener);
  render(<SearchLocality />);
  await type("Via Mercatovecchio 1 Udine");
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(useAppStore.getState().search.placeName).toBe(
    "Via Mercatovecchio 1, Udine",
  );
  expect(events[0]).toMatchObject({ lng: 13.235, lat: 46.064, zoom: 17.5 });
  expect(screen.queryByRole("listbox")).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(fetcher).toHaveBeenCalledTimes(1);
  window.removeEventListener("fvg:flyto", listener);
});
it("ignores an old response when the user searches a different street", async () => {
  let done: (r: Response) => void = () => {};
  fetcher
    .mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          done = r;
        }),
    )
    .mockResolvedValueOnce(response("Via Nuova 2"));
  render(<SearchLocality />);
  await type("Via Vecchia 1");
  await type("Via Nuova 2");
  await act(async () => done(response("Via Vecchia 1")));
  expect(screen.getByRole("option").textContent).toContain("Via Nuova 2");
  expect(screen.queryByText("Via Vecchia 1")).toBeNull();
});
it("keeps Escape dismissed when a pending response resolves and can show it on refocus", async () => {
  let done: (r: Response) => void = () => {};
  fetcher.mockImplementationOnce(
    () =>
      new Promise<Response>((r) => {
        done = r;
      }),
  );
  render(<SearchLocality />);
  await type("Via Roma 1");
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  await act(async () => done(response("Via Roma 1")));
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.focus(screen.getByRole("combobox"));
  expect(screen.getByRole("option").textContent).toContain("Via Roma 1");
});
it("offers retry on a failed request instead of calling it no results", async () => {
  fetcher
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(response("Via Roma 1"));
  render(<SearchLocality />);
  await type("Via Roma 1");
  expect(screen.getByRole("alert").textContent).toContain("503");
  fireEvent.click(screen.getByRole("button", { name: "Riprova ricerca" }));
  await act(() => vi.advanceTimersByTimeAsync(230));
  expect(screen.getByRole("option").textContent).toContain("Via Roma 1");
});
it("navigates on the first touch activation of a suggestion without Enter", async () => {
  fetcher.mockResolvedValue(response("Via Roma 20"));
  const listener = vi.fn();
  window.addEventListener("fvg:flyto", listener);
  render(<SearchLocality />);
  await type("Via Roma 20 Udine");
  const option = screen.getByRole("option");
  expect(option.tagName).toBe("BUTTON");
  fireEvent.pointerMove(option, { pointerType: "touch" });
  fireEvent.pointerDown(option, { pointerType: "touch", button: 0 });
  fireEvent.pointerUp(option, { pointerType: "touch" });
  fireEvent.click(option);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().search.placeName).toBe("Via Roma 20, Udine");
  expect(screen.queryByRole("listbox")).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(fetcher).toHaveBeenCalledTimes(1);
  window.removeEventListener("fvg:flyto", listener);
});
