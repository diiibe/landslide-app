import { describe, expect, it } from "vitest";
import { weightFor } from "./smoothHeatmap";

/**
 * `weightFor` produces a MapLibre `interpolate` expression. The expression
 * has the shape:
 *   ["interpolate", ["linear"], ["get", "p"], stop1, out1, stop2, out2, ...]
 * MapLibre requires input stops to be strictly increasing — equal stops
 * trigger a runtime style validation error. P2.4: at threshold near 0,
 * `Math.max(0, threshold - 0.001)` could collapse to stop1 == stop2.
 */
function extractStops(expr: unknown): number[] {
  if (!Array.isArray(expr)) throw new Error("expected array expression");
  // Either an interpolate (stops at indices 3, 5, 7, …) or a `case` (no stops).
  if (expr[0] !== "interpolate") return [];
  const stops: number[] = [];
  for (let i = 3; i < expr.length; i += 2) {
    const v = expr[i];
    if (typeof v !== "number") throw new Error(`non-numeric stop at ${i}`);
    stops.push(v);
  }
  return stops;
}

describe("weightFor", () => {
  it("produces strictly increasing input stops for every supported threshold", () => {
    for (const t of [0, 0.001, 0.01, 0.3, 0.5, 0.7, 0.85, 1]) {
      const expr = weightFor(t);
      const stops = extractStops(expr);
      // If the expression isn't an interpolate (e.g. fallback for t<0.01)
      // there are no stops to check — that's allowed.
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i]).toBeGreaterThan(stops[i - 1]!);
      }
    }
  });

  it("never returns an expression with equal adjacent stops at threshold 0", () => {
    const expr = weightFor(0);
    const stops = extractStops(expr);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]).not.toBe(stops[i - 1]);
    }
  });
});
