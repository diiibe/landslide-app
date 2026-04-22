from pathlib import Path

import geopandas as gpd

KEEP = ["cell_id", "p", "macro_zone", "sub_zone", "iffi_hit"]
RENAME = {"macro_zone": "zone"}


def export_geojson(gdf: gpd.GeoDataFrame, out: str | Path) -> None:
    """Export a minimal GeoJSON FeatureCollection with only the fields the
    frontend needs: cell_id, p (float), zone, sub_zone, iffi_hit."""
    cols = [c for c in KEEP if c in gdf.columns]
    slim = gdf[cols + ["geometry"]].rename(columns=RENAME)
    if "p" in slim.columns:
        slim = slim.copy()
        slim["p"] = slim["p"].astype("float32").round(3)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    slim.to_file(out, driver="GeoJSON")
