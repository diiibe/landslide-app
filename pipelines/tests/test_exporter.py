import json

import geopandas as gpd
from shapely.geometry import Polygon

from pipelines.exporter import export_geojson


def test_export_geojson_keeps_only_required_props(tmp_path):
    gdf = gpd.GeoDataFrame(
        {
            "cell_id": [1, 2],
            "p": [0.3, 0.7],
            "macro_zone": ["A", "B"],
            "sub_zone": ["A0", "B1"],
            "y_true": [0, 1],
            "iffi_hit": [False, True],
        },
        geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])] * 2,
        crs="EPSG:4326",
    )
    out = tmp_path / "cells.geojson"
    export_geojson(gdf, out)
    data = json.loads(out.read_text())
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 2
    props = data["features"][0]["properties"]
    assert set(props) == {"cell_id", "p", "zone", "sub_zone", "iffi_hit"}
    assert props["p"] == 0.3
    assert props["zone"] == "A"
