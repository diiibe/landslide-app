/**
 * Zod schemas for runtime validation at fetch boundaries.
 *
 * Static JSON assets shipped under `public/data/` are still untrusted from
 * the app's point of view — they can drift out of sync with the build
 * scripts during local development or after a partial deploy. Validating
 * the parsed payload at the boundary turns a confusing downstream crash
 * (e.g. `Cannot read 'features' of undefined`) into a single, actionable
 * error at the loader.
 *
 * Sprint 6 added schemas for cell grid + comuni. Sprint 8 extends the
 * coverage to the remaining network/POI loaders (roads, trails, POI).
 */
import { z } from "zod";

/**
 * Cell-grid JSON — produced by `scripts/build-cell-grid.mjs`.
 *
 * Shape:
 *   { "step": 0.002, "data": [gx, gy, p, gx, gy, p, ...] }
 *
 * `data` is a flat triplet array (length must be a multiple of 3). We
 * validate the multiple-of-3 invariant here rather than at use time
 * because the consumer iterates by 3 and would otherwise silently drop
 * any trailing fragment.
 */
export const CellGridFileSchema = z.object({
  step: z.number().positive(),
  data: z
    .array(z.number())
    .refine((d) => d.length % 3 === 0, {
      message: "data length must be a multiple of 3 (triplets of gx, gy, p)",
    }),
});

export type CellGridFile = z.infer<typeof CellGridFileSchema>;

/**
 * Comuni FeatureCollection — produced by `scripts/build-comuni.mjs`.
 *
 * We keep `properties` open via `passthrough()` since the feature carries
 * a variable bag (name, istat, risk_j2, risk_j3, cells_j2, cells_j3, …)
 * that may evolve. The fields we depend on are validated explicitly.
 *
 * `geometry` is left as `unknown`: validating MultiPolygon/Polygon shapes
 * here would be a lot of code for little safety — MapLibre's own GeoJSON
 * source parser will reject malformed geometries with a clear error.
 */
export const ComuneFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.unknown(),
  properties: z
    .object({
      name: z.string().optional(),
      istat: z.string().optional(),
      risk_j2: z.number().optional(),
      risk_j3: z.number().optional(),
    })
    .passthrough(),
});

export const ComuneFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(ComuneFeatureSchema),
});

export type ComuneFeatureCollection = z.infer<typeof ComuneFeatureCollectionSchema>;

/**
 * Roads FeatureCollection — produced by `scripts/build-roads.mjs`.
 *
 * Each feature is a LineString / MultiLineString trimmed to FVG. The build
 * script writes empty `properties` and `risk` is baked in at runtime by
 * `bakeRiskIntoFeatures` (see `cellGrid.ts`). Older payloads may carry an
 * OSM `class` (highway tag) — we accept it but don't require it.
 *
 * `passthrough()` on properties lets any future per-feature metadata
 * survive validation without a schema update; only the structural shape
 * is enforced here.
 */
export const RoadsFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.unknown(),
  properties: z
    .object({
      class: z.string().optional(),
      risk: z.number().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
});

export const RoadsFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(RoadsFeatureSchema),
});

export type RoadsFeatureCollection = z.infer<typeof RoadsFeatureCollectionSchema>;

/**
 * Trails FeatureCollection — produced by `scripts/build-roads.mjs` (same
 * builder, different highway classes). Shape mirrors roads; OSM `sac_scale`
 * and `trail_visibility` may appear in properties but are not required.
 */
export const TrailsFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.unknown(),
  properties: z
    .object({
      class: z.string().optional(),
      sac_scale: z.string().optional(),
      trail_visibility: z.string().optional(),
      risk: z.number().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
});

export const TrailsFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(TrailsFeatureSchema),
});

export type TrailsFeatureCollection = z.infer<typeof TrailsFeatureCollectionSchema>;

/**
 * Critical POI FeatureCollection — produced by `scripts/build-poi.mjs`.
 *
 * Each feature is a Point with classification metadata (`category`,
 * `group`, `importance`) and per-model risk (`risk_j2`, `risk_j3`) baked
 * at build time. The renderer (`criticalPoi.ts`) reads:
 *
 *   - `group` to filter into the critical/huts layer
 *   - `category` to resolve the icon image
 *   - `importance` for the size interpolation
 *   - `risk_j2` / `risk_j3` for the per-model tint
 *
 * `name` is optional (some OSM entries lack one) and isn't load-bearing.
 */
export const CriticalPoiFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.unknown(),
  properties: z
    .object({
      name: z.string().optional(),
      category: z.string(),
      group: z.string(),
      importance: z.number().optional(),
      risk_j2: z.number().optional(),
      risk_j3: z.number().optional(),
    })
    .passthrough(),
});

export const CriticalPoiFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(CriticalPoiFeatureSchema),
});

export type CriticalPoiFeatureCollection = z.infer<typeof CriticalPoiFeatureCollectionSchema>;

/**
 * Model v2 summary — produced by `pipelines/model_v2.py`.
 *
 * One entry per layer (bodies, diffuse). Each layer has its own quantile
 * classes: `classes` is how many survived after tied quantiles collapsed
 * (at least 3), `edges` has `classes + 1` values (min, inner breaks, max)
 * and `shares` the real fraction of cells in each class. The class of a
 * cell is baked into the tiles as `cls` (with `ncls`); the legend reads
 * the shares from here. `metrics` is a free label → value map filled in
 * by the model owner; it is empty until then and is never compared with
 * J.x.
 */
const V2LayerStatsSchema = z
  .object({
    n_cells: z.number().int().nonnegative(),
    classes: z.number().int().min(3, { message: "classes must be at least 3" }),
    edges: z
      .array(z.number())
      .refine((e) => e.every((v, i) => i === 0 || v > e[i - 1]!), {
        message: "edges must be strictly increasing",
      }),
    shares: z.array(z.number().min(0).max(1)),
    sources: z.object({
      oof: z.number().int().nonnegative(),
      holdout: z.number().int().nonnegative(),
      in_sample: z.number().int().nonnegative(),
    }),
    metrics: z.record(z.string(), z.number()),
  })
  .superRefine((l, ctx) => {
    if (l.edges.length !== l.classes + 1) {
      ctx.addIssue({
        code: "custom",
        path: ["edges"],
        message: `edges must have classes + 1 = ${l.classes + 1} values`,
      });
    }
    if (l.shares.length !== l.classes) {
      ctx.addIssue({ code: "custom", path: ["shares"], message: "one share per class" });
    }
    const total = l.shares.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["shares"], message: "shares must sum to 1" });
    }
  });

export const ModelV2FileSchema = z.object({
  model: z.literal("v2"),
  grid: z
    .object({
      crs: z.string(),
      x0: z.number(),
      y0: z.number(),
      cell: z.number().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  requested_classes: z.number().int().positive(),
  layers: z.object({
    bodies: V2LayerStatsSchema,
    diffuse: V2LayerStatsSchema,
  }),
});

export type ModelV2File = z.infer<typeof ModelV2FileSchema>;

/**
 * Helper: parse with a schema and throw a descriptive error on failure.
 * The thrown message names the source (so the boundary point is obvious
 * in browser DevTools) and lists every zod issue path so a malformed
 * field is spotted at a glance.
 */
export function parseOrThrow<T>(
  schema: {
    safeParse: (data: unknown) =>
      | { success: true; data: T }
      | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> } };
  },
  data: unknown,
  source: string,
): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const summary = r.error.issues
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");
  throw new Error(`${source} failed validation: ${summary}`);
}
