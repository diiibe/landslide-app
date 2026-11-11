# FriulView cartographic material

The four territory SVGs are decorative produced images derived from the shipped
`public/data/comuni_fvg.geojson` (OpenStreetMap municipality boundaries, assembled
by `scripts/build-comuni.mjs`). © OpenStreetMap contributors; source database
under ODbL: https://www.openstreetmap.org/copyright . Geometry is simplified for
this UI decoration and must not be used for analysis or geographical reference.
The map keeps its visible OpenStreetMap attribution. Regenerate only when needed
with `python3 scripts/build-interface-material.py` (Shapely required).

There is no sensor, model, risk or freshness information in this pattern.

## User-composed navbar · 11 November 2026

`navbar-user-pattern.json` preserves the six stamps exported from the user's
live pattern studio. `navbar-user-pattern.svg` uses their original positions,
size (222), rotation, stroke, ink and opacity without resampling. Its transparent
background is composed over the original #243129 navbar background in CSS.
The material uses the same 1200 × 240 CSS-pixel tile and centered repetition as
the studio preview. It applies only to the navbar, in both interface themes;
other panel materials are unchanged. The outline attribution above still applies.
