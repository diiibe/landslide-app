import os

import numpy as np
import pandas as pd
import pytest

from pipelines.loader import attach_probabilities, drop_na_and_reproject, load_cells_gpkg

GPKG = os.path.expanduser(
    "~/Coding/ml-landslide-mapping-audit/docs/audit_results/phase_j2/phase_j2_zones_fvg_map.gpkg"
)


@pytest.mark.skipif(not os.path.exists(GPKG), reason="audit repo not available")
def test_load_cells_gpkg_returns_676416_rows_in_32632():
    gdf = load_cells_gpkg(GPKG, layer="cells_by_zone")
    assert len(gdf) == 676416
    assert gdf.crs.to_epsg() == 32633  # actual source CRS of phase_j2 gpkg
    assert "geometry" in gdf.columns


def test_attach_probabilities_joins_on_cell_id():
    import geopandas as gpd
    from shapely.geometry import Point

    cells = gpd.GeoDataFrame(
        {"cell_id": [0, 1, 2]},
        geometry=[Point(0, 0), Point(1, 0), Point(2, 0)],
        crs="EPSG:32632",
    )
    probs = pd.DataFrame(
        {
            "cell_id": [0, 1, 2],
            "y_proba_calibrated": [0.1, 0.5, 0.9],
            "macro_zone": ["A", "B", "A"],
            "sub_zone": ["A0", "B1", "A2"],
            "y_true": [0, 1, 1],
        }
    )
    out = attach_probabilities(cells, probs)
    assert list(out["p"]) == [0.1, 0.5, 0.9]
    assert list(out["macro_zone"]) == ["A", "B", "A"]
    assert list(out["sub_zone"]) == ["A0", "B1", "A2"]
    assert list(out["y_true"]) == [0, 1, 1]
    assert out.crs.to_epsg() == 32632


def test_attach_probabilities_cells_zone_labels_win_on_disagreement():
    """Cells GPKG is the canonical source for zone labels. If `probs` carries
    a stale/different `macro_zone` (or `sub_zone`) for the same `cell_id`,
    the cells' value must be preserved end-to-end.

    Regression for P2.8 / Test gap #4 in docs/AUDIT.md.
    """
    import geopandas as gpd
    from shapely.geometry import Point

    cells = gpd.GeoDataFrame(
        {
            "cell_id": [0, 1, 2],
            "macro_zone": ["A", "A", "A"],
            "sub_zone": ["A0", "A1", "A2"],
        },
        geometry=[Point(0, 0), Point(1, 0), Point(2, 0)],
        crs="EPSG:32632",
    )
    probs = pd.DataFrame(
        {
            "cell_id": [0, 1, 2],
            "y_proba_calibrated": [0.1, 0.5, 0.9],
            # Intentional disagreement: probs has stale zone labels.
            "macro_zone": ["B", "B", "B"],
            "sub_zone": ["B0", "B1", "B2"],
            "y_true": [0, 1, 1],
        }
    )
    out = attach_probabilities(cells, probs)
    assert list(out["macro_zone"]) == ["A", "A", "A"], (
        "cells' macro_zone (canonical) must win over probs"
    )
    assert list(out["sub_zone"]) == ["A0", "A1", "A2"], (
        "cells' sub_zone (canonical) must win over probs"
    )
    # Probabilities still flow through.
    assert list(out["p"]) == [0.1, 0.5, 0.9]
    assert list(out["y_true"]) == [0, 1, 1]


def test_drop_na_and_reproject_to_wgs84():
    import geopandas as gpd
    from shapely.geometry import Point

    gdf = gpd.GeoDataFrame(
        {
            "cell_id": [0, 1, 2],
            "p": [0.1, np.nan, 0.9],
            "macro_zone": ["A", "B", "A"],
            "sub_zone": ["A0", "B0", "A1"],
            "y_true": [0, 1, 1],
        },
        geometry=[Point(330000, 5100000), Point(330001, 5100000), Point(330002, 5100000)],
        crs="EPSG:32632",
    )
    out = drop_na_and_reproject(gdf)
    assert len(out) == 2
    assert out.crs.to_epsg() == 4326
    assert set(out["cell_id"]) == {0, 2}
