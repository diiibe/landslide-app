import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TwinPanel } from "./Panel";
import { EMPTY_FEED, useTwinStore } from "./store";
import { parseMeasures } from "./data";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("retries a failed station series on manual refresh even if the observation time did not change", async () => {
  const row = {
    station_id: 212,
    sensor_id: 6,
    station_name: "Trieste",
    lon: 13.75,
    lat: 45.65,
    value: 3.8,
    dt: new Date(Date.now() - 30 * 60000).toISOString().slice(0, 19).replace("T", " "),
  };
  useTwinStore.setState({
    variable: "wind",
    selection: { kind: "sensor", stationId: 212 },
    measures: parseMeasures({ measures: [row] }),
    sensorsFeed: { ...EMPTY_FEED },
    radarFeed: { ...EMPTY_FEED },
    refreshKey: 0,
  });
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: "OK",
          measures: [row, { ...row, dt: new Date(Date.now() - 15 * 60000).toISOString().slice(0, 19).replace("T", " "), value: 4 }],
        }),
        { status: 200 },
      ),
    );
  render(<TwinPanel />);
  await screen.findByText(/Serie non disponibile: HTTP 503/);
  fireEvent.click(
    screen.getByRole("button", { name: /^Aggiorna adesso$/ }),
  );
  expect(
    await screen.findByRole("img", { name: /Serie osservata di Trieste/ }),
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
});

it("clips the provider response to the requested 24 hours and excludes future samples", async () => {
  const now = Date.now(), stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
  const row = { station_id: 212, sensor_id: 6, station_name: "Trieste", lon: 13.75, lat: 45.65, value: 3.8, dt: stamp(now - 30 * 60000) };
  useTwinStore.setState({ variable: "wind", selection: { kind: "sensor", stationId: 212 }, measures: parseMeasures({ measures: [row] }), sensorsFeed: { ...EMPTY_FEED }, radarFeed: { ...EMPTY_FEED } });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: "OK", measures: [
    { ...row, dt: stamp(now - 30 * 3600000) }, row,
    { ...row, dt: stamp(now - 15 * 60000), value: 4 },
    { ...row, dt: stamp(now + 10 * 60000), value: 99 },
  ] })));
  render(<TwinPanel />);
  expect(await screen.findByText("Ultime 24 ore · 2 osservazioni")).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Esplora i campioni osservati" })).toHaveAttribute("max", "1");
});
