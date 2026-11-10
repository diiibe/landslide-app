"""Refresh the fixed August 2026 EFFIS study extract, never fabricate a perimeter.
Tree data reuse the existing regional pipeline (uqpq-dr8x); no duplicate census.
"""
import datetime as dt
import json
import math
import os
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET
import requests
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'public/data/spaces/nature/fire-perimeters.geojson'
SOURCE = 'https://maps.effis.emergency.copernicus.eu/effis'
PARAMS = {'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature',
          'typename': 'modis.ba.poly', 'bbox': '12.99,46.38,13.12,46.46',
          'srsName': 'EPSG:4326', 'maxfeatures': 100}
NS = {'g': 'http://www.opengis.net/gml'}

def parse_gml(payload):
    root = ET.fromstring(payload)
    members = root.findall('.//g:featureMember', NS)
    if not members or len(members) >= PARAMS['maxfeatures']:
        raise ValueError('Empty or potentially truncated EFFIS extract')
    rows = []
    ids = set()
    for member in members:
        item = member[0]
        props = {e.tag.split('}')[-1]: e.text for e in item
                 if e.tag.split('}')[-1] not in ('msGeometry', 'boundedBy')}
        if not str(props.get('FIREDATE', '')).startswith('2026-08-'):
            continue
        if props.get('COUNTRY') != 'IT' or props.get('COMMUNE') not in ('Tolmezzo', 'Amaro'):
            continue
        identity = props.get('id')
        if not identity or identity in ids:
            raise ValueError('Missing or repeated EFFIS identity')
        ids.add(identity)
        polygons = []
        for poly in item.findall('.//g:Polygon', NS):
            rings = []
            for ring in poly.findall('.//g:LinearRing/g:coordinates', NS):
                rings.append([[float(v) for v in pair.split(',')[:2]] for pair in (ring.text or '').split()])
            polygons.append(rings)
        geometry = {'type': 'MultiPolygon', 'coordinates': polygons}
        geom = shape(geometry)
        if geom.is_empty or not geom.is_valid or not polygons:
            raise ValueError(f'Invalid source geometry {identity}; preserve previous extract')
        west, south, east, north = geom.bounds
        if not (12.8 < west <= east < 13.3 and 46.2 < south <= north < 46.6):
            raise ValueError(f'Unexpected coordinate order / bounds {identity}')
        area = float(props.get('AREA_HA', 'nan'))
        if not math.isfinite(area) or area <= 0:
            raise ValueError('Invalid AREA_HA')
        rows.append({'type': 'Feature', 'id': identity, 'properties': props, 'geometry': geometry})
    if not rows:
        raise ValueError('No August 2026 study records; previous data retained')
    return sorted(rows, key=lambda f: f['id'])

def write_atomic(data):
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=TARGET.parent, delete=False, encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, separators=(',', ':'))
        name = file.name
    os.replace(name, TARGET)

def main():
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    previous = json.loads(TARGET.read_text()) if TARGET.exists() else None
    try:
        response = requests.get(SOURCE, params=PARAMS, timeout=(15, 45))
        response.raise_for_status()
        rows = parse_gml(response.content)
        data = {'type': 'FeatureCollection', 'features': rows, 'provenance': {
            'provider': 'European Commission, Joint Research Centre (JRC) / Copernicus EMS / EFFIS',
            'url': response.url,
            'license': 'CC BY 4.0',
            'licenseUrl': 'https://forest-fire.emergency.copernicus.eu/about-effis/data-license',
            'retrievedAt': now, 'lastCheckedAt': now,
            'selection': 'bbox 12.99,46.38,13.12,46.46; FIREDATE August 2026; IT; Tolmezzo or Amaro. No attribution of all polygons to a single incident.',
            'changes': 'GML to GeoJSON and selection only; coordinates / source attributes preserved.',
            'note': 'Final mapped footprints, not a time series of fire spread. Source timestamps are not official ignition/extinction. AREA_HA records are not summed as unique area.'}}
        write_atomic(data)
        print(f'OK EFFIS: {len(rows)} August 2026 records')
    except Exception as exc:
        if not previous:
            raise
        # Preserve the exact last successful payload and its acquisition date.
        previous['provenance']['lastCheckedAt'] = now
        previous['provenance']['refreshError'] = str(exc)
        write_atomic(previous)
        print(f'WARNING EFFIS retained previous acquisition: {exc}')

if __name__ == '__main__':
    main()
