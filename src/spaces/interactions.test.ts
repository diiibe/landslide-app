import { expect, it } from "vitest";
import type { MapMouseEvent } from "maplibre-gl";
import { consumeProbeClick, isProbeClick } from "./interactions";
import { useExperienceStore } from "./store";
it("consumes the complete click across delegated wrappers after probe mode exits", () => {
  const originalEvent = new MouseEvent("click"),
    first = { originalEvent } as MapMouseEvent,
    delegated = { originalEvent } as MapMouseEvent;
  useExperienceStore.setState({ probe: true });
  consumeProbeClick(first);
  useExperienceStore.setState({ probe: false });
  expect(isProbeClick(delegated)).toBe(true);
  expect(
    isProbeClick({ originalEvent: new MouseEvent("click") } as MapMouseEvent),
  ).toBe(false);
});
