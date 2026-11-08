# Digital twin: Trieste–Monfalcone demo

Open **Digital twin** in the top bar. The workspace hides the hazard overlays,
opens the observations drawer and frames the coast. Trieste and Monfalcone
buttons frame the two building extracts. Leaving the workspace restores the
previous hazard layers, 3D setting and camera. Existing uploads are preserved.
The selected object scrolls into view in the drawer. A street-level OpenStreetMap
raster is used if no Mapbox token is configured; satellite and other Mapbox styles
are offered only with a configured token.

The drawer selects wind, temperature, 24-hour precipitation, marine level
(IGM42) or global radiation. Click a sensor for its value, timestamp and the
last 24 hours of observations. Click an AIA site for administrative attributes
and the three nearest stations for the selected variable, with their distances.
These measurements describe the stations, not conditions measured at the site;
no exposure, dispersion or damage model is inferred.

## Sources and refresh

PCR's public JSON API and SRI PNG products are read directly from the browser.
No account, API key, proxy or new deployment service is required. Attribution:
**Fonte: Protezione Civile della Regione Friuli Venezia Giulia**, CC BY 4.0.
The source is https://monitor.protezionecivile.fvg.it/ and its API documentation
is https://monitor.protezionecivile.fvg.it/api/apidocs/index.html.

Each feed performs a serial check every 60 seconds after the previous request
completes. Checks pause in hidden tabs, resume on visibility and abort when the
workspace closes. Automatic checks can be disabled; “Aggiorna adesso” requests
another read. Polling is not the measurement frequency. Observations preserve
UTC timestamps from PCR, displayed in Europe/Rome with a timezone label.
“Recent” means at most 45 minutes old; 45–120 minutes is delayed. Older or
invalid/future observations are grey. These are display freshness categories,
not hazard thresholds or a provider SLA.

On failure, the last successful response remains visible with an error. If no
response has ever arrived, explicitly labelled research snapshots are loaded.
Snapshot times remain those of 8 November 2026. No current values are generated.
The selected station's series is fetched independently, with explicit UTC
bounds and up to 1,000 observations. Gaps longer than 45 minutes are not joined.

Radar uses Fossalon's SRI PNG, delivered with bounding extent in its metadata.
Image bytes are verified and cached in memory as a data URL; MapLibre reuses
them after style changes. CSP therefore allows PCR in connect-src and data:
for the renderer's image fetch. Frame metadata, time and access errors appear
in the drawer. Dry or transparent images are not evidence that the entire
territory has zero precipitation. The official PCR legend remains linked.

DPC's national SRI metadata indicated a nominal five-minute interval in research.
However its WMS and presigned TIFF downloads did not provide CORS headers in
checks, so it is not the browser-native default. A future DPC adapter needs a
permitted distribution/proxy path and must retain DPC's separate licence.

## Physical assets

`public/data/twin/sources.json` records provenance, bounds, dates and counts.
Assets are bounded static extracts served relative to Vite's BASE_URL, including
GitHub Pages subpaths. They are intentionally tracked in Git, not rebuilt from
external WFS in CI. The complete research inventory remains a separate artifact.

AIA has 234 regional records from the regional WFS. Administrative authorisation
is not operational status or instantaneous industrial emissions. Building
extracts from `EDIFICI:DBS_EDIFICATO` contain 3,303 Trieste geometries and 4,849
Monfalcone geometries, from the 2017–2020 Trueortho base. Of these, 1,284 lack a
usable height and stay flat and grey. Heights are not invented. Buildings appear
from zoom 12. This is a 2.5D flat-roof visualisation, not a BIM or current survey.
Regione FVG/IRDAT's standard IODL 2.0 conditions and resource metadata apply.

Extrusions work without Mapbox credentials. Terrain/hillshade requires the
existing valid public Mapbox token; no invalid mapbox:// source is created when
using the public basemap fallback.

## Verification

Build with `npm run build`, lint with `npm run lint`, and run
`npm run test:run -- --pool=forks --maxWorkers=1`. The explicit pool/worker limit
avoids a locally observed hang during the default concurrent test startup.
New tests cover UTC parsing, missing values, observation freshness, georeferencing,
wind direction pairing, serial polling/cancellation and hazard state restoration.
Browser checks additionally exercise actual PCR requests, station series,
building extrusion, style changes, mobile layout and offline fallbacks.
