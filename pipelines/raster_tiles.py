"""Raster PMTiles pyramid of a class grid, for the low zooms of model v2.

At z6-9 the v2 cell polygons make vector tiles of 0.6-0.9 MB (310k cells
of interleaved classes), so the map shows those zooms as PNG tiles
rendered straight from the 120 m class grid instead:

- every output pixel takes the class of the grid cell under its centre
  (nearest neighbour), so classes never blend;
- colours are the app's ramp (`RAMP_STOPS` in src/map/style.ts, mirrored
  here and checked by a test), spread over the layer's class count
  exactly like `v2ClassColor`;
- cells outside the domain (class 0) are transparent;
- tiles without a single domain pixel are not written.

Tiles are 256 px, Web Mercator XYZ, palette PNG, in a PMTiles v3 archive.
"""
from __future__ import annotations

import io
import math
from pathlib import Path

import numpy as np
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from pyproj import Transformer

from pipelines.grid import GRID

TILE = 256
HALF = 20037508.342789244  # half the Web Mercator world width, metres

# Mirrors RAMP_STOPS in src/map/style.ts (test_raster_tiles parses it).
RAMP_STOPS: list[tuple[float, str]] = [
    (0.0, "#E8F0D8"),
    (0.25, "#8BB26B"),
    (0.5, "#D9A441"),
    (0.75, "#D25524"),
    (1.0, "#7A1F10"),
]


def _rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def ramp_color_at(p: float) -> tuple[int, int, int]:
    """Same as `rampColorAt` in style.ts, including its round-half-up."""
    first, last = RAMP_STOPS[0], RAMP_STOPS[-1]
    if p <= first[0]:
        return _rgb(first[1])
    if p >= last[0]:
        return _rgb(last[1])
    for (p0, c0), (p1, c1) in zip(RAMP_STOPS, RAMP_STOPS[1:], strict=False):
        if p <= p1:
            t = (p - p0) / (p1 - p0)
            return tuple(  # type: ignore[return-value]
                math.floor(a + (b - a) * t + 0.5) for a, b in zip(_rgb(c0), _rgb(c1), strict=True)
            )
    return _rgb(last[1])


def class_palette(ncls: int) -> list[tuple[int, int, int]]:
    """Colour of classes 1..ncls, like `v2ClassColor(cls, ncls)`."""
    return [ramp_color_at((k - 1) / (ncls - 1) if ncls > 1 else 1.0) for k in range(1, ncls + 1)]


def class_grid(i: np.ndarray, j: np.ndarray, cls: np.ndarray) -> np.ndarray:
    """(height, width) uint8 raster of classes; 0 outside the domain."""
    grid = np.zeros((GRID.height, GRID.width), dtype=np.uint8)
    grid[np.asarray(i), np.asarray(j)] = np.asarray(cls, dtype=np.uint8)
    return grid


def _grid_bounds_lonlat() -> tuple[float, float, float, float]:
    to_ll = Transformer.from_crs(GRID.crs, 4326, always_xy=True)
    x1 = GRID.x0 + GRID.width * GRID.cell
    y1 = GRID.y0 - GRID.height * GRID.cell
    xs = np.linspace(GRID.x0, x1, 50)
    ys = np.linspace(y1, GRID.y0, 50)
    edge_x = np.concatenate([xs, xs, np.full(50, GRID.x0), np.full(50, x1)])
    edge_y = np.concatenate([np.full(50, y1), np.full(50, GRID.y0), ys, ys])
    lon, lat = to_ll.transform(edge_x, edge_y)
    return float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())


def tile_range(z: int) -> tuple[tuple[int, int], tuple[int, int]]:
    """Inclusive (x range, y range) of the XYZ tiles covering the grid."""
    w, s, e, n = _grid_bounds_lonlat()

    def tx(lon: float) -> int:
        return int((lon + 180) / 360 * 2**z)

    def ty(lat: float) -> int:
        r = math.radians(lat)
        return int((1 - math.asinh(math.tan(r)) / math.pi) / 2 * 2**z)

    return (tx(w), tx(e)), (ty(n), ty(s))


def render_tile(grid: np.ndarray, z: int, x: int, y: int, to_utm: Transformer) -> np.ndarray:
    """(256, 256) class indices for tile z/x/y; nearest cell per pixel centre."""
    res = 2 * HALF / 2**z / TILE
    offs = np.arange(TILE) + 0.5
    mx = -HALF + (x * TILE + offs) * res
    my = HALF - (y * TILE + offs) * res
    mxx, myy = np.meshgrid(mx, my)
    ux, uy = to_utm.transform(mxx, myy)
    row = np.floor((GRID.y0 - uy) / GRID.cell).astype(np.int64)
    col = np.floor((ux - GRID.x0) / GRID.cell).astype(np.int64)
    inside = (row >= 0) & (row < GRID.height) & (col >= 0) & (col < GRID.width)
    out = np.zeros((TILE, TILE), dtype=np.uint8)
    out[inside] = grid[row[inside], col[inside]]
    return out


def encode_png(classes: np.ndarray, palette: list[tuple[int, int, int]]) -> bytes:
    """Palette PNG: index 0 transparent, index k = class k."""
    img = Image.frombytes("P", (TILE, TILE), np.ascontiguousarray(classes).tobytes())
    flat = [0, 0, 0] + [c for rgb in palette for c in rgb]
    img.putpalette(flat + [0] * (768 - len(flat)))
    buf = io.BytesIO()
    img.save(buf, format="PNG", transparency=0, optimize=True)
    return buf.getvalue()


def write_class_pmtiles(
    grid: np.ndarray, ncls: int, out: Path, min_zoom: int = 6, max_zoom: int = 9
) -> dict[int, dict[str, int]]:
    """Write the raster pyramid; returns per-zoom tile count and max bytes."""
    to_utm = Transformer.from_crs(3857, GRID.crs, always_xy=True)
    palette = class_palette(ncls)
    tiles: list[tuple[int, bytes]] = []
    stats: dict[int, dict[str, int]] = {}
    for z in range(min_zoom, max_zoom + 1):
        (x0, x1), (y0, y1) = tile_range(z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                classes = render_tile(grid, z, x, y, to_utm)
                if not classes.any():
                    continue
                data = encode_png(classes, palette)
                tiles.append((zxy_to_tileid(z, x, y), data))
                s = stats.setdefault(z, {"tiles": 0, "max_bytes": 0})
                s["tiles"] += 1
                s["max_bytes"] = max(s["max_bytes"], len(data))

    w, s_, e, n = _grid_bounds_lonlat()
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as f:
        writer = Writer(f)
        for tile_id, data in sorted(tiles):
            writer.write_tile(tile_id, data)
        writer.finalize(
            {
                "tile_type": TileType.PNG,
                "tile_compression": Compression.NONE,
                "min_lon_e7": int(w * 1e7),
                "min_lat_e7": int(s_ * 1e7),
                "max_lon_e7": int(e * 1e7),
                "max_lat_e7": int(n * 1e7),
                "center_zoom": min_zoom,
                "center_lon_e7": int((w + e) / 2 * 1e7),
                "center_lat_e7": int((s_ + n) / 2 * 1e7),
            },
            {"name": out.stem, "format": "png", "type": "overlay", "tileSize": TILE},
        )
    return stats
