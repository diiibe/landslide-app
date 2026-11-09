"""Build PMTiles + class breaks for the v2 landslide model from HazardFVG.

Usage (or `make tiles-v2`):
    python -m pipelines.model_v2 --map-dir ../HazardFVG/data/processed/model/map
        --tiles-dir public/tiles --data-dir public/data

Input: one parquet per layer (`bodies.parquet`, `diffuse.parquet`) with
columns `i, j, score, source, seed_spread` and, in the full-fit export, a
boolean `holdout` (cells of the evaluation squares; validated, not drawn).
`source` is `full_fit` for one model fitted on every domain cell; the
earlier export used `oof` / `holdout` / `in_sample`. `i, j` index the HazardFVG
120 m grid in EPSG:32633 (`scripts/build/feature_grid.py`, `GRID`): row
`i` counts down from `y0`, column `j` counts right from `x0`.

Pipeline, per layer:
    1. Validate the parquet (columns, source values, cells inside the grid,
       no duplicate cell).
    2. Class edges: score quantiles over every cell of the layer, 5 classes
       requested. Tied quantiles collapse (edges stay strictly increasing,
       empty classes merge into a neighbour) and the real share of cells in
       each class is recorded; fewer than 3 distinct classes is an error.
    3. Cell polygons from (i, j), reprojected to EPSG:4326, with `score`,
       `source`, `cls` and `ncls` (the layer's class count).
    4. Vector tiles for z10-14 (`v2_<layer>.pmtiles`): one tippecanoe run
       per (cls, source) group with --coalesce-densest-as-needed, then
       tile-join. Coalescing therefore only ever merges cells of the same
       class and source (tippecanoe keeps one feature's attributes when it
       coalesces; a single run moved 5-7 % of the area into the wrong
       class at z7-8). `score` of a coalesced feature is the mean of the
       merged cells. GeoJSON intermediates live in a temporary directory.
    5. Raster tiles for z6-9 (`v2_<layer>_raster.pmtiles`, see
       pipelines/raster_tiles.py): at those zooms the real vector tiles
       reached 0.6-0.9 MB, so the class grid is rendered to palette PNGs
       (nearest cell per pixel, same colours) instead. The map switches
       from raster to vector at z10.
Then `model_v2.json` collects the per-layer edges, shares and source
counts, plus the owner's metrics copied from the committed
`pipelines/model_v2_metrics.json` (groups of label/value rows per layer,
and notes). Nothing is computed here: missing file = empty metrics.

The two layers are never merged: each gets its own tiles and its own edges.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import asdict
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from pipelines.build_tiles import _check_tippecanoe_available
from pipelines.grid import GRID
from pipelines.raster_tiles import class_grid, write_class_pmtiles

LAYERS = ("bodies", "diffuse")
# Zoom split, mirrored by V2_VECTOR_MIN_ZOOM in src/map/layers/modelV2.ts.
RASTER_ZOOMS = (6, 9)
VECTOR_ZOOMS = (10, 14)
METRICS_PATH = Path(__file__).with_name("model_v2_metrics.json")
SOURCES = ("full_fit", "oof", "holdout", "in_sample")
COLUMNS = ("i", "j", "score", "source", "seed_spread")
N_CLASSES = 5
MIN_CLASSES = 3
# Starting per-part tile byte limit for the (cls, source) tippecanoe runs.
# The parts are joined without a limit, so a joined tile can reach roughly
# the sum of its parts; 100 kB keeps the densest synthetic low-zoom tile
# under ~1 MB. When a part cannot be coalesced that far (tippecanoe exits
# with TIPPECANOE_TOO_DENSE) the limit doubles, up to tippecanoe's default.
PART_TILE_BYTES = 100_000
TIPPECANOE_DEFAULT_BYTES = 500_000
TIPPECANOE_TOO_DENSE = 100

Runner = Callable[..., object]


def load_layer(path: str | Path) -> pd.DataFrame:
    """Read one layer parquet and fail loudly on anything the map can't show."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"{path} not found")
    df = pd.read_parquet(path)
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name}: missing columns {missing}")
    unknown = sorted(set(df["source"].astype(str)) - set(SOURCES))
    if unknown:
        raise ValueError(f"{path.name}: unknown source values {unknown}")
    outside = (df["i"] < 0) | (df["i"] >= GRID.height) | (df["j"] < 0) | (df["j"] >= GRID.width)
    if outside.any():
        raise ValueError(f"{path.name}: {int(outside.sum())} cells outside the grid")
    if df.duplicated(["i", "j"]).any():
        raise ValueError(f"{path.name}: duplicate (i, j) cells")
    if df["score"].isna().any():
        raise ValueError(f"{path.name}: NaN scores")
    if "holdout" in df.columns and not pd.api.types.is_bool_dtype(df["holdout"]):
        raise ValueError(f"{path.name}: holdout must be a boolean column")
    return df.reset_index(drop=True)


def assign_classes(scores: np.ndarray, edges: list[float]) -> np.ndarray:
    """Class 1..n per score. A score equal to an inner edge goes to the upper
    class; the maximum stays in the top class."""
    inner = np.asarray(edges[1:-1], dtype="float64")
    return (np.searchsorted(inner, np.asarray(scores), side="right") + 1).astype("int8")


def _class_counts(scores: np.ndarray, edges: list[float]) -> np.ndarray:
    return np.bincount(assign_classes(scores, edges), minlength=len(edges))[1:]


def class_edges(
    scores: np.ndarray, n_classes: int = N_CLASSES, min_classes: int = MIN_CLASSES
) -> list[float]:
    """Quantile edges (min, inner breaks, max) on the distinct quantile values.

    Tied scores make quantiles coincide; those collapse, and a class left
    empty is merged into its upper neighbour (the top class into the one
    below). Raises when fewer than `min_classes` distinct classes remain.
    """
    scores = np.asarray(scores, dtype="float64")
    edges = [float(e) for e in np.unique(np.quantile(scores, np.linspace(0, 1, n_classes + 1)))]
    while len(edges) > 2:
        empty = np.flatnonzero(_class_counts(scores, edges) == 0)
        if empty.size == 0:
            break
        k = int(empty[0])
        del edges[k + 1 if k + 1 < len(edges) - 1 else k]
    n = len(edges) - 1
    if n < min_classes:
        raise ValueError(
            f"only {n} distinct classes left after collapsing tied quantiles "
            f"(need at least {min_classes})"
        )
    return edges


def class_shares(scores: np.ndarray, edges: list[float]) -> list[float]:
    """Share of cells in each class, in class order."""
    counts = _class_counts(np.asarray(scores), edges)
    return [round(float(c) / counts.sum(), 4) for c in counts]


def cells_to_geodataframe(
    df: pd.DataFrame, edges: list[float], crs: str = "EPSG:4326"
) -> gpd.GeoDataFrame:
    """One square polygon per (i, j) cell, with `score`, `source`, `cls`, `ncls`."""
    i = df["i"].to_numpy(dtype="float64")
    j = df["j"].to_numpy(dtype="float64")
    xmin = GRID.x0 + j * GRID.cell
    ymax = GRID.y0 - i * GRID.cell
    boxes = shapely.box(xmin, ymax - GRID.cell, xmin + GRID.cell, ymax)
    gdf = gpd.GeoDataFrame(
        {
            "score": df["score"].astype("float32").round(4).to_numpy(),
            "source": df["source"].astype(str).to_numpy(),
            "cls": assign_classes(df["score"].to_numpy(), edges),
            "ncls": np.full(len(df), len(edges) - 1, dtype="int8"),
        },
        geometry=boxes,
        crs=GRID.crs,
    )
    return gdf if crs == GRID.crs else gdf.to_crs(crs)


def tile_layer(
    gdf: gpd.GeoDataFrame,
    out: Path,
    *,
    min_zoom: int = 6,
    max_zoom: int = 14,
    max_tile_bytes: int | None = None,
    run: Runner = subprocess.run,
) -> None:
    """Write `out` (.pmtiles, layer `cells`) from cell polygons.

    One tippecanoe run per (cls, source) group, so coalescing at low zoom
    can only merge cells that share both attributes, then tile-join. The
    joined tiles have no size limit: each part already respects it.
    `run` is injected for tests; `max_tile_bytes` lowers tippecanoe's
    500 kB per-part limit (see PART_TILE_BYTES).
    """
    if run is subprocess.run:
        _check_tippecanoe_available()
    with tempfile.TemporaryDirectory(prefix="v2_tiles_") as tmp:
        parts: list[str] = []
        for (cls, source), group in gdf.groupby(["cls", "source"], sort=True):
            stem = Path(tmp) / f"cls{cls}_{source}"
            group.to_file(stem.with_suffix(".geojson"), driver="GeoJSON")
            cmd = [
                "tippecanoe", "-q", "-o", str(stem.with_suffix(".pmtiles")), "--force",
                "-l", "cells", "-Z", str(min_zoom), "-z", str(max_zoom),
                "--coalesce-densest-as-needed",
                "--extend-zooms-if-still-dropping",
                "--accumulate-attribute=score:mean",
            ]
            limit = max_tile_bytes
            while True:
                size_flag = [] if limit is None else ["-M", str(limit)]
                try:
                    run([*cmd, *size_flag, str(stem.with_suffix(".geojson"))], check=True)
                    break
                except subprocess.CalledProcessError as err:
                    if err.returncode != TIPPECANOE_TOO_DENSE or limit is None:
                        raise
                    limit = None if limit * 2 >= TIPPECANOE_DEFAULT_BYTES else limit * 2
            parts.append(str(stem.with_suffix(".pmtiles")))
        run(
            ["tile-join", "-q", "-o", str(out), "--force", "--no-tile-size-limit", *parts],
            check=True,
        )


def build_layer(
    name: str, map_dir: Path, tiles_dir: Path, run: Runner = subprocess.run
) -> dict[str, object]:
    df = load_layer(map_dir / f"{name}.parquet")
    scores = df["score"].to_numpy()
    try:
        edges = class_edges(scores)
    except ValueError as err:
        raise ValueError(f"{name}: {err}") from err
    tile_layer(
        cells_to_geodataframe(df, edges),
        tiles_dir / f"v2_{name}.pmtiles",
        min_zoom=VECTOR_ZOOMS[0],
        max_zoom=VECTOR_ZOOMS[1],
        max_tile_bytes=PART_TILE_BYTES,
        run=run,
    )
    cls = assign_classes(scores, edges)
    raster = write_class_pmtiles(
        class_grid(df["i"].to_numpy(), df["j"].to_numpy(), cls),
        ncls=len(edges) - 1,
        out=tiles_dir / f"v2_{name}_raster.pmtiles",
        min_zoom=RASTER_ZOOMS[0],
        max_zoom=RASTER_ZOOMS[1],
    )
    from pipelines.threshold_tiles import write_threshold_tiles
    write_threshold_tiles(tiles_dir / f"v2_{name}_raster.pmtiles", len(edges) - 1)
    for z, st in sorted(raster.items()):
        print(f"{name} raster z{z}: {st['tiles']} tiles, max {st['max_bytes'] / 1024:.0f} KB")

    counts = df["source"].value_counts()
    return {
        "n_cells": int(len(df)),
        "classes": len(edges) - 1,
        "edges": [round(e, 6) for e in edges],
        "shares": class_shares(scores, edges),
        "sources": {s: int(counts[s]) for s in SOURCES if s in counts},
    }


def load_metrics(path: Path) -> dict[str, object]:
    """Owner-provided metrics, validated so a typo fails the build instead
    of the drawer. Shape: {"groups": [{"title", "detail"?, "layers":
    {"bodies": [row], "diffuse": [row]}}], "notes": [str]}, where a row is
    {"label", "value", "ci"?: [lo, hi], "unit"?: "%"}. Absent file → empty."""
    if not path.exists():
        return {"groups": [], "notes": []}
    data = json.loads(path.read_text())

    def fail(msg: str) -> None:
        raise ValueError(f"{path.name}: {msg}")

    if not isinstance(data.get("notes"), list) or not all(
        isinstance(n, str) for n in data["notes"]
    ):
        fail("notes must be a list of strings")
    if not isinstance(data.get("groups"), list):
        fail("groups must be a list")
    for g in data["groups"]:
        if not isinstance(g.get("title"), str):
            fail("every group needs a title")
        layers = g.get("layers", {})
        for name in LAYERS:
            rows = layers.get(name)
            if not isinstance(rows, list):
                fail(f"group {g['title']!r}: missing {name} rows")
            for r in rows:
                where = f"group {g['title']!r}, {name}, row {r.get('label')!r}"
                if not isinstance(r.get("label"), str):
                    fail(f"{where}: label must be a string")
                if isinstance(r.get("value"), bool) or not isinstance(r.get("value"), int | float):
                    fail(f"{where}: value must be a number")
                ci = r.get("ci")
                if ci is not None and not (
                    isinstance(ci, list) and len(ci) == 2
                    and all(isinstance(v, int | float) for v in ci)
                ):
                    fail(f"{where}: ci must be [low, high]")
                if r.get("unit") not in (None, "%"):
                    fail(f"{where}: unit must be '%' or absent")
    return {"groups": data["groups"], "notes": data["notes"]}


def build(
    map_dir: Path,
    tiles_dir: Path,
    data_dir: Path,
    run: Runner = subprocess.run,
    metrics_path: Path = METRICS_PATH,
) -> Path:
    for name in LAYERS:
        if not (map_dir / f"{name}.parquet").exists():
            raise FileNotFoundError(f"{map_dir / f'{name}.parquet'} not found")
    metrics = load_metrics(metrics_path)  # validate before the slow part
    tiles_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    layers = {name: build_layer(name, map_dir, tiles_dir, run) for name in LAYERS}
    model = {
        "model": "v2",
        "grid": asdict(GRID),
        "zooms": {"raster": list(RASTER_ZOOMS), "vector": list(VECTOR_ZOOMS)},
        "requested_classes": N_CLASSES,
        "layers": layers,
        "metrics": metrics,
    }
    out = data_dir / "model_v2.json"
    out.write_text(json.dumps(model, indent=2) + "\n")
    return out


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--map-dir", required=True, help="Folder with bodies.parquet, diffuse.parquet")
    p.add_argument("--tiles-dir", required=True, help="Path to public/tiles")
    p.add_argument("--data-dir", required=True, help="Path to public/data")
    p.add_argument("--metrics", default=str(METRICS_PATH), help="Owner metrics JSON")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    ns = parse_args(argv)
    out = build(
        Path(ns.map_dir).expanduser(),
        Path(ns.tiles_dir).expanduser(),
        Path(ns.data_dir).expanduser(),
        metrics_path=Path(ns.metrics).expanduser(),
    )
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
