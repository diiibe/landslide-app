import os

import numpy as np
import pandas as pd
import pytest

from pipelines.loader import load_cells_gpkg

GPKG = os.path.expanduser(
    "~/Coding/ml-landslide-mapping-audit/docs/audit_results/phase_j2/phase_j2_zones_fvg_map.gpkg"
)


@pytest.mark.skipif(not os.path.exists(GPKG), reason="audit repo not available")
def test_load_cells_gpkg_returns_676416_rows_in_32632():
    gdf = load_cells_gpkg(GPKG, layer="cells_by_zone")
    assert len(gdf) == 676416
    assert gdf.crs.to_epsg() == 32633  # actual source CRS of phase_j2 gpkg
    assert "geometry" in gdf.columns
