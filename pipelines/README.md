# pipelines

Offline preprocessing: `.gpkg` + `.parquet` → `.pmtiles`.

## Prereqs
- Python 3.10+
- `pip install -e '.[dev]'`
- `tippecanoe` installed (`brew install tippecanoe` on macOS)

## Run

```
make tiles
```

Outputs to `public/tiles/{j2,j3,iffi}.pmtiles`.

## Model v2 (HazardFVG)

```
make tiles-v2            # V2_MAP_DIR defaults to ../HazardFVG/data/processed/model/map
```

Reads `bodies.parquet` and `diffuse.parquet` (`i, j, score, source,
seed_spread` on the HazardFVG 120 m grid, EPSG:32633) and writes
`public/tiles/v2_{bodies,diffuse}.pmtiles` (layer `cells`, attributes
`score`, `source`, `cls`, `ncls`) plus `public/data/model_v2.json` with
the per-layer quantile class edges and the real share of cells per class
(5 classes requested; tied quantiles collapse, fewer than 3 distinct
classes is an error). Low zooms coalesce cells instead of dropping them,
one tippecanoe run per (class, source) so classes never mix, then
`tile-join` (needs `tile-join`, shipped with tippecanoe). GeoJSON
intermediates go to a temporary directory. The two layers are built and
classed separately and never merged. `metrics` stays empty until the
model owner fills it in.
