# landslide-app — Design spec

**Date**: 2026-04-22
**Status**: approved (design baseline v22)
**Owner**: Lorenzo Di Bernardo

A web viewer for the Friuli-Venezia Giulia landslide susceptibility maps produced
by the `ml-landslide-mapping-audit` project. Ships Phase **J.2** and **J.3** as
the two commercial models, overlaid on a Mapbox basemap with the IFFI landslide
polygons as ground truth.

---

## 1. Scope

**In scope (v1.0)**:
- FVG-only susceptibility viewer, two models side-by-side:
  - **J.2** — best pooled AUC on FVG (0.802), geographic macro-zones.
  - **J.3** — alternative with geomorphological zones and sub-cell texture (0.805).
- IFFI polygons (3 197 MultiPolygon, `data/historical_data/frane_poly_friuli-venezia-giulia_opendata.json`) as ground-truth overlay.
- Free-tier hosting: static site + user's existing Mapbox account.

**Out of scope (v1.0)**:
- Phase K / Trentino / Veneto-expanded models — K.3 LORO analysis rejected cross-region transfer, so multi-region rendering is scientifically dishonest and has no .gpkg artefact anyway. Documented in `docs/audit_results/phase_k/k3_analysis.md`.
- Real-time hazard triggers, temporal rainfall, ISPRA-based re-stratification.
- User authentication, multi-user editing.

---

## 2. Data sources & preprocessing

| artefact | path in `ml-landslide-mapping-audit` | size | contents |
|---|---|---:|---|
| J.2 cells | `docs/audit_results/phase_j2/phase_j2_zones_fvg_map.gpkg` | 175 MB | 676 416 polygons (EPSG:32632), layer `cells_by_zone` |
| J.2 probs | `docs/audit_results/phase_j2/phase_j2_bootstrap_oof.parquet` | 12 MB | `cell_id`, `y_proba_calibrated`, `macro_zone`, `sub_zone` |
| J.2 zones | `docs/audit_results/phase_j2/phase_j2_per_zone.csv` | 1 KB | AUC + ECE per macro-zone |
| J.3 cells | `docs/audit_results/phase_j3/phase_j3_zones_fvg_map.gpkg` | 185 MB | 676 416 polygons, same grid |
| J.3 probs | `docs/audit_results/phase_j3/phase_j3_bootstrap_oof.parquet` | 12 MB | same schema as J.2 |
| J.3 zones | `docs/audit_results/phase_j3/phase_j3_per_zone.csv` | 1 KB | AUC + ECE per geomorph zone |
| IFFI | `data/historical_data/frane_poly_friuli-venezia-giulia_opendata.json` | ~10 MB | 3 197 MultiPolygon (EPSG:32632) |

### Preprocessing pipeline (offline, Python)

`pipelines/build_tiles.py` will:

1. Load each `.gpkg` cell layer with `geopandas` (EPSG:32632).
2. Join with `bootstrap_oof.parquet` on `cell_id` to attach `y_proba_calibrated`, `macro_zone`, `sub_zone`, `y_true`.
3. Drop cells where `y_proba_calibrated` is NaN (not in evaluation set).
4. Reproject to EPSG:4326.
5. Export a minimal GeoJSON per model with only `{cell_id, p (float32), zone, sub_zone, iffi_hit (bool)}` — drop all other columns to reduce byte size.
6. Precompute `iffi_hit` via spatial join with IFFI polygons.
7. Feed the GeoJSON to **tippecanoe** → `.pmtiles` (vector tiles, zoom range 6-14, simplification by zoom).

For IFFI: direct GeoJSON → tippecanoe → pmtiles (preserve all properties).

Expected tile sizes (rough): J.2 ~40-70 MB, J.3 ~40-70 MB, IFFI ~3 MB.

**Hosting**: PMTiles served as static files from the same domain as the app (GitHub Pages or Vercel free). Fetched client-side by `pmtiles.js` via Mapbox protocol.

---

## 3. Tech stack

| layer | choice | reason |
|---|---|---|
| Framework | **React 18 + Vite + TypeScript** | matches user's TS stack; Vite = fast dev HMR, small prod build |
| Map library | **Mapbox GL JS v3** | user has existing Mapbox account; token free tier |
| Basemap | `mapbox://styles/mapbox/outdoors-v12` default, `light-v11` and `satellite-streets-v12` as alternatives | free tier, topographic context is valuable for landslide domain |
| Vector tiles | **PMTiles** via `pmtiles` + `mapbox-protocol` | self-hosted, zero-cost, Mapbox-compatible |
| Geocoding | Mapbox Geocoding API (bbox-scoped to FVG) | free tier 100 k requests/month |
| State | Zustand (or plain React context — TBD during plan) | lightweight; we likely do not need Redux |
| Charts | Inline SVG (no chart library) | small, tailored, full control over animations |
| Build | `vite build` → static assets | simplest deploy target |
| Hosting | GitHub Pages or Vercel free | zero cost |

---

## 4. Design language

Full detail in `.claude/projects/-Users-dibe-Coding-landslide-app/memory/design_language_strava.md`. Summary of the v22-approved values:

### Surface (naturalistic linen-forward)
- app bg `#F5EEDD` (linen)
- cards / drawer `#FDFAF0` (warm cream)
- borders / hairlines `#E0D7BF`
- text primary `#23261F`, secondary `#7A7A6E`

### Accents by drawer group
- **VIEW** (blue-cold) — stripe `#7A99BE`, bg `#F6F9FC`, header/value text `#3E5E8A`, row borders `#E1E9F3`.
- **MONITORING**
  - `.s-inview` — forest `#2F5D3A`, bg `#F6FAF2`
  - `.s-match` — russet `#7A1F10`, bg `#F7ECE5`
  - `.s-types` — russet `#7A1F10`, bg `#FAF4EE`
- **ANALYTICS**
  - `.s-thr` — terracotta `#D25524`, header `#B14615`, bg `#FBF1E9`
  - `.s-prob` — ochre `#D9A441`, header `#8A6A1E`, bg `#FCF7E8`
  - `.s-byzone` — sage `#8AA67B`, header `#2F5D3A`, bg `#F3F7EE`
- **MODEL**
  - `.s-calib` — slate-blue `#6B8EA3`, header `#3E5E72`, bg `#F1F5F8`
  - `.s-model` — forest `#2F5D3A`, bg `#F2F7ED`

### Heatmap ramp (susceptibility, per 117 m cell)
5 stops, ecological progression:

| p | color | semantic |
|---:|---|---|
| 0.00 | `#E8F0D8` | birch / pale |
| 0.25 | `#8BB26B` | sage |
| 0.50 | `#D9A441` | ochre / dried grass |
| 0.75 | `#D25524` | terracotta |
| 1.00 | `#7A1F10` | deep russet / wet soil |

### IFFI polygons
Stroke `#7A1F10` 1.6 px, fill `rgba(122, 31, 16, .12)`. Hover: fill .28, ring 2 px, scale 1.08.

### Typography
- Stack: `system-ui, -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif` (system-first, no web font loaded).
- Group headers: uppercase, weight 700, letter-spacing .26em, centered.
- Section headers (h3): uppercase, weight 700, letter-spacing .18em, centered, accent color per section.
- Stat labels: uppercase, 10 px, weight 700, letter-spacing .1em, color `#7A7A6E`.
- Stat values: 13 px weight 700 tabular-nums, letter-spacing -.01em. Units (`k`, `km²`, `%`) inherit size/weight/color from the value.

### Motion
- Easing: `cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart) for color/bg, `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for transforms.
- Durations: 150-200 ms hover feedback, 280-380 ms state changes (collapse, tab slide), 500-1200 ms entrance (histogram, calibration draw).
- GPU-only: `transform`, `opacity`, `filter`, `box-shadow`, `stroke-dashoffset`, `background`, `color`. Never animate `width`/`height` directly — use `grid-template-rows: 1fr ↔ 0fr` pattern.
- `prefers-reduced-motion: reduce` disables everything.

---

## 5. UI architecture

```
┌─ TopBar (44 px) ──────────────────────────────────────────────────┐
│  FVG Landslide   [J.2 | J.3]   [🔍 Search locality]   [🔔] [⚙] [👤] │
├──────────────────────────────────┬─ Drawer handle ─┬────────────────┤
│                                   │  ◀             │  VIEW ▾        │
│           Map                     │                │  ─────          │
│                                   │                │  MONITORING ▾   │
│   [Zones pill]       [Layers ▾]  │                │  ─────          │
│                                   │                │  ANALYTICS ▾    │
│                                   │                │  ─────          │
│   [Legend ▾]                      │                │  MODEL ▾        │
└──────────────────────────────────┴────────────────┴────────────────┘
```

### TopBar
Height 44 px, bg `#FDFAF0`, bottom border 1 px `#E0D7BF`.
- Brand "FVG Landslide" (left).
- Tab group J.2 / J.3 with animated underline indicator (forest green, slides between tabs).
- Search locality field (240 px, focus ring forest, bbox-scoped to FVG, dropdown suggestions).
- Icon buttons 28×28: Notifications (bell with russet dot), Settings (gear), Profile (avatar silhouette). Hover bg `#F5EEDD`.

### Map
- Mapbox GL JS v3 canvas.
- Basemap selectable (Outdoors / Light / Satellite) from Layers panel.
- Cells fill-layer from PMTiles of active model (J.2 or J.3), color by `y_proba_calibrated` via the 5-stop ramp (`interpolate`).
- IFFI polygon fill-layer (russet stroke + transparent fill).
- Zone-boundary line layer (secondary).
- Floating overlays on map:
  - **Zones pill** (top-left): chip showing filtered zones, click-to-edit.
  - **Layers panel** (top-right): expandable card (216 px). Contains Basemap selector (Outdoors / Light / Satellite, tinted backgrounds) + Overlay checkboxes (Susceptibility J.2, Susceptibility J.3, IFFI, Zone boundaries, Contours 100 m) with opacity readouts.
  - **Legend** (bottom-left): click-to-collapse card. Expanded = title + 200 px ramp + tick labels 0.0/0.3/0.5/0.7/1.0 + IFFI swatch. Collapsed = pill with title + 40×6 px mini-ramp.

### Drawer (right)
216 px, bg `#FDFAF0`, scrollable, **collapsible via chevron handle** on the left edge (18 px strip). When closed, width → 0 and the map flexes to fill.

Drawer is divided in **4 groups** (each collapsible via its header button):

#### VIEW (blue, light tint)
1 section `.s-view` · kv table:
- Zones · 2 / 5
- Overlay · J.2
- Threshold · ≥ 0.50
- Model · J.2

#### MONITORING
3 sections, no individual h3 (identified by stripe + bg color):
- `.s-inview` (forest) — kv table: Cells (k/total) · Coverage · Area · Zones
- `.s-match` (russet) — kv table: Polygons in view · IFFI cells · Captured ≥ threshold · Hit rate · Precision
- `.s-types` (russet, paper bg) — IFFI movement types table: Scivolamento · Crollo · Colata rapida · Complesso, each with color swatch + count

#### ANALYTICS
3 sections with h3:
- `.s-thr` — "Decision thresholds" — 4 canonical cut-offs (0.3/0.5/0.7/0.85) with use-case labels (screening / operational / priority / high conf.). Active row in terracotta with `▸` indicator.
- `.s-prob` — "Probability" — kv (Mean / Median / p99 / Above 0.50) + 10-bin histogram colored by ramp.
- `.s-byzone` — "Mean probability by zone" — 5 horizontal bars (height 20 px) with fill colored by per-zone mean, value **inside the bar** right-aligned (11 px weight 700, text-shadow crema for legibility).

#### MODEL
2 sections with h3:
- `.s-calib` — "Calibration pooled" — kv (ECE / Brier / Bins / Max gap) + 140 px reliability plot (see §6).
- `.s-model` — "Model J.2" — kv (AUC pooled / PR-AUC / ECE / Brier / Cells trained / CV folds).

---

## 6. Calibration plot

SVG `240 × 150` viewBox. Plot area `[28, 12]` → `[228, 122]` (200 × 110).

Layers (back to front):
1. **Grid**: 3 vertical + 3 horizontal faint lines at `.25 / .5 / .75`, color `#EEF1F4`.
2. **Axes**: bottom + left in `#C4D4DC`.
3. **Miscalibration area**: polygon enclosing the region between observed curve and diagonal, fill `rgba(62, 94, 138, .08)`. Visualizes deviation from perfect calibration at a glance.
4. **Diagonal reference**: dashed line from (28, 122) to (228, 12) in `#C4D4DC 1 px dash 3 3`.
5. **Observed curve**: 9-point polyline through bin centers, `#3E5E72` 2 px round line-join.
6. **Bin dots**: 9 circles r=3, colored by bin midpoint (ramp: sage → ochre → terracotta → russet). `<title>` tooltip with bin range + observed rate.
7. **Tick labels**: `0 · .25 · .5 · .75 · 1` on x-axis (below plot) and `0 · .5 · 1` on y-axis (left), 7.5 px muted.
8. **Axis labels**: "Predicted" (below) and "Observed" (rotated -90° left), 8 px uppercase letter-spacing .1em.

### Animation (on section enter)
1. `gap-area` fade-in 450 ms ease-out-quart @ .35 s.
2. `.curve` draw-on via `stroke-dashoffset: 260 → 0`, 1.1 s ease-out-expo @ .25 s.
3. 9 dots pop-in (`scale .4 → 1`) staggered 80 ms starting @ .7 s.

All use `animation-fill-mode: forwards` to persist the final state. Section hover = soft highlight (drop-shadow on curve, gap-area opacity +6 %), **no re-trigger** of the sequence — a replay without `forwards` leaves elements blank, which was v21's bug.

---

## 7. Interactions

| control | action |
|---|---|
| **Tab J.2 / J.3** | switch active model: swap tile source, update layers, update legend zones, update drawer VIEW/MONITORING/ANALYTICS/MODEL figures. Underline indicator slides. |
| **Search locality** | Mapbox Geocoding query scoped to FVG bbox. Enter → fly camera to result, place pin. |
| **Zones pill** | click opens zone multi-select (Prealpine, Alpine, Carso, Hills, Plain for J.2; Alpine_Snow, Forested_Hills, Rocky_Bare, Steep_Mountain, Transitional_Dry for J.3). Selection filters cells. |
| **Layers panel** | expandable card; click Basemap pill to switch map style; toggle Overlay checkboxes; opacity slider per overlay (v1.1). |
| **Legend** | click header to collapse/expand. |
| **Drawer handle** | click chevron to collapse/expand the entire drawer. |
| **Group header (VIEW/MONITORING/ANALYTICS/MODEL)** | click to collapse/expand group via `grid-template-rows 1fr ↔ 0fr`. |
| **Threshold row** | click a canonical threshold row (0.3/0.5/0.7/0.85) to set it as active filter. Active row colored terracotta with `▸` indicator. |
| **Cell click on map** | popup with cell details: `cell_id`, `y_proba_calibrated`, `macro_zone`, `sub_zone`, `iffi_hit`. |
| **IFFI polygon click** | popup with `id_frana`, `tipo_movimento`, `comune`, `provincia`. Hover scales polygon 1.08 + ring. |
| **Hover row in drawer** | label indents 3 px + vires accent color, value scales 1.08 + colors accent. |

All states (active tab, threshold, zones, basemap, overlays, drawer open/closed) live in a single Zustand store and reflect in the **VIEW** panel rows.

---

## 8. File / directory layout

```
landslide-app/
├── src/
│   ├── app/
│   │   ├── App.tsx                  # shell
│   │   ├── store.ts                 # Zustand state
│   │   └── types.ts
│   ├── map/
│   │   ├── MapView.tsx              # Mapbox GL JS container
│   │   ├── layers/
│   │   │   ├── susceptibility.ts    # PMTiles source + fill-layer
│   │   │   ├── iffi.ts
│   │   │   ├── zones.ts
│   │   │   └── contours.ts
│   │   └── style.ts                 # ramp, colors, basemap list
│   ├── topbar/
│   │   ├── TopBar.tsx
│   │   ├── Tabs.tsx                 # J.2 / J.3 with animated underline
│   │   ├── SearchLocality.tsx
│   │   └── IconButtons.tsx
│   ├── drawer/
│   │   ├── Drawer.tsx               # collapsible container + handle
│   │   ├── Group.tsx                # collapsible group header
│   │   ├── ViewPanel.tsx
│   │   ├── MonitoringPanel.tsx      # InView + Matches + IFFITypes
│   │   ├── AnalyticsPanel.tsx       # Thresholds + Probability + MeanByZone
│   │   ├── ModelPanel.tsx           # Calibration + Model
│   │   └── widgets/
│   │       ├── KVTable.tsx
│   │       ├── Histogram.tsx
│   │       ├── ZoneBars.tsx
│   │       └── CalibrationPlot.tsx
│   ├── map-overlays/
│   │   ├── ZonesPill.tsx
│   │   ├── LayersPanel.tsx
│   │   └── Legend.tsx
│   ├── styles/
│   │   ├── tokens.css               # colors, spacing, easing
│   │   ├── globals.css
│   │   └── animations.css
│   └── main.tsx
├── public/
│   ├── tiles/
│   │   ├── j2.pmtiles
│   │   ├── j3.pmtiles
│   │   └── iffi.pmtiles
│   └── data/
│       ├── zones_j2.json            # per-zone AUC/ECE/prevalence
│       └── zones_j3.json
├── pipelines/
│   └── build_tiles.py               # Python preprocessing
├── scripts/
│   └── deploy.sh
├── tests/                           # Vitest unit + Playwright smoke
├── docs/
│   └── superpowers/specs/           # this file
├── .superpowers/brainstorm/         # gitignored
├── .env.example                     # VITE_MAPBOX_TOKEN
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 9. Accessibility

- All interactive elements are `<button>` / `<input>` / `<label>` (not `<div onClick>`).
- `aria-expanded` on group headers, legend header, layer panel.
- `aria-label` on icon buttons.
- Focus-visible: 2 px forest outline with -2 px offset.
- `prefers-reduced-motion: reduce` → all animations to .01 ms.
- Color is never the sole signal (tabs have underline + weight, active threshold has `▸` marker, etc.).

---

## 10. Performance budget

| metric | target |
|---|---|
| Initial JS bundle (gzip) | < 180 kB |
| Time to first map render | < 2 s on fast 3G |
| PMTiles fetch per zoom | < 500 kB |
| Frame rate during pan/zoom | 60 fps on M1 Air |
| Drawer group collapse | 60 fps |
| Calibration plot mount | finishes in < 1.6 s |

Strategies: GPU-only animations, vector tiles with zoom-based simplification (tippecanoe), Mapbox GL JS worker-thread rendering, React 18 concurrent mode.

---

## 11. Deployment

**Free tier**:
- Mapbox account (user's own token, public scope, bbox-restricted via URL allowlist in production).
- GitHub Pages or Vercel static hosting.
- PMTiles served as plain files from the same origin (no range-request server required; PMTiles v3 supports HTTP range natively).
- No backend.

`.env.example`:
```
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEi...
```

---

## 12. Non-goals (to keep v1.0 focused)

- Phase K.2 / K.3 / K.4 rendering (geometries not in repo, transfer rejected).
- Temporal / hazard overlays (out of v1.0 per model card §2).
- User accounts, auth, saving view state to a backend.
- Mobile-first layout — desktop-primary, mobile receives a degraded experience (drawer forced collapsed, overlay panels stacked).

---

## 13. Open questions (resolve during plan phase)

1. **Zustand vs Context** — decide during implementation. Zustand for DevX; Context if we stay truly small.
2. **Locality search coverage** — Mapbox Geocoding covers comuni/localities but not all frazioni. For the thesis demo that's fine; for Protezione Civile v1.1 we may need ISTAT frazioni gazetteer.
3. **Opacity sliders in Layers panel** — included in mockups but may defer to v1.1 if implementation adds risk.
4. **Contour lines overlay** — listed in Layers panel as "off by default". Source TBD (Mapbox terrain-v2 contour layer is free tier).
5. **Tile generation host** — preprocessing runs locally; do we commit the `.pmtiles` files or serve from a release asset? Size (likely 80-140 MB total) may exceed GitHub's recommended repo size.

---

## Appendix A — Reference commits in `ml-landslide-mapping-audit`

- Model card: `docs/MODEL_CARD_susceptibility_v1.md` (commit of 2026-04-18).
- J.2 artefacts: `docs/audit_results/phase_j2/` (commit of 2026-04-19).
- J.3 artefacts: `docs/audit_results/phase_j3/` (commit of 2026-04-19).
- K.3 rejection analysis: `docs/audit_results/phase_k/k3_analysis.md` (commit of 2026-04-21).
