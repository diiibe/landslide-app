import io
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from PIL import Image
from pmtiles.reader import MmapSource, Reader
from pmtiles.tile import TileType
from pyproj import Transformer

from pipelines.grid import GRID
from pipelines.model_v2 import assign_classes
from pipelines.raster_tiles import (
    class_grid,
    class_palette,
    ramp_color_at,
    tile_range,
    write_class_pmtiles,
)

STYLE_TS = Path(__file__).parents[2] / "src" / "map" / "style.ts"
HALF = 20037508.342789244


def ts_ramp_stops() -> list[tuple[float, str]]:
    """RAMP_STOPS parsed from src/map/style.ts: the raster must use the
    exact colours the vector layer and the legend use."""
    body = STYLE_TS.read_text().split("RAMP_STOPS", 1)[1].split("];", 1)[0]
    pairs = re.findall(r'\[([\d.]+),\s*"(#[0-9A-Fa-f]{6})"\]', body)
    return [(float(p), c.upper()) for p, c in pairs]


def hex_rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def test_palette_matches_the_app_ramp():
    stops = ts_ramp_stops()
    assert len(stops) == 5
    assert class_palette(5) == [hex_rgb(c) for _, c in stops]
    # Three collapsed classes: low, middle, high stop.
    assert class_palette(3) == [hex_rgb(stops[0][1]), hex_rgb(stops[2][1]), hex_rgb(stops[4][1])]
    # In-between positions interpolate like rampColorAt (round half up).
    assert ramp_color_at(0.125) == tuple(
        math.floor(a + (b - a) * 0.5 + 0.5)
        for a, b in zip(hex_rgb(stops[0][1]), hex_rgb(stops[1][1]), strict=True)
    )


@pytest.fixture
def layer() -> tuple[pd.DataFrame, list[float]]:
    """Dense block of cells around Tolmezzo with smooth scores, plus holes."""
    rng = np.random.default_rng(7)
    ii, jj = np.mgrid[150:450, 300:700]
    ii, jj = ii.ravel(), jj.ravel()
    keep = rng.uniform(size=ii.size) < 0.8
    ii, jj = ii[keep], jj[keep]
    score = (np.sin(ii / 25) + np.cos(jj / 30) + 2) / 4
    df = pd.DataFrame({"i": ii, "j": jj, "score": score})
    edges = list(np.quantile(score, np.linspace(0, 1, 6)))
    df["cls"] = assign_classes(score, edges)
    return df, edges


def test_class_grid_puts_each_cell_at_row_i_column_j(layer):
    df, _ = layer
    grid = class_grid(df["i"].to_numpy(), df["j"].to_numpy(), df["cls"].to_numpy())
    assert grid.shape == (GRID.height, GRID.width)
    assert grid.dtype == np.uint8
    sample = df.sample(50, random_state=0)
    assert (grid[sample["i"], sample["j"]] == sample["cls"]).all()
    assert (grid > 0).sum() == len(df)  # everything else stays 0 = outside domain


def test_raster_pixels_show_the_class_of_the_parquet_cell_under_them(layer, tmp_path):
    df, _ = layer
    grid = class_grid(df["i"].to_numpy(), df["j"].to_numpy(), df["cls"].to_numpy())
    out = tmp_path / "raster.pmtiles"
    write_class_pmtiles(grid, ncls=5, out=out, min_zoom=6, max_zoom=9)

    with open(out, "rb") as f:
        reader = Reader(MmapSource(f))
        header = reader.header()
        assert header["tile_type"] == TileType.PNG
        assert (header["min_zoom"], header["max_zoom"]) == (6, 9)

        lookup = {(i, j): c for i, j, c in df[["i", "j", "cls"]].itertuples(index=False)}
        palette = class_palette(5)
        # Sample points in and around the block of cells, find the pixel
        # that covers each, then derive the expected class independently
        # of the renderer: pixel centre in Web Mercator -> WGS84 -> UTM 33N
        # -> grid cell containing it.
        utm_to_merc = Transformer.from_crs(32633, 3857, always_xy=True)
        merc_to_ll = Transformer.from_crs(3857, 4326, always_xy=True)
        ll_to_utm = Transformer.from_crs(4326, 32633, always_xy=True)
        rng = np.random.default_rng(1)
        i_lo, i_hi = df["i"].min() - 40, df["i"].max() + 40
        j_lo, j_hi = df["j"].min() - 40, df["j"].max() + 40
        checked = {"inside": 0, "outside": 0}
        for z in (7, 9):
            res = 2 * HALF / 2**z / 256
            for _ in range(300):
                ux = GRID.x0 + rng.uniform(j_lo, j_hi) * GRID.cell
                uy = GRID.y0 - rng.uniform(i_lo, i_hi) * GRID.cell
                mx, my = utm_to_merc.transform(ux, uy)
                gx, gy = int((mx + HALF) / res), int((HALF - my) / res)
                x, y, px, py = gx // 256, gy // 256, gx % 256, gy % 256
                cx, cy = -HALF + (gx + 0.5) * res, HALF - (gy + 0.5) * res
                cux, cuy = ll_to_utm.transform(*merc_to_ll.transform(cx, cy))
                cell = (
                    math.floor((GRID.y0 - cuy) / GRID.cell),
                    math.floor((cux - GRID.x0) / GRID.cell),
                )
                expected = lookup.get(cell)
                data = reader.get(z, x, y)
                if data is None:  # empty tiles are not stored
                    assert expected is None
                    continue
                rgba = Image.open(io.BytesIO(data)).convert("RGBA").getpixel((px, py))
                if expected is None:
                    assert rgba[3] == 0, f"z{z} {x}/{y} px {px},{py}: should be transparent"
                    checked["outside"] += 1
                else:
                    assert rgba == (*palette[expected - 1], 255), f"z{z} cell {cell}"
                    checked["inside"] += 1
        assert checked["inside"] > 200 and checked["outside"] > 50


def test_only_tiles_with_domain_pixels_are_written(layer, tmp_path):
    df, _ = layer
    grid = class_grid(df["i"].to_numpy(), df["j"].to_numpy(), df["cls"].to_numpy())
    out = tmp_path / "raster.pmtiles"
    stats = write_class_pmtiles(grid, ncls=5, out=out, min_zoom=6, max_zoom=9)
    assert set(stats) == {6, 7, 8, 9}
    for z, s in stats.items():
        xs, ys = tile_range(z)
        assert 0 < s["tiles"] <= (xs[1] - xs[0] + 1) * (ys[1] - ys[0] + 1)
        assert s["max_bytes"] > 0
