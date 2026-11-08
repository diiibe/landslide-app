"""The HazardFVG 120 m analysis grid (`scripts/build/feature_grid.py`, `GRID`)."""
from __future__ import annotations

from dataclasses import dataclass


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
