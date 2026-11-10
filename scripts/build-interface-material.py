"""Build the UI collage from the region's exterior, without municipal borders.

The shipped municipality geometries are dissolved and their outer rings used
only as decoration. Analytical source files are never changed.
"""
import json
import math
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
features = json.loads((ROOT / 'public/data/comuni_fvg.geojson').read_text())['features']
region = unary_union([shape(f['geometry']).buffer(0) for f in features]).simplify(.003, preserve_topology=True)
polygons = list(region.geoms) if region.geom_type == 'MultiPolygon' else [region]
# Keep meaningful exterior components; tiny seam fragments are not a regional outline.
polygons = [p for p in polygons if p.area > region.area * .0005]
x0, y0, x1, y1 = region.bounds
aspect = math.cos(math.radians((y0 + y1) / 2))
scale = min(76 / ((x1 - x0) * aspect), 84 / (y1 - y0))
paths = []
for polygon in polygons:
    coords = [((x-x0)*aspect*scale, (y1-y)*scale) for x,y in polygon.exterior.coords]
    paths.append('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in coords)+'Z')
path = ' '.join(paths)
# A deterministic, staggered collage; the central row stays readable in a 60px header.
placements = [(-35,12,-18,.85),(65,-36,22,1.1),(178,22,-12,.78),(274,-32,34,1.05),
              (390,15,-28,.9),(494,-35,12,1.1),(617,18,-10,.84),(711,-25,25,1.05),
              (-2,93,20,1.05),(108,116,-22,.87),(220,92,13,1.05),(337,119,-18,.85),
              (450,92,25,1.0),(568,119,-14,.83),(669,92,18,1.03)]
for theme, ink in [('light','#202b24'),('dark','#edf3e9')]:
    for role, opacity in [('chrome', .115 if theme=='light' else .075),('panel', .04 if theme=='light' else .025)]:
        copies='\n'.join(f'<use href="#fvg-outline" transform="translate({x} {y}) rotate({angle} 38 42) scale({size})"/>' for x,y,angle,size in placements)
        svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="210" viewBox="0 0 720 210">
<title>FriulView — collage del profilo regionale</title>
<desc>Solo contorni esterni della regione, derivati dall'unione dei comuni FVG. Motivo decorativo, non un livello dati. © OpenStreetMap contributors.</desc>
<defs><path id="fvg-outline" d="{path}"/></defs>
<g fill="none" stroke="{ink}" opacity="{opacity}" stroke-width=".85" stroke-linejoin="round" stroke-linecap="round">{copies}</g>
</svg>'''
        (ROOT/f'src/assets/materials/territory-{role}-{theme}.svg').write_text(svg)
print(f'Generated 4 collage materials from {len(features)} municipalities, {len(polygons)} exterior components')
