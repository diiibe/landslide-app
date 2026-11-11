/** Shared DOM tooltip: untrusted labels are always text, never HTML. */
export function createHoverCard(
  title: string,
  detail: string,
  color = "#83b990",
) {
  const node = document.createElement("div");
  node.className = "fvg-hover-card";
  node.dataset.ui = "sensor";
  node.setAttribute("role", "tooltip");
  const safe =
    /^#[\da-f]{3}([\da-f]{3})?$/i.test(color) ||
    /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(color)
      ? color
      : "#83b990";
  node.style.setProperty("--reading-color", safe);
  const heading = document.createElement("strong"),
    text = document.createElement("div");
  heading.textContent = title;
  text.textContent = detail;
  node.append(heading, text);
  return node;
}
export type ColorStop = readonly [number, string];
/** Same sRGB linear interpolation used by the map's unpremultiplied opaque ramps. */
export function rampColor(stops: readonly ColorStop[], value: number) {
  if (!Number.isFinite(value) || !stops.length) return "#8c938b";
  if (value <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!,
      b = stops[i]!;
    if (value === b[0]) return b[1];
    if (value < b[0]) {
      const t = (value - a[0]) / (b[0] - a[0]);
      const rgb = (c: string) =>
        [1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16));
      const left = rgb(a[1]),
        right = rgb(b[1]);
      return `rgb(${left.map((x, j) => Math.round(x + (right[j]! - x) * t)).join(", ")})`;
    }
  }
  return stops[stops.length - 1]![1];
}
