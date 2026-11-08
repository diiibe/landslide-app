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
    dt: "2026-11-08 15:30:00",
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
          measures: [row, { ...row, dt: "2026-11-08 15:45:00", value: 4 }],
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
