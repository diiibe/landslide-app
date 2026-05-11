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

---

# Follow-up audit — risk-tinted networks, comune choropleth, POI, search autocomplete

Snapshot date: 2026-05-10. Branch: `claude/dreamy-elgamal-8c91cb` (fast-forwarded
to `main`). Method: 2-agent parallel audit (map/perf/types + UI/a11y/mobile).
Triggered by commits `9465465` (data pipeline scripts) and `46e8396` (map
features). Same severity convention as above. Findings here are NEW — no
overlap with the original audit, except where explicitly cross-referenced.

## P0 — blockers

### P0.4 Slider drag triggers unbounded re-bake of 35–40 MB GeoJSON

`src/map-overlays/LayersPanel.tsx:309` fires `onChange` on every `input`
event → `src/app/store.ts:250` → `src/map/MapView.tsx:288-293` (`rebakeRoads`
or `rebakeTrails`). One drag of `gamma` (step 0.05, range 0.3–4) emits
~70 events; each invokes `bakeRiskIntoFeatures` which walks hundreds of
thousands of vertices doing a `(2R+1)²` grid lookup per vertex. With
`radius = 8` that's 289 lookups per vertex per event, no debounce, no
coalescing. UI freezes for the whole drag. **Fix**: trailing-debounce at
the slider (~120 ms) and a "pending params" slot inside
`refreshRoadData` / `refreshTrailData` so the in-flight bake superseded
by newer params is dropped on completion.

### P0.5 `bakingPromise` serialises but does not coalesce

`src/map/layers/roads.ts:86-106` (and the identical block in
`src/map/layers/trails.ts:74-93`) — when N concurrent
`refreshRoadData` calls land, each `await`s the prior, then each runs
its own `bake`. With slider events, 70 sequential bakes queue and ALL
run, even though only the last one's output is visible. **Fix**: store
*desired params* in a `pending` slot; the in-flight bake checks the
slot on completion and re-runs once against the latest params.

### P0.6 Mobile UX regression: LayersPanel default-open with two RiskParamsControl sub-blocks covers the map

`src/app/store.ts:229` `layersPanelOpen: true`, combined with
`layers.roads = true` + `layers.trails = true` defaults, makes the
panel render **two** sensitivity sub-blocks (3 sliders + lock each) on
top of 10 overlay rows + 6 pill rows. With 44 px touch targets enforced
on mobile, the panel is ~850 px tall; at viewport ≤ 480 px the panel
takes `width: calc(100vw - 16px)` and covers the entire map until the
user manually collapses. Re-opens P0.1 from the original audit.
**Fix**: read `matchMedia("(max-width: 768px)")` once at store init and
default `layersPanelOpen: false` on mobile.

## P1 — visible bugs

### P1.9 Default model change broke `store.test.ts`

`src/app/store.test.ts:7-9` asserts `model === "j2"`; `src/app/store.ts:204`
is now `"j3"` (intentional per commit message). **Fix**: update the
assertion. CLAUDE.md §5/§13 — tests should land in the same commit as
the behaviour change.

### P1.10 Model toggle redundantly re-bakes both networks

`src/map/MapView.tsx:167-172` — `sensRoads` is
`s.riskParams.roads[s.model].sensitivity`. When `model` flips, all 6
parameter selectors return new values *and* `model` itself changes →
the model effect runs `rebakeRoads` + `rebakeTrails`, then the param
effects fire `applyRoadSensitivity`/`rebakeRoads` against the new
values. Two redundant rebakes per network on every model switch.
**Fix**: track `prevModel` in a ref; param-only effects no-op when the
model just changed.

### P1.11 `addRoads` / `addTrails` / `addCriticalPoi` run twice per basemap change

`src/map/MapView.tsx:197-203` — `style.load` runs `setupStaticLayers`
*and* `applyThemeToLayers` (lines 119-121). Both call `addRoads` /
`addTrails` / `addCriticalPoi`. Each `add*` removes the existing
layers, re-adds the source, and triggers another `refreshRoadData` /
`refreshTrailData`. So the static GeoJSON is bake-walked twice on every
basemap switch (and once on cold start). **Fix**: gate the
`addRoads`/`addTrails`/`addCriticalPoi` calls inside
`applyThemeToLayers` to actual theme changes; on first `style.load`
let `setupStaticLayers` own them.

### P1.12 Single bake on radius=8 is multi-second blocking work

`src/map/layers/cellGrid.ts:56-69` — 289 `Map.get`s per vertex × ~500K–1M
vertices = 290M lookups + a `Math.pow` per vertex on the JS main
thread. Even with P0.4 / P0.5 fixed, a single legitimate
parameter-change still freezes the UI for 2–6 s. **Fix**: chunk the
feature loop with `await new Promise(r => setTimeout(r, 0))` every N
features, or move the bake to a Web Worker (transferable
`ArrayBuffer` for the cell map + the GeoJSON).

### P1.13 `styleimagemissing` handler leaks across `setStyle()`

`src/map/layers/criticalPoi.ts:72-90` — `missingHandlerInstalled` is a
module-level boolean. After a `setStyle()` MapLibre wipes registered
images but the boolean stays `true`, so the next `style.load` does NOT
reinstall the handler. POI icons render as the default missing-image
dot. Also: handler is never removed on map unmount → strict leak in
test environments. **Fix**: tie to a `WeakMap<MLMap, boolean>` and
reset on `addCriticalPoi` re-entry, plus `m.off("styleimagemissing", …)`
on unmount.

### P1.14 SearchLocality dropdown click-outside ignores touch

`src/topbar/SearchLocality.tsx:124-131` — only listens for
`mousedown`. iOS Safari / Android Chrome don't reliably synthesise
`mousedown` from a touch when the on-screen keyboard is open; the
dropdown stays stuck after the user taps the map. **Fix**: also listen
for `touchstart` (passive) or use `pointerdown`.

### P1.15 Lock toggle is invisible to color-blind + screen-reader users

`src/map-overlays/LayersPanel.tsx:233-242` — `🔓` vs `🔒` emoji + a
border-tint colour change is the *only* state signal. No
`aria-pressed`, no text label, `aria-label` is static. Also
`:focus-visible` on `.lockBtn` may be clipped by the panel's
`overflow: hidden` (`LayersPanel.module.css:9`). **Fix**:
`aria-pressed={!dirty}`, dynamic aria-label ("Save defaults" /
"Defaults match"), replace emoji with a stroke icon + visible "Save" /
"Saved" text, change `.panel` to `overflow: clip`.

### P1.16 Sensitivity sliders missing accessibility wiring

`src/map-overlays/LayersPanel.tsx:296-310` — no `aria-valuetext` (so
VoiceOver reads `1.5` instead of `1.5×`, `0` instead of `0 cells`),
the live numeric value (`<span class={styles.val}>` line 298-301) is
not `aria-describedby`-linked to the slider, and there's no native
size on the thumb in `.paramRow input[type=range]` for desktop touch
targets. **Fix**: add `aria-valuetext={value.toFixed(d) + suffix}`
and `aria-describedby` linking the val span.

## P2 — latent / hardening

### P2.10 Cell-grid coordinate hashing wraps silently outside FVG

`src/map/layers/cellGrid.ts:35,49,63` packs `(gx & 0xffff) << 16 | (gy & 0xffff)`.
For lng/lat in the FVG bbox `gx, gy` fit 16 bits; outside, the encoding
silently wraps with no error — wrong risk value, no detection. **Fix**:
assert at `loadCellGrid` time that all `gx, gy ∈ [0, 0xffff]`, or move
to BigInt / string keys.

### P2.11 No JSON shape validation at any data fetch boundary

`src/map/layers/cellGrid.ts:29` (`as { step, data: number[] }`),
`roads.ts:79`, `trails.ts:67`, `comuni.ts:35`, `criticalPoi.ts:37` all
`as`-cast unvalidated `fetch().json()` to typed shapes. A truncated
GeoJSON (network blip) crashes deep inside the bake. CLAUDE.md §4
requires validation at boundaries. **Fix**: zod schemas in
`src/lib/schemas.ts`, validated once at fetch.

### P2.12 ~15 unsafe `as never` / `as unknown` casts in expression builders

`src/map/layers/{roads,trails,comuni,criticalPoi,smoothHeatmap}.ts` —
the cast pattern is needed only because layer paint expressions are
typed as `unknown`. The MapLibre SDK exports `ExpressionSpecification`.
**Fix**: type expression helpers as `maplibregl.ExpressionSpecification`
and remove the casts.

### P2.13 `clampParams` accepts `NaN` from malformed localStorage

`src/app/store.ts:46-48` — `Number(undefined)` is `NaN`; `clamp(NaN, lo, hi)`
returns `NaN`. A malformed `riskParamsLocked` key bypasses validation.
**Fix**: replace `Number(p?.x ?? d)` with
`Number.isFinite(n) ? n : d` before `clamp`.

### P2.14 `lockRiskParams` not synced cross-tab

`src/app/store.ts:261-272` — `riskParamsDefaults` is captured *once* at
module load. Tab A locks j3-roads → tab B has stale defaults → dirty
chip in `LayersPanel.tsx:241` is wrong until reload. **Fix**: add a
`storage` event listener that re-hydrates defaults; or document as out
of scope.

### P2.15 Build pipeline not wired into CI / no deploy story for the static GeoJSON

`package.json:11-15` adds 5 `build:*` scripts. `roads_fvg.geojson` and
`trails_fvg.geojson` are gitignored (correct — 35–40 MB each). But
there's no documented way for a freshly-cloned CI box to assemble a
deployable bundle: production deploy needs all 5 to have run, and
Overpass is rate-limited / flaky. **Fix**: README "deploy" section
listing the build chain; CI workflow that runs `npm run build:*` and
uploads artifacts; or commit a pinned snapshot to a release artifact.

### P2.16 SearchLocality dropdown accessibility & mobile issues

- `src/topbar/SearchLocality.tsx:184` — `aria-expanded` only reflects
  `open && suggestions.length > 0`. During the 220 ms debounce + fetch
  SR users hear "collapsed" while typing. No "no results" affordance
  for a 2+ char query that returns empty.
- `src/topbar/SearchLocality.module.css:83-87` — `.opt` is ~32 px
  tall (under WCAG 2.5.8 24 px min and far under 44 px touch target).
  No mobile breakpoint, no `title` attribute on truncated names.
**Fix**: a non-result `<li>` when `q.length >= 2 && !loading && !suggestions.length`,
plus `@media (max-width: 768px) { .opt { min-height: 44px } }` and
`title={s.name}` on `<li>`.

### P2.17 Comune choropleth has no legend

`src/map-overlays/LayersPanel.tsx:158-166` toggles `layers.comuni` but
`src/map-overlays/Legend.tsx` has no comune ramp. User enables the
choropleth → colored polygons with no key. **Fix**: extend `Legend`
with a conditional `{layers.comuni && <ComuneRamp />}` block, or
document that the susceptibility ramp doubles for both.

### P2.18 IA confusion: ThresholdControl + sensitivity sub-block coexist — **RESOLVED by design**

`src/app/App.tsx` renders `<ThresholdControl />` (top-left, susceptibility
`p ≥ X` cutoff for cells & heatmap) while `src/map-overlays/LayersPanel.tsx`
hosts the per-network sensitivity / gamma / radius sliders for the risk
tint on roads & trails. The two controls drive different downstream
math on different layers — they're not duplicates. **Decision (2026-05):
keep both as-is.** Re-labeling can happen if user testing surfaces a
real comprehension gap; closing this finding without code change.

### P2.19 Hardcoded ramp gradients duplicated across 3 stylesheets, no dark variant

`src/map-overlays/Legend.module.css:37,52` and
`src/map-overlays/ThresholdControl.module.css:39` —
`linear-gradient(90deg,#E8F0D8 0%,#8BB26B 25%,…)`. Same five hex
duplicated 3×; in dark theme `#E8F0D8` against `--c-surface` = `#1A1A1A`
breaks the neutralised palette. **Fix**: lift to `--c-ramp-stops`
tokens or a `.ramp` utility class with muted dark variant.

## P3 — nits

- `src/map/layers/roads.ts:199-208` — `tintRoadsByRisk` /
  `installRoadTinting` exported "for backwards compatibility" but no
  caller exists. Dead code; delete.
- `src/map-overlays/LayersPanel.tsx:65,84` —
  `data-kind={m.id === "j2" ? "outdoors" : "satellite"}` reuses
  basemap colors for model pills. A 3rd model would silently miscolor.
- `src/map/layers/comuni.ts:87` — `line-color: rgba(60,55,40,0.55)` is
  theme-agnostic; outlines look muddy on dark basemap.
- `src/topbar/SearchLocality.tsx:32` — `navigator.platform` is
  deprecated; `navigator.userAgentData?.platform` is the modern
  replacement (Chromium-only, fine as enrichment).
- `src/map/layers/criticalPoi.ts:114-119` — icon size at z6 with
  importance=1 is ~2 px (sub-readable). Probably intentional faintness;
  flag.
- `src/app/store.ts:90-108` — `initialTheme` now respects
  `prefers-color-scheme`. Closes original P2.9.
- Original P2.5 (`color-mix` fallback in `Group.module.css`) and the
  Sprint 2 popup hardening still hold; not regressed.

## Test gaps to close (cumulative — appended to original list)

6. `bakeRiskIntoFeatures` invariants: identity at `gamma=1, radius=0`
   vs. raw `lookupRiskInGrid`; risk monotone-decreasing as `gamma`
   grows (catches future regressions in the bake math).
7. `clampParams` rejects `NaN` and out-of-range payloads (P2.13).
8. `bakingPromise` coalescing: 5 sequential calls → only 1 final bake
   runs (P0.5).
9. `lockRiskParams` round-trip: lock j3-roads → reload module →
   defaults match (P2.14).
10. `installIconLoader` reattaches across `setStyle()` (P1.13).

## Sprint plan (cumulative)

- **Sprint 4 — urgent perf**: P0.4 + P0.5 + P0.6 + P1.10 + P1.11.
  Slider debounce, bake coalescing, model-switch double-bake,
  basemap double-bake, mobile default-collapsed panel. Touches
  `LayersPanel.tsx`, `MapView.tsx`, `roads.ts`, `trails.ts`,
  `store.ts`. Adds tests #6, #8.
- **Sprint 5 — correctness + a11y**: P1.9 + P1.12 + P1.13 + P1.14 +
  P1.15 + P1.16 + P2.13. Test fix, async chunking, icon handler
  lifecycle, touch click-outside, lock a11y, slider a11y. Adds tests
  #7, #10.
- **Sprint 6 — types + boundary validation**: P2.10 + P2.11 + P2.12.
  zod schemas, `ExpressionSpecification` typing, cell-grid bounds
  assertion.
- **Sprint 7 — UI polish + deploy**: P2.15 + P2.16 + P2.17 + P2.18 +
  P2.19. README/CI for `build:*`, search a11y, comune legend, IA
  decision, ramp tokens. Plus P3 nits in the same pass.

P2.7 (strict TS frontend zod), P2.8 (pipeline tippecanoe — already
done in commit `deeb5ac`/`edf21a9` per the original audit) and the
remaining nits stay deferred until Sprint 7 unless they block earlier
work.
