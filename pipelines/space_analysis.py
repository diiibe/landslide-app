"""Complete analytical data for the landslide workspace, independent of viewport tiles.

The class grid uses the original model cells. OSM networks are simplified by
3 m in UTM33N and split into <=60 m segments for local exposure sampling.
"""
from pathlib import Path
import gzip, hashlib, json, struct, subprocess
import numpy as np
from PIL import Image
from pyproj import Transformer
import shapely
from pipelines.grid import GRID
from pipelines.model_v2 import load_layer, assign_classes

ROOT=Path(__file__).resolve().parents[1]

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()[:16]

def build(map_dir: Path):
 out=ROOT/'public/data/spaces';out.mkdir(parents=True,exist_ok=True)
 model=json.loads((ROOT/'public/data/model_v2.json').read_text())
 n=GRID.width*GRID.height;classes=[];scores=[]
 for name in ['bodies','diffuse']:
  df=load_layer(map_dir/f'{name}.parquet');idx=df.i.to_numpy()*GRID.width+df.j.to_numpy()
  assert len(df)==model['layers'][name]['cells'] if 'cells'in model['layers'][name] else len(df)>0
  c=np.zeros(n,dtype='u1');c[idx]=assign_classes(df.score.to_numpy(),model['layers'][name]['edges'])
  s=np.full(n,np.nan,dtype='<f4');s[idx]=df.score.to_numpy();classes.append(c);scores.append(s)
 header=struct.pack('<8sIIddd',b'FVGRID1\0',GRID.width,GRID.height,GRID.x0,GRID.y0,GRID.cell)
 payload=header+b''.join(x.tobytes()for x in classes+scores)
 p=out/'model-grid.bin.gz';p.write_bytes(gzip.compress(payload,mtime=0))
 meta={'version':1,'grid':model['grid'],'modelGrid':{'file':p.name,'sha':digest(p),'rawSha':hashlib.sha256(payload).hexdigest()[:16],'bytes':p.stat().st_size},'modelHash':digest(ROOT/'public/data/model_v2.json'),'modelSource':'HazardFVG · model v2 · original parquet cells','networks':{}}
 to_utm=Transformer.from_crs(4326,32633,always_xy=True);to_ll=Transformer.from_crs(32633,4326,always_xy=True)
 for name in ['roads','trails']:
  source=ROOT/f'public/data/{name}_fvg.geojson';collection=shapely.from_geojson(source.read_text());geoms=np.array(list(collection.geoms),dtype=object)
  projected=shapely.transform(geoms,to_utm.transform,interleaved=False)
  projected=shapely.simplify(projected,3)
  valid=shapely.is_valid(projected)&(shapely.length(projected)>.05)
  skipped=int((~valid).sum());projected=shapely.segmentize(projected[valid],60)
  parts=[]
  for geom in projected:
   if geom.geom_type!='LineString':continue
   a=shapely.get_coordinates(geom)
   if len(a)>1:parts.append(np.column_stack((a[:-1],a[1:])))
  seg=np.concatenate(parts);length=np.hypot(seg[:,2]-seg[:,0],seg[:,3]-seg[:,1]);seg=seg[length>.05]
  mid=(seg[:,:2]+seg[:,2:])/2;i=np.floor((GRID.y0-mid[:,1])/GRID.cell).astype(int);j=np.floor((mid[:,0]-GRID.x0)/GRID.cell).astype(int)
  inside=(i>=0)&(i<GRID.height)&(j>=0)&(j<GRID.width);idx=np.clip(i*GRID.width+j,0,n-1)
  bc=np.where(inside,classes[0][idx],0);dc=np.where(inside,classes[1][idx],0)
  local=np.rint((seg-np.array([GRID.x0,GRID.y0,GRID.x0,GRID.y0]))*100).astype('<i4')
  payload=struct.pack('<8sIddI',b'FVNET1\0\0',len(seg),GRID.x0,GRID.y0,16)+local.tobytes()
  p=out/f'{name}.bin.gz';p.write_bytes(gzip.compress(payload,mtime=0))
  lon1,lat1=to_ll.transform(seg[:,0],seg[:,1]);lon2,lat2=to_ll.transform(seg[:,2],seg[:,3])
  temp=Path('/tmp/friulview-spaces')/f'{name}.geojsonl';temp.parent.mkdir(exist_ok=True)
  with temp.open('w')as f:
   # Join adjacent segments with the same classes for rendering only. The
   # complete analytical binary above keeps every <=60 m sampling segment.
   coordinates=[];previous=None;run_classes=None
   def flush():
    if coordinates:
     f.write(json.dumps({'type':'Feature','properties':{'b':run_classes[0],'d':run_classes[1]},'geometry':{'type':'LineString','coordinates':coordinates}},separators=(',',':'))+'\n')
   for k in range(len(seg)):
    pair=(int(bc[k]),int(dc[k]));start=[round(lon1[k],6),round(lat1[k],6)];end=[round(lon2[k],6),round(lat2[k],6)]
    if previous is not None and np.array_equal(previous,seg[k,:2]) and run_classes==pair:
     coordinates.append(end)
    else:
     flush();coordinates=[start,end];run_classes=pair
    previous=seg[k,2:]
   flush()
  tile=ROOT/f'public/tiles/space-{name}.pmtiles'
  subprocess.run(['tippecanoe','--force','--quiet','--output',str(tile),'--layer','network','--minimum-zoom','6','--maximum-zoom','12','--drop-densest-as-needed',str(temp)],check=True)
  meta['networks'][name]={'file':p.name,'sha':digest(p),'rawSha':hashlib.sha256(payload).hexdigest()[:16],'bytes':p.stat().st_size,'segments':len(seg),'sourceFeatures':len(geoms),'skippedDegenerate':skipped,'tiles':tile.name,'tileSha':digest(tile),'source':'OpenStreetMap contributors · ODbL','sourceUrl':'https://www.openstreetmap.org/copyright','method':'Geometry simplified 3m; segments ≤60m; midpoint sampling on 120m model cells'}
  print('OK',name,len(seg),p.stat().st_size,tile.stat().st_size,flush=True)
 (out/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n');print('DONE',p,flush=True)
if __name__=='__main__':
 import argparse
 a=argparse.ArgumentParser();a.add_argument('--map-dir',type=Path,required=True);build(a.parse_args().map_dir)
