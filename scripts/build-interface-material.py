"""Build decorative regional linework from the shipped municipality map.

No analytical data is encoded here. Coordinates are simplified/projected only
for the UI engraving, never written back to the geographical source.
"""
import json
import math
from pathlib import Path
from shapely.geometry import shape, MultiLineString

ROOT = Path(__file__).resolve().parents[1]
features = json.loads((ROOT / 'public/data/comuni_fvg.geojson').read_text())['features']
rings = []
for feature in features:
    boundary = shape(feature['geometry']).simplify(.008).boundary
    rings.extend(boundary.geoms if hasattr(boundary, 'geoms') else [boundary])
lines = MultiLineString(rings)
x0, y0, x1, y1 = lines.bounds
aspect = math.cos(math.radians((y0 + y1) / 2))
scale = min(680 / ((x1 - x0) * aspect), 520 / (y1 - y0))
ox = (720 - (x1 - x0) * aspect * scale) / 2
oy = (560 - (y1 - y0) * scale) / 2
paths = []
for line in lines.geoms:
    coords = [(ox + (x - x0) * aspect * scale, 560 - oy - (y - y0) * scale) for x, y in line.coords]
    paths.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in coords))
path = ' '.join(paths)
# Two contrast levels, with the same linework and scale in each semantic role.
for theme, ink in [('light', '#202b24'), ('dark', '#edf3e9')]:
    for role, opacity in [('chrome', .08 if theme == 'light' else .035), ('panel', .035 if theme == 'light' else .018)]:
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="560" viewBox="0 0 720 560">
  <title>FriulView — incisione del territorio</title>
  <desc>Confini comunali FVG semplificati dalla cartografia locale. Motivo decorativo, non un livello dati. © OpenStreetMap contributors.</desc>
  <path d="{path}" fill="none" stroke="{ink}" stroke-width=".75" opacity="{opacity}" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
'''
        (ROOT / f'src/assets/materials/territory-{role}-{theme}.svg').write_text(svg)
print(f'Generated 4 local SVG materials from {len(features)} municipality geometries')
