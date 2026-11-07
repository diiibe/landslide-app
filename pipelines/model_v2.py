"""Build PMTiles + class breaks for the v2 landslide model from HazardFVG.

Usage (or `make tiles-v2`):
    python -m pipelines.model_v2 --map-dir ../HazardFVG/data/processed/model/map
        --tiles-dir public/tiles --data-dir public/data

Input: one parquet per layer (`bodies.parquet`, `diffuse.parquet`) with
columns `i, j, score, source, seed_spread`. `i, j` index the HazardFVG
120 m grid in EPSG:32633 (`scripts/build/feature_grid.py`, `GRID`): row
`i` counts down from `y0`, column `j` counts right from `x0`.

Pipeline, per layer:
    1. Validate the parquet (columns, source values, cells inside the grid,
       no duplicate cell).
    2. Class edges: score quantiles over every cell of the layer, 5 classes.
    3. Cell polygons from (i, j), reprojected to EPSG:4326.
    4. Slim GeoJSON (`score`, `source`, `cls`) → `v2_<layer>.pmtiles`.
Then `model_v2.json` collects the per-layer edges and source counts, with
empty `metrics` until the owner provides them.

The two layers are never merged: each gets its own tiles and its own edges.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from pipelines.build_tiles import run_tippecanoe


@dataclass(frozen=True)
class Grid:
    """North-up grid, origin at the top-left corner. Mirrors HazardFVG `Grid`."""

    crs: str
    x0: float
    y0: float
    cell: float
    width: int
    height: int


GRID = Grid(crs="EPSG:32633", x0=282549.4208, y0=5176239.1188, cell=120.0, width=1180, height=1120)

LAYERS = ("bodies", "diffuse")
SOURCES = ("oof", "holdout", "in_sample")
COLUMNS = ("i", "j", "score", "source", "seed_spread")
N_CLASSES = 5


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
    return df.reset_index(drop=True)


def quantile_edges(scores: np.ndarray, n_classes: int = N_CLASSES) -> list[float]:
    """`n_classes + 1` edges: min, the inner quantiles, max."""
    edges = np.quantile(np.asarray(scores, dtype="float64"), np.linspace(0, 1, n_classes + 1))
    return [float(e) for e in edges]


def assign_classes(scores: np.ndarray, edges: list[float]) -> np.ndarray:
    """Class 1..n per score. A score equal to an inner edge goes to the upper
    class; the maximum stays in the top class."""
    inner = np.asarray(edges[1:-1], dtype="float64")
    return (np.searchsorted(inner, np.asarray(scores), side="right") + 1).astype("int8")


def cells_to_geodataframe(
    df: pd.DataFrame, edges: list[float], crs: str = "EPSG:4326"
) -> gpd.GeoDataFrame:
    """One square polygon per (i, j) cell, with `score`, `source`, `cls`."""
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
        },
        geometry=boxes,
        crs=GRID.crs,
    )
    return gdf if crs == GRID.crs else gdf.to_crs(crs)


def build_layer(name: str, map_dir: Path, tiles_dir: Path) -> dict[str, object]:
    df = load_layer(map_dir / f"{name}.parquet")
    edges = quantile_edges(df["score"].to_numpy())
    gdf = cells_to_geodataframe(df, edges)

    geojson = tiles_dir / f"v2_{name}.geojson"
    gdf.to_file(geojson, driver="GeoJSON")
    run_tippecanoe(geojson, tiles_dir / f"v2_{name}.pmtiles", min_zoom=6, max_zoom=14,
                   layer_name="cells")

    counts = df["source"].value_counts()
    return {
        "n_cells": int(len(df)),
        "edges": [round(e, 6) for e in edges],
        "sources": {s: int(counts.get(s, 0)) for s in SOURCES},
        "metrics": {},
    }


def build(map_dir: Path, tiles_dir: Path, data_dir: Path) -> Path:
    for name in LAYERS:
        if not (map_dir / f"{name}.parquet").exists():
            raise FileNotFoundError(f"{map_dir / f'{name}.parquet'} not found")
    tiles_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    layers = {name: build_layer(name, map_dir, tiles_dir) for name in LAYERS}
    model = {"model": "v2", "grid": asdict(GRID), "classes": N_CLASSES, "layers": layers}
    out = data_dir / "model_v2.json"
    out.write_text(json.dumps(model, indent=2) + "\n")
    return out


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--map-dir", required=True, help="Folder with bodies.parquet, diffuse.parquet")
    p.add_argument("--tiles-dir", required=True, help="Path to public/tiles")
    p.add_argument("--data-dir", required=True, help="Path to public/data")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    ns = parse_args(argv)
    out = build(
        Path(ns.map_dir).expanduser(),
        Path(ns.tiles_dir).expanduser(),
        Path(ns.data_dir).expanduser(),
    )
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
