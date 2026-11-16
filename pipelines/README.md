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

### Upper-band display (November 2026)

The model-v2 CLI now subdivides only the historical highest quintile into five
new grades. `--full-distribution` retains the historical whole-domain build.
The five new grades are calculated independently per layer on the same Float32
scores as the analytical grid. Fewer than five distinct grades is an error in
focus mode. `layers.*.focus` records the scheme, original cutoff, full domain
count and historical edges. The graded-cell count and shares refer to the focus
band, not the whole domain.

`space_analysis.py` preserves the original domain classes/scores in the complete
analytical binary using `focus.base_edges`; rendered network classes use the
new focus edges. The worker derives the display grades from those original
scores and reports `belowFocusM2` separately from missing coverage. Model metrics
and fitted scores are not recomputed by this display change.
