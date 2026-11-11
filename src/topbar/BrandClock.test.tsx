import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrandClock } from "./BrandClock";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T22:59:59.500Z")); });
afterEach(() => vi.useRealTimers());
it("uses Italian wall time, updates through midnight and cleans up its timer", () => {
  const { unmount } = render(<BrandClock />);
  expect(screen.getByTitle("Data e ora attuali · Europe/Rome")).toHaveAttribute("aria-label", "11/11/2026, ore 23:59, ora italiana");
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByTitle("Data e ora attuali · Europe/Rome")).toHaveAttribute("aria-label", "12/11/2026, ore 00:00, ora italiana");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
