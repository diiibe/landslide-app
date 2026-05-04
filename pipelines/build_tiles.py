"""Build PMTiles for J.2, J.3 or IFFI from the ml-landslide-mapping-audit repo.

Usage:
    python -m pipelines.build_tiles j2  --src-dir ../ml-landslide-mapping-audit --out-dir public/tiles
    python -m pipelines.build_tiles j3  --src-dir ../ml-landslide-mapping-audit --out-dir public/tiles
    python -m pipelines.build_tiles iffi --src-dir ../ml-landslide-mapping-audit --out-dir public/tiles

Pipeline:
    1. Load `.gpkg` cells (J.2 / J.3) or IFFI GeoJSON.
    2. Attach `y_proba_calibrated` from the bootstrap OOF parquet (cells only).
    3. Drop NaN probabilities; reproject to EPSG:4326.
    4. Spatial join with IFFI polygons to set `iffi_hit` (cells only).
    5. Export slim GeoJSON.
    6. Shell out to `tippecanoe` to convert GeoJSON → `.pmtiles`.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import geopandas as gpd
import pandas as pd

from pipelines.exporter import export_geojson
from pipelines.loader import attach_probabilities, drop_na_and_reproject, load_cells_gpkg
from pipelines.spatial import compute_iffi_hit

PHASES = {
    "j2": ("phase_j2/phase_j2_zones_fvg_map.gpkg", "phase_j2/phase_j2_bootstrap_oof.parquet"),
    "j3": ("phase_j3/phase_j3_zones_fvg_map.gpkg", "phase_j3/phase_j3_bootstrap_oof.parquet"),
}
IFFI_PATH = "data/historical_data/frane_poly_friuli-venezia-giulia_opendata.json"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("which", choices=["j2", "j3", "iffi"])
    p.add_argument("--src-dir", required=True, help="Path to ml-landslide-mapping-audit repo")
    p.add_argument("--out-dir", required=True, help="Path to public/tiles")
    p.add_argument(
        "--min-zoom",
        type=int,
        default=6,
        help="Minimum zoom for tippecanoe (default 6)",
    )
    p.add_argument(
        "--max-zoom",
        type=int,
        default=14,
        help="Maximum zoom for tippecanoe (default 14)",
    )
    return p.parse_args(argv)


def build_cells(which: str, src_dir: Path, out_dir: Path) -> tuple[Path, Path]:
    """Generate two artefacts per model:
    * `<which>.geojson` — polygon cells with p, zone, sub_zone, iffi_hit
    * `centroids_<which>.geojson` — same data but Point geometry at each
      centroid, used by the MapLibre `heatmap` layer.
    """
    gpkg_rel, parquet_rel = PHASES[which]
    audit = src_dir / "docs" / "audit_results"
    cells = load_cells_gpkg(audit / gpkg_rel)
    probs = pd.read_parquet(audit / parquet_rel)
    cells = attach_probabilities(cells, probs)
    cells = drop_na_and_reproject(cells)
    iffi = gpd.read_file(src_dir / IFFI_PATH).to_crs("EPSG:4326")
    cells = compute_iffi_hit(cells, iffi)

    geojson = out_dir / f"{which}.geojson"
    export_geojson(cells, geojson)

    # Centroids — Point geometry per cell, same attributes minus iffi_hit
    # (heatmap layer uses `p` only). Compute centroid in a projected CRS
    # (EPSG:3857) to silence the geographic-CRS warning, then reproject back.
    centroids = cells.copy()
    centroids["geometry"] = centroids.geometry.to_crs("EPSG:3857").centroid.to_crs("EPSG:4326")
    centroids_path = out_dir / f"centroids_{which}.geojson"
    export_geojson(centroids, centroids_path)
    return geojson, centroids_path


def build_iffi(src_dir: Path, out_dir: Path) -> Path:
    iffi = gpd.read_file(src_dir / IFFI_PATH).to_crs("EPSG:4326")
    out = out_dir / "iffi.geojson"
    keep = [
        c
        for c in ["id_frana", "tipo_movimento", "nome_tipo", "comune", "provincia"]
        if c in iffi.columns
    ]
    slim = iffi[keep + ["geometry"]]
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    slim.to_file(out, driver="GeoJSON")
    return out


def run_tippecanoe(
    geojson: Path, pmtiles: Path, min_zoom: int, max_zoom: int, layer_name: str
) -> None:
    cmd = [
        "tippecanoe",
        "-o",
        str(pmtiles),
        "--force",
        "-l",
        layer_name,
        "-Z",
        str(min_zoom),
        "-z",
        str(max_zoom),
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        str(geojson),
    ]
    subprocess.run(cmd, check=True)


def main(argv: list[str] | None = None) -> None:
    ns = parse_args(argv)
    src_dir = Path(ns.src_dir).expanduser()
    out_dir = Path(ns.out_dir).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    if ns.which == "iffi":
        geojson = build_iffi(src_dir, out_dir)
        pmtiles = out_dir / "iffi.pmtiles"
        run_tippecanoe(geojson, pmtiles, ns.min_zoom, ns.max_zoom, "iffi")
        print(f"Wrote {pmtiles}")
    else:
        geojson, centroids_geojson = build_cells(ns.which, src_dir, out_dir)
        pmtiles = out_dir / f"{ns.which}.pmtiles"
        run_tippecanoe(geojson, pmtiles, ns.min_zoom, ns.max_zoom, "cells")
        print(f"Wrote {pmtiles}")
        # Centroids: heatmap reads at moderate zoom; tile small.
        centroids_pmtiles = out_dir / f"centroids_{ns.which}.pmtiles"
        run_tippecanoe(centroids_geojson, centroids_pmtiles, ns.min_zoom, ns.max_zoom, "centroids")
        print(f"Wrote {centroids_pmtiles}")


if __name__ == "__main__":
    main()
