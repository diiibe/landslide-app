import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipelines.model_v2 import (
    GRID,
    N_CLASSES,
    PART_TILE_BYTES,
    assign_classes,
    build,
    cells_to_geodataframe,
    class_edges,
    class_shares,
    load_layer,
    load_metrics,
    tile_layer,
)

EDGES5 = [0, 0.2, 0.4, 0.6, 0.8, 1]


def synthetic_layer(n: int = 500, seed: int = 0) -> pd.DataFrame:
    """Same schema as HazardFVG data/processed/model/map/<layer>.parquet
    (full-fit export: one model on every domain cell, `holdout` marks the
    cells of the evaluation squares)."""
    rng = np.random.default_rng(seed)
    flat = rng.choice(GRID.width * GRID.height, size=n, replace=False)
    return pd.DataFrame(
        {
            "i": (flat // GRID.width).astype("int32"),
            "j": (flat % GRID.width).astype("int32"),
            "score": rng.beta(0.8, 6.0, size=n),
            "source": "full_fit",
            "holdout": rng.uniform(size=n) < 0.2,
            "seed_spread": rng.uniform(0, 0.05, size=n),
        }
    )


def oof_layer(n: int = 500, seed: int = 0) -> pd.DataFrame:
    """The earlier export (map/oof/): per-cell source, no holdout column."""
    rng = np.random.default_rng(seed)
    df = synthetic_layer(n, seed).drop(columns=["holdout"])
    df["source"] = rng.choice(["oof", "holdout", "in_sample"], size=n, p=[0.7, 0.2, 0.1])
    return df


@pytest.fixture
def map_dir(tmp_path: Path) -> Path:
    d = tmp_path / "map"
    d.mkdir()
    synthetic_layer(seed=1).to_parquet(d / "bodies.parquet")
    synthetic_layer(seed=2).to_parquet(d / "diffuse.parquet")
    return d


def test_load_layer_accepts_the_full_fit_and_the_oof_exports(tmp_path: Path):
    for df in (synthetic_layer(), oof_layer()):
        path = tmp_path / "layer.parquet"
        df.to_parquet(path)
        assert len(load_layer(path)) == len(df)


def test_load_layer_rejects_a_non_boolean_holdout_column(tmp_path: Path):
    path = tmp_path / "bad.parquet"
    synthetic_layer().assign(holdout="yes").to_parquet(path)
    with pytest.raises(ValueError, match="holdout"):
        load_layer(path)


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


def test_class_edges_split_untied_scores_into_five_even_classes():
    scores = np.linspace(0, 1, 1001)
    edges = class_edges(scores)
    assert len(edges) == N_CLASSES + 1
    np.testing.assert_allclose(edges, EDGES5)
    shares = class_shares(scores, edges)
    assert len(shares) == N_CLASSES
    assert sum(shares) == pytest.approx(1)
    assert min(shares) >= 0.195 and max(shares) <= 0.205


def test_tied_scores_collapse_to_distinct_classes_with_real_shares():
    # 50 % of the cells share the exact same score: three quantiles coincide.
    rng = np.random.default_rng(0)
    scores = np.concatenate([np.full(5000, 0.01), rng.uniform(0.02, 0.9, 5000)])
    edges = class_edges(scores)
    assert edges == sorted(set(edges)), "edges must be strictly increasing"
    n = len(edges) - 1
    assert 3 <= n < N_CLASSES
    shares = class_shares(scores, edges)
    assert len(shares) == n
    assert all(s > 0 for s in shares), "no empty class survives"
    assert sum(shares) == pytest.approx(1)
    assert shares[0] >= 0.5  # the tied block sits in one class, honestly reported
    cls = assign_classes(scores, edges)
    assert set(np.unique(cls)) == set(range(1, n + 1))


def test_fewer_than_three_distinct_classes_fail_loudly():
    scores = np.concatenate([np.zeros(900), np.ones(100)])
    with pytest.raises(ValueError, match="distinct classes"):
        class_edges(scores)


def test_assign_classes_covers_the_extremes():
    edges = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
    cls = assign_classes(np.array([0.0, 0.05, 0.1, 0.25, 0.5, 0.49]), edges)
    assert cls.tolist() == [1, 1, 2, 3, 5, 5]


def test_cell_polygons_sit_on_the_hazardfvg_grid():
    df = pd.DataFrame(
        {"i": [0, GRID.height - 1], "j": [0, GRID.width - 1], "score": [0.1, 0.9],
         "source": ["oof", "holdout"], "seed_spread": [0.0, 0.0]}
    )
    gdf = cells_to_geodataframe(df, edges=EDGES5, crs=GRID.crs)
    first, last = gdf.geometry.iloc[0].bounds, gdf.geometry.iloc[1].bounds
    # Top-left cell: row 0 counts down from y0, column 0 right from x0.
    assert first == pytest.approx((GRID.x0, GRID.y0 - 120, GRID.x0 + 120, GRID.y0))
    # Bottom-right cell closes the grid extent.
    x1 = GRID.x0 + GRID.width * GRID.cell
    y1 = GRID.y0 - GRID.height * GRID.cell
    assert last == pytest.approx((x1 - 120, y1, x1, y1 + 120))


def test_cells_reproject_to_wgs84_inside_fvg():
    gdf = cells_to_geodataframe(synthetic_layer(50), edges=EDGES5)
    assert gdf.crs.to_epsg() == 4326
    minx, miny, maxx, maxy = gdf.total_bounds
    assert 12.0 < minx < maxx < 14.2
    assert 45.4 < miny < maxy < 46.8
    assert list(gdf.columns) == ["score", "source", "cls", "ncls", "geometry"]
    assert set(gdf["ncls"]) == {5}


class FakeRunner:
    """Stands in for subprocess.run: records commands, checks their inputs
    exist at call time and touches the output file."""

    def __init__(self) -> None:
        self.cmds: list[list[str]] = []
        self.inputs: list[Path] = []

    def __call__(self, cmd: list[str], check: bool) -> None:
        assert check
        self.cmds.append(cmd)
        out = Path(cmd[cmd.index("-o") + 1])
        for arg in cmd[1:]:
            if arg.endswith((".geojson", ".pmtiles")) and Path(arg) != out:
                assert Path(arg).exists(), f"{arg} missing when {cmd[0]} ran"
                self.inputs.append(Path(arg))
        out.write_bytes(b"pmtiles")


METRICS = {
    "groups": [
        {
            "title": "Area di test",
            "detail": "Quadrati esclusi.",
            "layers": {
                "bodies": [{"label": "ROC AUC", "value": 0.887, "ci": [0.827, 0.959]}],
                "diffuse": [{"label": "Prevalenza", "value": 10.43, "unit": "%"}],
            },
        }
    ],
    "notes": ["Misurano l'accordo con l'inventario."],
}


def write_metrics(tmp_path: Path, payload: object) -> Path:
    path = tmp_path / "metrics.json"
    path.write_text(json.dumps(payload))
    return path


def test_build_writes_tiles_and_model_json(map_dir: Path, tmp_path: Path):
    tiles, data = tmp_path / "tiles", tmp_path / "data"
    run = FakeRunner()
    build(map_dir, tiles, data, run=run, metrics_path=write_metrics(tmp_path, METRICS))

    assert sorted(p.name for p in tiles.iterdir()) == [
        "v2_bodies.pmtiles", "v2_bodies_raster.pmtiles",
        "v2_diffuse.pmtiles", "v2_diffuse_raster.pmtiles",
    ]
    tips = [c for c in run.cmds if c[0] == "tippecanoe"]
    assert tips and all(c[c.index("-M") + 1] == str(PART_TILE_BYTES) for c in tips)
    # Vector tiles start where the raster pyramid stops.
    assert all((c[c.index("-Z") + 1], c[c.index("-z") + 1]) == ("10", "14") for c in tips)
    joins = [c for c in run.cmds if c[0] == "tile-join"]
    assert [Path(c[c.index("-o") + 1]).name for c in joins] == [
        "v2_bodies.pmtiles", "v2_diffuse.pmtiles"
    ]

    model = json.loads((data / "model_v2.json").read_text())
    assert model["model"] == "v2"
    assert model["requested_classes"] == N_CLASSES
    assert model["zooms"] == {"raster": [6, 9], "vector": [10, 14]}
    assert set(model["layers"]) == {"bodies", "diffuse"}
    for name in ("bodies", "diffuse"):
        layer = model["layers"][name]
        assert len(layer["edges"]) == layer["classes"] + 1
        assert len(layer["shares"]) == layer["classes"]
        assert sum(layer["shares"]) == pytest.approx(1, abs=1e-3)
        assert layer["edges"] == sorted(layer["edges"])
        assert layer["n_cells"] == 500
        assert layer["sources"] == {"full_fit": 500}
        assert "metrics" not in layer
    # Owner metrics are copied verbatim from the committed input file.
    assert model["metrics"] == METRICS
    # Breaks are per layer: two different synthetic draws give two sets.
    assert model["layers"]["bodies"]["edges"] != model["layers"]["diffuse"]["edges"]


def test_build_without_a_metrics_file_writes_empty_metrics(map_dir: Path, tmp_path: Path):
    build(map_dir, tmp_path / "tiles", tmp_path / "data", run=FakeRunner(),
          metrics_path=tmp_path / "absent.json")
    model = json.loads((tmp_path / "data" / "model_v2.json").read_text())
    assert model["metrics"] == {"groups": [], "notes": []}


def test_committed_metrics_file_is_valid():
    metrics = load_metrics(Path(__file__).parents[1] / "model_v2_metrics.json")
    assert [g["title"] for g in metrics["groups"]] == [
        "Area di test (seconda apertura)", "Validazione incrociata a blocchi"
    ]
    assert len(metrics["notes"]) == 3


@pytest.mark.parametrize(
    "payload, match",
    [
        ({"groups": [], "notes": "x"}, "notes"),
        ({"groups": [{"title": "t", "layers": {"bodies": []}}], "notes": []}, "diffuse"),
        ({"groups": [{"title": "t", "layers": {"bodies": [{"label": "a", "value": "0.8"}],
                                               "diffuse": []}}], "notes": []}, "value"),
        ({"groups": [{"title": "t", "layers": {"bodies": [{"label": "a", "value": 0.8,
                                                           "ci": [0.9]}],
                                               "diffuse": []}}], "notes": []}, "ci"),
        ({"groups": [{"title": "t", "layers": {"bodies": [{"label": "a", "value": 0.8,
                                                           "unit": "kg"}],
                                               "diffuse": []}}], "notes": []}, "unit"),
    ],
)
def test_load_metrics_rejects_malformed_files(tmp_path: Path, payload: object, match: str):
    with pytest.raises(ValueError, match=match):
        load_metrics(write_metrics(tmp_path, payload))


def test_build_fails_clearly_when_a_parquet_is_missing(tmp_path: Path):
    empty = tmp_path / "map"
    empty.mkdir()
    with pytest.raises(FileNotFoundError, match="bodies.parquet"):
        build(empty, tmp_path / "tiles", tmp_path / "data", run=FakeRunner())


def test_tile_layer_tiles_each_class_and_source_apart_then_joins(tmp_path: Path):
    gdf = cells_to_geodataframe(synthetic_layer(300), edges=EDGES5)
    run = FakeRunner()
    tile_layer(gdf, tmp_path / "out.pmtiles", run=run)

    tips = [c for c in run.cmds if c[0] == "tippecanoe"]
    groups = gdf.groupby(["cls", "source"]).ngroups
    assert len(tips) == groups
    for c in tips:
        assert "--coalesce-densest-as-needed" in c
        assert "--drop-densest-as-needed" not in c
        assert c[c.index("-l") + 1] == "cells"
    join = run.cmds[-1]
    assert join[0] == "tile-join" and "--no-tile-size-limit" in join
    # GeoJSON intermediates lived in a temp dir outside the output folder
    # and are gone once the tiles exist.
    geojsons = [p for p in run.inputs if p.suffix == ".geojson"]
    assert len(geojsons) == groups
    assert all(tmp_path not in p.parents for p in geojsons)
    assert not any(p.exists() for p in run.inputs)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["out.pmtiles"]


def test_tile_layer_doubles_the_part_limit_when_a_part_is_too_dense(tmp_path: Path):
    gdf = cells_to_geodataframe(synthetic_layer(100).assign(score=0.1), edges=EDGES5)
    assert gdf.groupby(["cls", "source"]).ngroups == 1  # one (cls, source) group
    tried: list[str | None] = []

    def run(cmd: list[str], check: bool) -> None:
        if cmd[0] == "tippecanoe":
            limit = cmd[cmd.index("-M") + 1] if "-M" in cmd else None
            tried.append(limit)
            if limit is not None and int(limit) < 400_000:
                raise subprocess.CalledProcessError(100, cmd)
        Path(cmd[cmd.index("-o") + 1]).write_bytes(b"pmtiles")

    tile_layer(gdf, tmp_path / "out.pmtiles", max_tile_bytes=100_000, run=run)
    assert tried == ["100000", "200000", "400000"]


def test_tile_layer_fails_loudly_on_other_tippecanoe_errors(tmp_path: Path):
    gdf = cells_to_geodataframe(synthetic_layer(50), edges=EDGES5)

    def run(cmd: list[str], check: bool) -> None:
        raise subprocess.CalledProcessError(1, cmd)

    with pytest.raises(subprocess.CalledProcessError):
        tile_layer(gdf, tmp_path / "out.pmtiles", max_tile_bytes=100_000, run=run)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.skipif(
    not (shutil.which("tippecanoe") and shutil.which("tile-join")
         and shutil.which("tippecanoe-decode")),
    reason="tippecanoe not installed",
)
def test_coalesced_low_zoom_tiles_keep_each_cells_class(tmp_path: Path):
    """Real tippecanoe run. Classes are vertical bands of columns; a tiny
    tile byte limit forces coalescing. Every decoded low-zoom feature must
    stay inside the band of its own `cls` (up to two screen pixels)."""
    from pyproj import Transformer
    from shapely.geometry import box, shape
    from shapely.ops import transform

    rng = np.random.default_rng(3)
    ii, jj = np.mgrid[0:100, 0:GRID.width]
    ii, jj = ii.ravel(), jj.ravel()
    keep = rng.uniform(size=ii.size) < 0.3
    ii, jj = ii[keep], jj[keep]
    band = np.minimum(jj * 5 // GRID.width, 4)
    df = pd.DataFrame({
        "i": ii, "j": jj, "score": (band + rng.uniform(0.05, 0.95, ii.size)) / 5,
        "source": rng.choice(["oof", "holdout"], ii.size), "seed_spread": 0.0,
    })
    gdf = cells_to_geodataframe(df, edges=EDGES5)
    out = tmp_path / "band.pmtiles"
    tile_layer(gdf, out, max_zoom=8, max_tile_bytes=50_000)

    decoded = subprocess.run(
        ["tippecanoe-decode", "-Z", "6", "-z", "8", str(out)],
        capture_output=True, text=True, check=True,
    ).stdout
    to_utm = Transformer.from_crs(4326, 32633, always_xy=True).transform
    xb = [GRID.x0 + k * GRID.width / 5 * GRID.cell for k in range(6)]
    per_zoom: dict[int, int] = {}
    area, outside = 0.0, 0.0
    for tile in json.loads(decoded)["features"]:
        zoom = tile["properties"]["zoom"]
        tol = 40075016 / 2 ** zoom / 256 * 2
        for layer in tile["features"]:
            for f in layer["features"]:
                k = f["properties"]["cls"] - 1
                geom = transform(to_utm, shape(f["geometry"])).buffer(0)
                per_zoom[zoom] = per_zoom.get(zoom, 0) + 1
                area += geom.area
                outside += geom.difference(box(xb[k] - tol, -1e9, xb[k + 1] + tol, 1e9)).area
    assert 0 < per_zoom[6] < len(gdf) / 2, "z6 should coalesce cells"
    assert outside / area < 1e-4
