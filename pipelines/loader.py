from pathlib import Path

import geopandas as gpd
import pandas as pd


def load_cells_gpkg(path: str | Path, layer: str = "cells_by_zone") -> gpd.GeoDataFrame:
    """Load a GeoPackage layer as a GeoDataFrame. Keeps the source CRS."""
    return gpd.read_file(path, layer=layer)


def attach_probabilities(
    cells: gpd.GeoDataFrame, probs: pd.DataFrame
) -> gpd.GeoDataFrame:
    """Join probabilities onto cells by `cell_id`, returning only
    `cell_id, p, macro_zone, sub_zone, y_true, geometry`. CRS preserved."""
    cols = ["cell_id", "y_proba_calibrated", "macro_zone", "sub_zone", "y_true"]
    out = cells[["cell_id", "geometry"]].merge(probs[cols], on="cell_id", how="left")
    out = out.rename(columns={"y_proba_calibrated": "p"})
    out = gpd.GeoDataFrame(out, geometry="geometry", crs=cells.crs)
    return out


def drop_na_and_reproject(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Drop rows where `p` is NaN, then reproject to EPSG:4326."""
    filtered = gdf[gdf["p"].notna()].copy()
    return filtered.to_crs("EPSG:4326")
