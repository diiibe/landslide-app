import geopandas as gpd


def compute_iffi_hit(
    cells: gpd.GeoDataFrame, iffi: gpd.GeoDataFrame
) -> gpd.GeoDataFrame:
    """Return `cells` with a boolean `iffi_hit` column: True iff the cell
    intersects at least one IFFI polygon. Both inputs must share CRS."""
    if cells.crs != iffi.crs:
        raise ValueError(f"CRS mismatch: {cells.crs} vs {iffi.crs}")
    joined = gpd.sjoin(cells, iffi[["geometry"]], how="left", predicate="intersects")
    hit_ids = set(joined.dropna(subset=["index_right"])["cell_id"])
    out = cells.copy()
    out["iffi_hit"] = out["cell_id"].isin(hit_ids)
    return out
