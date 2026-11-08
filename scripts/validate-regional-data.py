#!/usr/bin/env python3
"""Validate the shipped regional catalog and every referenced local asset."""
import datetime as dt,json,math,pathlib,re,struct
from shapely.geometry import shape
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'public/data/regional'
def validate():
 catalog=json.loads((OUT/'catalog.json').read_text());ids=set();counts={'geojson':0,'vector':0,'raster':0,'features':0,'blocked':0}
 now=dt.datetime.now(dt.timezone.utc)
 assert len(catalog['families'])==len(json.loads((ROOT/'scripts/regional-sources.json').read_text())['families'])
 for layer in catalog['layers']:
  lid=layer['id'];assert re.fullmatch('[-a-z0-9]+',lid)and lid not in ids,lid;ids.add(lid)
  assert layer['folder']in ['meteo','mare','aria','energia','trasformazioni','attivita','ambiente','acqua','verde','servizi','mobilita','infrastrutture','contesto'],lid
  for field in ['title','sourceId','sourceUrl','provider','license','licenseUrl']:assert layer.get(field),f'{lid}: {field}'
  json.dumps(layer,allow_nan=False)
  if layer['status']=='blocked':assert layer.get('problem'),lid;counts['blocked']+=1;continue
  assert layer['status']=='ready',lid
  if layer.get('retrievedAt'):assert dt.datetime.fromisoformat(layer['retrievedAt'].replace('Z','+00:00'))<=now+dt.timedelta(minutes=5),lid
  bounds=layer.get('bounds')
  if bounds:assert len(bounds)==2 and all(math.isfinite(n)for p in bounds for n in p)and bounds[0][0]<=bounds[1][0]and bounds[0][1]<=bounds[1][1],lid
  kind=layer.get('kind')
  if kind in ['geojson','vector']and layer.get('file'):
   file=OUT/layer['file'];assert file.parent==OUT and file.is_file(),lid
   counts[kind]+=1
   if kind=='vector':
    with file.open('rb')as stream:header=stream.read(127)
    assert header[:7]==b'PMTiles'and header[7]==3,lid
    assert struct.unpack_from('<Q',header,24)[0]<file.stat().st_size,lid
   else:
    data=json.loads(file.read_text());assert data['type']=='FeatureCollection',lid
    assert len(data['features'])==layer['count'],lid
    counts['features']+=len(data['features'])
    for feature in data['features']:
     geom=shape(feature['geometry']);assert not geom.is_empty and geom.is_valid,(lid,feature.get('id'))
     assert all(math.isfinite(v)for v in geom.bounds),lid
     p=feature['properties'];assert p.get('__featureId'),lid
     if p.get('__censored'):assert '__value'not in p,(lid,p)
     if '__value'in p:assert isinstance(p['__value'],(int,float))and not isinstance(p['__value'],bool)and math.isfinite(p['__value']),lid
  elif kind=='raster':
   folder=OUT/layer['rasterDir'];files=list(folder.rglob('*.png'));assert len(files)==layer['tileCount'],lid
   for file in files:
    with Image.open(file)as image:assert image.size==(512,512),file;image.verify()
   counts['raster']+=1
  elif kind=='buildings':assert(ROOT/'public/data/twin/buildings.geojson').is_file(),lid
  else:assert (layer.get('liveKind')=='pcr'or layer.get('pollUrl'))and layer.get('count')==0,lid
 for family in catalog['families']:assert family['layerIds']and all(i in ids for i in family['layerIds']),family['title']
 print(json.dumps({'layers':len(ids),'families':len(catalog['families']),**counts},ensure_ascii=False))
if __name__=='__main__':validate()
