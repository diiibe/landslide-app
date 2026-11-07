import json
from pathlib import Path
from unittest import mock

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest

from pipelines import model_v2
from pipelines.model_v2 import (
    GRID,
    N_CLASSES,
    assign_classes,
    build,
    cells_to_geodataframe,
    load_layer,
    quantile_edges,
)


def synthetic_layer(n: int = 500, seed: int = 0) -> pd.DataFrame:
    """Same schema as HazardFVG data/processed/model/map/<layer>.parquet."""
    rng = np.random.default_rng(seed)
    flat = rng.choice(GRID.width * GRID.height, size=n, replace=False)
    return pd.DataFrame(
        {
            "i": (flat // GRID.width).astype("int32"),
            "j": (flat % GRID.width).astype("int32"),
            "score": rng.beta(0.8, 6.0, size=n),
            "source": rng.choice(["oof", "holdout", "in_sample"], size=n, p=[0.7, 0.2, 0.1]),
            "seed_spread": rng.uniform(0, 0.05, size=n),
        }
    )


@pytest.fixture
def map_dir(tmp_path: Path) -> Path:
    d = tmp_path / "map"
    d.mkdir()
    synthetic_layer(seed=1).to_parquet(d / "bodies.parquet")
    synthetic_layer(seed=2).to_parquet(d / "diffuse.parquet")
    return d


def test_load_layer_rejects_missing_columns(tmp_path: Path):
    path = tmp_path / "bad.parquet"
    synthetic_layer().drop(columns=["source"]).to_parquet(path)
    with pytest.raises(ValueError, match="source"):
        load_layer(path)


def test_load_layer_rejects_unknown_source(tmp_path: Path):
    path = tmp_path / "bad.parquet"
    df = synthetic_layer()
    df.loc[0, "source"] = "train"
    df.to_parquet(path)
    with pytest.raises(ValueError, match="train"):
        load_layer(path)


def test_load_layer_rejects_cells_outside_the_grid(tmp_path: Path):
    path = tmp_path / "bad.parquet"
    df = synthetic_layer()
    df.loc[0, "j"] = GRID.width
    df.to_parquet(path)
    with pytest.raises(ValueError, match="outside"):
        load_layer(path)


def test_load_layer_rejects_duplicate_cells(tmp_path: Path):
    path = tmp_path / "bad.parquet"
    df = synthetic_layer()
    df = pd.concat([df, df.iloc[[0]]])
    df.to_parquet(path)
    with pytest.raises(ValueError, match="duplicate"):
        load_layer(path)


def test_quantile_edges_split_the_cells_into_five_even_classes():
    scores = np.linspace(0, 1, 1001)
    edges = quantile_edges(scores)
    assert len(edges) == N_CLASSES + 1
    assert edges[0] == 0 and edges[-1] == 1
    np.testing.assert_allclose(edges, [0, 0.2, 0.4, 0.6, 0.8, 1])
    counts = np.bincount(assign_classes(scores, edges), minlength=N_CLASSES + 1)[1:]
    assert counts.min() >= 195 and counts.max() <= 205


def test_assign_classes_covers_the_extremes():
    edges = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
    cls = assign_classes(np.array([0.0, 0.05, 0.1, 0.25, 0.5, 0.49]), edges)
    assert cls.tolist() == [1, 1, 2, 3, 5, 5]


def test_cell_polygons_sit_on_the_hazardfvg_grid():
    df = pd.DataFrame(
        {"i": [0, GRID.height - 1], "j": [0, GRID.width - 1], "score": [0.1, 0.9],
         "source": ["oof", "holdout"], "seed_spread": [0.0, 0.0]}
    )
    gdf = cells_to_geodataframe(df, edges=[0, 0.2, 0.4, 0.6, 0.8, 1], crs=GRID.crs)
    first, last = gdf.geometry.iloc[0].bounds, gdf.geometry.iloc[1].bounds
    # Top-left cell: row 0 counts down from y0, column 0 right from x0.
    assert first == pytest.approx((GRID.x0, GRID.y0 - 120, GRID.x0 + 120, GRID.y0))
    # Bottom-right cell closes the grid extent.
    x1 = GRID.x0 + GRID.width * GRID.cell
    y1 = GRID.y0 - GRID.height * GRID.cell
    assert last == pytest.approx((x1 - 120, y1, x1, y1 + 120))


def test_cells_reproject_to_wgs84_inside_fvg():
    gdf = cells_to_geodataframe(synthetic_layer(50), edges=[0, 0.2, 0.4, 0.6, 0.8, 1])
    assert gdf.crs.to_epsg() == 4326
    minx, miny, maxx, maxy = gdf.total_bounds
    assert 12.0 < minx < maxx < 14.2
    assert 45.4 < miny < maxy < 46.8
    assert list(gdf.columns) == ["score", "source", "cls", "geometry"]


def test_build_writes_tiles_and_model_json(map_dir: Path, tmp_path: Path):
    tiles, data = tmp_path / "tiles", tmp_path / "data"
    with mock.patch.object(model_v2, "run_tippecanoe") as tip:
        build(map_dir, tiles, data)

    outputs = [c.args[1].name for c in tip.call_args_list]
    assert outputs == ["v2_bodies.pmtiles", "v2_diffuse.pmtiles"]
    assert all(c.kwargs["layer_name"] == "cells" for c in tip.call_args_list)

    geo = gpd.read_file(tiles / "v2_bodies.geojson")
    assert len(geo) == 500
    assert set(geo["source"]) <= {"oof", "holdout", "in_sample"}
    assert set(geo["cls"]) <= set(range(1, N_CLASSES + 1))

    model = json.loads((data / "model_v2.json").read_text())
    assert model["model"] == "v2"
    assert model["classes"] == N_CLASSES
    assert set(model["layers"]) == {"bodies", "diffuse"}
    for name in ("bodies", "diffuse"):
        layer = model["layers"][name]
        assert len(layer["edges"]) == N_CLASSES + 1
        assert layer["edges"] == sorted(layer["edges"])
        assert layer["n_cells"] == 500
        assert sum(layer["sources"].values()) == 500
        assert layer["metrics"] == {}
    # Breaks are per layer: two different synthetic draws give two sets.
    assert model["layers"]["bodies"]["edges"] != model["layers"]["diffuse"]["edges"]


def test_build_fails_clearly_when_a_parquet_is_missing(tmp_path: Path):
    empty = tmp_path / "map"
    empty.mkdir()
    with pytest.raises(FileNotFoundError, match="bodies.parquet"):
        build(empty, tmp_path / "tiles", tmp_path / "data")
