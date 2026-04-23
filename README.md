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

## Reference

- Design spec: [docs/superpowers/specs/2026-04-22-landslide-app-design.md](docs/superpowers/specs/2026-04-22-landslide-app-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-22-landslide-app.md](docs/superpowers/plans/2026-04-22-landslide-app.md)
- Upstream model card: `../ml-landslide-mapping-audit/docs/MODEL_CARD_susceptibility_v1.md`
