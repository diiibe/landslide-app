export type XY = [number, number];
/** WGS84 -> UTM 33N (Snyder transverse Mercator); coordinates are metres. */
export function utm33([lon, lat]: number[]): XY {
  const a = 6378137,
    e2 = 0.0066943799901413165,
    ep2 = e2 / (1 - e2),
    k = 0.9996;
  const p = (lat! * Math.PI) / 180,
    l = ((lon! - 15) * Math.PI) / 180;
  const s = Math.sin(p),
    c = Math.cos(p),
    t = Math.tan(p),
    n = a / Math.sqrt(1 - e2 * s * s);
  const T = t * t,
    C = ep2 * c * c,
    A = c * l;
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * p -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) *
        Math.sin(2 * p) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * p) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * p));
  return [
    500000 +
      k *
        n *
        (A +
          ((1 - T + C) * A ** 3) / 6 +
          ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120),
    k *
      (M +
        n *
          t *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720)),
  ];
}
export function ringArea(r: XY[]): number {
  let a = 0;
  const origin = r[0];
  if (!origin) return 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!,
      q = r[(i + 1) % r.length]!;
    a +=
      (p[0] - origin[0]) * (q[1] - origin[1]) -
      (q[0] - origin[0]) * (p[1] - origin[1]);
  }
  return Math.abs(a / 2);
}
export function polygonArea(rings: XY[][]): number {
  return Math.max(
    0,
    ringArea(rings[0] ?? []) -
      rings.slice(1).reduce((a, r) => a + ringArea(r), 0),
  );
}
export function bounds(r: XY[]): [number, number, number, number] {
  let x = Infinity,
    y = Infinity,
    X = -Infinity,
    Y = -Infinity;
  for (const p of r) {
    x = Math.min(x, p[0]);
    y = Math.min(y, p[1]);
    X = Math.max(X, p[0]);
    Y = Math.max(Y, p[1]);
  }
  return [x, y, X, Y];
}
export function inRing(p: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function inPolygon(p: XY, rings: XY[][]): boolean {
  return inRing(p, rings[0] ?? []) && !rings.slice(1).some((r) => inRing(p, r));
}
function clip(ring: XY[], axis: 0 | 1, value: number, sign: number): XY[] {
  const out: XY[] = [];
  if (!ring.length) return out;
  let a = ring[ring.length - 1]!;
  for (const b of ring) {
    const ai = (a[axis] - value) * sign >= 0,
      bi = (b[axis] - value) * sign >= 0;
    if (ai !== bi) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
    if (bi) out.push(b);
    a = b;
  }
  return out;
}
export function intersectionArea(
  rings: XY[][],
  box: [number, number, number, number],
): number {
  return Math.max(
    0,
    rings.reduce((sum, ring, i) => {
      let r = clip(ring, 0, box[0], 1);
      r = clip(r, 0, box[2], -1);
      r = clip(r, 1, box[1], 1);
      r = clip(r, 1, box[3], -1);
      return sum + (i === 0 ? 1 : -1) * ringArea(r);
    }, 0),
  );
}
/** Interior intervals of a straight segment; holes and concave polygons supported. */
export function lineIntervals(a: XY, b: XY, rings: XY[][]): [number, number][] {
  const ts = [0, 1],
    dx = b[0] - a[0],
    dy = b[1] - a[1];
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i]!,
        d = ring[(i + 1) % ring.length]!,
        ex = d[0] - c[0],
        ey = d[1] - c[1],
        den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-10) continue;
      const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den,
        u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
  ts.sort((x, y) => x - y);
  const out: [number, number][] = [];
  for (let i = 1; i < ts.length; i++) {
    const l = ts[i - 1]!,
      r = ts[i]!,
      t = (l + r) / 2;
    if (r - l > 1e-10 && inPolygon([a[0] + t * dx, a[1] + t * dy], rings))
      out.push([l, r]);
  }
  return out;
}
const EPS = 1e-12;
function orientation(a: number[], b: number[], c: number[]): number {
  return (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
}
function onSegment(a: number[], b: number[], p: number[]): boolean {
  return (
    Math.abs(orientation(a, b, p)) < EPS &&
    p[0]! >= Math.min(a[0]!, b[0]!) - EPS &&
    p[0]! <= Math.max(a[0]!, b[0]!) + EPS &&
    p[1]! >= Math.min(a[1]!, b[1]!) - EPS &&
    p[1]! <= Math.max(a[1]!, b[1]!) + EPS
  );
}
function intersects(
  a: number[],
  b: number[],
  c: number[],
  d: number[],
): boolean {
  const ab1 = orientation(a, b, c),
    ab2 = orientation(a, b, d),
    cd1 = orientation(c, d, a),
    cd2 = orientation(c, d, b);
  return (
    (ab1 * ab2 < 0 && cd1 * cd2 < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
export function validatePolygon(p: GeoJSON.Polygon): void {
  if (p.type !== "Polygon" || !p.coordinates.length)
    throw new Error("Seleziona un poligono valido.");
  if (p.coordinates.reduce((s, r) => s + r.length, 0) > 600)
    throw new Error("Contorno troppo complesso: usa al massimo 600 vertici.");
  const rings = p.coordinates;
  for (const ring of rings) {
    if (
      ring.length < 4 ||
      ring[0]![0] !== ring.at(-1)![0] ||
      ring[0]![1] !== ring.at(-1)![1] ||
      ring.some(
        (p) =>
          !Number.isFinite(p[0]) ||
          !Number.isFinite(p[1]) ||
          Math.abs(p[0]!) > 180 ||
          Math.abs(p[1]!) > 85,
      )
    )
      throw new Error("La zona contiene coordinate o contorni non validi.");
    const open = ring.slice(0, -1);
    if (new Set(open.map((p) => `${p[0]},${p[1]}`)).size !== open.length)
      throw new Error("Il contorno ripassa sullo stesso punto.");
    for (let i = 0; i < open.length; i++) {
      const a = open[(i + open.length - 1) % open.length]!,
        b = open[i]!,
        c = open[(i + 1) % open.length]!;
      if (
        Math.abs(orientation(a, b, c)) < EPS &&
        (b[0]! - a[0]!) * (c[0]! - b[0]!) + (b[1]! - a[1]!) * (c[1]! - b[1]!) <
          0
      )
        throw new Error("Il contorno contiene un tratto ripercorso.");
    }
    for (let i = 1; i < ring.length; i++)
      for (let j = i + 2; j < ring.length; j++) {
        if (i === 1 && j === ring.length - 1) continue;
        if (intersects(ring[i - 1]!, ring[i]!, ring[j - 1]!, ring[j]!))
          throw new Error("Il contorno si incrocia o si sovrappone.");
      }
  }
  for (let h = 1; h < rings.length; h++) {
    const hole = rings[h]!;
    if (!inRing(hole[0]! as XY, rings[0]! as XY[]))
      throw new Error("Un foro si trova fuori dalla zona.");
    for (let k = 0; k < h; k++) {
      const other = rings[k]!;
      for (let i = 1; i < hole.length; i++)
        for (let j = 1; j < other.length; j++)
          if (intersects(hole[i - 1]!, hole[i]!, other[j - 1]!, other[j]!))
            throw new Error(
              "I contorni interni si toccano o si sovrappongono.",
            );
      if (
        k > 0 &&
        (inRing(hole[0]! as XY, other as XY[]) ||
          inRing(other[0]! as XY, hole as XY[]))
      )
        throw new Error("I fori della zona si sovrappongono.");
    }
  }
}
