import type { AnalysisResult } from "./core";
let worker: Worker | null = null;
let sequence = 0;
const waiting = new Map<
  number,
  { resolve: (r: AnalysisResult) => void; reject: (e: Error) => void }
>();
export function analyseArea(
  polygon: GeoJSON.Polygon,
  context = false,
): Promise<AnalysisResult> {
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
