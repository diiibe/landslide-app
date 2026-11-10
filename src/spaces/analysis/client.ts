import type { AnalysisResult } from "./core";
let worker: Worker | null = null;
let sequence = 0;
let checkedVersion: Promise<void> | null = null, workerVersion = "", versionEpoch = 0;
/** Space entry invalidates only the lightweight version check. Unchanged
 * analytical binaries stay in the worker instead of being downloaded again. */
export function invalidateAnalysisVersion() { versionEpoch++; checkedVersion = null; }
async function ensureVersion(): Promise<void> {
  if (checkedVersion) return checkedVersion;
  const epoch = versionEpoch;
  const pending = (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/spaces/manifest.json`, { cache: "no-cache", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Non è stato possibile verificare la versione dell’indice. Riprova.");
    const m = await response.json() as { modelGrid?: { sha?: string }; modelHash?: string; networks?: { roads?: { sha?: string }; trails?: { sha?: string } } };
    if (!m.modelGrid?.sha || !m.modelHash || !m.networks?.roads?.sha || !m.networks?.trails?.sha) throw new Error("Manifest dell’analisi non valido.");
    if (epoch !== versionEpoch) return ensureVersion();
    const version = [m.modelHash,m.modelGrid.sha,m.networks.roads.sha,m.networks.trails.sha].join(":");
    if (workerVersion && workerVersion !== version) {
      worker?.terminate(); worker = null;
      waiting.forEach(p => p.reject(new Error("È disponibile un nuovo indice. Ricalcola l’analisi.")));
      waiting.clear();
    }
    workerVersion = version;
  })();
  checkedVersion = pending;
  try { return await pending; } catch(error) { if (checkedVersion === pending) checkedVersion = null; throw error; }
}
const waiting = new Map<
  number,
  { resolve: (r: AnalysisResult) => void; reject: (e: Error) => void }
>();
export async function analyseArea(
  polygon: GeoJSON.Polygon,
  context = false,
): Promise<AnalysisResult> {
  await ensureVersion();
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Analisi non disponibile in questo browser."));
      return;
    }
    if (!worker) {
      worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (
        e: MessageEvent<{
          id: number;
          result?: AnalysisResult;
          error?: string;
        }>,
      ) => {
        const p = waiting.get(e.data.id);
        if (!p) return;
        waiting.delete(e.data.id);
        if (e.data.error) p.reject(new Error(e.data.error));
        else if (e.data.result) p.resolve(e.data.result);
      };
      worker.onerror = () => {
        waiting.forEach((p) =>
          p.reject(
            new Error("Il motore di analisi è stato interrotto. Riprova."),
          ),
        );
        waiting.clear();
        worker?.terminate();
        worker = null;
      };
    }
    const id = ++sequence;
    waiting.set(id, { resolve, reject });
    worker.postMessage({ id, polygon, context });
  });
}
