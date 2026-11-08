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
