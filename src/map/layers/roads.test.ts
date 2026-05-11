import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Map as MLMap } from "maplibre-gl";
import type { ModelId } from "@/app/types";
import { __test } from "./roads";

/**
 * P0.5 — `refreshRoadData` used to queue every overlapping request:
 *
 *   if (bakingPromise) await bakingPromise;  // wait then run again
 *
 * A burst of 5 slider drags therefore ran 5 sequential bakes, each
 * walking the full 35MB FeatureCollection. The fix replaces the queue
 * with a single "pending" slot — newer requests overwrite older pending
 * ones, so at most two bakes run for any burst: the in-flight one + one
 * coalesced trailing bake with the latest params.
 *
 * This test mocks the bake fn (`__test.setBakeImpl`) so we don't need
 * MapLibre / fetch / the real cell grid. We just count calls and check
 * which model arg made it through.
 */

const fakeMap = {} as MLMap;

describe("roads refresh coalesces overlapping requests (P0.5)", () => {
  beforeEach(() => __test.reset());

  it("5 rapid calls run at most twice and the last call wins", async () => {
    const seenModels: ModelId[] = [];
    let release!: () => void;
    const firstBakeStarted = new Promise<void>((r) => (release = r));

    const bake = vi.fn(async (_m: MLMap, model: ModelId) => {
      // Block the first bake until we've enqueued the rest, so the
      // pending-slot path is exercised. Later bakes resolve immediately.
      if (bake.mock.calls.length === 1) {
        release();
        await new Promise((r) => setTimeout(r, 0));
      }
      seenModels.push(model);
    });
    __test.setBakeImpl(bake as (m: MLMap, model: ModelId) => Promise<void>);

    // 5 rapid calls. The first one starts the in-flight bake (blocked);
    // the next 4 should each overwrite the pending slot.
    const p0 = __test.refresh(fakeMap, "j2");
    await firstBakeStarted; // ensure call #1 is in-flight before we queue
    const p1 = __test.refresh(fakeMap, "j2");
    const p2 = __test.refresh(fakeMap, "j3");
    const p3 = __test.refresh(fakeMap, "j2");
    const p4 = __test.refresh(fakeMap, "j3");

    await Promise.all([p0, p1, p2, p3, p4]);

    // At most 2 bakes ran: the initial j2, plus one coalesced trailing
    // bake with the most-recently-requested model (j3).
    expect(bake).toHaveBeenCalledTimes(2);
    expect(seenModels).toEqual(["j2", "j3"]);
  });

  it("a single call still bakes exactly once", async () => {
    const bake = vi.fn(async () => {});
    __test.setBakeImpl(bake as (m: MLMap, model: ModelId) => Promise<void>);

    await __test.refresh(fakeMap, "j3");

    expect(bake).toHaveBeenCalledTimes(1);
  });

  it("sequential (non-overlapping) calls each run", async () => {
    const bake = vi.fn(async () => {});
    __test.setBakeImpl(bake as (m: MLMap, model: ModelId) => Promise<void>);

    await __test.refresh(fakeMap, "j2");
    await __test.refresh(fakeMap, "j3");
    await __test.refresh(fakeMap, "j2");

    // Each await drains the inflight slot before the next call lands —
    // no coalescing kicks in, all three bake.
    expect(bake).toHaveBeenCalledTimes(3);
  });
});
