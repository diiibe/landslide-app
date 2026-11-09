#!/usr/bin/env python3
"""Publish one catalog, retaining a dated last-known-good layer on provider failure."""
import pathlib,json,datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'public/data/regional';NOW=dt.datetime.now(dt.timezone.utc).isoformat()
previous=json.loads((OUT/'catalog.json').read_text())if(OUT/'catalog.json').exists()else{'layers':[]};old={l['id']:l for l in previous['layers']};layers=[]
for name in ['wfs-catalog.json','tables-catalog.json','observations-catalog.json','products-catalog.json','supplement-catalog.json','raster-catalog.json']:
 f=OUT/name
 if f.exists():
  part=json.loads(f.read_text())
  for layer in part['layers']:layer.setdefault('lastCheckedAt',part['generatedAt'])
  layers.extend(part['layers'])
def available(layer):
 return bool((layer.get('file')and(OUT/layer['file']).exists())or(layer.get('rasterDir')and(OUT/layer['rasterDir']).exists())or layer.get('kind')=='buildings'or(layer.get('liveKind')=='pcr'and layer.get('count')==0))
# A failed source may expand to many parameter layers. Preserve its complete
# previous set, not only a matching aggregate id.
recovered=[];current_ids={l['id']for l in layers}
for layer in layers:
 if layer['status']!='blocked':recovered.append(layer);continue
 candidates=[previous for previous in old.values()if previous['status']=='ready'and(previous['id']==layer['id']or(previous.get('sourceId')==layer.get('sourceId')and previous['id']not in current_ids))and available(previous)]
 for previous in candidates:
  replacement=dict(previous);replacement['refreshError']=layer.get('problem','Fonte non disponibile');replacement['lastCheckedAt']=layer.get('lastCheckedAt',NOW);recovered.append(replacement)
 if not any(previous['id']==layer['id']for previous in candidates):recovered.append(layer)
layers=recovered
ids=[l['id']for l in layers]
if len(ids)!=len(set(ids)):raise ValueError('Identificativi layer duplicati: '+str([x for x in set(ids)if ids.count(x)>1]))
config=json.loads((ROOT/'scripts/regional-sources.json').read_text())['families'];families=[]
for family in config:
 sources={s['id']for s in family['sources']};mapped=[l for l in layers if any(s in sources for s in l.get('sourceId','').split(','))]
 if family['title']=='Ortofoto, rilievo LiDAR e modello del terreno':mapped=[l for l in layers if l.get('sourceId','').startswith('GRIGLIEGEO:QU_')or l.get('kind')=='raster']
 problem=None
 if not mapped:problem='Collegamento alla distribuzione o interpretazione ancora da completare; vedere le schede delle fonti.'
 elif any(l['status']=='blocked'for l in mapped):problem='; '.join(dict.fromkeys(l.get('problem','')for l in mapped if l['status']=='blocked'))
 families.append({'title':family['title'],'layerIds':[l['id']for l in mapped],'problem':problem})
for l in layers:
 if l.get('file')and not(OUT/l['file']).exists():raise ValueError('File mancante per '+l['id'])
 # Metadata from JSON must stay finite and serializable.
 json.dumps(l,allow_nan=False)
compiled={'generatedAt':NOW,'refreshHours':6,'layers':layers,'families':families}
temp=OUT/'catalog.json.tmp';temp.write_text(json.dumps(compiled,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n');temp.replace(OUT/'catalog.json')
# Delete only unreferenced generated flat data files, never user uploads or source catalogs.
keep={l['file']for l in layers if l.get('file')} | {l['overview']['file']for l in layers if l.get('overview')}
for file in OUT.iterdir():
 if file.is_file()and file.suffix in ['.geojson','.pmtiles']and file.name not in keep:file.unlink()
print('CATALOG',len(layers),'ready',sum(l['status']=='ready'for l in layers),'blocked',sum(l['status']=='blocked'for l in layers))
print('FAMILIES',len(families),'covered',sum(bool(f['layerIds'])for f in families))
