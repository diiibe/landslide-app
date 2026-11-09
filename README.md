# FriulView

Mappa unificata del Friuli Venezia Giulia: osservazioni, registri territoriali,
ambiente, città e infrastrutture in layer tematici indipendenti, insieme ai modelli
di suscettibilità ai corpi di frana e alle zone diffuse, alluvioni e inventario IFFI.

## Develop

```
cp .env.example .env    # paste your Mapbox public token
npm install
make tiles               # requires tippecanoe + sibling repo ml-landslide-mapping-audit
make tiles-v2            # model v2 layers; requires sibling repo HazardFVG (see pipelines/README.md)
npm run dev
```

## One regional map

**FriulView** puts landslides, floods, regional registries and observations
on the same map. **Catalogo** opens the central data browser: search by name,
parameter or source, and filter by theme, provider, data type, update cadence or
availability. Add multiple independent layers without closing the catalog.

The **Sulla mappa** sidebar keeps search at the top, followed by individual active
layers and a folder/breadcrumb browser. Select a layer name to inspect its data,
source and display controls. Specialist tools are available through Spazi. There is no obsolete model
selector. The two susceptibility mappings use transparent class overlays with
adjustable minimum class and opacity at both regional and detailed zooms.
Classes are quantiles of model scores, not event probabilities. The two mappings
remain mutually exclusive so overlapping colours cannot imply a combined score.

The sidebar overlays a stable WebGL canvas; opening it changes only safe camera
padding. Saved areas preserve geometry and area. The Frane FVG space calculates complete
current statistics from the original grid, independent of visible map tiles.
Previously saved statistics remain marked as historical. Personal files retain
colour controls and can return from a historical risk tint to a solid colour.

See [catalog, sources, automatic updates and limits](docs/digital-twin.md).
Regional snapshots and PMTiles are tracked. Live PCR/OGS observations are read on
demand; the scheduled pipeline refreshes registries and fallback data every six
hours. Roads and trails are refreshed on the first deployment of each UTC day.

## Interactive spaces

Open **Spazi** to enter **Frane FVG** or five independent demonstration spaces:
industry in Buttrio, a Collio vineyard, retail in Martignacco, Tavagnacco traffic,
and mountain tourism at Sella Nevea. Each space has its own map, sensors, zones
and inspection sheets; returning to the territory restores the previous view.

Frane FVG supports drawn/saved areas, point probes, coverage and class statistics,
comparison of the two mappings, roads/trails and contextual structures, and JSON
analysis export. Demonstrations use deterministic 24/7 simulations, interactive
series, 24-hour replay and hypothetical scenarios. Company names are geographic
references; no real company measurements or affiliation are implied.

See [analytical data, simulation assumptions and rebuilding](docs/spaces.md).

## Test

```
npm run test:run         # vitest (unit + component)
npm run test:e2e         # playwright smoke
```

## Production build / deploy

The map depends on a set of static GeoJSON / sprite assets under
`public/data/` and `public/icons/` that are **gitignored** because of their
size (combined ~80 MB). A fresh clone will build but the roads, trails,
comune, and POI overlays will be empty until these are baked.

Build chain (run in this order, from repo root):

| Script              | Output                                                 | Source           | Approx. time |
|---------------------|--------------------------------------------------------|------------------|--------------|
| `build:cell-grid`   | `public/data/cell_grid_fvg.geojson` (~12 MB)           | local pipelines  | < 1 min      |
| `build:comuni`      | `public/data/comuni_fvg.geojson` (~3 MB)               | local pipelines  | < 1 min      |
| `build:poi`         | `public/data/poi_*.geojson`                            | local pipelines  | < 1 min      |
| `build:icons`       | `public/icons/sprite.{png,json}`                       | local SVG sources| seconds      |
| `build:roads`       | `public/data/roads_fvg.geojson` (~35 MB) and `trails_fvg.geojson` (~40 MB) | **Overpass API** | 2–10 min     |

`build:roads` produces both the roads and the trails layers. It is the
only script that hits the public Overpass API; Overpass is rate-limited,
so the script falls back across a few mirrors with retry-and-backoff —
expect occasional 429s and re-runs.

The deploy workflow builds roads and trails automatically and caches them for
the current UTC day. An unsuccessful source fetch fails that deployment, keeping
the previously published site available. The scheduled regional refresh triggers
a new Pages deployment after its verified data commit.

The non-Overpass scripts (`build:cell-grid`, `build:comuni`,
`build:poi`, `build:icons`) are reproducible from local inputs and are
exercised in CI to make sure they don't bitrot — see
`.github/workflows/ci.yml`.

## Privacy & token scope

The Mapbox public token is consumed via `VITE_MAPBOX_TOKEN` and is statically
inlined into the deployed bundle (Vite replaces `import.meta.env` references at
build time). Anyone viewing the site can extract it from the JS — that is
intentional and supported by Mapbox for client-side use, but it means a
naked token can be reused by third parties to burn your monthly quota.

To prevent quota theft, lock the token down in the Mapbox dashboard:

- **URL restriction**: allow only `https://<your-user>.github.io/landslide-app/*`
  (and `http://localhost:*` while developing).
- **Scopes**: read-only — `styles:read`, `fonts:read`, `tiles:read`, plus
  `geocoding:read` if you want the locality search box to work. Do **not**
  grant any `*:write` scope, and do not grant `downloads:read` (account
  metadata).

The locality search box in the topbar issues requests to
`https://api.mapbox.com/geocoding/v5/mapbox.places/...` with the token and the
typed query. If you publish a privacy notice for this site, disclose that
typed search terms are forwarded to Mapbox for geocoding.

## Reference

- Design spec: [docs/superpowers/specs/2026-04-22-landslide-app-design.md](docs/superpowers/specs/2026-04-22-landslide-app-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-22-landslide-app.md](docs/superpowers/plans/2026-04-22-landslide-app.md)
- Upstream model card: `../ml-landslide-mapping-audit/docs/MODEL_CARD_susceptibility_v1.md`
