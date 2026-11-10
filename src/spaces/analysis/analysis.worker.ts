import {
  analyse,
  analyseNetwork,
  decodeGrid,
  projectPolygon,
  type AnalysisResult,
  type Grid,
} from "./core";
import { inPolygon, utm33 } from "./geometry";
type FileEntry = { file: string; sha: string; rawSha: string };
interface Manifest {
  version: number;
  modelGrid: FileEntry;
  modelHash: string;
  networks: Record<"roads" | "trails", FileEntry>;
  modelSource: string;
}
const base = import.meta.env.BASE_URL;
const worker = globalThis as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (v: unknown) => void;
};
let gridPromise: Promise<{ grid: Grid; manifest: Manifest }> | null = null;
const networks = new Map<string, Promise<ArrayBuffer>>();
let pois: Promise<GeoJSON.FeatureCollection> | null = null;
async function response(url: string) {
  const metadata = url.endsWith("/manifest.json") || url.endsWith("/model_v2.json");
  const r = await fetch(url, metadata ? { cache: "no-cache" } : undefined);
  if (!r.ok) throw new Error(`Dati non disponibili (${r.status}). Riprova.`);
  return r;
}
async function hash(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (n) => n.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 16);
}
async function binary(file: FileEntry) {
  const bytes = await (
    await response(`${base}data/spaces/${file.file}?v=${file.sha}`)
  ).arrayBuffer();
  const actual = await hash(bytes);
  if (actual === file.rawSha) return bytes;
  if (actual !== file.sha)
    throw new Error("Versione dei dati non allineata. Ricarica e riprova.");
  if (typeof DecompressionStream === "undefined")
    throw new Error("L’analisi richiede una versione aggiornata del browser.");
  const decoded = await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
  if ((await hash(decoded)) !== file.rawSha)
    throw new Error("Indice analitico incompleto. Riprova.");
  return decoded;
}
async function gridData() {
  if (!gridPromise)
    gridPromise = (async () => {
      const [mr, model] = await Promise.all([
        response(`${base}data/spaces/manifest.json`),
        response(`${base}data/model_v2.json`),
      ]);
      const manifest = (await mr.json()) as Manifest;
      if (
        manifest.version !== 1 ||
        (await hash(await model.arrayBuffer())) !== manifest.modelHash
      )
        throw new Error(
          "L’indice analitico non corrisponde alla mappatura corrente.",
        );
      return { grid: decodeGrid(await binary(manifest.modelGrid)), manifest };
    })().catch((e) => {
      gridPromise = null;
      throw e;
    });
  return gridPromise;
}
async function network(name: "roads" | "trails", m: Manifest) {
  if (!networks.has(name))
    networks.set(
      name,
      binary(m.networks[name]).catch((e) => {
        networks.delete(name);
        throw e;
      }),
    );
  return networks.get(name)!;
}
worker.onmessage = async (
  e: MessageEvent<{ id: number; polygon: GeoJSON.Polygon; context: boolean }>,
) => {
  const { id, polygon, context } = e.data;
  try {
    const { grid, manifest } = await gridData();
    const result: AnalysisResult = analyse(polygon, grid);
    result.version = manifest.modelGrid.sha;
    result.method =
      "Griglia originale 120 m · intersezione delle celle in UTM 33N · pesi sulla superficie";
    if (context) {
      const [roads, trails, points] = await Promise.all([
        network("roads", manifest),
        network("trails", manifest),
        pois ??
          (pois = response(`${base}data/poi_fvg.geojson`)
            .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
            .catch((e) => {
              pois = null;
              throw e;
            })),
      ]);
      result.networks = {
        roads: analyseNetwork(roads, polygon, grid),
        trails: analyseNetwork(trails, polygon, grid),
      };
      const rings = projectPolygon(polygon, grid);
      result.poi = points.features.flatMap((f) => {
        if (f.geometry.type !== "Point") return [];
        const p = utm33(f.geometry.coordinates);
        if (!inPolygon([p[0] - grid.x0, p[1] - grid.y0], rings)) return [];
        return [
          {
            name: String(f.properties?.name || "Punto di contesto"),
            category: String(f.properties?.category || "altro"),
            coordinates: f.geometry.coordinates,
          },
        ];
      });
    }
    worker.postMessage({ id, result });
  } catch (error) {
    worker.postMessage({
      id,
      error:
        error instanceof Error
          ? error.message
          : "Non è stato possibile completare l’analisi.",
    });
  }
};
