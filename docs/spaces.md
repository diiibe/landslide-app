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
