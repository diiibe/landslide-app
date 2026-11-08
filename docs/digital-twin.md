# FVG · Territorio: one map, independent layers

The Digital Twin and landslide workspaces are now one application. Open **Livelli
e dati** for a searchable layer tree. Frane, Alluvioni and Contesto coexist with
13 thematic folders (the cartographic sources are inside Contesto). A datum with
a different parameter or unit has its own switch. Several variables and hazard
layers can remain visible together. Layer choices, opacity and open folders are
saved locally. **Analisi** preserves the existing model tools.

On phones the panel opens as a bottom sheet, in touch landscape as a side sheet.
The search, layer switches and Info buttons have touch targets of at least 44px.
“Inquadra il livello” closes the mobile sheet before navigation. Point selection
uses a 44px picking area without enlarging polygon hit areas. Selection and new
PCR samples can trigger a brief feedback ring; there is no simulated continuous
movement. Reduced motion is respected. Source attributes are rendered as text.

## Catalog and coverage

`public/data/regional/catalog.json` is the machine-readable inventory: each layer
records provider, source URL, licence, acquisition date, source data date where
available, extent, coverage, warnings and update errors. Its `families` array
maps all 50 selected Open Data families to their imported or blocked entries.
It is not a claim that the entire regional Open Data portal has been imported.

The first release contains 1,456 catalog entries: 1,451 ready and 5 requiring
external review, plus 19 original PCR variables and radar in the app. “Ready” is
an available distribution or sensor-channel definition: 71 extra PCR channels
currently have no observations and are explicitly labelled, without fake zeroes.
Counts can change as the public sources change. The UI loads only enabled data.
Large distributions use PMTiles; low zooms generalize dense features, with details
available by zooming. Display geometries are simplified by roughly 1–2m; repaired
invalid geometries are marked and counted. Originals remain at the linked source.

The sources cover weather, precipitation, marine conditions and waves, measured
currents by depth, daily air quality and pollens, water sampling and sediments,
energy installations, permits and industrial areas, ports, waste, soil consumption,
habitats and protected areas, schools, care facilities, sport, cultural assets,
transport networks, telecom registries, address points, seismic events and webcam
metadata. An authorisation is not actual industrial output, a public Wi-Fi site
is not live availability, and an antenna is not a coverage or traffic measurement.

## Updates that run automatically

- PCR latest observations, radar, current seismic events and webcam metadata:
  serial checks every 60 seconds after the previous request completes.
- OGS ERDDAP observations: same serial browser checks, requests deduplicated
  across variables sharing a dataset. Measurement frequency and QC come from OGS.
- Regional WFS, Socrata tables, ISPRA soil indicators, building extracts, raster
  cartography and fallback snapshots: GitHub Actions `Aggiorna dati regionali`
  at minute 17 every six hours, or manual workflow dispatch.
- Roads and trails from OSM: first Pages deployment of each UTC day refreshes
  Overpass, later deployments reuse that day's cache.
- An open app checks the local catalog every five minutes and replaces updated
  enabled sources without resetting other layers or the camera.

Hidden browser tabs pause live polling; visibility resumes checks. Requests have
bounded timeouts and are aborted on cleanup. Checking a source every minute does
not make an annual map realtime. `generatedAt` describes catalog generation;
`retrievedAt` is source acquisition, and observations keep their own times (UTC,
displayed in Europe/Rome). There is no promised provider SLA. Historical model
outputs and survey campaigns remain dated scientific products, not sensors.

The scheduled job validates pagination, identities, counts, geometries and assets
before committing data. Failures keep the previous good layer with its acquisition
date and an explicit `refreshError`. Successful parameters from a partially failed
distribution keep their new metadata; only missing parameters recover previous
versions. An uncaught failure or failed validator prevents the publish commit.
The Pages workflow listens for a successful refresh because a GITHUB_TOKEN push
does not itself trigger another push workflow. Schedules follow GitHub's execution
availability and can run late; the last verification is visible in metadata.

## Measurement integrity

Water measurements are keyed by site, parameter, unit and sampling dimensions;
all samples tied at the latest date are preserved. Native WGS84 coordinates are
used where available. Values such as `<0.01` remain censored bounds, not zeroes or
exact measured concentrations. Several analytical units therefore produce separate
layers. Data without point coordinates are aggregated by municipality with an
explicit record-count label. Tourism uses separate arrivals and overnight-stay
metrics and joins boundaries by ISTAT code before names.

OGS observations retain unit, depth and QC: QC0 means no quality control performed,
QC1 is the source's good flag, and questionable/bad flags remain visible. Current
profiles use one coherent latest observation time, not a mixture of old depth
bins. They describe a local measured profile, not currents everywhere in the gulf.
PCR hydrometric references vary by station: there is no misleading common scale.
The 19 original PCR channels retain an interactive 24h observed-history inspector.
Historical chart exploration does not change the latest data on the map.
Radar Info shows product time, live errors and snapshot status.

## Cartography and urban extracts

The 8,152 building footprints cover the two existing Trieste/Monfalcone boxes,
not all FVG. The source campaign is 2017–2020. Unusable heights remain flat.
AIA now uses the automatically refreshed regional registry. Neither represents
instantaneous activity, exposure, structural health or a BIM model.

Regional WMS lacks browser CORS, so a verified tile mirror supplies three raster
layers: true orthophotos 2017–2020, orthophotos 2012 and LiDAR hillshade. The pyramid
is z5–11 with 512px tiles, about 27m pixels at its finest scale. It is a regional
visualization, not the original high-resolution imagery. Coverage layers link to
original LiDAR/DTM/orthophoto resources; raw point clouds are not loaded in-browser.

## External review still needed

1. INEMAR estimated emissions: ARPA legal text combines CC BY with additional
   noncommercial/notification terms. Clarify reuse permission.
2. BusOne real GPS: written organisational/commercial consent and identifying
   client headers required. No automatic integration without that permission.
3. SSM available parking in Udine: reuse licence unconfirmed; no verified
   equivalent feed for Trieste–Monfalcone.
4. Precise RF sampling positions: source projected CRS needs confirmation.
   Municipal record counts and observed maxima remain available and qualified.
5. Bathing areas not matched to official geographic codes: only unambiguous
   matches are plotted. The others require a verified official crosswalk.

These are also listed under **Da revisionare** in the app. Missing points are not
geocoded by guesses. Bathing samples are historical sampling, not an assertion of
current bathing safety. Webcam images are not republished with metadata rights.

## Reproduce and verify

Install Python dependencies from `scripts/regional-requirements.txt` and
Tippecanoe 2.79.0, commit `68ab8dcc229f95b8b25877697d5e8d66783af503`.
Run, in order:

```sh
python scripts/build-regional-data.py --workers 3
python scripts/build-regional-tables.py
python scripts/build-regional-observations.py
python scripts/build-regional-products.py
python scripts/build-regional-supplement.py
python scripts/build-regional-raster.py
python scripts/assemble-regional-catalog.py
python scripts/validate-regional-data.py
python scripts/test_regional_pipeline.py
npm run test:run
npm run build
```

Local JSON caches have a one-hour TTL. Set `FVG_DATA_REFRESH=1` to bypass it;
the scheduled workflow does so. Raster conditional requests can return 304 and
preserve original acquisition dates. Raw response caches stay outside the repo.
Source overrides (`--source`) support targeted WFS/table rebuilds.
