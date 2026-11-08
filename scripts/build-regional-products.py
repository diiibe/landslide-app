#!/usr/bin/env python3
"""Public PCR point products: current seismic events and webcam metadata."""
import importlib.util,pathlib,json,datetime as dt,math
spec=importlib.util.spec_from_file_location('b',pathlib.Path(__file__).with_name('build-regional-data.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.CACHE.mkdir(exist_ok=True,parents=True);layers=[]
for product,title,folder in [('earthquakes','Eventi sismici · feed corrente PCR','ambiente'),('webcams','Punti webcam della rete PCR','contesto')]:
 url='https://monitor.protezionecivile.fvg.it/api/'+product
 d={'id':'pcr-'+product,'title':title,'folder':folder,'description':'Localizzazioni degli eventi sismici pubblicati nel feed corrente PCR.'if product=='earthquakes'else'Posizioni e metadati delle webcam pubblicate dalla rete PCR. Per le immagini consulta il sito ufficiale.','note':'Il feed corrente può avere una finestra limitata: non è l’intero catalogo sismico. La magnitudo non misura danni o stato strutturale degli edifici.'if product=='earthquakes'else'Il codice di stato della fonte è conservato senza tradurlo in una garanzia di disponibilità. Le immagini non sono ripubblicate, perché le loro condizioni possono essere diverse da quelle dei metadati.','status':'ready','kind':'geojson','liveKind':product,'pollUrl':url,'provider':'Protezione Civile della Regione Friuli Venezia Giulia','sourceId':'PCR:'+product,'sourceUrl':'https://monitor.protezionecivile.fvg.it/','license':'CC BY 4.0 · metadati PCR','licenseUrl':'https://www.protezionecivile.fvg.it/note-legali','cadence':'Verifica automatica ogni minuto','color':'#d7a96b'if product=='earthquakes'else'#9fb5b1'}
 if product=='earthquakes':d['metric']={'field':'__value','unit':'M'}
 try:
  raw=b.fetch(url)
  if raw.get('result')!='OK' or not isinstance(raw.get(product),list):raise ValueError('Formato prodotto PCR non riconosciuto')
  fs=[]
  for row in raw[product]:
   p=dict(row);p['__name']=row.get('description')or row.get('name')or title
   if product=='earthquakes':
    p['__observedAt']=str(row.get('dt','')).replace(' ','T')+'Z';p['__value']=row.get('magnitudo');p['__unit']='M';p['__displayValue']=str(row.get('magnitudo'));p['profondita_km']=row.get('depth')
   f=b.feature({'type':'Point','coordinates':[row.get('lon'),row.get('lat')]},p,title)
   if f:fs.append(f)
  if fs:d=b.save_layer(d,fs,len(raw[product]))
  else:d.update({'count':0,'retrievedAt':b.NOW})
  layers.append(d);print('OK PRODUCT',product,len(fs),flush=True)
 except Exception as e:d.update({'status':'blocked','problem':str(e)});layers.append(d);print('BLOCKED PRODUCT',product,str(e),flush=True)
(b.OUT/'products-catalog.json').write_text(json.dumps({'generatedAt':b.NOW,'layers':layers},ensure_ascii=False,indent=2)+'\n')
