import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCellGrid } from "./cellGrid";

/**
 * P2.10 — the cell-grid index packs `(gx & 0xffff) << 16 | (gy & 0xffff)`,
 * which silently wraps for grid coordinates outside [0, 65535]. The FVG
 * bbox fits, but we'd rather throw a `RangeError` than produce silent
 * key collisions if a build script ever emits an out-of-range triplet.
 *
 * P2.11 — schema validation at the fetch boundary turns a missing/bad
 * field into a single clear error instead of a downstream crash.
 */
function mockFetchOnce(body: unknown, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }),
  );
}

describe("loadCellGrid", () => {
  beforeEach(() => {
    // Bust the module-level cache so each test sees a fresh fetch.
    // The cache is keyed by model id, so we vary the id per test below.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts well-formed in-range data", async () => {
    mockFetchOnce({ step: 0.002, data: [6150, 22750, 0.1, 6160, 22760, 0.2] });
    // Use a never-before-used model id literal cast — keeps cache clean
    // between tests without exposing internals.
    const grid = await loadCellGrid("j2-test-ok" as unknown as "j2");
    expect(grid.step).toBe(0.002);
    expect(grid.cells.size).toBe(2);
  });

  it("throws a RangeError when gx exceeds 0xffff", async () => {
    mockFetchOnce({ step: 0.002, data: [70000, 22750, 0.1] });
    await expect(loadCellGrid("j2-test-gx-hi" as unknown as "j2")).rejects.toThrow(
      /gx|range|out of/i,
    );
  });

  it("throws a RangeError when gy is negative", async () => {
    mockFetchOnce({ step: 0.002, data: [6150, -1, 0.1] });
    await expect(loadCellGrid("j2-test-gy-neg" as unknown as "j2")).rejects.toThrow(
      /gy|range|out of/i,
    );
  });

  it("throws on schema-invalid payload (data not a multiple of 3)", async () => {
    mockFetchOnce({ step: 0.002, data: [6150, 22750, 0.1, 6160] });
    await expect(loadCellGrid("j2-test-mod3" as unknown as "j2")).rejects.toThrow(
      /multiple of 3|invalid/i,
    );
  });

  it("throws on schema-invalid payload (missing step)", async () => {
    mockFetchOnce({ data: [6150, 22750, 0.1] });
    await expect(loadCellGrid("j2-test-nostep" as unknown as "j2")).rejects.toThrow();
  });
});
