import { afterEach, describe, expect, it, vi } from "vitest";
import { startPolling } from "./polling";
afterEach(() => vi.useRealTimers());
describe("twin polling lifecycle", () => {
  it("waits for completion, avoids overlap and aborts on teardown", async () => {
    vi.useFakeTimers();
    let finish: () => void = () => {};
    let signal: AbortSignal | undefined;
    const task = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const stop = startPolling(task, true);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(180000);
    expect(task).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
    expect(signal?.aborted).toBe(true);
    finish();
    await vi.advanceTimersByTimeAsync(600000);
    expect(task).toHaveBeenCalledTimes(2);
  });
  it("performs one read when automatic refresh is disabled", async () => {
    vi.useFakeTimers();
    const task = vi.fn(async () => {}),
      stop = startPolling(task, false);
    await vi.advanceTimersByTimeAsync(300000);
    expect(task).toHaveBeenCalledTimes(1);
    stop();
  });
});

it("reads new observations every minute in view and immediately after reconnect/focus", async () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  let value = 0;
  const task = vi.fn(async () => { value += 1; });
  const stop = startPolling(task, true);
  await Promise.resolve();
  expect(value).toBe(1);
  await vi.advanceTimersByTimeAsync(60000);
  expect(value).toBe(2);
  hidden.mockReturnValue(true); document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(180000);
  expect(value).toBe(2);
  hidden.mockReturnValue(false); document.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve(); expect(value).toBe(3);
  window.dispatchEvent(new Event("online")); await Promise.resolve(); expect(value).toBe(4);
  window.dispatchEvent(new Event("focus")); await Promise.resolve(); expect(value).toBe(5);
  stop(); window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(60000); expect(value).toBe(5);
  hidden.mockRestore();
});
