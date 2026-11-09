#!/usr/bin/env python3
"""Small, dated navigation indexes derived from the shipped data, never measurements.

Vector records are decoded at their maximum zoom and deduplicated by the stable
feature identity. Refuse partial coverage. The index is rebuilt after each data
refresh; it neither refreshes nor relabels the observation/acquisition dates.
"""
import collections, datetime as dt, hashlib, json, math, pathlib, subprocess
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/regional'

def leaves(node):
    if node.get('type') == 'Feature':
        yield node
    else:
        for child in node.get('features', []):
            yield from leaves(child)

def eligible(layer):
    if layer.get('status') != 'ready': return False
    if layer.get('kind') == 'buildings': return True
    if layer.get('metric'): return False
    types = layer.get('geometryTypes', [])
    points = any('Point' in t for t in types)
    polygons = any('Polygon' in t for t in types)
    # Extensive land cover / survey grids already are continuous footprints.
    extensive = layer['sourceId'].startswith(('GRIGLIEGEO:', 'CART_NAT:', 'ERSA:')) or layer['sourceId'] in ['SITI_PROT:PRATISTABILI', 'PPR:v_rete_ecologica_ecotopi', 'UNITA_STAT:SEZ_CENS_2021']
    return (points and layer.get('kind') == 'vector' and not polygons and not any('LineString' in t for t in types)) or (polygons and not extensive)

def source_features(layer):
    if layer.get('kind') == 'buildings':
        data=json.loads((OUT.parent/'twin/buildings.geojson').read_text())['features']
        if len(data)!=layer['count']:raise ValueError('Incomplete building coverage')
        return data
    file = OUT / layer['file']
    if layer['kind'] == 'geojson':
        return json.loads(file.read_text())['features']
    # Tippecanoe emits nested collections per tile/layer. Clipped parts share
    # __featureId. Union their footprints before choosing an interior point.
    raw = json.loads(subprocess.check_output(['tippecanoe-decode', '-Z', '14', '-z', '14', str(file)]))
    grouped = collections.defaultdict(list)
    for f in leaves(raw):
        fid = f.get('properties', {}).get('__featureId')
        if fid is None: raise ValueError('Missing stable identity')
        grouped[str(fid)].append(f['geometry'])
    if len(grouped) != layer['count']:
        raise ValueError(f"Incomplete vector coverage: {len(grouped)}/{layer['count']}")
    return [{'geometry': (unary_union([shape(g) for g in parts]) if len(parts) > 1 else shape(parts[0])).__geo_interface__, 'properties': {'__featureId': fid}} for fid, parts in grouped.items()]

def overview(layer, features):
    areas = layer.get('kind') == 'buildings' or any('Polygon' in t for t in layer.get('geometryTypes', []))
    precise_areas = areas and layer.get("kind") != "buildings"
    groups = {}
    for index, f in enumerate(features):
        g = shape(f['geometry'])
        if g.is_empty: continue
        # Small-area markers are navigation only. Do not place markers on
        # extensive polygons which are already readable at the regional scale.
        if areas:
            if 'Polygon' not in g.geom_type: continue
            km2 = g.area * 111.32**2 * math.cos(math.radians(g.centroid.y))
            if km2 >= 1: continue
        p = g.representative_point()
        lon, lat = p.x, p.y
        # ~7 km cells in this region. Boundaries/counts are reproducible and
        # count source records once, including a MultiPoint record just once.
        gx = math.floor((lon + 180) / 360 * 4096)
        gy = math.floor((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 4096)
        identity = str(f.get("properties", {}).get("__featureId", index))
        key = (identity, identity) if precise_areas else (gx, gy)
        b = g.bounds
        v = groups.setdefault(key, {'count': 0, 'x': 0., 'y': 0., 'bounds': list(b)})
        v['count'] += 1; v['x'] += lon; v['y'] += lat
        v['bounds'] = [min(v['bounds'][0], b[0]), min(v['bounds'][1], b[1]), max(v['bounds'][2], b[2]), max(v['bounds'][3], b[3])]
    rows = []
    for (gx, gy), v in sorted(groups.items()):
        rows.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [v['x']/v['count'], v['y']/v['count']] if precise_areas else [round(v['x']/v['count'], 6), round(v['y']/v['count'], 6)]}, 'properties': {'__overview': True, '__count': v['count'], '__bounds': json.dumps(v['bounds'], separators=(',', ':')), '__name': 'Piccole aree censite' if areas else 'Record censiti'}})
    return {'type': 'FeatureCollection', 'features': rows}

def publish_overview(layer, features):
    layer.pop('overview', None)
    if not eligible(layer): return None
    data = overview(layer, features)
    if not data['features']: return None
    payload=json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n'
    name = 'overview-' + layer['id'] + '-' + hashlib.sha256(payload.encode()).hexdigest()[:12] + '.geojson'
    temp = OUT/(name+'.tmp'); temp.write_text(payload); temp.replace(OUT/name)
    count = sum(f['properties']['__count'] for f in data['features'])
    layer['overview'] = {'file': name, 'count': count, 'sourceCount': layer['count'], 'maxCount':max(f['properties']['__count']for f in data['features']), 'resolutionKm':0 if layer.get('kind')!='buildings'and any('Polygon' in t for t in layer.get('geometryTypes',[]))else 7, 'detailZoom':12 if layer.get('kind')=='buildings'else 14 if any('Polygon' in t for t in layer.get('geometryTypes',[]))else 11, 'kind': 'areas' if layer.get('kind') == 'buildings' or any('Polygon' in t for t in layer.get('geometryTypes', [])) else 'registry'}
    return data

def main():
    path = OUT/'catalog.json'; catalog = json.loads(path.read_text()); before=json.dumps(catalog,ensure_ascii=False,sort_keys=True); report = []
    for layer in catalog['layers']:
        if not eligible(layer):
            layer.pop('overview',None)
            continue
        if layer.get('overview',{}).get('detailZoom') and (OUT/layer['overview']['file']).exists():
            oldfile=OUT/layer['overview']['file'];data=json.loads(oldfile.read_text())
            payload=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n'
            name='overview-'+layer['id']+'-'+hashlib.sha256(payload.encode()).hexdigest()[:12]+'.geojson'
            if oldfile.name!=name:(OUT/name).write_text(payload)
            layer['overview'].update({'file':name,'maxCount':max(f['properties']['__count']for f in data['features'])})
            continue
        if not eligible(layer): continue
        try:
            data = publish_overview(layer, source_features(layer))
            if not data: continue
            count = layer['overview']['count']
            report.append({'id':layer['id'], 'count':count, 'groups':len(data['features'])})
            print('OVERVIEW', layer['id'], count, len(data['features']), flush=True)
        except (ValueError, KeyError, subprocess.CalledProcessError) as error:
            # The main data remain available if a complete overview is impossible.
            report.append({'id':layer['id'], 'error':str(error)}); print('NO OVERVIEW', layer['id'], str(error), flush=True)
    if json.dumps(catalog,ensure_ascii=False,sort_keys=True)!=before:
        catalog['generatedAt']=dt.datetime.now(dt.timezone.utc).isoformat()
    temp = path.with_suffix('.json.tmp'); temp.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n'); temp.replace(path)
    keep = {l['overview']['file'] for l in catalog['layers'] if l.get('overview')}
    for file in OUT.glob('overview-*.geojson'):
        if file.name not in keep: file.unlink()
    print('DONE',len(report),'distributions', sum('error' not in r for r in report),'complete', flush=True)
if __name__ == '__main__': main()
