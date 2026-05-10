from pathlib import Path

import geopandas as gpd
import pandas as pd


def load_cells_gpkg(path: str | Path, layer: str = "cells_by_zone") -> gpd.GeoDataFrame:
    """Load a GeoPackage layer as a GeoDataFrame. Keeps the source CRS."""
    return gpd.read_file(path, layer=layer)


def attach_probabilities(
    cells: gpd.GeoDataFrame, probs: pd.DataFrame
) -> gpd.GeoDataFrame:
    """Join probabilities onto cells by `cell_id`, returning
    `cell_id, p, macro_zone, sub_zone, y_true, geometry`. CRS preserved.

    The cells GPKG is the canonical source for zone labels (`macro_zone`,
    `sub_zone`); the bootstrap-OOF parquet is a derived artefact and may
    carry stale labels. Therefore, when both sides have the same column,
    cells wins. We achieve this by carrying any zone columns already
    present on `cells` into the merge and only pulling them from `probs`
    if they are absent on the cells side.
    """
    canonical_cols = ["macro_zone", "sub_zone"]
    keep_from_cells = ["cell_id", "geometry"] + [
        c for c in canonical_cols if c in cells.columns
    ]
    # Pull from probs only what cells does not already provide.
    needed_from_probs = ["cell_id", "y_proba_calibrated", "y_true"] + [
        c for c in canonical_cols if c not in cells.columns
    ]
    probs_cols = [c for c in needed_from_probs if c in probs.columns]
    out = cells[keep_from_cells].merge(probs[probs_cols], on="cell_id", how="left")
    out = out.rename(columns={"y_proba_calibrated": "p"})
    out = gpd.GeoDataFrame(out, geometry="geometry", crs=cells.crs)
    return out


def drop_na_and_reproject(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Drop rows where `p` is NaN, then reproject to EPSG:4326."""
    filtered = gdf[gdf["p"].notna()].copy()
    return filtered.to_crs("EPSG:4326")
