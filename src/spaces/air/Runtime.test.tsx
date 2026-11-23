import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useExperienceStore } from "../store";
import { useAirStore } from "./store";
import { AirRuntime } from "./Runtime";
import { airFixture, contextFixture, worldFixture } from "./testFixtures";
const rows = [
  {
    ubicazione: "Sito A",
    data_misura: "2026-11-22T00:00:00",
    media_giornaliera: "21",
    media_oraria_max: "35",
    unita_misura: "ug/m3",
    dati_insuff: "False",
  },
];
const response = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  useExperienceStore.setState({ activeId: "air" });
  useAirStore.setState({
    ...useAirStore.getInitialState(),
    data: airFixture(),
  });
  fetcher = vi.fn((url: unknown) =>
    Promise.resolve(
      response(
        String(url).includes("resource/")
          ? rows
          : String(url).includes("worldcover.json")
            ? worldFixture
            : String(url).includes("context.json")
              ? contextFixture
              : airFixture(),
      ),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useExperienceStore.setState({ activeId: null });
});
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
it("refreshes directly, preserves pinned selections, and pauses network work while hidden", async () => {
  render(<AirRuntime />);
  await flush();
  expect(
    useAirStore.getState().data?.stations[0]?.series.pm10?.at(-1)?.value,
  ).toBe(21);
  expect(useAirStore.getState().date).toBe("2026-11-22");
  useAirStore.setState({
    date: "2026-11-01",
    followLatest: false,
    controls: { key: "observations", question: null },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  expect(useAirStore.getState().date).toBe("2026-11-01");
  expect(useAirStore.getState().controls?.key).toBe("observations");
  const calls = fetcher.mock.calls.length;
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600000);
  });
  expect(fetcher).toHaveBeenCalledTimes(calls);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(fetcher.mock.calls.length).toBeGreaterThan(calls);
});
it("keeps the bundle error visible while independent observation sources still update", async () => {
  fetcher.mockImplementation((url: unknown) =>
    String(url).endsWith("data.json")
      ? Promise.reject(Error("offline"))
      : Promise.resolve(
          response(
            String(url).includes("resource/")
              ? rows
              : String(url).includes("worldcover.json")
                ? worldFixture
                : contextFixture,
          ),
        ),
  );
  render(<AirRuntime />);
  await flush();
  expect(useAirStore.getState().error).toContain("conservata");
  expect(
    useAirStore.getState().data?.stations[0]?.series.pm10?.at(-1)?.value,
  ).toBe(21);
  expect(useAirStore.getState().contextError).toBeNull();
});
it("retains the last good series and exposes per-feed errors without dropping unrelated updates", async () => {
  fetcher.mockImplementation((url: unknown) =>
    String(url).includes("d63p-pqpr")
      ? Promise.reject(Error("feed offline"))
      : Promise.resolve(
          response(
            String(url).includes("resource/")
              ? rows
              : String(url).includes("worldcover.json")
                ? worldFixture
                : String(url).includes("context.json")
                  ? contextFixture
                  : airFixture(),
          ),
        ),
  );
  render(<AirRuntime />);
  await flush();
  expect(useAirStore.getState().data?.sourceStatus.pm25?.error).toContain(
    "conservata",
  );
  expect(useAirStore.getState().data?.sourceStatus.pm10?.error).toBeNull();
  expect(
    useAirStore.getState().data?.stations[0]?.series.no2?.at(-1)?.value,
  ).toBe(35);
});
it("aborts and discards late responses after leaving the Space", async () => {
  let complete: (r: Response) => void = () => {};
  fetcher.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  const mounted = render(<AirRuntime />);
  act(() => useExperienceStore.setState({ activeId: null }));
  mounted.unmount();
  const before = useAirStore.getState().data;
  complete(response(airFixture()));
  await flush();
  expect(useAirStore.getState().data).toBe(before);
  expect((fetcher.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(
    true,
  );
  expect(vi.getTimerCount()).toBe(0);
});
it("adopts successful archives and feeds even if the unrelated cover manifest times out", async () => {
  useAirStore.setState({ data: null });
  const normal = fetcher.getMockImplementation()! as (
    url: unknown,
    ...args: unknown[]
  ) => Promise<Response>;
  fetcher.mockImplementation((url: unknown, ...args: unknown[]) =>
    String(url).endsWith("worldcover.json")
      ? new Promise<Response>(() => {})
      : normal(url, ...args),
  );
  render(<AirRuntime />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(25020);
  });
  expect(
    useAirStore.getState().data?.stations[0]?.series.pm10?.at(-1)?.value,
  ).toBe(21);
  expect(useAirStore.getState().context).toEqual(contextFixture);
  expect(useAirStore.getState().worldError).toContain("non disponibile");
  expect(useAirStore.getState().loading).toBe(false);
});
it("keeps the two successful measurements when one observation API never resolves", async () => {
  const normal = fetcher.getMockImplementation()! as (
    url: unknown,
    ...args: unknown[]
  ) => Promise<Response>;
  fetcher.mockImplementation((url: unknown, ...args: unknown[]) =>
    String(url).includes("d63p-pqpr")
      ? new Promise<Response>(() => {})
      : normal(url, ...args),
  );
  render(<AirRuntime />);
  await flush();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(25020);
  });
  expect(useAirStore.getState().data?.sourceStatus.pm25?.error).toContain(
    "conservata",
  );
  expect(useAirStore.getState().data?.sourceStatus.no2?.error).toBeNull();
  expect(
    useAirStore.getState().data?.stations[0]?.series.no2?.at(-1)?.value,
  ).toBe(35);
});
it("isolates a malformed cover manifest from the observation refresh", async () => {
  const normal = fetcher.getMockImplementation()! as (
    url: unknown,
    ...args: unknown[]
  ) => Promise<Response>;
  fetcher.mockImplementation((url: unknown, ...args: unknown[]) =>
    String(url).endsWith("worldcover.json")
      ? Promise.resolve(response({ classes: [] }))
      : normal(url, ...args),
  );
  render(<AirRuntime />);
  await flush();
  expect(useAirStore.getState().worldError).toContain("non disponibile");
  expect(
    useAirStore.getState().data?.stations[0]?.series.no2?.at(-1)?.value,
  ).toBe(35);
});

it("isolates JSON null from both context sources without suppressing measurements", async () => {
  const normal = fetcher.getMockImplementation()! as (
    url: unknown,
    ...args: unknown[]
  ) => Promise<Response>;
  fetcher.mockImplementation((url: unknown, ...args: unknown[]) =>
    /worldcover.json|context.json/.test(String(url))
      ? Promise.resolve(response(null))
      : normal(url, ...args),
  );
  render(<AirRuntime />);
  await flush();
  expect(useAirStore.getState().worldError).toContain("non disponibile");
  expect(useAirStore.getState().contextError).toContain("non riuscito");
  expect(
    useAirStore.getState().data?.stations[0]?.series.no2?.at(-1)?.value,
  ).toBe(35);
});
