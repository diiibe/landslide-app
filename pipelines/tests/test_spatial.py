import geopandas as gpd
from shapely.geometry import Polygon

from pipelines.spatial import compute_iffi_hit


def _square(x: float, y: float, s: float = 1.0) -> Polygon:
    return Polygon([(x, y), (x + s, y), (x + s, y + s), (x, y + s)])


def test_compute_iffi_hit_flags_intersecting_cells():
    cells = gpd.GeoDataFrame(
        {"cell_id": [0, 1, 2]},
        geometry=[_square(0, 0), _square(10, 0), _square(20, 0)],
        crs="EPSG:4326",
    )
    iffi = gpd.GeoDataFrame(
        {"id_frana": ["A"]},
        geometry=[_square(0.5, 0.5, 0.2)],
        crs="EPSG:4326",
    )
    out = compute_iffi_hit(cells, iffi)
    assert list(out["iffi_hit"]) == [True, False, False]
