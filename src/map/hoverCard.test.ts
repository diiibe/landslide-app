import { expect, it } from "vitest";
import { createHoverCard, rampColor } from "./hoverCard";
import { sensorTone, VARIABLES } from "@/digital-twin/data";
import { metricTone, metricColor } from "@/regional/mapStyle";
import type { LayerDefinition } from "@/regional/types";
import { createExpression } from "@maplibre/maplibre-gl-style-spec";
it("uses the actual point ramp and stale colour without changing displayed data", () => {
  const v = VARIABLES.temperature;
  expect(sensorTone(v.min, "temperature")).toBe(v.colors[0]);
  expect(sensorTone(v.max, "temperature")).toBe(v.colors[2]);
  expect(sensorTone(20, "temperature", true)).toBe("#888888");
  expect(
    rampColor(
      [
        [0, "#000000"],
        [10, "#ffffff"],
      ],
      5,
    ),
  ).toBe("rgb(128, 128, 128)");
});
it("matches rendered regional metric colours, including neutral zero and QC exclusions", () => {
  const l = {
    id: "sample",
    kind: "geojson",
    folder: "aria",
    title: "Misura",
    color: "#654321",
    metric: { field: "__value", unit: "x", min: -10, max: 30 },
  } as LayerDefinition;
  const expression = createExpression(metricColor(l), {
    type: "color",
    default: "#000000",
    "property-type": "data-driven",
    transition: false,
    overridable: false,
  });
  expect(expression.result).toBe("success");
  if (expression.result !== "success") return;
  for (const value of [-10, 0, 10, 30]) {
    const color = expression.value.evaluate(
      { zoom: 10 },
      { type: 1, properties: { __value: value } },
    );
    const hex = (x: number) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, "0");
    const expected = `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
    const node = createHoverCard("x", "", metricTone(l, { __value: value }));
    document.body.append(node);
    const helperColor = node.style.getPropertyValue("--reading-color");
    const test = document.createElement("div");
    test.style.color = expected;
    const same = document.createElement("div");
    same.style.color = helperColor;
    expect(test.style.color).toBe(same.style.color);
    node.remove();
  }
  expect(metricTone(l, { __value: 1, __censored: true })).toBe("#8c938b");
  expect(metricTone(l, { __value: 1, qualita_qc: 4 })).toBe("#8c938b");
});
it("keeps source text inert inside the rounded colour card", () => {
  const node = createHoverCard(
    "<img src=x onerror=alert(1)>",
    "<script>bad</script>",
    "#dda13b",
  );
  expect(node.querySelector("img")).toBeNull();
  expect(node.textContent).toContain("<script>");
  expect(node.style.getPropertyValue("--reading-color")).toBe("#dda13b");
});
