# landslide-app — Systematic audit

Snapshot date: 2026-05-10. Branch: `claude/dreamy-elgamal-8c91cb`. Method:
4-agent parallel audit (correctness, performance, security, portability) on
the codebase as it sits today (~2.3K LOC TS/TSX, ~200 LOC Python pipelines,
phase J.2 + J.3 shipping with smooth heatmap, roads/DTM overlays, dark mode).

Findings are triaged by severity. Each entry is `file:line — title — what
fails — fix`.

## P0 — blockers (UX)

### P0.1 Mobile is unusable

- `src/styles/tokens.css:36` + `src/app/App.module.css:8-29` — `--drawer-w:
  280px` is fixed. On a 360 px viewport it eats 78% of the screen.
- `src/map-overlays/{LayersPanel,Legend,ThresholdControl,ZonesPill}.module.css`
  — fixed-position overlays at `12px` insets with hardcoded widths
  (216 / 200 / …) overlap each other on narrow screens.
- `src/topbar/SearchLocality.module.css:1-12` — input fixed `width: 240px`
  overflows topbar at < 380 px.
- All hover-only affordances (`box-shadow`, `transform: translateY(-1px)`)
  give touch users no tap feedback.

**Fix**: introduce `@media (max-width: 768px)` breakpoint set: drawer
collapses by default and opens as overlay (full-screen sheet, not 280 px
column); overlay stack switches to a single bottom-sheet column; search
input becomes fluid; add `:active` states for tap feedback.

### P0.2 No `:focus-visible` ring anywhere

Verified zero hits for `:focus-visible` across `src/`. Keyboard users
have no idea where focus is. **Fix**: 4-line addition in
`src/styles/globals.css`:

```css
*:focus-visible {
  outline: 2px solid var(--c-forest);
  outline-offset: 2px;
}
```

### P0.3 CalibrationPlot is light-only

`src/drawer/widgets/CalibrationPlot.module.css:7,13,47` — `background:
#FFFFFF`, `stroke: #EEF1F4`, `fill: #9CA48C`. White rectangle inside the
dark drawer. **Fix**: drive every color from `tokens.css`.

## P1 — visible bugs

### P1.1 Basemap switch leaks popups & flashes empty overlays

`src/map/MapView.tsx:124-146` — `style.load` handler is registered once
inside the init effect and `popupsRegistered.current` gates a
re-registration. After `setStyle()` MapLibre re-emits `style.load`,
re-runs `setupDataLayers`, but click handlers bound to the previous
layer instances may dangle. **Fix**: register `m.on("style.load",
() => { setupDataLayers(m); registerPopups(m); })` once at init, store
the unsubscribe returned by `registerPopups`, call it before next
re-registration.

### P1.2 Theme/model effects tear down everything

`src/map/MapView.tsx:142-153, 191-196` — both effects call
`setupDataLayers` which removes & re-adds **every** source/layer.
Theme only needs `setPaintProperty` on roads/hillshade. **Fix**: split
`setupDataLayers` into model-dependent (susceptibility + heatmap +
IFFI + zones), theme-dependent (roads + DTM colors only), and static
(loaded once on first `style.load`).

### P1.3 `pctAt` is wrong for non-decile thresholds

`src/drawer/AnalyticsPanel.tsx:51-54` derives "% above threshold" from
the 10-bin histogram via midpoint comparison `lo + 0.05 >= t`. For
`t = 0.85` half of bin 0.8–0.9 is incorrectly counted. **Fix**: derive
from `aboveThr` already returned by `useMapStats` (it's exact); for
the per-zone breakdown extend `useMapStats` to return per-zone
`aboveThr` instead of bucketing.

### P1.4 `useMapStats` can starve under continuous tile loading

`src/map/useMapStats.ts:140-151` — `sourcedata` listener resets the 250 ms
debounce on every tile load → on slow networks `compute` may never run.
Plus `[...ps].sort()` + extra `reduce` makes 3 passes over up to 50 k
features per compute. **Fix**: drop `sourcedata` listener, rely on
`moveend` + `idle`; add max-delay watchdog; collapse to one pass.

### P1.5 Dead IconButtons trap keyboard focus

`src/topbar/IconButtons.tsx:30-43` — Notifications / Settings / Profile
have `cursor: pointer` but no `onClick`. Tab users land on inert
controls. Targets are 28×28 (below WCAG 2.5.8 24 px min, far below the
44 px touch target). **Fix**: remove until they're real.

### P1.6 Light-only hover hex codes break dark theme

- `src/topbar/SearchLocality.module.css:13,41,46` — `#C9D7BE`, `#FBF4E3`,
  `#8A8472`.
- `src/map-overlays/LayersPanel.module.css:26,80` — `#F8F2DF`, `#F0F4EC`.
- `src/drawer/AnalyticsPanel.module.css:10,30` — `#E8D0C6`, `#8A7A6E`.

**Fix**: route all through `tokens.css` (`--c-bg-linen`, `--c-fg-soft`,
etc.) with light/dark variants.

### P1.7 SearchLocality input is unvalidated and races

`src/topbar/SearchLocality.tsx:21-22` — `const [lng, lat] = f.center;`
crashes silently on malformed payload (NaN flyTo). No AbortController:
rapid Enter presses produce out-of-order responses. **Fix**: validate
shape; use AbortController keyed to the input value.

### P1.8 `aria-pressed` missing on basemap / model pills

`src/map-overlays/LayersPanel.tsx:38-66` — `data-active` is the only
selection signal; screen readers can't tell which basemap is active.
**Fix**: add `aria-pressed={active}` to all pill buttons and
ThresholdControl ticks.

## P2 — latent / hardening

### P2.1 No CSP

`index.html` ships without `Content-Security-Policy`. **Fix**: add a
`<meta http-equiv="Content-Security-Policy">` covering self + Mapbox
hosts + `worker-src 'self' blob:` (pmtiles).

### P2.2 Popup HTML interpolates feature props

`src/map/popups.ts:20-50` — `Popup.setHTML` interpolates feature
properties. Today the data is trusted (your pipeline) but the sink is
trivial to remove with `setDOMContent` + `textContent`. **Fix**: build
a `<div>` programmatically.

### P2.3 Mapbox token unrestricted

`VITE_MAPBOX_TOKEN` is intentionally public per Vite, but the token is
not URL-restricted in the Mapbox dashboard. Anyone scraping the bundle
can reuse it. **Fix (account hygiene, no code change)**: scope to
`*.github.io/landslide-app/*`.

### P2.4 Heatmap weight crashes at `threshold === 0`

`src/map/layers/smoothHeatmap.ts:13` — `Math.max(0, threshold - 0.001)`
can produce stop1 == stop2 if threshold reaches 0. Not reachable
today (Threshold = {0.3, 0.5, 0.7, 0.85}) but the comment hints at
"continuous 0.0–1.0" planned. **Fix**: branch when `threshold < 0.01`.

### P2.5 `color-mix` fallback missing

`src/drawer/Group.module.css:46` — Safari < 16.4 silently loses the
hover. **Fix**: declare a fallback `background:` line before the
`color-mix` line.

### P2.6 Bundle: MapLibre dominates initial JS

`maplibre-gl` is ~250 KB gzipped and lives in the initial chunk. **Fix**:
`React.lazy(() => import("./map/MapView"))` in `App.tsx` with a Suspense
skeleton; `manualChunks: { "vendor-map": ["maplibre-gl", "pmtiles"] }`
in `vite.config.ts`.

### P2.7 `tsconfig` is not strict enough

No `noUncheckedIndexedAccess`, no runtime validator at popup boundary.
`useMapStats.ts:71-76, 98, 105` and `popups.ts:11-17, 33-37` cast
`unknown` to a struct without validation. **Fix**: enable
`noUncheckedIndexedAccess`, add zod schemas at popup + fetch boundaries.

### P2.8 `tippecanoe` no presence check, missing `-P`

`pipelines/build_tiles.py:101-115` — `subprocess.run(["tippecanoe",
…])` with no `shutil.which` precheck → cryptic FileNotFoundError on
fresh systems. Missing `-P` and `--read-parallel` halves possible
build throughput. **Fix**: presence check with brew/apt hint;
add `-P --read-parallel`; cache IFFI between J.2/J.3 builds.

### P2.9 `initialTheme()` ignores `prefers-color-scheme`

`src/app/store.ts:9-14` — defaults to `"dark"` ignoring
`window.matchMedia("(prefers-color-scheme: dark)")`. **Fix**: respect
system preference on first visit; persist on user toggle.

## P3 — nits

- `src/map/useMapStats.ts:120` — `zones_active: 5` hardcoded.
- `src/drawer/widgets/Histogram.tsx:3-6` — `RAMP` colors don't match
  `RAMP_STOPS` in `style.ts`.
- `src/map/layers/zones.ts:7` — boundary layer added without explicit
  `layout.visibility` causes a one-frame flash before
  `setZoneBoundariesVisible` runs.
- `src/topbar/SearchLocality.tsx:53` — `⌘K` shown unconditionally;
  Windows/Linux should see `Ctrl K`.

## Test gaps to close (highest leverage)

1. `pctAt` correctness across all 4 thresholds with a known histogram vs
   brute-force ground truth — catches P1.3.
2. `setupDataLayers` re-entrancy after `setStyle()` — assert popup
   handlers bound exactly once — catches P1.1.
3. `weightFor` strictly increasing stops for threshold ∈ {0, 0.3, 0.5,
   0.7, 0.85, 1} — catches P2.4.
4. Pipeline contract test: `attach_probabilities` preserves cells'
   `macro_zone` / `sub_zone` over probs' values — catches a silent
   data overwrite in `pipelines/loader.py:18`.
5. `useMapStats` debounce does not starve under 50 ms `sourcedata`
   spam — catches P1.4.

## Sprint plan

- **Sprint 1 — mobile / a11y / theme**: P0.1 + P0.2 + P0.3 + P1.5 +
  P1.6 + P1.8 + P2.5 + P2.9. CSS modules + IconButtons + store +
  pill buttons. File-disjoint from Sprints 2/3.
- **Sprint 2 — map correctness**: P1.1 + P1.2 + P1.3 + P1.4 + P1.7 +
  P2.4. Touches `src/map/*`, `AnalyticsPanel.tsx`, `SearchLocality.tsx`.
  Adds tests #1, #2, #3, #5.
- **Sprint 3 — bundle + hardening**: P2.1 + P2.2 + P2.6.
  Touches `index.html`, `src/app/App.tsx`, `vite.config.ts`,
  `src/map/popups.ts` (DOM build), `.github/workflows/`, README. The
  popup hardening is in Sprint 3, not 2, so the two never collide on
  popups.ts (Sprint 2 only re-registers).

P2.7 (strict TS) + P2.8 (pipeline) + P3 nits deferred to a follow-up
because they require coordinated retyping or non-frontend work.
