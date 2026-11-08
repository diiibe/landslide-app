#!/usr/bin/env python3
"""Mirror regional WMS images as dated XYZ tiles for GitHub Pages/WebGL.

The upstream WMS has no CORS header. Tiles preserve original PNG pixels and
are checked automatically, with conditional HTTP requests when supported.
Regional display pyramid: z5..11, 512px. Full-resolution originals stay at source.
"""
import concurrent.futures,datetime as dt,hashlib,io,json,math,os,pathlib,time,requests,xml.etree.ElementTree as ET
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'public/data/regional';NOW=dt.datetime.now(dt.timezone.utc).isoformat();BOUNDS=[12.25,45.5,14.0,46.7];SERVICE='https://irdat-ortofoto.regione.fvg.it/geoserver/ortofoto/wms'
OUT.mkdir(exist_ok=True,parents=True);BASE_POLICY='https://www.regione.fvg.it/rafvg/cms/RAFVG/ambiente-territorio/conoscere-ambiente-territorio/FOGLIA4/'
def tile_range(z):
 n=2**z;x=lambda lon:int((lon+180)/360*n);y=lambda lat:int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
 return[(z,xx,yy)for xx in range(x(BOUNDS[0]),x(BOUNDS[2])+1)for yy in range(y(BOUNDS[3]),y(BOUNDS[1])+1)]
def bbox(z,x,y):
 world=20037508.342789244;step=2*world/(2**z);return[x*step-world,world-(y+1)*step,(x+1)*step-world,world-y*step]
def download_tile(config,tile):
 z,x,y=tile;folder=OUT/config['rasterDir'];dest=folder/str(z)/str(x)/(str(y)+'.png');meta=dest.with_suffix('.http.json');previous=json.loads(meta.read_text())if meta.exists()else{};headers={}
 if previous.get('etag'):headers['If-None-Match']=previous['etag']
 if previous.get('lastModified'):headers['If-Modified-Since']=previous['lastModified']
 # Even without ETags, cached frozen-campaign tiles are rechecked every 6h.
 checked=previous.get('checkedAt');force=os.environ.get('FVG_DATA_REFRESH')=='1'
 if dest.exists()and checked and not force and(dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(checked)).total_seconds()<21600:return previous
 params={'service':'WMS','version':'1.1.1','request':'GetMap','layers':config['wmsLayer'],'styles':'','format':'image/png','transparent':'true','srs':'EPSG:3857','bbox':','.join(map(str,bbox(z,x,y))),'width':512,'height':512}
 for attempt in range(3):
  try:
   r=requests.get(SERVICE,params=params,headers=headers,timeout=(15,65));r.raise_for_status()
   at=dt.datetime.now(dt.timezone.utc).isoformat()
   if r.status_code==304 and dest.exists():previous['checkedAt']=at;meta.write_text(json.dumps(previous));return previous
   if not r.headers.get('content-type','').startswith('image/png'):raise ValueError('WMS non restituisce PNG: '+r.text[:100])
   im=Image.open(io.BytesIO(r.content));im.verify()
   dest.parent.mkdir(exist_ok=True,parents=True);temp=dest.with_suffix('.png.tmp');temp.write_bytes(r.content);temp.replace(dest)
   entry={'checkedAt':at,'retrievedAt':at,'etag':r.headers.get('ETag'),'lastModified':r.headers.get('Last-Modified'),'sha256':hashlib.sha256(r.content).hexdigest()};meta.write_text(json.dumps(entry));return entry
  except (requests.RequestException,ValueError,OSError):
   if attempt==2:raise
   time.sleep(attempt+1)

layers=[]
for name,title,period in [('trueorto_FVG_1720','True ortofoto regionali · 2017–2020','2017–2020'),('ortofoto2012','Ortofoto PCR · 2012','2012'),('Hillshade','Rilievo del terreno LiDAR · hillshade','2017–2020')]:
 d={'id':'raster-'+name.lower().replace('_','-'),'title':title,'folder':'contesto','kind':'raster','status':'ready','provider':'Regione FVG / IRDAT · ortofoto e rilievi','sourceId':'WMS regionali','sourceUrl':'https://www.regione.fvg.it/rafvg/cms/RAFVG/ambiente-territorio/conoscere-ambiente-territorio/FOGLIA5/','license':'IODL 2.0 · standard regionale','licenseUrl':BASE_POLICY,'description':'Immagini georeferenziate del servizio WMS regionale, rese disponibili in tile compatibili con la mappa web.','note':'Campagna '+period+'. Piramide per visualizzazione regionale z5–11 (pixel di circa 27 m alla scala più dettagliata); per il rilievo originale ad alta risoluzione consultare la fonte. Non immagini di oggi.','cadence':'Verifica e sincronizzazione automatiche ogni 6 ore','color':'#9ba99b','dataDate':period,'bounds':[[BOUNDS[0],BOUNDS[1]],[BOUNDS[2],BOUNDS[3]]],'minzoom':5,'maxzoom':11,'wmsLayer':name,'rasterDir':'raster-'+name.lower().replace('_','-')}
 d['tiles']=['data/regional/'+d['rasterDir']+'/{z}/{x}/{y}.png']
 try:
  cap=requests.get(SERVICE,params={'service':'WMS','request':'GetCapabilities','version':'1.3.0'},timeout=30);cap.raise_for_status();doc=ET.fromstring(cap.content);available={n.text for n in doc.findall('.//{http://www.opengis.net/wms}Layer/{http://www.opengis.net/wms}Name')}
  if name not in available:raise ValueError('Il layer WMS non è più pubblicato nelle capacità')
  tiles=[t for z in range(5,12)for t in tile_range(z)]
  with concurrent.futures.ThreadPoolExecutor(3)as ex:items=list(ex.map(lambda t:download_tile(d,t),tiles))
  d['retrievedAt']=min(x['retrievedAt']for x in items);d['lastCheckedAt']=min(x['checkedAt']for x in items);d['tileCount']=len(tiles)
  print('OK RASTER',name,len(tiles),flush=True)
 except Exception as e:
  d.update({'status':'blocked','problem':str(e)});print('BLOCKED RASTER',name,str(e)[:180],flush=True)
 layers.append(d)
(OUT/'raster-catalog.json').write_text(json.dumps({'generatedAt':NOW,'layers':layers},ensure_ascii=False,indent=2)+'\n')
print('DONE RASTER',flush=True)
