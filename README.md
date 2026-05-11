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

Because of that flakiness and runtime, `build:roads` should be run
**manually before each deploy**, not in CI. The resulting
`roads_fvg.geojson` and `trails_fvg.geojson` should be uploaded as a
GitHub release artifact (or committed to a `data-snapshots` branch and
checked out by the deploy workflow) so the deploy job has them
available without re-hitting Overpass.

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
