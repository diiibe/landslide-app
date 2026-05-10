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
