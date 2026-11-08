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
seed_spread` on the HazardFVG 120 m grid, EPSG:32633) and writes, per
layer:

- `public/tiles/v2_<layer>_raster.pmtiles` — z6-9, palette PNG tiles
  rendered from the class grid (nearest cell per pixel, app ramp colours,
  transparent outside the domain);
- `public/tiles/v2_<layer>.pmtiles` — z10-14, vector cells (layer
  `cells`: `score`, `source`, `cls`, `ncls`), coalesced only within one
  (class, source) group, then `tile-join`ed (`tile-join` ships with
  tippecanoe);

plus `public/data/model_v2.json`: per-layer quantile class edges and the
real share of cells per class (5 classes requested; tied quantiles
collapse, fewer than 3 distinct classes is an error), the zoom split, and
the owner's metrics copied from `pipelines/model_v2_metrics.json` (edit
that file, not the output). GeoJSON intermediates go to a temporary
directory. The two layers are built and classed separately and never
merged.
