import { AIR_BASE } from "./model";
import type { SoilReading, WorldCover } from "./types";
const pending = new Map<string, Promise<SoilReading>>();
export function sampleSoil(
  point: [number, number],
  world: WorldCover,
): Promise<SoilReading> {
  const key = JSON.stringify([point, world.sourceSha256]);
  const previous = pending.get(key);
  if (previous) return previous;
  const result = new Promise<SoilReading>((resolve) => {
    let done = false;
    const finish = (value: SoilReading) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      pending.delete(key);
      finish({ point, status: "error" });
    }, 8000);
    if (
      point[0] < world.bounds[0] ||
      point[0] > world.bounds[2] ||
      point[1] < world.bounds[1] ||
      point[1] > world.bounds[3]
    ) {
      finish({ point, status: "outside" });
      return;
    }
    const z = world.maxzoom,
      xf = ((point[0] + 180) / 360) * 2 ** z,
      yf =
        ((1 - Math.asinh(Math.tan((point[1] * Math.PI) / 180)) / Math.PI) / 2) *
        2 ** z,
      x = Math.floor(xf),
      y = Math.floor(yf),
      image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = world.tileSize;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw Error();
        ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(
            Math.max(
              0,
              Math.min(
                world.tileSize - 1,
                Math.floor((xf - x) * world.tileSize),
              ),
            ),
            Math.max(
              0,
              Math.min(
                world.tileSize - 1,
                Math.floor((yf - y) * world.tileSize),
              ),
            ),
            1,
            1,
          ).data,
          found = world.classes.find((c) =>
            [1, 3, 5].every(
              (j, i) => parseInt(c.color.slice(j, j + 2), 16) === rgba[i],
            ),
          );
        finish(
          rgba[3] && found
            ? { point, status: "ready", code: found.code, name: found.name }
            : { point, status: "missing" },
        );
      } catch {
        pending.delete(key);
        finish({ point, status: "error" });
      }
    };
    image.onerror = () => {
      pending.delete(key);
      finish({ point, status: "error" });
    };
    image.src = `${AIR_BASE}worldcover/${z}/${x}/${y}.png`;
  });
  pending.set(key, result);
  return result;
}
