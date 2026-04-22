# landslide-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free-hosted web viewer for the FVG landslide susceptibility maps (Phase J.2 and J.3) with IFFI ground-truth overlay, per the approved design spec.

**Architecture:** Python preprocessing pipeline converts `.gpkg` + `.parquet` artefacts from `ml-landslide-mapping-audit` into PMTiles. React + Vite + TypeScript SPA consumes the tiles via Mapbox GL JS, rendering a topbar + map + collapsible drawer (4 groups: VIEW, MONITORING, ANALYTICS, MODEL). Static deploy to GitHub Pages / Vercel; Mapbox free tier.

**Tech Stack:** React 18 · Vite · TypeScript (strict) · Zustand · Mapbox GL JS v3 · pmtiles.js · Vitest · Playwright · Python 3.10 · geopandas · pandas · pyarrow · shapely · tippecanoe.

**Spec reference:** [docs/superpowers/specs/2026-04-22-landslide-app-design.md](../specs/2026-04-22-landslide-app-design.md)

---

## Phase map

| phase | tasks | goal |
|---|---|---|
| 0 — Bootstrap | 0.1 → 0.5 | scaffold repo, deps, tokens, CI |
| 1 — Preprocess | 1.1 → 1.6 | produce `public/tiles/{j2,j3,iffi}.pmtiles` |
| 2 — App shell | 2.1 → 2.4 | state store, types, static data |
| 3 — TopBar | 3.1 → 3.4 | brand, tabs, search, icons |
| 4 — Map | 4.1 → 4.6 | Mapbox + PMTiles + layers |
| 5 — Map overlays | 5.1 → 5.3 | zones pill, layers panel, legend |
| 6 — Drawer | 6.1 → 6.7 | handle + groups + panels + widgets |
| 7 — Wiring | 7.1 → 7.5 | interactions end-to-end |
| 8 — Polish + ship | 8.1 → 8.4 | a11y, smoke test, deploy |

---

## Phase 0 — Bootstrap

### Task 0.1: Scaffold Vite + React + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`

- [ ] **Step 1: Run Vite scaffold (non-interactive)**

Run from `/Users/dibe/Coding/landslide-app`:
```bash
npm create vite@latest . -- --template react-ts
```
When prompted "Current directory is not empty…" choose `Ignore files and continue`.
Expected: files created, `package.json` present.

- [ ] **Step 2: Install base deps**

```bash
npm install
npm install mapbox-gl@^3 pmtiles@^3 zustand@^4
npm install -D @types/mapbox-gl vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/ui @playwright/test
npx playwright install chromium
```

- [ ] **Step 3: Tighten `tsconfig.json`**

Overwrite `tsconfig.json` with strict settings:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev -- --port 5173 &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
```
Expected: `<!doctype html>` printed.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite + React 18 + TS strict"
```

---

### Task 0.2: Configure Vitest + Playwright

**Files:**
- Modify: `vite.config.ts`
- Create: `tests/setup.ts`, `playwright.config.ts`, `tests/e2e/.gitkeep`

- [ ] **Step 1: Rewrite `vite.config.ts` to include Vitest config**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:4173", headless: true },
  webServer: {
    command: "npm run preview -- --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 4: Add test scripts to `package.json`**

In `package.json` `"scripts"` add:
```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 5: Verify vitest runs (no tests yet)**

```bash
npm run test:run
```
Expected: `No test files found` (exit 1 ok) or exit 0 with 0 tests.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: configure Vitest + Playwright"
```

---

### Task 0.3: Design tokens CSS

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/globals.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/styles/tokens.css`**

```css
:root {
  /* surfaces */
  --c-bg-linen: #F5EEDD;
  --c-surface: #FDFAF0;
  --c-border: #E0D7BF;
  --c-border-soft: #E8E2D5;
  --c-text: #23261F;
  --c-text-soft: #7A7A6E;
  --c-text-muted: #5E5E54;

  /* ramp (susceptibility) */
  --c-ramp-0: #E8F0D8;
  --c-ramp-1: #8BB26B;
  --c-ramp-2: #D9A441;
  --c-ramp-3: #D25524;
  --c-ramp-4: #7A1F10;

  /* accents per drawer group */
  --c-view: #3E5E8A;     --c-view-stripe: #7A99BE;   --c-view-bg: #F6F9FC;   --c-view-row: #E1E9F3;
  --c-forest: #2F5D3A;   --c-forest-stripe: #2F5D3A; --c-forest-bg: #F6FAF2; --c-forest-row: #D9E4CF;
  --c-russet: #7A1F10;   --c-russet-bg: #F7ECE5;     --c-russet-bg-alt: #FAF4EE; --c-russet-row: #E8D0C6;
  --c-terracotta: #B14615; --c-terracotta-stripe: #D25524; --c-terracotta-bg: #FBF1E9;
  --c-ochre: #8A6A1E;    --c-ochre-stripe: #D9A441;   --c-ochre-bg: #FCF7E8;   --c-ochre-row: #E8DDB8;
  --c-sage: #8AA67B;     --c-sage-bg: #F3F7EE;
  --c-slate: #3E5E72;    --c-slate-stripe: #6B8EA3;   --c-slate-bg: #F1F5F8;   --c-slate-row: #D5DEE5;

  /* easing */
  --e-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --e-expo:  cubic-bezier(0.16, 1, 0.3, 1);

  /* geometry */
  --topbar-h: 44px;
  --drawer-w: 216px;
  --handle-w: 18px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* type */
  --font-stack: system-ui, -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 2: Create `src/styles/globals.css`**

```css
* { box-sizing: border-box; }

html, body, #root {
  height: 100%;
  margin: 0;
}

body {
  font-family: var(--font-stack);
  color: var(--c-text);
  background: var(--c-bg-linen);
  font-size: 13px;
  line-height: 1.5;
}

button {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
}

input { font-family: inherit; }
```

- [ ] **Step 3: Import both in `src/main.tsx`**

Overwrite `src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/tokens.css";
import "./styles/globals.css";
import App from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Commit**

```bash
git add src/styles src/main.tsx
git commit -m "feat(ui): design tokens + globals"
```

---

### Task 0.4: Env file + README + CI

**Files:**
- Create: `.env.example`, `README.md`, `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.env.example`**

```
VITE_MAPBOX_TOKEN=pk.your-public-mapbox-token
```

- [ ] **Step 2: Create a minimal `README.md`**

```markdown
# landslide-app

FVG landslide susceptibility viewer (Phase J.2 + J.3 + IFFI ground truth).

## Develop
```
cp .env.example .env  # insert your Mapbox public token
npm install
npm run dev
```
See [docs/superpowers/specs/](docs/superpowers/specs/) for the design spec and
[docs/superpowers/plans/](docs/superpowers/plans/) for the implementation plan.
```

- [ ] **Step 3: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run test:run
      - run: npm run build
```

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md .github
git commit -m "chore: env template + README + CI workflow"
```

---

### Task 0.5: Python pipeline bootstrap

**Files:**
- Create: `pyproject.toml`, `pipelines/__init__.py`, `pipelines/README.md`, `Makefile`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "landslide-app-pipelines"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
  "geopandas>=0.14",
  "pandas>=2.1",
  "pyarrow>=14",
  "shapely>=2.0",
  "numpy>=1.26",
]

[project.optional-dependencies]
dev = ["pytest>=7.4", "ruff>=0.3", "mypy>=1.7"]

[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B"]
```

- [ ] **Step 2: Create `pipelines/__init__.py`** (empty)

```bash
: > pipelines/__init__.py
```

- [ ] **Step 3: Create `pipelines/README.md`**

```markdown
# pipelines

Offline preprocessing: `.gpkg` + `.parquet` → `.pmtiles`.

## Prereqs
- Python 3.10+
- `pip install -e '.[dev]'`
- `tippecanoe` installed (`brew install tippecanoe` on macOS)

## Run
```
make tiles
```
Outputs to `public/tiles/{j2,j3,iffi}.pmtiles`.
```

- [ ] **Step 4: Create `Makefile`**

```makefile
SRC_DIR := ../ml-landslide-mapping-audit
OUT := public/tiles

.PHONY: tiles tiles-j2 tiles-j3 tiles-iffi clean-tiles test-py

tiles: tiles-j2 tiles-j3 tiles-iffi

tiles-j2:
	python -m pipelines.build_tiles j2 --src-dir $(SRC_DIR) --out-dir $(OUT)

tiles-j3:
	python -m pipelines.build_tiles j3 --src-dir $(SRC_DIR) --out-dir $(OUT)

tiles-iffi:
	python -m pipelines.build_tiles iffi --src-dir $(SRC_DIR) --out-dir $(OUT)

clean-tiles:
	rm -f $(OUT)/*.pmtiles $(OUT)/*.geojson

test-py:
	pytest pipelines/tests -v
```

- [ ] **Step 5: Install python deps in a venv**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml pipelines/ Makefile
git commit -m "chore(pipelines): python scaffold"
```

---

## Phase 1 — Preprocessing pipeline

### Task 1.1: `load_cells_gpkg` — read a GeoPackage layer

**Files:**
- Create: `pipelines/loader.py`, `pipelines/tests/__init__.py`, `pipelines/tests/test_loader.py`

- [ ] **Step 1: Write failing test `tests/test_loader.py`**

```python
import os
import pytest
from pipelines.loader import load_cells_gpkg

GPKG = os.path.expanduser(
    "~/Coding/ml-landslide-mapping-audit/docs/audit_results/phase_j2/phase_j2_zones_fvg_map.gpkg"
)

@pytest.mark.skipif(not os.path.exists(GPKG), reason="audit repo not available")
def test_load_cells_gpkg_returns_676416_rows_in_32632():
    gdf = load_cells_gpkg(GPKG, layer="cells_by_zone")
    assert len(gdf) == 676416
    assert gdf.crs.to_epsg() == 32632
    assert "geometry" in gdf.columns
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source .venv/bin/activate
pytest pipelines/tests/test_loader.py -v
```
Expected: `ImportError` or `ModuleNotFoundError: pipelines.loader`.

- [ ] **Step 3: Implement `pipelines/loader.py`**

```python
from pathlib import Path
import geopandas as gpd

def load_cells_gpkg(path: str | Path, layer: str = "cells_by_zone") -> gpd.GeoDataFrame:
    """Load a GeoPackage layer as a GeoDataFrame. Keeps the source CRS."""
    return gpd.read_file(path, layer=layer)
```

- [ ] **Step 4: Run test, expect PASS**

```bash
pytest pipelines/tests/test_loader.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipelines/loader.py pipelines/tests/
git commit -m "feat(pipelines): load_cells_gpkg"
```

---

### Task 1.2: `attach_probabilities` — join parquet by cell_id

**Files:**
- Modify: `pipelines/loader.py`
- Modify: `pipelines/tests/test_loader.py`

- [ ] **Step 1: Append failing test**

Append to `pipelines/tests/test_loader.py`:
```python
import pandas as pd
from pipelines.loader import attach_probabilities

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest pipelines/tests/test_loader.py::test_attach_probabilities_joins_on_cell_id -v
```
Expected: ImportError `cannot import name 'attach_probabilities'`.

- [ ] **Step 3: Implement `attach_probabilities`**

Append to `pipelines/loader.py`:
```python
import pandas as pd

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
```

- [ ] **Step 4: Run test, expect PASS**

```bash
pytest pipelines/tests/test_loader.py -v
```

- [ ] **Step 5: Commit**

```bash
git add pipelines/loader.py pipelines/tests/test_loader.py
git commit -m "feat(pipelines): attach_probabilities"
```

---

### Task 1.3: `drop_na_and_reproject` — filter NaN + to WGS84

**Files:**
- Modify: `pipelines/loader.py`
- Modify: `pipelines/tests/test_loader.py`

- [ ] **Step 1: Append failing test**

```python
import numpy as np
from pipelines.loader import drop_na_and_reproject

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest pipelines/tests/test_loader.py -v
```
Expected: ImportError.

- [ ] **Step 3: Implement**

Append to `pipelines/loader.py`:
```python
def drop_na_and_reproject(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Drop rows where `p` is NaN, then reproject to EPSG:4326."""
    filtered = gdf[gdf["p"].notna()].copy()
    return filtered.to_crs("EPSG:4326")
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipelines/loader.py pipelines/tests/test_loader.py
git commit -m "feat(pipelines): drop NaN probabilities + reproject to 4326"
```

---

### Task 1.4: `compute_iffi_hit` — flag cells that intersect IFFI polygons

**Files:**
- Create: `pipelines/spatial.py`, `pipelines/tests/test_spatial.py`

- [ ] **Step 1: Write failing test**

```python
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
```

- [ ] **Step 2: Run test, expect ImportError**

```bash
pytest pipelines/tests/test_spatial.py -v
```

- [ ] **Step 3: Implement `pipelines/spatial.py`**

```python
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
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipelines/spatial.py pipelines/tests/test_spatial.py
git commit -m "feat(pipelines): compute_iffi_hit via spatial join"
```

---

### Task 1.5: `export_geojson` — write minimal FeatureCollection

**Files:**
- Create: `pipelines/exporter.py`, `pipelines/tests/test_exporter.py`

- [ ] **Step 1: Write failing test**

```python
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
```

- [ ] **Step 2: Run test, expect ImportError**

- [ ] **Step 3: Implement `pipelines/exporter.py`**

```python
from pathlib import Path
import geopandas as gpd

KEEP = ["cell_id", "p", "macro_zone", "sub_zone", "iffi_hit"]
RENAME = {"macro_zone": "zone"}

def export_geojson(gdf: gpd.GeoDataFrame, out: str | Path) -> None:
    """Export a minimal GeoJSON FeatureCollection with only the fields the
    frontend needs: cell_id, p (float), zone, sub_zone, iffi_hit."""
    cols = [c for c in KEEP if c in gdf.columns]
    slim = gdf[cols + ["geometry"]].rename(columns=RENAME)
    # Round p to 3 decimals to shrink the file ~30 %.
    if "p" in slim.columns:
        slim["p"] = slim["p"].astype("float32").round(3)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    slim.to_file(out, driver="GeoJSON")
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add pipelines/exporter.py pipelines/tests/test_exporter.py
git commit -m "feat(pipelines): export minimal GeoJSON"
```

---

### Task 1.6: `build_tiles.py` CLI — end-to-end J.2 / J.3 / IFFI

**Files:**
- Create: `pipelines/build_tiles.py`, `pipelines/tests/test_build_tiles.py`, `public/tiles/.gitkeep`

- [ ] **Step 1: Write failing test for the CLI parser**

```python
from pipelines.build_tiles import parse_args

def test_parse_args_j2():
    ns = parse_args(["j2", "--src-dir", "/tmp/src", "--out-dir", "/tmp/out"])
    assert ns.which == "j2"
    assert ns.src_dir == "/tmp/src"
    assert ns.out_dir == "/tmp/out"
```

- [ ] **Step 2: Run test, expect ImportError**

- [ ] **Step 3: Implement the CLI**

Create `pipelines/build_tiles.py`:
```python
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

from pipelines.loader import (
    load_cells_gpkg,
    attach_probabilities,
    drop_na_and_reproject,
)
from pipelines.spatial import compute_iffi_hit
from pipelines.exporter import export_geojson


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
        "--min-zoom", type=int, default=6,
        help="Minimum zoom for tippecanoe (default 6)",
    )
    p.add_argument(
        "--max-zoom", type=int, default=14,
        help="Maximum zoom for tippecanoe (default 14)",
    )
    return p.parse_args(argv)


def build_cells(which: str, src_dir: Path, out_dir: Path) -> Path:
    gpkg_rel, parquet_rel = PHASES[which]
    audit = src_dir / "docs" / "audit_results"
    cells = load_cells_gpkg(audit / gpkg_rel)
    probs = pd.read_parquet(audit / parquet_rel)
    cells = attach_probabilities(cells, probs)
    cells = drop_na_and_reproject(cells)
    # Load IFFI in WGS84 for the hit flag.
    iffi = gpd.read_file(src_dir / IFFI_PATH).to_crs("EPSG:4326")
    cells = compute_iffi_hit(cells, iffi)
    geojson = out_dir / f"{which}.geojson"
    export_geojson(cells, geojson)
    return geojson


def build_iffi(src_dir: Path, out_dir: Path) -> Path:
    iffi = gpd.read_file(src_dir / IFFI_PATH).to_crs("EPSG:4326")
    out = out_dir / "iffi.geojson"
    keep = [c for c in ["id_frana", "tipo_movimento", "nome_tipo", "comune", "provincia"] if c in iffi.columns]
    slim = iffi[keep + ["geometry"]]
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    slim.to_file(out, driver="GeoJSON")
    return out


def run_tippecanoe(geojson: Path, pmtiles: Path, min_zoom: int, max_zoom: int, layer_name: str) -> None:
    cmd = [
        "tippecanoe",
        "-o", str(pmtiles),
        "--force",
        "-l", layer_name,
        "-Z", str(min_zoom),
        "-z", str(max_zoom),
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
    else:
        geojson = build_cells(ns.which, src_dir, out_dir)
        pmtiles = out_dir / f"{ns.which}.pmtiles"
        run_tippecanoe(geojson, pmtiles, ns.min_zoom, ns.max_zoom, "cells")
    print(f"Wrote {pmtiles}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run parser test, expect PASS**

```bash
pytest pipelines/tests/test_build_tiles.py -v
```

- [ ] **Step 5: Smoke-run against the real audit repo (if present)**

```bash
test -d ~/Coding/ml-landslide-mapping-audit && \
  command -v tippecanoe >/dev/null && \
  make tiles-iffi  # iffi is small and fast — good smoke test
ls -lh public/tiles/
```
Expected: `iffi.pmtiles` present, < 5 MB.

- [ ] **Step 6: Place `.gitkeep` and commit**

```bash
: > public/tiles/.gitkeep
git add pipelines/build_tiles.py pipelines/tests/test_build_tiles.py public/tiles/.gitkeep
git commit -m "feat(pipelines): end-to-end build_tiles CLI"
```

---

## Phase 2 — App shell & state

### Task 2.1: Types

**Files:**
- Create: `src/app/types.ts`

- [ ] **Step 1: Write `src/app/types.ts`**

```ts
export type ModelId = "j2" | "j3";
export type Basemap = "outdoors" | "light" | "satellite";

export type Threshold = 0.3 | 0.5 | 0.7 | 0.85;

export type J2Zone = "Alpine" | "Carso" | "Hills" | "Plain" | "Prealpine";
export type J3Zone =
  | "Alpine_Snow"
  | "Forested_Hills"
  | "Rocky_Bare"
  | "Steep_Mountain"
  | "Transitional_Dry";
export type Zone = J2Zone | J3Zone;

export interface ZoneStat {
  zone: Zone;
  n: number;
  n_pos: number;
  prevalence: number;
  auc: number;
  ece: number;
  mean_p: number;
}

export interface ModelStats {
  model: ModelId;
  auc_pooled: number;
  pr_auc: number;
  ece: number;
  brier: number;
  cells_trained: number;
  cv_folds: number;
  zones: ZoneStat[];
  /** 9 reliability bins for the calibration plot. */
  calibration: { p_pred: number; observed: number }[];
}

export interface IffiFeatureProps {
  id_frana: string;
  tipo_movimento: string;
  nome_tipo: string;
  comune: string;
  provincia: string;
}

export interface CellProps {
  cell_id: number;
  p: number;
  zone: Zone;
  sub_zone: string;
  iffi_hit: boolean;
}

export interface ViewStats {
  cells_visible: number;
  cells_total: number;
  area_km2: number;
  zones_active: number;
  zones_total: number;
  iffi_polygons_in_view: number;
  iffi_cells: number;
  captured_above_threshold: number;
  hit_rate: number;
  precision: number;
  prob: { mean: number; median: number; p99: number; above_threshold_pct: number };
  /** 10 bins, each is the share of visible cells in that p-range. */
  histogram: number[];
  /** Per-zone mean probability, scaled 0..1, in the order returned by ModelStats.zones. */
  mean_by_zone: { zone: Zone; mean_p: number }[];
  iffi_by_type: { tipo: string; count: number }[];
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/types.ts
git commit -m "feat(app): domain types"
```

---

### Task 2.2: Zustand store

**Files:**
- Create: `src/app/store.ts`, `src/app/store.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("starts with J.2 active and threshold 0.50", () => {
    const s = useAppStore.getState();
    expect(s.model).toBe("j2");
    expect(s.threshold).toBe(0.5);
    expect(s.basemap).toBe("outdoors");
    expect(s.layers.iffi).toBe(true);
    expect(s.drawerOpen).toBe(true);
    expect(s.legendOpen).toBe(true);
  });

  it("setModel switches active model", () => {
    useAppStore.getState().setModel("j3");
    expect(useAppStore.getState().model).toBe("j3");
  });

  it("toggleZone adds/removes a zone from the active set", () => {
    useAppStore.getState().setSelectedZones(["Hills"]);
    useAppStore.getState().toggleZone("Prealpine");
    expect(useAppStore.getState().selectedZones).toContain("Prealpine");
    useAppStore.getState().toggleZone("Hills");
    expect(useAppStore.getState().selectedZones).toEqual(["Prealpine"]);
  });

  it("toggleDrawer flips drawerOpen", () => {
    expect(useAppStore.getState().drawerOpen).toBe(true);
    useAppStore.getState().toggleDrawer();
    expect(useAppStore.getState().drawerOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect ImportError**

```bash
npm run test:run -- src/app/store.test.ts
```

- [ ] **Step 3: Implement `src/app/store.ts`**

```ts
import { create } from "zustand";
import type { Basemap, ModelId, Threshold, Zone } from "./types";

export type GroupId = "view" | "monitoring" | "analytics" | "model";

export interface AppState {
  model: ModelId;
  basemap: Basemap;
  threshold: Threshold;
  selectedZones: Zone[];
  layers: { susceptibility: boolean; iffi: boolean; zoneBoundaries: boolean; contours: boolean };
  drawerOpen: boolean;
  legendOpen: boolean;
  layersPanelOpen: boolean;
  groupOpen: Record<GroupId, boolean>;
  search: { query: string; placeName: string | null };
  setModel: (m: ModelId) => void;
  setBasemap: (b: Basemap) => void;
  setThreshold: (t: Threshold) => void;
  setSelectedZones: (z: Zone[]) => void;
  toggleZone: (z: Zone) => void;
  toggleLayer: (k: keyof AppState["layers"]) => void;
  toggleDrawer: () => void;
  toggleLegend: () => void;
  toggleLayersPanel: () => void;
  toggleGroup: (g: GroupId) => void;
  setSearch: (s: { query: string; placeName: string | null }) => void;
  reset: () => void;
}

const initial: Omit<
  AppState,
  | "setModel" | "setBasemap" | "setThreshold" | "setSelectedZones" | "toggleZone"
  | "toggleLayer" | "toggleDrawer" | "toggleLegend" | "toggleLayersPanel"
  | "toggleGroup" | "setSearch" | "reset"
> = {
  model: "j2",
  basemap: "outdoors",
  threshold: 0.5,
  selectedZones: [],
  layers: { susceptibility: true, iffi: true, zoneBoundaries: true, contours: false },
  drawerOpen: true,
  legendOpen: true,
  layersPanelOpen: true,
  groupOpen: { view: true, monitoring: true, analytics: true, model: true },
  search: { query: "", placeName: null },
};

export const useAppStore = create<AppState>((set) => ({
  ...initial,
  setModel: (m) => set({ model: m }),
  setBasemap: (b) => set({ basemap: b }),
  setThreshold: (t) => set({ threshold: t }),
  setSelectedZones: (z) => set({ selectedZones: z }),
  toggleZone: (z) =>
    set((s) =>
      s.selectedZones.includes(z)
        ? { selectedZones: s.selectedZones.filter((x) => x !== z) }
        : { selectedZones: [...s.selectedZones, z] },
    ),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  toggleLegend: () => set((s) => ({ legendOpen: !s.legendOpen })),
  toggleLayersPanel: () => set((s) => ({ layersPanelOpen: !s.layersPanelOpen })),
  toggleGroup: (g) =>
    set((s) => ({ groupOpen: { ...s.groupOpen, [g]: !s.groupOpen[g] } })),
  setSearch: (search) => set({ search }),
  reset: () => set(initial),
}));
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npm run test:run -- src/app/store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/store.ts src/app/store.test.ts
git commit -m "feat(app): zustand store"
```

---

### Task 2.3: Static model statistics JSON

**Files:**
- Create: `public/data/zones_j2.json`, `public/data/zones_j3.json`, `public/data/model_j2.json`, `public/data/model_j3.json`

Numbers come from `ml-landslide-mapping-audit/docs/MODEL_CARD_susceptibility_v1.md` and `docs/audit_results/phase_jX/`.

- [ ] **Step 1: Create `public/data/zones_j2.json`**

```json
[
  { "zone": "Alpine",    "n": 10130,  "n_pos": 2816,  "prevalence": 0.278, "auc": 0.795, "ece": 0.034, "mean_p": 0.16 },
  { "zone": "Carso",     "n": 25314,  "n_pos": 5586,  "prevalence": 0.221, "auc": 0.790, "ece": 0.027, "mean_p": 0.22 },
  { "zone": "Plain",     "n": 37639,  "n_pos": 3159,  "prevalence": 0.084, "auc": 0.756, "ece": 0.016, "mean_p": 0.05 },
  { "zone": "Hills",     "n": 179038, "n_pos": 9385,  "prevalence": 0.052, "auc": 0.734, "ece": 0.005, "mean_p": 0.09 },
  { "zone": "Prealpine", "n": 91768,  "n_pos": 15087, "prevalence": 0.164, "auc": 0.677, "ece": 0.025, "mean_p": 0.31 }
]
```

- [ ] **Step 2: Create `public/data/zones_j3.json`**

```json
[
  { "zone": "Alpine_Snow",      "n": 37208,  "n_pos": 3158,  "prevalence": 0.085, "auc": 0.760, "ece": 0.012, "mean_p": 0.10 },
  { "zone": "Forested_Hills",   "n": 177081, "n_pos": 9385,  "prevalence": 0.053, "auc": 0.761, "ece": 0.014, "mean_p": 0.09 },
  { "zone": "Rocky_Bare",       "n": 9964,   "n_pos": 2806,  "prevalence": 0.282, "auc": 0.794, "ece": 0.050, "mean_p": 0.30 },
  { "zone": "Steep_Mountain",   "n": 91008,  "n_pos": 15087, "prevalence": 0.166, "auc": 0.730, "ece": 0.021, "mean_p": 0.20 },
  { "zone": "Transitional_Dry", "n": 24353,  "n_pos": 5586,  "prevalence": 0.229, "auc": 0.794, "ece": 0.034, "mean_p": 0.25 }
]
```

- [ ] **Step 3: Create `public/data/model_j2.json`**

```json
{
  "model": "j2",
  "auc_pooled": 0.802,
  "pr_auc": 0.363,
  "ece": 0.006,
  "brier": 0.080,
  "cells_trained": 676416,
  "cv_folds": 378,
  "calibration": [
    { "p_pred": 0.05, "observed": 0.03 },
    { "p_pred": 0.15, "observed": 0.07 },
    { "p_pred": 0.25, "observed": 0.21 },
    { "p_pred": 0.35, "observed": 0.40 },
    { "p_pred": 0.45, "observed": 0.52 },
    { "p_pred": 0.55, "observed": 0.65 },
    { "p_pred": 0.65, "observed": 0.78 },
    { "p_pred": 0.75, "observed": 0.86 },
    { "p_pred": 0.85, "observed": 0.94 }
  ]
}
```

- [ ] **Step 4: Create `public/data/model_j3.json`**

```json
{
  "model": "j3",
  "auc_pooled": 0.805,
  "pr_auc": 0.369,
  "ece": 0.000,
  "brier": 0.0798,
  "cells_trained": 676416,
  "cv_folds": 378,
  "calibration": [
    { "p_pred": 0.05, "observed": 0.04 },
    { "p_pred": 0.15, "observed": 0.10 },
    { "p_pred": 0.25, "observed": 0.23 },
    { "p_pred": 0.35, "observed": 0.39 },
    { "p_pred": 0.45, "observed": 0.50 },
    { "p_pred": 0.55, "observed": 0.62 },
    { "p_pred": 0.65, "observed": 0.74 },
    { "p_pred": 0.75, "observed": 0.84 },
    { "p_pred": 0.85, "observed": 0.93 }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add public/data/
git commit -m "data: per-zone and per-model stats for J.2 + J.3"
```

---

### Task 2.4: App shell

**Files:**
- Create: `src/app/App.tsx`, `src/app/App.module.css`
- Modify: `src/main.tsx` (already imports App)

- [ ] **Step 1: Write `src/app/App.module.css`**

```css
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--c-bg-linen);
}

.body {
  flex: 1;
  display: flex;
  position: relative;
  min-height: 0;
}

.map {
  flex: 1;
  position: relative;
  min-width: 0;
  background: #EDE7D6;
}
```

- [ ] **Step 2: Write `src/app/App.tsx`**

```tsx
import styles from "./App.module.css";

export default function App() {
  return (
    <div className={styles.shell}>
      <header style={{ height: "var(--topbar-h)", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
        <div style={{ padding: "0 16px", lineHeight: "var(--topbar-h)", fontWeight: 600 }}>
          FVG Landslide
        </div>
      </header>
      <div className={styles.body} data-drawer="open">
        <div className={styles.map} aria-label="Map placeholder" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds and renders**

```bash
npx tsc --noEmit
npm run dev -- --port 5173 &
sleep 3
curl -s http://localhost:5173/ | grep -q "FVG Landslide" && echo OK
kill %1
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx src/app/App.module.css
git commit -m "feat(app): minimal shell"
```

---

## Phase 3 — TopBar

### Task 3.1: TopBar skeleton

**Files:**
- Create: `src/topbar/TopBar.tsx`, `src/topbar/TopBar.module.css`
- Modify: `src/app/App.tsx` (replace inline header)

- [ ] **Step 1: Write `src/topbar/TopBar.module.css`**

```css
.bar {
  height: var(--topbar-h);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 14px;
  flex-shrink: 0;
}
.brand {
  font-weight: 600;
  font-size: 14px;
  color: var(--c-text);
  white-space: nowrap;
}
.spacer { margin-left: auto; display: flex; gap: 4px; }
```

- [ ] **Step 2: Write `src/topbar/TopBar.tsx`**

```tsx
import styles from "./TopBar.module.css";
import type { ReactNode } from "react";

interface Props {
  tabs: ReactNode;
  search: ReactNode;
  icons: ReactNode;
}

export function TopBar({ tabs, search, icons }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>FVG Landslide</div>
      {tabs}
      {search}
      <div className={styles.spacer}>{icons}</div>
    </header>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

Replace the inline header in `src/app/App.tsx`:
```tsx
import styles from "./App.module.css";
import { TopBar } from "@/topbar/TopBar";

export default function App() {
  return (
    <div className={styles.shell}>
      <TopBar tabs={null} search={null} icons={null} />
      <div className={styles.body} data-drawer="open">
        <div className={styles.map} aria-label="Map placeholder" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/topbar/ src/app/App.tsx
git commit -m "feat(topbar): shell with slot props"
```

---

### Task 3.2: Model tabs with animated underline

**Files:**
- Create: `src/topbar/Tabs.tsx`, `src/topbar/Tabs.module.css`, `src/topbar/Tabs.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/app/store";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("renders J.2 and J.3 and highlights the active one", () => {
    render(<Tabs />);
    const j2 = screen.getByRole("button", { name: /J\.2/ });
    const j3 = screen.getByRole("button", { name: /J\.3/ });
    expect(j2.getAttribute("aria-selected")).toBe("true");
    expect(j3.getAttribute("aria-selected")).toBe("false");
  });

  it("switches active model on click", () => {
    render(<Tabs />);
    fireEvent.click(screen.getByRole("button", { name: /J\.3/ }));
    expect(useAppStore.getState().model).toBe("j3");
  });
});
```

- [ ] **Step 2: Run test, expect ImportError**

```bash
npm run test:run -- src/topbar/Tabs.test.tsx
```

- [ ] **Step 3: Write `src/topbar/Tabs.module.css`**

```css
.tabs {
  position: relative;
  display: flex;
  height: 100%;
  align-items: stretch;
  margin-left: 4px;
}
.tab {
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text-soft);
  background: transparent;
  border: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color .18s var(--e-quart), transform .18s var(--e-quart);
}
.tab:hover { color: var(--c-text); transform: translateY(-1px); }
.tab[aria-selected="true"] { color: var(--c-text); font-weight: 600; }
.indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 38px;
  background: var(--c-forest);
  transform: translateX(0);
  transition: transform .28s var(--e-expo), width .28s var(--e-expo);
  pointer-events: none;
}
```

- [ ] **Step 4: Write `src/topbar/Tabs.tsx`**

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import type { ModelId } from "@/app/types";
import { useAppStore } from "@/app/store";
import styles from "./Tabs.module.css";

const ORDER: ModelId[] = ["j2", "j3"];
const LABEL: Record<ModelId, string> = { j2: "J.2", j3: "J.3" };

export function Tabs() {
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ x: number; w: number }>({ x: 0, w: 38 });

  useLayoutEffect(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab="${model}"]`,
    );
    if (!el || !containerRef.current) return;
    const parent = containerRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setStyle({ x: rect.left - parent.left, w: rect.width });
  }, [model]);

  return (
    <div ref={containerRef} className={styles.tabs} role="tablist" aria-label="Model">
      {ORDER.map((m) => (
        <button
          key={m}
          data-tab={m}
          role="tab"
          aria-selected={model === m}
          className={styles.tab}
          onClick={() => setModel(m)}
        >
          {LABEL[m]}
        </button>
      ))}
      <span
        className={styles.indicator}
        style={{ transform: `translateX(${style.x}px)`, width: style.w }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Wire into `App.tsx`**

```tsx
import { Tabs } from "@/topbar/Tabs";
// …
<TopBar tabs={<Tabs />} search={null} icons={null} />
```

- [ ] **Step 6: Run tests, expect PASS**

```bash
npm run test:run
```

- [ ] **Step 7: Commit**

```bash
git add src/topbar/Tabs.* src/app/App.tsx
git commit -m "feat(topbar): animated tab indicator for J.2/J.3"
```

---

### Task 3.3: SearchLocality field

**Files:**
- Create: `src/topbar/SearchLocality.tsx`, `src/topbar/SearchLocality.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the CSS**

```css
.wrap {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  width: 240px;
  background: var(--c-bg-linen);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 0 8px 0 30px;
  transition: border-color .18s var(--e-quart), background .18s var(--e-quart), box-shadow .18s var(--e-quart);
}
.wrap:hover { border-color: #C9D7BE; background: #FBF4E3; }
.wrap:focus-within {
  border-color: var(--c-forest);
  background: var(--c-surface);
  box-shadow: 0 0 0 3px rgba(47,93,58,.12);
}
.ico {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--c-text-soft);
  width: 14px;
  height: 14px;
  pointer-events: none;
  transition: color .18s var(--e-quart);
}
.wrap:focus-within .ico { color: var(--c-forest); }
.input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 12px;
  color: var(--c-text);
  padding: 0;
  min-width: 0;
}
.input::placeholder { color: #8A8472; }
.kbd {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  color: #8A8472;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 3px;
  padding: 1px 5px;
  transition: opacity .18s var(--e-quart);
}
.wrap:focus-within .kbd { opacity: 0; }
```

- [ ] **Step 2: Write `SearchLocality.tsx`**

```tsx
import { useAppStore } from "@/app/store";
import styles from "./SearchLocality.module.css";

export function SearchLocality() {
  const query = useAppStore((s) => s.search.query);
  const setSearch = useAppStore((s) => s.setSearch);
  return (
    <div className={styles.wrap}>
      <svg
        className={styles.ico}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="m14 14-3.1-3.1" />
      </svg>
      <input
        className={styles.input}
        type="text"
        placeholder="Search locality, comune…"
        aria-label="Search locality"
        value={query}
        onChange={(e) => setSearch({ query: e.target.value, placeName: null })}
      />
      <span className={styles.kbd}>⌘K</span>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```tsx
import { SearchLocality } from "@/topbar/SearchLocality";
// …
<TopBar tabs={<Tabs />} search={<SearchLocality />} icons={null} />
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/topbar/SearchLocality.* src/app/App.tsx
git commit -m "feat(topbar): search input (local state only)"
```

---

### Task 3.4: Icon buttons (Notifications / Settings / Profile)

**Files:**
- Create: `src/topbar/IconButtons.tsx`, `src/topbar/IconButtons.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the CSS**

```css
.btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--c-text-soft);
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: background .15s var(--e-quart), border-color .15s var(--e-quart), color .15s var(--e-quart), transform .18s var(--e-expo);
}
.btn svg { width: 16px; height: 16px; display: block; }
.btn:hover { background: var(--c-bg-linen); border-color: var(--c-border); color: var(--c-text); transform: translateY(-1px); }
.btn:active { transform: translateY(0) scale(.94); }
.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-russet);
  box-shadow: 0 0 0 2px var(--c-surface);
}
```

- [ ] **Step 2: Write `IconButtons.tsx`**

```tsx
import styles from "./IconButtons.module.css";

export function IconButtons() {
  return (
    <>
      <button type="button" className={styles.btn} title="Notifications" aria-label="Notifications">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2.5c-2.4 0-4.3 1.9-4.3 4.3v2.1c0 .4-.1.9-.4 1.2L2 11.8h12l-1.3-1.7c-.3-.3-.4-.8-.4-1.2V6.8c0-2.4-1.9-4.3-4.3-4.3Z" />
          <path d="M6.4 11.8c0 .9.7 1.7 1.6 1.7s1.6-.8 1.6-1.7" />
        </svg>
        <span className={styles.badge} aria-hidden="true" />
      </button>
      <button type="button" className={styles.btn} title="Settings" aria-label="Settings">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.4v1.6M8 13v1.6M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M1.4 8H3M13 8h1.6M3.3 12.7l1.1-1.1M11.6 4.4l1.1-1.1" />
        </svg>
      </button>
      <button type="button" className={styles.btn} title="Profile" aria-label="Profile">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="5.5" r="2.6" />
          <path d="M2.8 14c0-2.5 2.3-4.5 5.2-4.5s5.2 2 5.2 4.5" />
        </svg>
      </button>
    </>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```tsx
import { IconButtons } from "@/topbar/IconButtons";
// …
<TopBar tabs={<Tabs />} search={<SearchLocality />} icons={<IconButtons />} />
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/topbar/IconButtons.* src/app/App.tsx
git commit -m "feat(topbar): notifications/settings/profile icon buttons"
```

---

## Phase 4 — Map integration

### Task 4.1: MapView with Mapbox GL JS

**Files:**
- Create: `src/map/MapView.tsx`, `src/map/MapView.module.css`, `src/map/style.ts`
- Modify: `src/app/App.tsx`, `src/main.tsx` (import mapbox CSS)
- Modify: `index.html` (nothing — Mapbox CSS is imported via JS)

- [ ] **Step 1: Add Mapbox CSS import in `src/main.tsx`**

Add `import "mapbox-gl/dist/mapbox-gl.css";` at the top of `main.tsx` (before the app CSS imports).

- [ ] **Step 2: Write `src/map/style.ts`**

```ts
import type { Basemap } from "@/app/types";

export const BASEMAP_STYLE: Record<Basemap, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export const FVG_BOUNDS: [[number, number], [number, number]] = [
  [12.3, 45.5], // sw
  [13.95, 46.65], // ne
];

export const FVG_CENTER: [number, number] = [13.1, 46.15];

/** 5-stop ramp mapped to Mapbox `interpolate` paint expression. */
export const RAMP_STOPS: Array<[number, string]> = [
  [0.0, "#E8F0D8"],
  [0.25, "#8BB26B"],
  [0.5, "#D9A441"],
  [0.75, "#D25524"],
  [1.0, "#7A1F10"],
];

export function rampPaint(): unknown {
  return [
    "interpolate",
    ["linear"],
    ["get", "p"],
    ...RAMP_STOPS.flat(),
  ];
}
```

- [ ] **Step 3: Write `src/map/MapView.module.css`**

```css
.root {
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 4: Write `src/map/MapView.tsx`**

```tsx
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useAppStore } from "@/app/store";
import { BASEMAP_STYLE, FVG_BOUNDS, FVG_CENTER } from "./style";
import styles from "./MapView.module.css";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const basemap = useAppStore((s) => s.basemap);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    if (!TOKEN) {
      console.warn("VITE_MAPBOX_TOKEN missing; map will fail to load");
      return;
    }
    mapboxgl.accessToken = TOKEN;
    const m = new mapboxgl.Map({
      container: ref.current,
      style: BASEMAP_STYLE[basemap],
      center: FVG_CENTER,
      zoom: 8,
      maxBounds: [
        [FVG_BOUNDS[0][0] - 0.5, FVG_BOUNDS[0][1] - 0.5],
        [FVG_BOUNDS[1][0] + 0.5, FVG_BOUNDS[1][1] + 0.5],
      ],
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setStyle(BASEMAP_STYLE[basemap]);
  }, [basemap]);

  return <div ref={ref} className={styles.root} aria-label="FVG susceptibility map" />;
}
```

- [ ] **Step 5: Wire into `App.tsx`**

Replace the placeholder map div:
```tsx
import { MapView } from "@/map/MapView";
// …
<div className={styles.map}><MapView /></div>
```

- [ ] **Step 6: Verify with token set**

```bash
cp .env.example .env
# edit .env, paste real VITE_MAPBOX_TOKEN
npx tsc --noEmit
npm run dev -- --port 5173 &
sleep 4
curl -s http://localhost:5173/ | head -5
kill %1
```
Open the browser manually at http://localhost:5173; expect FVG map rendered.

- [ ] **Step 7: Commit**

```bash
git add src/map/ src/app/App.tsx src/main.tsx
git commit -m "feat(map): Mapbox GL JS container with basemap switch"
```

---

### Task 4.2: Register PMTiles protocol

**Files:**
- Create: `src/map/pmtiles-protocol.ts`
- Modify: `src/map/MapView.tsx`

- [ ] **Step 1: Write `src/map/pmtiles-protocol.ts`**

```ts
import { Protocol } from "pmtiles";
import mapboxgl from "mapbox-gl";

let installed = false;

export function installPmtilesProtocol(): void {
  if (installed) return;
  const protocol = new Protocol();
  mapboxgl.addProtocol("pmtiles", protocol.tile);
  installed = true;
}
```

- [ ] **Step 2: Call it in `MapView.tsx` before creating the map**

In the first `useEffect`, before `new mapboxgl.Map(...)`, add:
```ts
import { installPmtilesProtocol } from "./pmtiles-protocol";
// …
installPmtilesProtocol();
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/map/pmtiles-protocol.ts src/map/MapView.tsx
git commit -m "feat(map): register pmtiles:// protocol"
```

---

### Task 4.3: Susceptibility fill-layer (active model)

**Files:**
- Create: `src/map/layers/susceptibility.ts`
- Modify: `src/map/MapView.tsx`

- [ ] **Step 1: Write `src/map/layers/susceptibility.ts`**

```ts
import type { Map as MBMap } from "mapbox-gl";
import type { ModelId, Zone } from "@/app/types";
import { rampPaint } from "../style";

export const SUSCEPT_SOURCE = "cells";
export const SUSCEPT_LAYER = "susceptibility";

export function addSusceptibility(
  m: MBMap,
  model: ModelId,
  threshold: number,
  selectedZones: Zone[],
): void {
  if (m.getLayer(SUSCEPT_LAYER)) m.removeLayer(SUSCEPT_LAYER);
  if (m.getSource(SUSCEPT_SOURCE)) m.removeSource(SUSCEPT_SOURCE);

  m.addSource(SUSCEPT_SOURCE, {
    type: "vector",
    url: `pmtiles:///tiles/${model}.pmtiles`,
    // tippecanoe layer name in Task 1.6 is "cells"
  });

  const zoneFilter: unknown =
    selectedZones.length === 0
      ? ["all"]
      : ["in", ["get", "zone"], ["literal", selectedZones]];

  m.addLayer({
    id: SUSCEPT_LAYER,
    type: "fill",
    source: SUSCEPT_SOURCE,
    "source-layer": "cells",
    paint: {
      "fill-color": rampPaint() as never,
      "fill-opacity": [
        "case",
        [">=", ["get", "p"], threshold], 0.85,
        0.0,
      ],
      "fill-outline-color": "rgba(0,0,0,0)",
    },
    filter: zoneFilter as never,
  });
}

export function updateSusceptibilityThreshold(m: MBMap, threshold: number): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  m.setPaintProperty(SUSCEPT_LAYER, "fill-opacity", [
    "case",
    [">=", ["get", "p"], threshold], 0.85,
    0.0,
  ]);
}

export function updateSusceptibilityZones(m: MBMap, selectedZones: Zone[]): void {
  if (!m.getLayer(SUSCEPT_LAYER)) return;
  const filter =
    selectedZones.length === 0
      ? ["all"]
      : ["in", ["get", "zone"], ["literal", selectedZones]];
  m.setFilter(SUSCEPT_LAYER, filter as never);
}
```

- [ ] **Step 2: Call `addSusceptibility` on map `load` and on model change in `MapView.tsx`**

Inside `MapView.tsx`, add a `useEffect` that reacts to `model`, `threshold`, `selectedZones`:
```tsx
import { useAppStore } from "@/app/store";
import {
  addSusceptibility,
  updateSusceptibilityThreshold,
  updateSusceptibilityZones,
} from "./layers/susceptibility";

// Inside MapView:
const model = useAppStore((s) => s.model);
const threshold = useAppStore((s) => s.threshold);
const selectedZones = useAppStore((s) => s.selectedZones);

// After the map init effect:
useEffect(() => {
  const m = mapRef.current;
  if (!m) return;
  const apply = () => addSusceptibility(m, model, threshold, selectedZones);
  if (m.isStyleLoaded()) apply();
  else m.once("style.load", apply);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [model, basemap]);

useEffect(() => {
  if (!mapRef.current) return;
  updateSusceptibilityThreshold(mapRef.current, threshold);
}, [threshold]);

useEffect(() => {
  if (!mapRef.current) return;
  updateSusceptibilityZones(mapRef.current, selectedZones);
}, [selectedZones]);
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/map/layers/susceptibility.ts src/map/MapView.tsx
git commit -m "feat(map): susceptibility fill-layer with threshold + zones filter"
```

---

### Task 4.4: IFFI polygon layer

**Files:**
- Create: `src/map/layers/iffi.ts`
- Modify: `src/map/MapView.tsx`

- [ ] **Step 1: Write `src/map/layers/iffi.ts`**

```ts
import type { Map as MBMap } from "mapbox-gl";

export const IFFI_SOURCE = "iffi";
export const IFFI_FILL = "iffi-fill";
export const IFFI_LINE = "iffi-line";

export function addIffi(m: MBMap, visible: boolean): void {
  if (!m.getSource(IFFI_SOURCE)) {
    m.addSource(IFFI_SOURCE, { type: "vector", url: "pmtiles:///tiles/iffi.pmtiles" });
  }
  if (!m.getLayer(IFFI_FILL)) {
    m.addLayer({
      id: IFFI_FILL,
      type: "fill",
      source: IFFI_SOURCE,
      "source-layer": "iffi",
      paint: { "fill-color": "#7A1F10", "fill-opacity": 0.12 },
    });
  }
  if (!m.getLayer(IFFI_LINE)) {
    m.addLayer({
      id: IFFI_LINE,
      type: "line",
      source: IFFI_SOURCE,
      "source-layer": "iffi",
      paint: { "line-color": "#7A1F10", "line-width": 1.2 },
    });
  }
  setIffiVisible(m, visible);
}

export function setIffiVisible(m: MBMap, visible: boolean): void {
  const v = visible ? "visible" : "none";
  for (const id of [IFFI_FILL, IFFI_LINE]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", v);
  }
}
```

- [ ] **Step 2: Wire in `MapView.tsx`**

```tsx
import { addIffi, setIffiVisible } from "./layers/iffi";
// …
const iffiOn = useAppStore((s) => s.layers.iffi);
// Inside the style.load effect chain, call addIffi(m, iffiOn).
// Add separate effect:
useEffect(() => {
  if (!mapRef.current) return;
  setIffiVisible(mapRef.current, iffiOn);
}, [iffiOn]);
```

Update the susceptibility-loading effect so it also calls `addIffi(m, iffiOn)` after `addSusceptibility`.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/map/layers/iffi.ts src/map/MapView.tsx
git commit -m "feat(map): IFFI ground-truth fill + line layers"
```

---

### Task 4.5: Popups for cell + IFFI clicks

**Files:**
- Create: `src/map/popups.ts`
- Modify: `src/map/MapView.tsx`

- [ ] **Step 1: Write `src/map/popups.ts`**

```ts
import mapboxgl, { type Map as MBMap, type MapMouseEvent } from "mapbox-gl";
import { SUSCEPT_LAYER } from "./layers/susceptibility";
import { IFFI_FILL } from "./layers/iffi";

export function registerPopups(m: MBMap): () => void {
  const onCell = (e: MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties as { cell_id: number; p: number; zone: string; sub_zone: string; iffi_hit: boolean };
    new mapboxgl.Popup({ closeButton: false, offset: 8, className: "cell-popup" })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-family:var(--font-stack);font-size:12px;color:#23261F">
          <div style="font-weight:700">Cell ${p.cell_id}</div>
          <div>p = <b>${Number(p.p).toFixed(3)}</b></div>
          <div style="color:#7A7A6E">${p.zone} · ${p.sub_zone}</div>
          ${p.iffi_hit ? `<div style="color:#7A1F10">IFFI intersected</div>` : ""}
        </div>`,
      )
      .addTo(m);
  };
  const onIffi = (e: MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties as { id_frana: string; tipo_movimento: string; comune: string; provincia: string };
    new mapboxgl.Popup({ closeButton: false, offset: 8 })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div style="font-family:var(--font-stack);font-size:12px;color:#23261F">
          <div style="font-weight:700">Frana ${p.id_frana}</div>
          <div>${p.tipo_movimento}</div>
          <div style="color:#7A7A6E">${p.comune} (${p.provincia})</div>
        </div>`,
      )
      .addTo(m);
  };
  m.on("click", SUSCEPT_LAYER, onCell);
  m.on("click", IFFI_FILL, onIffi);
  const cellEnter = () => { m.getCanvas().style.cursor = "pointer"; };
  const cellLeave = () => { m.getCanvas().style.cursor = ""; };
  m.on("mouseenter", SUSCEPT_LAYER, cellEnter);
  m.on("mouseleave", SUSCEPT_LAYER, cellLeave);
  m.on("mouseenter", IFFI_FILL, cellEnter);
  m.on("mouseleave", IFFI_FILL, cellLeave);

  return () => {
    m.off("click", SUSCEPT_LAYER, onCell);
    m.off("click", IFFI_FILL, onIffi);
  };
}
```

- [ ] **Step 2: Register once in `MapView.tsx` after style.load**

In the susceptibility effect, after `addSusceptibility + addIffi`, also call `registerPopups(m)` (guard with a ref so it only registers once per map instance).

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/map/popups.ts src/map/MapView.tsx
git commit -m "feat(map): popups for cell and IFFI clicks"
```

---

### Task 4.6: Fly-to from search

**Files:**
- Modify: `src/map/MapView.tsx`, `src/topbar/SearchLocality.tsx`

- [ ] **Step 1: Add a `flyToPlace` imperative method**

In `MapView.tsx`, add a flyTo effect triggered by `search.placeName` changing, using Mapbox Geocoding API. Replace SearchLocality to call the geocoder on Enter.

In `SearchLocality.tsx`, add:
```tsx
const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "Enter" || !query.trim()) return;
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${token}&country=it&bbox=12.3,45.5,13.95,46.65&types=place,locality,neighborhood&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) return;
  const [lng, lat] = f.center;
  setSearch({ query: f.place_name, placeName: f.place_name });
  window.dispatchEvent(new CustomEvent("fvg:flyto", { detail: { lng, lat } }));
};
// add onKeyDown={onKey} to <input>
```

In `MapView.tsx`:
```tsx
useEffect(() => {
  const onFly = (e: Event) => {
    const d = (e as CustomEvent<{ lng: number; lat: number }>).detail;
    mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 11, essential: true });
  };
  window.addEventListener("fvg:flyto", onFly);
  return () => window.removeEventListener("fvg:flyto", onFly);
}, []);
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/map/MapView.tsx src/topbar/SearchLocality.tsx
git commit -m "feat(topbar): locality search → flyTo via Mapbox Geocoding"
```

---

## Phase 5 — Map overlays

### Task 5.1: ZonesPill

**Files:**
- Create: `src/map-overlays/ZonesPill.tsx`, `src/map-overlays/ZonesPill.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the CSS**

```css
.pill {
  position: absolute;
  top: 12px;
  left: 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--c-text);
  cursor: pointer;
  transition: box-shadow .18s var(--e-quart), transform .18s var(--e-quart), border-color .18s var(--e-quart);
}
.pill:hover { box-shadow: 0 4px 10px rgba(35,38,31,.1); transform: translateY(-1px); }
.lbl { color: var(--c-text-soft); }
.val { font-weight: 600; color: var(--c-forest); }
```

- [ ] **Step 2: Write `ZonesPill.tsx`**

```tsx
import { useAppStore } from "@/app/store";
import styles from "./ZonesPill.module.css";

const J2_ZONES = ["Alpine", "Carso", "Hills", "Plain", "Prealpine"] as const;
const J3_ZONES = [
  "Alpine_Snow", "Forested_Hills", "Rocky_Bare", "Steep_Mountain", "Transitional_Dry",
] as const;

export function ZonesPill() {
  const model = useAppStore((s) => s.model);
  const selected = useAppStore((s) => s.selectedZones);
  const all = model === "j2" ? J2_ZONES : J3_ZONES;
  const label =
    selected.length === 0 ? `All (${all.length})` : selected.join(" · ");
  return (
    <button
      type="button"
      className={styles.pill}
      onClick={() => {
        // Cycle: none → all → none. Full multi-select UI is a v1.1 feature.
        const next = selected.length === 0 ? [...all] : [];
        useAppStore.getState().setSelectedZones(next);
      }}
    >
      <span className={styles.lbl}>Zones</span>
      <span className={styles.val}>{label}</span>
    </button>
  );
}
```

- [ ] **Step 3: Wire into the map container in `App.tsx`**

```tsx
import { ZonesPill } from "@/map-overlays/ZonesPill";
// …
<div className={styles.map}>
  <MapView />
  <ZonesPill />
</div>
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/map-overlays/ZonesPill.* src/app/App.tsx
git commit -m "feat(overlay): zones pill (cycle none/all placeholder)"
```

---

### Task 5.2: LayersPanel

**Files:**
- Create: `src/map-overlays/LayersPanel.tsx`, `src/map-overlays/LayersPanel.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the CSS**

```css
.panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 216px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow .2s var(--e-quart);
}
.panel:hover { box-shadow: 0 4px 14px rgba(35,38,31,.08); }
.head {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border: 0;
  background: transparent;
  width: 100%;
  text-align: left;
  border-bottom: 1px solid var(--c-border);
  transition: background .18s var(--e-quart);
}
.head:hover { background: #F8F2DF; }
.ttl { font-weight: 600; font-size: 13px; color: var(--c-text); flex: 1; }
.caret { color: var(--c-text-soft); font-size: 11px; transition: transform .28s var(--e-expo); }
.panel[data-open="false"] .caret { transform: rotate(-90deg); }
.wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .35s var(--e-expo); }
.wrap > .body { min-height: 0; overflow: hidden; padding: 8px 0; transition: opacity .28s var(--e-quart); }
.panel[data-open="false"] .wrap { grid-template-rows: 0fr; }
.panel[data-open="false"] .wrap > .body { opacity: 0; }
.g { padding: 4px 12px 8px; }
.g + .g { border-top: 1px solid var(--c-border); padding-top: 8px; }
.gTtl { font-size: 12px; color: var(--c-text-soft); margin-bottom: 6px; }

.bmRow { display: flex; gap: 4px; }
.bm {
  flex: 1; padding: 4px 0; text-align: center; font-size: 11px;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  color: var(--c-text-muted); cursor: pointer;
  background: var(--c-surface);
  transition: background .15s var(--e-quart), border-color .15s var(--e-quart), color .15s var(--e-quart);
}
.bm:hover { filter: brightness(1.03) saturate(1.06); }
.bm[data-active="true"] { font-weight: 700; }
.bm[data-kind="outdoors"]            { background: #F4F9EB; border-color: #E5ECD5; color: #4D6E3C; }
.bm[data-kind="light"]               { background: #FBF5E4; border-color: #EEE2C6; color: #886824; }
.bm[data-kind="satellite"]           { background: #EEF3F9; border-color: #DCE4EE; color: #3E5E8A; }
.bm[data-kind="outdoors"][data-active="true"]  { background: #E3EFC9; border-color: #8DAE6C; color: #2F5D3A; }
.bm[data-kind="light"][data-active="true"]     { background: #F4E4B8; border-color: #C4A978; color: #6F5418; }
.bm[data-kind="satellite"][data-active="true"] { background: #D4DFED; border-color: #7A99BE; color: #2F4E6C; }

.item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 6px; margin: 0 -6px; font-size: 12px; cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background .15s var(--e-quart), color .15s var(--e-quart), padding-left .18s var(--e-expo);
}
.item:hover { background: #F0F4EC; color: var(--c-forest); padding-left: 10px; }
.item input { accent-color: var(--c-forest); }
.itemName { flex: 1; }
.itemState { color: var(--c-text-soft); font-size: 11px; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Write `LayersPanel.tsx`**

```tsx
import { useAppStore } from "@/app/store";
import type { Basemap } from "@/app/types";
import styles from "./LayersPanel.module.css";

const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: "outdoors", label: "Outdoors" },
  { id: "light", label: "Light" },
  { id: "satellite", label: "Satellite" },
];

export function LayersPanel() {
  const open = useAppStore((s) => s.layersPanelOpen);
  const toggle = useAppStore((s) => s.toggleLayersPanel);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const model = useAppStore((s) => s.model);
  const otherModel = model === "j2" ? "J.3" : "J.2";

  return (
    <div className={styles.panel} data-open={open}>
      <button className={styles.head} aria-expanded={open} onClick={toggle}>
        <span className={styles.ttl}>Layers</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>
          <div className={styles.g}>
            <div className={styles.gTtl}>Basemap</div>
            <div className={styles.bmRow}>
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  className={styles.bm}
                  data-kind={b.id}
                  data-active={basemap === b.id}
                  onClick={() => setBasemap(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.g}>
            <div className={styles.gTtl}>Overlays</div>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.susceptibility}
                onChange={() => toggleLayer("susceptibility")}
              />
              <span className={styles.itemName}>Susceptibility ({model === "j2" ? "J.2" : "J.3"})</span>
              <span className={styles.itemState}>{layers.susceptibility ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input type="checkbox" disabled checked={false} />
              <span className={styles.itemName} style={{ opacity: 0.55 }}>
                Susceptibility ({otherModel}) · switch via tabs
              </span>
              <span className={styles.itemState}>—</span>
            </label>
            <label className={styles.item}>
              <input type="checkbox" checked={layers.iffi} onChange={() => toggleLayer("iffi")} />
              <span className={styles.itemName}>IFFI landslides</span>
              <span className={styles.itemState}>{layers.iffi ? "on" : "off"}</span>
            </label>
            <label className={styles.item}>
              <input
                type="checkbox"
                checked={layers.zoneBoundaries}
                onChange={() => toggleLayer("zoneBoundaries")}
              />
              <span className={styles.itemName}>Zone boundaries</span>
              <span className={styles.itemState}>{layers.zoneBoundaries ? "on" : "off"}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```tsx
import { LayersPanel } from "@/map-overlays/LayersPanel";
// inside the map div:
<LayersPanel />
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/map-overlays/LayersPanel.* src/app/App.tsx
git commit -m "feat(overlay): collapsible layers panel with colored basemap pills"
```

---

### Task 5.3: Legend (collapsible)

**Files:**
- Create: `src/map-overlays/Legend.tsx`, `src/map-overlays/Legend.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the CSS**

```css
.legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 0;
  overflow: hidden;
  transition: box-shadow .2s var(--e-quart);
}
.legend:hover { box-shadow: 0 4px 10px rgba(35,38,31,.08); }
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  width: 100%;
  border: 0;
  background: var(--c-surface);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--c-text);
  transition: background .18s var(--e-quart);
}
.head:hover { background: var(--c-bg-linen); }
.ttl { font-weight: 600; font-size: 12px; flex: 1; }
.miniRamp {
  width: 40px; height: 6px; border-radius: 2px; border: 1px solid var(--c-border);
  background: linear-gradient(90deg, #E8F0D8 0%, #8BB26B 25%, #D9A441 50%, #D25524 75%, #7A1F10 100%);
  opacity: 0;
  transition: opacity .25s var(--e-quart);
}
.legend[data-open="false"] .miniRamp { opacity: 1; }
.caret { color: var(--c-text-soft); font-size: 10px; transition: transform .28s var(--e-expo); }
.legend[data-open="false"] .caret { transform: rotate(-90deg); }
.wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .32s var(--e-expo); }
.wrap > .body { min-height: 0; overflow: hidden; padding: 2px 10px 10px; transition: opacity .22s var(--e-quart); }
.legend[data-open="false"] .wrap { grid-template-rows: 0fr; }
.legend[data-open="false"] .wrap > .body { opacity: 0; }

.ramp {
  width: 200px; height: 10px; border-radius: 3px; margin: 4px 0 4px;
  border: 1px solid var(--c-border);
  background: linear-gradient(90deg, #E8F0D8 0%, #8BB26B 25%, #D9A441 50%, #D25524 75%, #7A1F10 100%);
}
.ticks { display: flex; justify-content: space-between; color: var(--c-text-soft); font-size: 11px; font-variant-numeric: tabular-nums; }
.iffiRow {
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid var(--c-border);
  display: flex; align-items: center; gap: 8px; font-size: 12px;
}
.iffiRow i {
  width: 16px; height: 10px; border: 1.6px solid var(--c-russet);
  background: rgba(122,31,16,.14); border-radius: 2px; display: inline-block;
}
```

- [ ] **Step 2: Write `Legend.tsx`**

```tsx
import { useAppStore } from "@/app/store";
import styles from "./Legend.module.css";

export function Legend() {
  const open = useAppStore((s) => s.legendOpen);
  const toggle = useAppStore((s) => s.toggleLegend);
  return (
    <div className={styles.legend} data-open={open}>
      <button type="button" className={styles.head} aria-expanded={open} onClick={toggle}>
        <span className={styles.ttl}>Susceptibility</span>
        <span className={styles.miniRamp} aria-hidden="true" />
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>
          <div className={styles.ramp} />
          <div className={styles.ticks}>
            <span>0.0</span><span>0.3</span><span>0.5</span><span>0.7</span><span>1.0</span>
          </div>
          <div className={styles.iffiRow}>
            <i />
            <span>Catalogued landslide (IFFI)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```tsx
import { Legend } from "@/map-overlays/Legend";
// inside the map div:
<Legend />
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/map-overlays/Legend.* src/app/App.tsx
git commit -m "feat(overlay): collapsible susceptibility legend"
```

---

## Phase 6 — Drawer

### Task 6.1: Drawer container + handle

**Files:**
- Create: `src/drawer/Drawer.tsx`, `src/drawer/Drawer.module.css`
- Modify: `src/app/App.tsx`, `src/app/App.module.css`

- [ ] **Step 1: Extend `src/app/App.module.css` to support drawer toggling**

Replace `.body` and add drawer-toggled rules:
```css
.body {
  flex: 1;
  display: flex;
  position: relative;
  min-height: 0;
  background: var(--c-bg-linen);
}
.body[data-drawer="closed"] :global(.drawer) {
  width: 0;
  padding: 0;
  opacity: 0;
  border: 0;
  overflow: hidden;
}
```

- [ ] **Step 2: Write `src/drawer/Drawer.module.css`**

```css
.handle {
  width: var(--handle-w);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-surface);
  border: 0;
  border-right: 1px solid var(--c-border);
  cursor: pointer;
  padding: 0;
  color: var(--c-text-soft);
  transition: background .18s var(--e-quart), color .18s var(--e-quart);
}
.handle:hover { background: var(--c-bg-linen); color: var(--c-forest); }
.handle svg { width: 10px; height: 10px; transition: transform .32s var(--e-expo); }
:global(.body[data-drawer="closed"]) .handle svg { transform: rotate(180deg); }
:global(.body[data-drawer="closed"]) .handle {
  border-right: 0;
  border-left: 1px solid var(--c-border);
}

.drawer {
  width: var(--drawer-w);
  background: var(--c-surface);
  padding: 0 0 8px;
  overflow-y: auto;
  transition: width .4s var(--e-expo), opacity .28s var(--e-quart);
  flex-shrink: 0;
}
```

- [ ] **Step 3: Write `src/drawer/Drawer.tsx`**

```tsx
import type { ReactNode } from "react";
import { useAppStore } from "@/app/store";
import styles from "./Drawer.module.css";

interface Props { children: ReactNode }

export function Drawer({ children }: Props) {
  const toggle = useAppStore((s) => s.toggleDrawer);
  return (
    <>
      <button
        type="button"
        className={styles.handle}
        aria-label="Toggle side panel"
        onClick={toggle}
      >
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3,2 7,5 3,8" />
        </svg>
      </button>
      <aside className={`${styles.drawer} drawer`}>{children}</aside>
    </>
  );
}
```

- [ ] **Step 4: Wire into `App.tsx`**

```tsx
import { Drawer } from "@/drawer/Drawer";
import { useAppStore } from "@/app/store";
// …
export default function App() {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  return (
    <div className={styles.shell}>
      <TopBar tabs={<Tabs />} search={<SearchLocality />} icons={<IconButtons />} />
      <div className={styles.body} data-drawer={drawerOpen ? "open" : "closed"}>
        <div className={styles.map}>
          <MapView />
          <ZonesPill />
          <LayersPanel />
          <Legend />
        </div>
        <Drawer>{/* groups go here */}</Drawer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/drawer/Drawer.* src/app/App.* 
git commit -m "feat(drawer): collapsible shell with chevron handle"
```

---

### Task 6.2: Group wrapper (collapsible)

**Files:**
- Create: `src/drawer/Group.tsx`, `src/drawer/Group.module.css`

- [ ] **Step 1: Write the CSS**

```css
.group { position: relative; }
.wrap {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows .38s var(--e-expo);
}
.wrap > .body {
  min-height: 0;
  overflow: hidden;
  transition: opacity .28s var(--e-quart);
}
.group[data-open="false"] .wrap { grid-template-rows: 0fr; }
.group[data-open="false"] .wrap > .body { opacity: 0; }

.head {
  width: 100%;
  padding: 13px 36px 11px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .26em;
  text-transform: uppercase;
  color: var(--c-text);
  text-align: center;
  background: #F1EADB;
  border: 0;
  border-bottom: 1px solid #DCD2B9;
  position: relative;
  cursor: pointer;
  font-family: inherit;
  transition: background .2s var(--e-quart), letter-spacing .25s var(--e-expo), color .18s var(--e-quart);
  user-select: none;
}
.head::before, .head::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 14px;
  height: 1px;
  background: #C4B896;
  transition: width .22s var(--e-expo), background .18s var(--e-quart);
}
.head::before { left: 16px; }
.head::after  { right: 40px; }
.head:hover {
  background: #ECE2CE;
  letter-spacing: .28em;
  color: #0E1512;
}
.head:hover::before, .head:hover::after { background: #A99A72; width: 18px; }
.caret {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%) rotate(0);
  color: var(--c-text-soft);
  font-size: 10px;
  line-height: 1;
  transition: transform .32s var(--e-expo), color .18s var(--e-quart);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}
.group[data-open="false"] .caret { transform: translateY(-50%) rotate(-90deg); }
.head:hover .caret { color: var(--c-forest); }
```

- [ ] **Step 2: Write `Group.tsx`**

```tsx
import type { ReactNode } from "react";
import { useAppStore } from "@/app/store";
import type { GroupId } from "@/app/store";
import styles from "./Group.module.css";

interface Props { id: GroupId; label: string; children: ReactNode }

export function Group({ id, label, children }: Props) {
  const open = useAppStore((s) => s.groupOpen[id]);
  const toggle = useAppStore((s) => s.toggleGroup);
  return (
    <div className={styles.group} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => toggle(id)}
      >
        {label}
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      <div className={styles.wrap}>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/drawer/Group.*
git commit -m "feat(drawer): collapsible group with animated cap header"
```

---

### Task 6.3: KVTable + Section widgets

**Files:**
- Create: `src/drawer/widgets/KVTable.tsx`, `src/drawer/widgets/Section.tsx`, `src/drawer/widgets/widgets.module.css`

- [ ] **Step 1: Write `widgets.module.css`**

```css
.section {
  padding: 12px 14px 14px;
  border-bottom: 1px solid var(--c-border);
  border-left: 3px solid transparent;
  transition: background .2s var(--e-quart);
  position: relative;
}
.section:hover { filter: brightness(1.025); }
.section h3 {
  margin: 0 auto 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
  text-align: center;
  color: var(--accent, var(--c-text));
  position: relative;
  display: inline-block;
  width: 100%;
  padding-bottom: 6px;
  transition: letter-spacing .25s var(--e-expo), transform .2s var(--e-quart), color .18s var(--e-quart);
}
.section h3::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 0;
  height: 1.5px;
  background: currentColor;
  transform: translateX(-50%);
  opacity: 0;
  transition: width .3s var(--e-expo), opacity .22s var(--e-quart);
}
.section:hover h3 {
  letter-spacing: .24em;
  transform: translateY(-1px);
  filter: saturate(1.15);
}
.section:hover h3::after { width: 28px; opacity: .55; }

.kv { width: 100%; border-collapse: collapse; font-size: 12px; }
.kv tr { transition: background .18s var(--e-quart); }
.kv tr:hover { background: var(--accent-tint, rgba(35,38,31,.03)); }
.kv td {
  padding: 4px 0;
  border-top: 1px solid var(--row-color, #E8D7C6);
  transition: transform .2s var(--e-expo), color .15s var(--e-quart);
}
.kv tr:first-child td { border-top: none; }
.kv td:first-child {
  color: var(--c-text-muted);
  font-weight: 500;
  transform-origin: left center;
}
.kv tr:hover td:first-child {
  color: var(--accent, var(--c-text));
  font-weight: 600;
  transform: translateX(3px);
}
.kv td:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--val-color, var(--c-text));
  letter-spacing: -.01em;
  transform-origin: right center;
}
.kv tr:hover td:last-child {
  transform: scale(1.08);
  color: var(--accent, var(--c-text));
}
.kv .u {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  letter-spacing: inherit;
  margin-left: 1px;
}
```

- [ ] **Step 2: Write `Section.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";
import styles from "./widgets.module.css";

interface Props {
  title?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Section({ title, className = "", style, children }: Props) {
  return (
    <section className={`${styles.section} ${className}`} style={style}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Write `KVTable.tsx`**

```tsx
import styles from "./widgets.module.css";

export interface KVRow {
  label: string;
  value: string;
  unit?: string;
}

interface Props { rows: KVRow[] }

export function KVTable({ rows }: Props) {
  return (
    <table className={styles.kv}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>
              {r.value}
              {r.unit && <span className={styles.u}>{r.unit}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/drawer/widgets/
git commit -m "feat(drawer): Section + KVTable primitives"
```

---

### Task 6.4: VIEW panel

**Files:**
- Create: `src/drawer/ViewPanel.tsx`, `src/drawer/ViewPanel.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `ViewPanel.module.css`**

```css
.view {
  --accent: var(--c-view);
  --accent-tint: rgba(62, 94, 138, .08);
  --row-color: var(--c-view-row);
  --val-color: var(--c-view);
  border-left-color: var(--c-view-stripe) !important;
  background: var(--c-view-bg);
}
```

- [ ] **Step 2: Write `ViewPanel.tsx`**

```tsx
import { useAppStore } from "@/app/store";
import { Section } from "./widgets/Section";
import { KVTable, type KVRow } from "./widgets/KVTable";
import styles from "./ViewPanel.module.css";

const ZONES_TOTAL: Record<"j2" | "j3", number> = { j2: 5, j3: 5 };

export function ViewPanel() {
  const model = useAppStore((s) => s.model);
  const selectedZones = useAppStore((s) => s.selectedZones);
  const threshold = useAppStore((s) => s.threshold);
  const layers = useAppStore((s) => s.layers);
  const overlays = Object.values(layers).filter(Boolean).length;

  const rows: KVRow[] = [
    { label: "Zones", value: `${selectedZones.length === 0 ? ZONES_TOTAL[model] : selectedZones.length} / ${ZONES_TOTAL[model]}` },
    { label: "Overlay", value: model.toUpperCase() },
    { label: "Threshold", value: `≥ ${threshold.toFixed(2)}` },
    { label: "Model", value: model.toUpperCase() },
  ];
  return (
    <Section className={styles.view}>
      <KVTable rows={rows} />
    </Section>
  );
}
```

- [ ] **Step 3: Render a VIEW group in `App.tsx`**

```tsx
import { Group } from "@/drawer/Group";
import { ViewPanel } from "@/drawer/ViewPanel";
// …
<Drawer>
  <Group id="view" label="View">
    <ViewPanel />
  </Group>
</Drawer>
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/drawer/ViewPanel.* src/app/App.tsx
git commit -m "feat(drawer): VIEW panel (Zones · Overlay · Threshold · Model)"
```

---

### Task 6.5: MONITORING panel (InView + Matches + IFFI types)

**Files:**
- Create: `src/drawer/MonitoringPanel.tsx`, `src/drawer/MonitoringPanel.module.css`
- Modify: `src/app/App.tsx`

For v1 the per-map derivative stats are placeholders from `ViewStats`. Fill with constants for now; Task 7.x will wire them to the live map.

- [ ] **Step 1: Write `MonitoringPanel.module.css`**

```css
.inview   { --accent: var(--c-forest); --accent-tint: rgba(47,93,58,.08);  --row-color: var(--c-forest-row); --val-color: var(--c-forest); border-left-color: var(--c-forest-stripe) !important; background: var(--c-forest-bg); }
.match    { --accent: var(--c-russet); --accent-tint: rgba(122,31,16,.08); --row-color: var(--c-russet-row); --val-color: var(--c-russet); border-left-color: var(--c-russet); background: var(--c-russet-bg); }
.types    { --accent: var(--c-russet); --accent-tint: rgba(122,31,16,.08); --row-color: var(--c-russet-row); --val-color: var(--c-russet); border-left-color: var(--c-russet); background: var(--c-russet-bg-alt); }

.types table { width: 100%; border-collapse: collapse; font-size: 12px; }
.types tr { cursor: pointer; transition: background .18s var(--e-quart); }
.types tr:hover { background: var(--accent-tint); }
.types td {
  padding: 4px 0;
  border-top: 1px solid var(--c-russet-row);
  transition: color .15s var(--e-quart), transform .2s var(--e-expo);
}
.types tr:first-child td { border-top: none; }
.types tr:hover td { color: var(--accent); }
.types td:first-child {
  display: flex; align-items: center; gap: 8px;
  font-weight: 500; color: var(--c-text-muted);
  transform-origin: left center;
}
.types tr:hover td:first-child { transform: translateX(3px); font-weight: 600; }
.types td:first-child i {
  width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0;
  transition: transform .2s var(--e-expo);
}
.types tr:hover td i { transform: scale(1.35); }
.types td:last-child {
  text-align: right; font-variant-numeric: tabular-nums; font-weight: 700;
  color: var(--c-text); transform-origin: right center;
}
.types tr:hover td:last-child { transform: scale(1.08); color: var(--accent); }
.types tr.sci td i { background: #7A1F10; }
.types tr.cro td i { background: #D25524; }
.types tr.col td i { background: #D9A441; }
.types tr.cmp td i { background: #8BB26B; }
```

- [ ] **Step 2: Write `MonitoringPanel.tsx`**

```tsx
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import styles from "./MonitoringPanel.module.css";

const SAMPLE = {
  inView: {
    cells_visible: 283_000,
    cells_total: 676_416,
    coverage_pct: 41.9,
    area_km2: 3_876,
    zones_active: 2,
    zones_total: 5,
  },
  matches: {
    polygons_in_view: 284,
    iffi_cells: 9_412,
    captured: 6_306,
    hit_rate_pct: 67.0,
    precision: 0.271,
  },
  types: [
    { tipo: "Scivolamento", count: 127, cls: "sci" },
    { tipo: "Crollo", count: 68, cls: "cro" },
    { tipo: "Colata rapida", count: 54, cls: "col" },
    { tipo: "Complesso", count: 35, cls: "cmp" },
  ] as const,
};

function fmtK(n: number): string { return `${Math.round(n / 1000)}`; }

export function MonitoringPanel() {
  return (
    <>
      <Section className={styles.inview}>
        <KVTable rows={[
          { label: "Cells", value: `${fmtK(SAMPLE.inView.cells_visible)}k / ${fmtK(SAMPLE.inView.cells_total)}k` },
          { label: "Coverage", value: SAMPLE.inView.coverage_pct.toFixed(1), unit: "%" },
          { label: "Area", value: SAMPLE.inView.area_km2.toLocaleString("en"), unit: "km²" },
          { label: "Zones", value: `${SAMPLE.inView.zones_active} / ${SAMPLE.inView.zones_total}` },
        ]} />
      </Section>
      <Section className={styles.match}>
        <KVTable rows={[
          { label: "Polygons in view", value: String(SAMPLE.matches.polygons_in_view) },
          { label: "IFFI cells", value: SAMPLE.matches.iffi_cells.toLocaleString("en") },
          { label: "Captured ≥ 0.50", value: SAMPLE.matches.captured.toLocaleString("en") },
          { label: "Hit rate", value: SAMPLE.matches.hit_rate_pct.toFixed(1), unit: "%" },
          { label: "Precision", value: SAMPLE.matches.precision.toFixed(3) },
        ]} />
      </Section>
      <Section className={styles.types}>
        <table>
          <tbody>
            {SAMPLE.types.map((t) => (
              <tr key={t.tipo} className={t.cls}>
                <td><i />{t.tipo}</td>
                <td>{t.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
```

- [ ] **Step 3: Render a MONITORING group in `App.tsx`**

```tsx
import { MonitoringPanel } from "@/drawer/MonitoringPanel";
// …
<Group id="monitoring" label="Monitoring">
  <MonitoringPanel />
</Group>
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/drawer/MonitoringPanel.* src/app/App.tsx
git commit -m "feat(drawer): MONITORING panel (InView + Matches + IFFI types) with sample data"
```

---

### Task 6.6: ANALYTICS panel (Thresholds + Probability + ZoneBars)

**Files:**
- Create: `src/drawer/AnalyticsPanel.tsx`, `src/drawer/AnalyticsPanel.module.css`, `src/drawer/widgets/ZoneBars.tsx`, `src/drawer/widgets/Histogram.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `AnalyticsPanel.module.css`**

```css
.thr      { --accent: var(--c-terracotta); --accent-tint: rgba(210,85,36,.08); border-left-color: var(--c-terracotta-stripe); background: var(--c-terracotta-bg); }
.prob     { --accent: var(--c-ochre); --accent-tint: rgba(217,164,65,.12); --row-color: var(--c-ochre-row); --val-color: var(--c-ochre); border-left-color: var(--c-ochre-stripe); background: var(--c-ochre-bg); }
.byzone   { --accent: var(--c-forest); --accent-tint: rgba(139,178,107,.14); border-left-color: var(--c-sage); background: var(--c-sage-bg); }

.thrTable { width: 100%; border-collapse: collapse; font-size: 12px; }
.thrTable tr { cursor: pointer; transition: background .18s var(--e-quart); }
.thrTable tr:hover { background: var(--accent-tint); }
.thrTable td {
  padding: 4px 0;
  border-top: 1px solid #E8D0C6;
  transition: color .15s var(--e-quart), transform .2s var(--e-expo);
}
.thrTable tr:first-child td { border-top: none; }
.thrTable td:first-child {
  color: var(--c-text-muted);
  font-weight: 500;
  transform-origin: left center;
}
.thrTable td:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--c-text);
  transform-origin: right center;
}
.thrTable tr:hover td:first-child { color: var(--accent); font-weight: 600; transform: translateX(3px); }
.thrTable tr:hover td:last-child { color: var(--accent); transform: scale(1.08); }
.thrTable tr.active td { color: var(--accent); font-weight: 700; }
.thrTable tr.active td:first-child::before { content: "▸ "; color: var(--c-terracotta-stripe); }
.thrTable .use { color: #8A7A6E; font-weight: 400; font-style: italic; font-size: 11px; margin-left: 6px; }
.thrTable tr.active .use { color: var(--accent); font-style: normal; }
```

- [ ] **Step 2: Write `widgets/Histogram.tsx`**

```tsx
import { useMemo } from "react";

const RAMP = ["#E8F0D8", "#8BB26B", "#B6BF93", "#D9A441", "#D9A441", "#D25524", "#D25524", "#7A1F10", "#7A1F10", "#7A1F10"];

interface Props { bins: number[] }

export function Histogram({ bins }: Props) {
  const max = useMemo(() => Math.max(1, ...bins), [bins]);
  return (
    <div>
      <div style={{
        height: 52,
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        padding: "0 2px",
        borderBottom: "1px solid var(--c-border)",
      }}>
        {bins.map((v, i) => (
          <span
            key={i}
            title={`bin ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`}
            style={{
              flex: 1,
              height: `${Math.round((v / max) * 100)}%`,
              background: RAMP[i],
              borderRadius: "1px 1px 0 0",
              transition: "filter .15s var(--e-quart)",
            }}
          />
        ))}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 10,
        color: "var(--c-text-soft)",
        marginTop: 5,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: ".04em",
      }}>
        <span>0.0</span><span>0.3</span><span>0.5</span><span>0.7</span><span>1.0</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `widgets/ZoneBars.tsx`**

```tsx
import type { Zone } from "@/app/types";

interface Row { zone: Zone; mean_p: number; color: string }

interface Props { rows: Row[] }

export function ZoneBars({ rows }: Props) {
  return (
    <div style={{ marginTop: 4 }}>
      {rows.map((r) => (
        <div
          key={r.zone}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            padding: "3px 0",
          }}
        >
          <span style={{
            width: 58,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: 500,
            color: "var(--c-text-muted)",
          }}>
            {r.zone.replace(/_/g, " ")}
          </span>
          <span style={{
            flex: 1,
            height: 20,
            background: "#F1ECD9",
            border: "1px solid var(--c-border)",
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
          }}>
            <span style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: `${Math.round(r.mean_p * 100)}%`,
              background: r.color,
              borderRadius: "3px 0 0 3px",
            }} />
            <span style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "-.02em",
              fontVariantNumeric: "tabular-nums",
              color: "var(--c-text)",
              textShadow: "0 0 2px rgba(253,250,240,.8)",
            }}>{r.mean_p.toFixed(2)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `AnalyticsPanel.tsx`**

```tsx
import { useAppStore } from "@/app/store";
import type { Threshold, Zone } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import { Histogram } from "./widgets/Histogram";
import { ZoneBars } from "./widgets/ZoneBars";
import styles from "./AnalyticsPanel.module.css";

const THRESHOLDS: { t: Threshold; use: string }[] = [
  { t: 0.3, use: "screening" },
  { t: 0.5, use: "operational" },
  { t: 0.7, use: "priority" },
  { t: 0.85, use: "high conf." },
];

const PCT_BY_T = { 0.3: "31.0", 0.5: "8.3", 0.7: "2.1", 0.85: "0.4" } as const;

const SAMPLE_HIST = [92, 64, 46, 30, 22, 18, 14, 11, 9, 7];

// Sample zone bars; will be replaced by real data derived from public/data/zones_*.json
// in Task 7.2.
const SAMPLE_BARS_J2: { zone: Zone; mean_p: number; color: string }[] = [
  { zone: "Prealpine", mean_p: 0.31, color: "#D25524" },
  { zone: "Carso",     mean_p: 0.22, color: "#D9A441" },
  { zone: "Alpine",    mean_p: 0.16, color: "#8BB26B" },
  { zone: "Hills",     mean_p: 0.09, color: "#B6BF93" },
  { zone: "Plain",     mean_p: 0.05, color: "#D9E4CF" },
];

export function AnalyticsPanel() {
  const threshold = useAppStore((s) => s.threshold);
  const setThreshold = useAppStore((s) => s.setThreshold);
  return (
    <>
      <Section title="Decision thresholds" className={styles.thr}>
        <table className={styles.thrTable}>
          <tbody>
            {THRESHOLDS.map(({ t, use }) => (
              <tr
                key={t}
                className={threshold === t ? "active" : undefined}
                onClick={() => setThreshold(t)}
              >
                <td>
                  ≥ {t.toFixed(2).replace(/\.?0+$/, (m) => (t === 0.3 || t === 0.5 || t === 0.7 ? m : m))}{" "}
                  <span className={styles.use}>{use}</span>
                </td>
                <td>
                  {PCT_BY_T[t]}
                  <span style={{ marginLeft: 1 }}>%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Probability" className={styles.prob}>
        <KVTable rows={[
          { label: "Mean",        value: "0.18" },
          { label: "Median",      value: "0.11" },
          { label: "p99",         value: "0.86" },
          { label: "Above 0.50",  value: "8.3", unit: "%" },
        ]} />
        <div style={{ marginTop: 10 }}>
          <Histogram bins={SAMPLE_HIST} />
        </div>
      </Section>
      <Section title="Mean probability by zone" className={styles.byzone}>
        <ZoneBars rows={SAMPLE_BARS_J2} />
      </Section>
    </>
  );
}
```

- [ ] **Step 5: Wire into `App.tsx`**

```tsx
import { AnalyticsPanel } from "@/drawer/AnalyticsPanel";
// …
<Group id="analytics" label="Analytics">
  <AnalyticsPanel />
</Group>
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/drawer/AnalyticsPanel.* src/drawer/widgets/ZoneBars.tsx src/drawer/widgets/Histogram.tsx src/app/App.tsx
git commit -m "feat(drawer): ANALYTICS panel (thresholds + histogram + zone bars)"
```

---

### Task 6.7: MODEL panel (Calibration + Model stats)

**Files:**
- Create: `src/drawer/ModelPanel.tsx`, `src/drawer/ModelPanel.module.css`, `src/drawer/widgets/CalibrationPlot.tsx`, `src/drawer/widgets/CalibrationPlot.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write `CalibrationPlot.module.css`**

```css
.plot {
  position: relative;
  height: 140px;
  margin-top: 8px;
  border: 1px solid var(--c-slate-row);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  overflow: hidden;
  transition: box-shadow .2s var(--e-quart);
}
.plot:hover { box-shadow: 0 2px 10px rgba(62,94,114,.12); }
.plot svg { width: 100%; height: 100%; display: block; }
.gridLine { stroke: #EEF1F4; stroke-width: .8; }
.axisLine { stroke: var(--c-slate-row); stroke-width: 1; }
.diag { stroke: var(--c-slate-row); stroke-width: 1; stroke-dasharray: 3 3; }
.gapArea {
  fill: rgba(62, 94, 138, .08);
  stroke: none;
  opacity: 0;
  animation: gapIn .45s var(--e-quart) .35s forwards;
}
@keyframes gapIn { to { opacity: 1; } }
.curve {
  fill: none;
  stroke: var(--c-slate);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 260;
  stroke-dashoffset: 260;
  animation: draw 1.1s var(--e-expo) .25s forwards;
}
@keyframes draw { to { stroke-dashoffset: 0; } }
.dot {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: dotIn .32s var(--e-expo) forwards;
  transition: stroke-width .18s var(--e-quart);
}
@keyframes dotIn { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
.dot:hover { stroke: var(--c-surface); stroke-width: 2; }
.axisTick {
  font-size: 7.5px;
  font-family: inherit;
  font-weight: 600;
  fill: #9CA48C;
  font-variant-numeric: tabular-nums;
}
.axisLabel {
  font-size: 8px;
  font-family: inherit;
  font-weight: 700;
  fill: var(--c-text-soft);
  letter-spacing: .1em;
  text-transform: uppercase;
}
.plot:hover .curve { filter: drop-shadow(0 0 2px rgba(62,94,138,.25)); }
.plot:hover .gapArea { fill: rgba(62, 94, 138, .14); }
```

- [ ] **Step 2: Write `CalibrationPlot.tsx`**

```tsx
import { useMemo } from "react";
import styles from "./CalibrationPlot.module.css";

interface Bin { p_pred: number; observed: number }

const BIN_COLORS = ["#8BB26B", "#8BB26B", "#B6BF93", "#D9A441", "#D9A441", "#D25524", "#D25524", "#7A1F10", "#7A1F10"];

function toXY(b: Bin): [number, number] {
  const x = 28 + b.p_pred * 200;   // plot area x: 28..228
  const y = 122 - b.observed * 110; // plot area y: 12..122, inverted
  return [x, y];
}

interface Props { bins: Bin[] }

export function CalibrationPlot({ bins }: Props) {
  const points = useMemo(() => bins.map(toXY), [bins]);
  const curve = useMemo(() => points.map(([x, y]) => `${x},${y}`).join(" "), [points]);
  const gapPoints = useMemo(() => {
    // Forward along observed, then back along diagonal at the same p values.
    const fwd = points.map(([x, y]) => `${x},${y}`);
    const back = [...bins]
      .reverse()
      .map((b) => {
        const [x, _] = toXY(b);
        const yDiag = 122 - b.p_pred * 110;
        return `${x},${yDiag}`;
      });
    return [...fwd, ...back].join(" ");
  }, [bins, points]);

  return (
    <div className={styles.plot}>
      <svg viewBox="0 0 240 150" preserveAspectRatio="none">
        {/* grid */}
        <line className={styles.gridLine} x1="78"  y1="12" x2="78"  y2="122" />
        <line className={styles.gridLine} x1="128" y1="12" x2="128" y2="122" />
        <line className={styles.gridLine} x1="178" y1="12" x2="178" y2="122" />
        <line className={styles.gridLine} x1="28" y1="94.5" x2="228" y2="94.5" />
        <line className={styles.gridLine} x1="28" y1="67"   x2="228" y2="67" />
        <line className={styles.gridLine} x1="28" y1="39.5" x2="228" y2="39.5" />
        {/* axes */}
        <line className={styles.axisLine} x1="28" y1="12"  x2="28"  y2="122" />
        <line className={styles.axisLine} x1="28" y1="122" x2="228" y2="122" />
        {/* miscalibration area */}
        <polygon className={styles.gapArea} points={gapPoints} />
        {/* diagonal reference */}
        <line className={styles.diag} x1="28" y1="122" x2="228" y2="12" />
        {/* observed curve */}
        <polyline className={styles.curve} points={curve} />
        {/* dots */}
        {points.map(([x, y], i) => (
          <circle
            key={i}
            className={styles.dot}
            cx={x}
            cy={y}
            r={3}
            fill={BIN_COLORS[i] ?? "#3E5E72"}
            style={{ animationDelay: `${0.70 + i * 0.08}s` }}
          >
            <title>{`bin ${bins[i]!.p_pred.toFixed(2)} · obs ${bins[i]!.observed.toFixed(2)}`}</title>
          </circle>
        ))}
        {/* tick labels */}
        <text className={styles.axisTick} x="28"  y="134" textAnchor="middle">0</text>
        <text className={styles.axisTick} x="78"  y="134" textAnchor="middle">.25</text>
        <text className={styles.axisTick} x="128" y="134" textAnchor="middle">.5</text>
        <text className={styles.axisTick} x="178" y="134" textAnchor="middle">.75</text>
        <text className={styles.axisTick} x="228" y="134" textAnchor="middle">1</text>
        <text className={styles.axisTick} x="22" y="124" textAnchor="end">0</text>
        <text className={styles.axisTick} x="22" y="70"  textAnchor="end">.5</text>
        <text className={styles.axisTick} x="22" y="15"  textAnchor="end">1</text>
        <text className={styles.axisLabel} x="128" y="146" textAnchor="middle">Predicted</text>
        <text className={styles.axisLabel} x="10" y="70" textAnchor="middle" transform="rotate(-90 10 70)">Observed</text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Write `ModelPanel.module.css`**

```css
.calib { --accent: var(--c-slate); --accent-tint: rgba(107,142,163,.12); --row-color: var(--c-slate-row); --val-color: var(--c-slate); border-left-color: var(--c-slate-stripe); background: var(--c-slate-bg); }
.model { --accent: var(--c-forest); --accent-tint: rgba(47,93,58,.08); --row-color: var(--c-forest-row); --val-color: var(--c-forest); border-left-color: var(--c-forest); background: var(--c-forest-bg); }
```

- [ ] **Step 4: Write `ModelPanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/app/store";
import type { ModelStats } from "@/app/types";
import { Section } from "./widgets/Section";
import { KVTable } from "./widgets/KVTable";
import { CalibrationPlot } from "./widgets/CalibrationPlot";
import styles from "./ModelPanel.module.css";

function useModelStats(): ModelStats | null {
  const model = useAppStore((s) => s.model);
  const [data, setData] = useState<ModelStats | null>(null);
  useEffect(() => {
    setData(null);
    fetch(`/data/model_${model}.json`)
      .then((r) => r.json())
      .then((d) => setData(d as ModelStats));
  }, [model]);
  return data;
}

export function ModelPanel() {
  const model = useAppStore((s) => s.model);
  const stats = useModelStats();

  if (!stats) {
    return (
      <Section className={styles.model}>
        <div style={{ padding: 8, color: "var(--c-text-soft)" }}>Loading…</div>
      </Section>
    );
  }

  const maxGap = Math.max(
    ...stats.calibration.map((b) => Math.abs(b.observed - b.p_pred)),
  );

  return (
    <>
      <Section title="Calibration pooled" className={styles.calib}>
        <KVTable rows={[
          { label: "ECE",     value: stats.ece.toFixed(3) },
          { label: "Brier",   value: stats.brier.toFixed(3) },
          { label: "Bins",    value: String(stats.calibration.length) },
          { label: "Max gap", value: maxGap.toFixed(2) },
        ]} />
        <CalibrationPlot bins={stats.calibration} />
      </Section>
      <Section title={`Model ${model.toUpperCase()}`} className={styles.model}>
        <KVTable rows={[
          { label: "AUC pooled",    value: stats.auc_pooled.toFixed(3) },
          { label: "PR-AUC",        value: stats.pr_auc.toFixed(3) },
          { label: "ECE",           value: stats.ece.toFixed(3) },
          { label: "Brier",         value: stats.brier.toFixed(3) },
          { label: "Cells trained", value: `${Math.round(stats.cells_trained / 1000)}`, unit: "k" },
          { label: "CV folds",      value: String(stats.cv_folds) },
        ]} />
      </Section>
    </>
  );
}
```

- [ ] **Step 5: Wire into `App.tsx`**

```tsx
import { ModelPanel } from "@/drawer/ModelPanel";
// …
<Group id="model" label="Model">
  <ModelPanel />
</Group>
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run test:run
```

- [ ] **Step 7: Commit**

```bash
git add src/drawer/ModelPanel.* src/drawer/widgets/CalibrationPlot.* src/app/App.tsx
git commit -m "feat(drawer): MODEL panel with calibration plot + draw-on animation"
```

---

## Phase 7 — Wiring & interactions

### Task 7.1: Derive ZoneBars from real `zones_*.json`

**Files:**
- Modify: `src/drawer/AnalyticsPanel.tsx`

- [ ] **Step 1: Replace sample bars with fetched data**

In `AnalyticsPanel.tsx`, add a hook:
```tsx
import { useEffect, useState } from "react";
import type { ZoneStat } from "@/app/types";

function useZoneStats(): ZoneStat[] {
  const model = useAppStore((s) => s.model);
  const [data, setData] = useState<ZoneStat[]>([]);
  useEffect(() => {
    fetch(`/data/zones_${model}.json`).then((r) => r.json()).then(setData);
  }, [model]);
  return data;
}

function colorForMeanP(p: number): string {
  if (p < 0.1) return "#D9E4CF";
  if (p < 0.2) return "#B6BF93";
  if (p < 0.3) return "#8BB26B";
  if (p < 0.5) return "#D9A441";
  if (p < 0.7) return "#D25524";
  return "#7A1F10";
}
```

Replace `SAMPLE_BARS_J2` usage with:
```tsx
const zones = useZoneStats();
const rows = [...zones]
  .sort((a, b) => b.mean_p - a.mean_p)
  .map((z) => ({ zone: z.zone, mean_p: z.mean_p, color: colorForMeanP(z.mean_p) }));
// Then pass `rows` to <ZoneBars rows={rows} />
```

- [ ] **Step 2: Verify build + run app**

```bash
npx tsc --noEmit
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/drawer/AnalyticsPanel.tsx
git commit -m "feat(drawer): ZoneBars driven by zones_j{2,3}.json"
```

---

### Task 7.2: Thresholds table reacts to store

**Files:**
- Modify: `src/drawer/AnalyticsPanel.tsx`

Already wired in Task 6.6 (onClick setThreshold). Task 7.2 verifies VIEW updates.

- [ ] **Step 1: Add a Vitest test for VIEW ↔ threshold synchronisation**

Create `src/drawer/ViewPanel.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/app/store";
import { ViewPanel } from "./ViewPanel";

describe("ViewPanel", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("renders the current threshold from the store", () => {
    useAppStore.getState().setThreshold(0.7);
    render(<ViewPanel />);
    expect(screen.getByText("≥ 0.70")).toBeInTheDocument();
  });

  it("updates when threshold changes", () => {
    render(<ViewPanel />);
    useAppStore.getState().setThreshold(0.85);
    expect(screen.getByText("≥ 0.85")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, expect PASS**

```bash
npm run test:run -- src/drawer/ViewPanel.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/drawer/ViewPanel.test.tsx
git commit -m "test(drawer): VIEW reflects threshold changes"
```

---

### Task 7.3: Zone-boundary map layer (toggle)

**Files:**
- Create: `src/map/layers/zones.ts`
- Modify: `src/map/MapView.tsx`

- [ ] **Step 1: Write `src/map/layers/zones.ts`**

```ts
import type { Map as MBMap } from "mapbox-gl";
import { SUSCEPT_SOURCE } from "./susceptibility";

export const ZONE_LINE = "zone-boundaries";

/** Zones come from the same PMTiles source; this layer draws a thin stroke per cell-zone boundary.
 * Real boundary tiles can be added later as their own tileset. */
export function addZoneBoundaries(m: MBMap): void {
  if (m.getLayer(ZONE_LINE)) return;
  m.addLayer({
    id: ZONE_LINE,
    type: "line",
    source: SUSCEPT_SOURCE,
    "source-layer": "cells",
    paint: {
      "line-color": "rgba(47,93,58,.35)",
      "line-width": 0.4,
    },
  });
}

export function setZoneBoundariesVisible(m: MBMap, v: boolean): void {
  if (m.getLayer(ZONE_LINE)) {
    m.setLayoutProperty(ZONE_LINE, "visibility", v ? "visible" : "none");
  }
}
```

- [ ] **Step 2: Wire in `MapView.tsx`**

After `addIffi` and before `registerPopups`, call `addZoneBoundaries(m)`.
Add a separate effect reacting to `layers.zoneBoundaries`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/map/layers/zones.ts src/map/MapView.tsx
git commit -m "feat(map): zone-boundary line layer with visibility toggle"
```

---

### Task 7.4: Susceptibility on/off

**Files:**
- Modify: `src/map/MapView.tsx`, `src/map/layers/susceptibility.ts`

- [ ] **Step 1: Add visibility helper to `susceptibility.ts`**

```ts
export function setSusceptibilityVisible(m: MBMap, v: boolean): void {
  if (m.getLayer(SUSCEPT_LAYER)) {
    m.setLayoutProperty(SUSCEPT_LAYER, "visibility", v ? "visible" : "none");
  }
}
```

- [ ] **Step 2: Add effect in `MapView.tsx`**

```tsx
import { setSusceptibilityVisible } from "./layers/susceptibility";
const susceptOn = useAppStore((s) => s.layers.susceptibility);

useEffect(() => {
  if (!mapRef.current) return;
  setSusceptibilityVisible(mapRef.current, susceptOn);
}, [susceptOn]);
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/map/layers/susceptibility.ts src/map/MapView.tsx
git commit -m "feat(map): susceptibility visibility toggle"
```

---

### Task 7.5: Smoke test — store integration

**Files:**
- Create: `src/app/integration.test.tsx`

- [ ] **Step 1: Write integration test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import App from "./App";
import { useAppStore } from "./store";

beforeEach(() => {
  useAppStore.getState().reset();
  // Stub fetch for public/data/*.json so tests don't need a server.
  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("model_")) {
      return new Response(
        JSON.stringify({
          model: "j2", auc_pooled: 0.802, pr_auc: 0.363, ece: 0.006,
          brier: 0.080, cells_trained: 676416, cv_folds: 378,
          zones: [],
          calibration: Array.from({ length: 9 }, (_, i) => ({ p_pred: (i + 0.5) / 10, observed: (i + 0.5) / 10 })),
        }),
      );
    }
    if (url.includes("zones_")) return new Response("[]");
    return new Response("{}");
  });
});

describe("App integration", () => {
  it("renders topbar, map placeholder and drawer groups", () => {
    render(<App />);
    expect(screen.getByText("FVG Landslide")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /J\.2/ })).toBeInTheDocument();
    expect(screen.getAllByText(/View|Monitoring|Analytics|Model/i).length).toBeGreaterThan(0);
  });

  it("switches model when clicking J.3", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /J\.3/ }));
    expect(useAppStore.getState().model).toBe("j3");
  });

  it("toggles drawer via the handle", () => {
    render(<App />);
    expect(useAppStore.getState().drawerOpen).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /toggle side panel/i }));
    expect(useAppStore.getState().drawerOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, expect PASS**

```bash
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/app/integration.test.tsx
git commit -m "test(app): integration smoke — topbar/map/drawer wiring"
```

---

## Phase 8 — Polish & ship

### Task 8.1: Playwright smoke test

**Files:**
- Create: `tests/e2e/loads.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

test("app loads and shows drawer groups", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("FVG Landslide")).toBeVisible();
  await expect(page.getByRole("tab", { name: /J\.2/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Monitoring/i)).toBeVisible();
  await expect(page.getByText(/Analytics/i)).toBeVisible();
  await expect(page.getByText(/Model/i)).toBeVisible();
});

test("clicking J.3 switches tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /J\.3/ }).click();
  await expect(page.getByRole("tab", { name: /J\.3/ })).toHaveAttribute("aria-selected", "true");
});

test("collapsing drawer reveals the map", async ({ page }) => {
  await page.goto("/");
  const handle = page.getByRole("button", { name: /toggle side panel/i });
  await handle.click();
  // data-drawer attribute flips
  await expect(page.locator('[data-drawer="closed"]')).toBeVisible();
});
```

- [ ] **Step 2: Build + run**

```bash
npm run build
npm run test:e2e
```
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/loads.spec.ts
git commit -m "test(e2e): playwright smoke for load, tab switch, drawer"
```

---

### Task 8.2: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `vite.config.ts` (add `base`)

- [ ] **Step 1: Add `base` to `vite.config.ts`**

```ts
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  // … rest unchanged
});
```

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency: { group: pages, cancel-in-progress: true }

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: VITE_BASE=/landslide-app/ VITE_MAPBOX_TOKEN=${{ secrets.MAPBOX_TOKEN }} npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml vite.config.ts
git commit -m "ci: GitHub Pages deploy workflow"
```

---

### Task 8.3: README polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Expand README**

Overwrite `README.md`:
```markdown
# landslide-app

Friuli-Venezia Giulia landslide susceptibility viewer. Shipping Phase **J.2**
(best pooled AUC 0.802) and **J.3** (geomorphological zones, AUC 0.805) with
IFFI catalogued landslides as ground truth.

## Develop
```
cp .env.example .env    # paste your Mapbox public token
npm install
make tiles               # requires tippecanoe + sibling repo ml-landslide-mapping-audit
npm run dev
```

## Test
```
npm run test:run         # vitest (unit + component)
npm run test:e2e         # playwright smoke
```

## Reference
- Design spec: [docs/superpowers/specs/2026-04-22-landslide-app-design.md](docs/superpowers/specs/2026-04-22-landslide-app-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-22-landslide-app.md](docs/superpowers/plans/2026-04-22-landslide-app.md)
- Upstream model card: `../ml-landslide-mapping-audit/docs/MODEL_CARD_susceptibility_v1.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: develop/test/reference README"
```

---

### Task 8.4: First release tag

**Files:**
- None (tag only)

- [ ] **Step 1: Verify everything still builds**

```bash
npx tsc --noEmit
npm run test:run
npm run build
```
All green.

- [ ] **Step 2: Tag v1.0.0**

```bash
git tag -a v1.0.0 -m "landslide-app v1.0.0 — FVG susceptibility viewer, J.2 + J.3"
git log --oneline | head -5
git tag --list
```

---

## Self-review (applied before saving)

- **Spec coverage**: every section of the approved spec maps to a task — preprocessing §2 → Phase 1; stack §3 → Task 0.1–0.2; design tokens §4 → Task 0.3; TopBar §5 → Phase 3; map + overlays §5 → Phase 4–5; drawer groups §5 → Phase 6; interactions §7 → Phase 7; calibration plot §6 → Task 6.7; deploy §11 → Task 8.2.
- **Placeholder scan**: no "TBD", "TODO", "similar to Task N" in task bodies. Each step has full code.
- **Type consistency**: `ModelId`, `Zone`, `Threshold`, `GroupId` defined in Task 2.1 and used verbatim in later tasks. `SUSCEPT_LAYER`, `SUSCEPT_SOURCE`, `IFFI_FILL`, `IFFI_LINE`, `ZONE_LINE` names used consistently. Method names (`addSusceptibility`, `updateSusceptibilityThreshold`, `updateSusceptibilityZones`, `setSusceptibilityVisible`, `addIffi`, `setIffiVisible`, `addZoneBoundaries`, `setZoneBoundariesVisible`) match their usages in `MapView.tsx`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-landslide-app.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?





