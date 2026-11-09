import {
  bounds,
  intersectionArea,
  lineIntervals,
  polygonArea,
  utm33,
  validatePolygon,
  type XY,
} from "./geometry";
export interface Grid {
  width: number;
  height: number;
  x0: number;
  y0: number;
  cell: number;
  classes: [Uint8Array, Uint8Array];
  scores: [Float32Array, Float32Array];
}
export interface LayerAnalysis {
  coveredM2: number;
  cells: number;
  classes: number[];
  mean: number | null;
  median: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
}
export interface NetworkAnalysis {
  totalKm: number;
  bodiesKm: number[];
  diffuseKm: number[];
  segments: number;
}
export interface AnalysisResult {
  areaM2: number;
  layers: { bodies: LayerAnalysis; diffuse: LayerAnalysis };
  networks?: { roads: NetworkAnalysis; trails: NetworkAnalysis };
  poi?: { name: string; category: string; coordinates: number[] }[];
  version?: string;
  method?: string;
}
export function decodeGrid(buffer: ArrayBuffer): Grid {
  const d = new DataView(buffer),
    magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 7));
  if (magic !== "FVGRID1")
    throw new Error("Indice della mappatura non valido.");
  const width = d.getUint32(8, true),
    height = d.getUint32(12, true),
    n = width * height;
  if (width < 1 || height < 1 || n > 3e6 || buffer.byteLength !== 40 + n * 10)
    throw new Error("Indice della mappatura incompleto.");
  return {
    width,
    height,
    x0: d.getFloat64(16, true),
    y0: d.getFloat64(24, true),
    cell: d.getFloat64(32, true),
    classes: [new Uint8Array(buffer, 40, n), new Uint8Array(buffer, 40 + n, n)],
    scores: [
      new Float32Array(buffer, 40 + 2 * n, n),
      new Float32Array(buffer, 40 + 6 * n, n),
    ],
  };
}
export function projectPolygon(polygon: GeoJSON.Polygon, g: Grid): XY[][] {
  validatePolygon(polygon);
  return polygon.coordinates.map((r) =>
    r.slice(0, -1).map((p) => {
      const q = utm33(p);
      return [q[0] - g.x0, q[1] - g.y0] as XY;
    }),
  );
}
export function sampleClass(g: Grid, p: XY, layer: 0 | 1): number {
  const c = Math.floor(p[0] / g.cell),
    r = Math.floor(-p[1] / g.cell);
  return c < 0 || r < 0 || c >= g.width || r >= g.height
    ? 0
    : g.classes[layer][r * g.width + c]!;
}
export function analyse(polygon: GeoJSON.Polygon, g: Grid): AnalysisResult {
  const rings = projectPolygon(polygon, g),
    box = bounds(rings[0]!),
    areaM2 = polygonArea(rings);
  if (areaM2 < 1)
    throw new Error("La zona deve avere una superficie di almeno 1 m².");
  const x0 = Math.max(0, Math.floor(box[0] / g.cell)),
    x1 = Math.min(g.width - 1, Math.floor(box[2] / g.cell)),
    y0 = Math.max(0, Math.floor(-box[3] / g.cell)),
    y1 = Math.min(g.height - 1, Math.floor(-box[1] / g.cell));
  if (
    Math.max(0, x1 - x0 + 1) *
      Math.max(0, y1 - y0 + 1) *
      rings.reduce((s, r) => s + r.length, 0) >
    45e6
  )
    throw new Error(
      "Zona troppo estesa e complessa: analizza aree più piccole.",
    );
  const sums = [0, 0],
    rows: [number, number][][] = [[], []];
  const layers: LayerAnalysis[] = [0, 1].map(() => ({
    coveredM2: 0,
    cells: 0,
    classes: [0, 0, 0, 0, 0],
    mean: null,
    median: null,
    p90: null,
    min: null,
    max: null,
  }));
  for (let r = y0; r <= y1; r++)
    for (let c = x0; c <= x1; c++) {
      const idx = r * g.width + c;
      if (!g.classes[0][idx] && !g.classes[1][idx]) continue;
      const x = c * g.cell,
        y = -r * g.cell,
        a = intersectionArea(rings, [x, y - g.cell, x + g.cell, y]);
      if (a < 0.001) continue;
      for (const l of [0, 1] as const) {
        const cls = g.classes[l][idx]!,
          score = g.scores[l][idx]!;
        if (cls < 1 || cls > 5 || !Number.isFinite(score)) continue;
        const v = layers[l]!;
        v.coveredM2 += a;
        v.cells++;
        v.classes[cls - 1]! += a;
        sums[l]! += a * score;
        rows[l]!.push([score, a]);
      }
    }
  layers.forEach((l, i) => {
    if (!l.coveredM2) return;
    l.mean = sums[i]! / l.coveredM2;
    const sorted = rows[i]!.sort((a, b) => a[0] - b[0]);
    l.min = sorted[0]![0];
    l.max = sorted.at(-1)![0];
    let area = 0;
    for (const [score, a] of sorted) {
      area += a;
      if (l.median === null && area >= l.coveredM2 * 0.5) l.median = score;
      if (l.p90 === null && area >= l.coveredM2 * 0.9) l.p90 = score;
    }
  });
  return { areaM2, layers: { bodies: layers[0]!, diffuse: layers[1]! } };
}
export function analyseNetwork(
  buffer: ArrayBuffer,
  polygon: GeoJSON.Polygon,
  g: Grid,
): NetworkAnalysis {
  const d = new DataView(buffer);
  if (new TextDecoder().decode(new Uint8Array(buffer, 0, 6)) !== "FVNET1")
    throw new Error("Indice delle reti non valido.");
  const n = d.getUint32(8, true),
    ox = d.getFloat64(12, true) - g.x0,
    oy = d.getFloat64(20, true) - g.y0;
  if (buffer.byteLength !== 32 + n * 16 || d.getUint32(28, true) !== 16)
    throw new Error("Indice delle reti incompleto.");
  const coords = new Int32Array(buffer, 32),
    rings = projectPolygon(polygon, g),
    box = bounds(rings[0]!),
    result: NetworkAnalysis = {
      totalKm: 0,
      bodiesKm: [0, 0, 0, 0, 0, 0],
      diffuseKm: [0, 0, 0, 0, 0, 0],
      segments: 0,
    };
  for (let k = 0; k < n; k++) {
    const a: XY = [coords[k * 4]! / 100 + ox, coords[k * 4 + 1]! / 100 + oy],
      b: XY = [coords[k * 4 + 2]! / 100 + ox, coords[k * 4 + 3]! / 100 + oy];
    if (
      Math.max(a[0], b[0]) < box[0] ||
      Math.min(a[0], b[0]) > box[2] ||
      Math.max(a[1], b[1]) < box[1] ||
      Math.min(a[1], b[1]) > box[3]
    )
      continue;
    const intervals = lineIntervals(a, b, rings);
    if (intervals.length) result.segments++;
    for (const [l, r] of intervals) {
      const len = (Math.hypot(b[0] - a[0], b[1] - a[1]) * (r - l)) / 1000,
        t = (l + r) / 2,
        p: XY = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      result.totalKm += len;
      result.bodiesKm[sampleClass(g, p, 0)]! += len;
      result.diffuseKm[sampleClass(g, p, 1)]! += len;
    }
  }
  return result;
}
