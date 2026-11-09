import { expect, it } from "vitest";
import { bottomClearance } from "./useControlClearance";
const map = { left: 0, right: 390, top: 0, bottom: 700, height: 700 };
const control = { left: 16, right: 86, top: 640, bottom: 684, height: 44 };
it("reserves wrapped attribution and the mobile sheet only when they intersect the left edge", () => {
  expect(bottomClearance(map, control, [{ left: 30, right: 380, top: 630, bottom: 690, height: 60 }])).toBe(78);
  expect(bottomClearance(map, control, [{ left: 120, right: 380, top: 660, bottom: 690, height: 30 }])).toBe(16);
  expect(bottomClearance(map, control, [{ left: 0, right: 390, top: 266, bottom: 700, height: 434 }])).toBe(442);
  expect(bottomClearance(map, control, [{ left: 200, right: 390, top: 0, bottom: 700, height: 700 }])).toBe(16);
});
