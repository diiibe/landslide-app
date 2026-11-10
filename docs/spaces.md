# FriulView spaces

The **Frane FVG** workspace uses the two current HazardFVG maps. Its analysis runs
in a worker on the complete original grid, not on features currently rendered by
MapLibre. Coverage excludes nodata from class percentages. Scores express model
similarity to the inventory; they are not probabilities of a landslide.

Area statistics use intersections in EPSG:32633 with partial-cell area weights.
Road/trail lengths use complete OSM geometry simplified by 3 m and segmented at
60 m; each clipped segment is classified at its midpoint. These are exploratory
exposure indicators, not an engineering or emergency assessment. Saved areas
retain geometry; statistics are calculated against the current published index.

## Rebuilding the index

`make tiles-v2` regenerates both map tiles and the analytical index. Use
`make space-analysis V2_MAP_DIR=/absolute/path/to/model/map` to rebuild the index
and the current-model context networks separately. Dependencies: the Python
pipeline environment (numpy, pandas/parquet, Pillow, pyproj, Shapely 2) and the
`tippecanoe` executable. Inputs are the original `bodies.parquet` and
`diffuse.parquet`, `public/data/model_v2.json`, and the shipped OSM road/trail
GeoJSON. Publish the grid, manifest and both network files/PMTiles together. Context map
tiles are generalized at zooms 6–12 and overscaled above that; analytical binaries
retain every sampling segment.

The manifest records compressed and raw SHA-256 prefixes, model metadata hash,
network provenance and tile hashes. The browser checks the index against the
published model; corruption or mismatched versions produce an error, never a
zero-valued result. Gzip responses are accepted with or without HTTP transparent
decompression, with the appropriate hash verified in either case.

## Demonstration spaces

Fresh entry into any of the five demonstration Spaces selects the dark basemap
when the Mapbox style is available. The UI theme is independent and can remain
light. Users can change the basemap within the Space; leaving restores the
original territory view. Frane FVG starts on the relief basemap. Saved views
continue to restore their explicitly saved basemap.

Industry, vineyard, retail, Tavagnacco traffic and mountain tourism are independent
simulations. Company/place names are geographic references only. Their boundaries,
assets, sensors, capacities, measurements and scenarios are fictional, with no
company affiliation or operational access implied. The three traffic corridors
use OSM geometry clipped to Tavagnacco municipality (ODbL); short junction gaps
under 40 m are joined for illustration, not routing.

Simulations derive their state from absolute time, deterministic smooth variation,
local daily/weekly/seasonal profiles and hypothetical scenarios. They advance
24/7 mathematically even while the page is closed; reopening reconstructs the
current state. No background server is running equipment or recording telemetry.
A visible page refreshes readings every second and animates aggregate flows.
Hidden tabs stop rendering; reduced motion lowers animation frequency. Replay
and charts use the same deterministic engine. Events use absolute time buckets;
vehicle positions use stable entry slots and elapsed travel time.

Retail entries are passages, not unique visitors. Occupancy is synthesized from
arrivals and dwell time and allocated to zones within demonstrative capacity.
Counts, speed, parking and energy must never be presented as observed facts.

## Decision tools

The **Estensioni** map command sits below **Strumenti** and opens the current
workspace's dedicated tools in the right panel (also reachable via its
**Estensioni** tab). Outside a workspace it opens the Space picker. **Strumenti**
retains the general upload, drawing and import/export actions.
Five simulation tools operate on the
same clock/scenario as the map and replay; calculations recompute at the current
minute and on input changes. Hypotheses remain in memory for this browser session,
not on equipment. JSON exports preserve the as-of time, global scenario, tool
parameters, results and whether the data are simulated or versioned real data.

- **Industry:** historical 1/6/24-hour electricity balance, integrated at 5-minute
  intervals. A uniform hypothetical load reduction is compared to the same scope
  and scenario. PV is credited within that scope only; import is bounded at zero.
  The manual tariff excludes fixed charges, taxes and export revenue. Disjoint
  power meters and unchanged production are assumptions, not business findings.
- **Vineyard:** volumetric soil deficit by sensor-equipped parcel. Effective rain
  and root depth are manual assumptions; deficit × illustrative area / irrigation
  efficiency gives gross volume. Reserve is a separate manual m³ input; a tank
  percentage is never converted to volume without a known capacity. Runtime is
  an equivalent at the demo valve's nominal flow, not its current on/off reading.
- **Retail:** presence and service staffing ratios by zone or site, with sampled
  historical peaks. Gate passages and shop occupancy are not added together, and
  illustrative capacity/people-per-staff ratios are not regulatory requirements.
- **Traffic:** a capacity what-if using the existing demand/speed/queue model,
  retaining the same arrival demand and weather. At 100% it reproduces the map's
  baseline. Geometry length / speed is a section indicator, not a routing ETA;
  queues are synthetic demand-capacity indicators rather than microscopic traffic.
- **Mountain:** 2-hour projection of the synthetic access/lift model at 5-minute
  intervals, with zero initial queue. Absolute offered counts accumulate fractional
  expected arrivals; quotas defer visitors outside the site rather than erasing
  demand. Service-slot fractional remainders stay below one and do not bank unused
  seats. Offered = admitted + deferred; admitted = served + final queue. The
  illustrative 07:30–18:00 schedule/wind threshold do not indicate actual lift
  operations or safety. Baseline capacity remains the configured demo capacity.
- **Landslides:** side-by-side analysis of two presets, current or saved polygons,
  using the complete index, selected model and class cutoff. Optional context
  includes full roads/trails. Nodata is explicit and excluded from class shares;
  tiny positive surfaces/lengths retain significant digits instead of rounding
  to zero. Failures are reported independently per area.

Opening a Space requests fresh real sensor/catalog checks, restores automatic
polling and clears any prior replay. Observation polling is serial every 60s
(after a request finishes); catalog checks run every 5 minutes. Publication dates,
source cadence and snapshot/error states remain separate from the simulation
clock. A successful poll does not make old observations current.

Entering the landslide Space invalidates a lightweight manifest version check.
The next analysis revalidates metadata; unchanged indices reuse the current
worker, while changed model/network hashes replace it. Concurrent stale version
responses cannot roll a newer worker back. This is publication-version checking,
not a live landslide monitoring service. Simulated realism is profile/coherence
based and has not been calibrated against these companies' operational telemetry.
