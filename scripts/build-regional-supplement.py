#!/usr/bin/env python3
"""Refresh city building extracts, official soil indicators and PCR fallback data."""
import importlib.util,pathlib,json,datetime as dt,io,math,re,requests,openpyxl,hashlib
from PIL import Image
spec=importlib.util.spec_from_file_location('b',pathlib.Path(__file__).with_name('build-regional-data.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
P=b.OUT;P.mkdir(exist_ok=True,parents=True);b.CACHE.mkdir(exist_ok=True,parents=True);NOW=b.NOW;layers=[]
TWIN=b.ROOT/'public/data/twin';provenance=json.loads((TWIN/'sources.json').read_text());sources_changed=False

def city_buildings():
 d={'id':'twin-buildings','title':'Edifici · Trieste e Monfalcone','folder':'contesto','kind':'buildings','status':'ready','provider':'Regione FVG / IRDAT','sourceId':'EDIFICI:DBS_EDIFICATO','sourceUrl':b.REGION_LICENSE,'license':'IODL 2.0','licenseUrl':b.REGION_LICENSE,'description':'Estratti urbani dell’edificato regionale DBS; le altezze misurate dalla fonte sono estruse dove disponibili.','note':'Campagna 2017–2020, non BIM o rilievo in tempo reale. Gli edifici senza altezza valida restano piatti.','cadence':'Sincronizzazione automatica ogni 6 ore; campagna di origine 2017–2020','color':'#a3b8b4'}
 try:
  fs=[];counts={};boxes=provenance['buildings']['bounds']
  for city,box in boxes.items():
   params={'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':'EDIFICI:DBS_EDIFICATO','outputFormat':'application/json','srsName':'EPSG:4326','bbox':','.join(map(str,box))+',EPSG:4326','count':10000}
   data=b.fetch('https://serviziogc.regione.fvg.it/geoserver/wfs',params);rows=data.get('features',[]);expected=data.get('numberMatched')
   if not str(expected).isdigit()or len(rows)!=int(expected):raise ValueError('Estratto edifici incompleto: '+city)
   valid=0;height_count=0
   for row in rows:
    p=row.get('properties')or{};height=p.get('ALTEZZA_M');known=isinstance(height,(int,float))and math.isfinite(height)and 0<height<=250
    f=b.feature(row.get('geometry'),{'id':str(p.get('ID1')or p.get('ID')or row.get('id')),'city':city,'height':float(height)if known else 0,'heightKnown':known,'area':p.get('AREA_MQ'),'__name':'Edificio · '+city})
    if f:fs.append(f);valid+=1;height_count+=int(known)
   counts[city]={'features':valid,'positiveHeights':height_count}
  if not fs:raise ValueError('Nessun edificio valido')
  temp=TWIN/'buildings.geojson.tmp';temp.write_text(json.dumps({'type':'FeatureCollection','features':fs},ensure_ascii=False,separators=(',',':')));temp.replace(TWIN/'buildings.geojson')
  d.update({'count':len(fs),'sourceCount':sum(v['features']for v in counts.values()),'retrievedAt':min(v for u,v in b.FETCH_TIMES.items()if 'DBS_EDIFICATO'in requests.utils.unquote(u)),'bounds':[[min(x[0]for x in boxes.values()),min(x[1]for x in boxes.values())],[max(x[2]for x in boxes.values()),max(x[3]for x in boxes.values())]],'warnings':[str(sum(1 for f in fs if not f['properties']['heightKnown']))+' edifici senza altezza valida rappresentati piatti.']})
  provenance['buildings']['counts']=counts;provenance['buildings']['retrievedAtUTC']=d['retrievedAt'];print('OK BUILDINGS',len(fs),flush=True)
 except Exception as e:d.update({'status':'blocked','problem':str(e)});print('BLOCKED BUILDINGS',str(e)[:150],flush=True)
 layers.append(d)

city_buildings()
# Soil: always discover the current official workbook from ISPRA's linked data page.
SOIL_PAGE='https://www.isprambiente.gov.it/it/attivita/suolo-e-territorio/suolo/il-consumo-di-suolo/i-dati-sul-consumo-di-suolo'
try:
 html=requests.get(SOIL_PAGE,timeout=40);html.raise_for_status();links=re.findall(r'href=[\"\']([^\"\']+\.xlsx[^\"\']*)',html.text)
 url=next((u for u in links if 'dati_principali'in u and __import__('urllib.parse',fromlist=['urlparse']).urlparse(u).netloc=='www.snpambiente.it'and u.startswith('https://')),None)
 if not url:raise ValueError('La pagina ufficiale non espone più il file dei dati principali: verificare la nuova distribuzione')
 response=requests.get(url,timeout=90);response.raise_for_status();book=openpyxl.load_workbook(io.BytesIO(response.content),data_only=True,read_only=True)
 sheet=next((s for s in book.sheetnames if s.startswith('Comuni_')),None)
 if not sheet:raise ValueError('Foglio Comuni non riconosciuto')
 iterator=book[sheet].iter_rows(values_only=True);headers=next(iterator);rows=[dict(zip(headers,r))for r in iterator];rows=[r for r in rows if str(r.get('Nome_Regione','')).strip()=='Friuli-Venezia Giulia']
 boundary=b.fetch('https://serviziogc.regione.fvg.it/geoserver/wfs',{'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':'UNITA_AMM:COMUNI_FVG','outputFormat':'application/json','srsName':'EPSG:4326','count':1000});geo={str(f['properties']['COD_ISTAT']).zfill(6):f for f in boundary['features']}
 for column in headers:
  if not isinstance(column,str)or not any(x in column for x in ['Incremento netto','Incremento lordo','Ripristino','Suolo consumato']):continue
  d={'id':'soil-'+b.slug(column),'title':column,'folder':'trasformazioni','subfolder':'Consumo di suolo · indicatori ISPRA','description':'Indicatore comunale ufficiale ISPRA/SNPA. Ogni periodo mantiene il proprio intervallo e la propria unità.','note':'Elaborazione su base cartografica annuale; non avanzamento di cantieri o misura in tempo reale. I confronti tra intervalli di durata diversa non sono automaticamente tassi annui.','status':'ready','provider':'ISPRA / SNPA','sourceId':'ISPRA / SNPA','sourceUrl':SOIL_PAGE,'license':'CC BY 4.0 · Data Policy ISPRA','licenseUrl':'https://www.isprambiente.gov.it/files2023/trasparenza/disposizioni-generali-2023/delibera_31ca-_regolamento_data_policy_dati_territoriali_e_ambientali_erogati_da_ispra_-1.pdf','cadence':'Sincronizzazione automatica ogni 6 ore · dati annuali','color':'#be9b68','retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'metric':{'field':'__value','unit':'%'if '[%]'in column else'ha'}}
  fs=[]
  for row in rows:
   code=str(int(row['PRO_COM'])).zfill(6);f=geo.get(code);v=row.get(column)
   if f and isinstance(v,(int,float))and math.isfinite(v):fs.append(b.feature(f['geometry'],{'__name':row['Nome_Comune'],'__value':v,'__unit':d['metric']['unit'],'codice_istat':code,'periodo':column}))
  d['dataDate']=str(max(map(int,re.findall(r'20\d\d',column))))
  layers.append(b.save_layer(d,fs,len(rows),['Collegamento per codice ISTAT a sei cifre; confini comunali regionali.']))
 print('OK SOIL',len(rows),'municipalities',flush=True)
except Exception as e:
 layers.append({'id':'soil-indicators','title':'Consumo di suolo · indicatori ISPRA','folder':'trasformazioni','status':'blocked','description':'Indicatori sul consumo di suolo.','note':'Fonte annuale.','provider':'ISPRA / SNPA','sourceId':'ISPRA / SNPA','sourceUrl':SOIL_PAGE,'license':'CC BY 4.0','licenseUrl':SOIL_PAGE,'cadence':'Annuale','color':'#be9b68','problem':str(e)});print('BLOCKED SOIL',str(e),flush=True)

# Refresh fallback observations too, keeping acquisition provenance separate from measurement time.
try:
 raw=b.fetch('https://monitor.protezionecivile.fvg.it/api/measures/latest');rows=raw if isinstance(raw,list)else raw.get('measures',[])
 if not rows:raise ValueError('Snapshot misure vuoto')
 (TWIN/'sensors-snapshot.json.tmp').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')));(TWIN/'sensors-snapshot.json.tmp').replace(TWIN/'sensors-snapshot.json');provenance['sensors']['snapshotRetrievedAtUTC']=next(v for u,v in b.FETCH_TIMES.items()if '/measures/latest'in u);provenance['sensors']['snapshotMeasureCount']=len(rows);provenance['sensors']['snapshotSensorIds']=sorted({r['sensor_id']for r in rows if isinstance(r.get('sensor_id'),int)})
except Exception as e:print('PCR SNAPSHOT RETAINED',str(e)[:150],flush=True)
try:
 result=b.fetch('https://monitor.protezionecivile.fvg.it/api/radars/1/products',{'last':100});frames=[r for r in result.get('products',[])if r.get('name')=='SRI'and r.get('format')=='image/png'];frame=max(frames,key=lambda r:r['dt']);url='https://monitor.protezionecivile.fvg.it/api/products/'+str(frame['id']);response=requests.get(url,timeout=30);response.raise_for_status();Image.open(io.BytesIO(response.content)).verify();meta={'id':frame['id'],'dt':frame['dt'],'extent':frame['details']['extent']}
 (TWIN/'radar-snapshot.png.tmp').write_bytes(response.content);(TWIN/'radar-snapshot.json.tmp').write_text(json.dumps(meta));(TWIN/'radar-snapshot.png.tmp').replace(TWIN/'radar-snapshot.png');(TWIN/'radar-snapshot.json.tmp').replace(TWIN/'radar-snapshot.json');provenance['radar']['snapshotRetrievedAtUTC']=dt.datetime.now(dt.timezone.utc).isoformat()
except Exception as e:print('RADAR SNAPSHOT RETAINED',str(e)[:150],flush=True)
(TWIN/'sources.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
# Unresolved external rights/feeds remain review items, not empty map layers.
for id,title,folder,source,url,problem in [
 ('review-inemar','Emissioni stimate INEMAR 2023','aria','INEMAR 2023','https://www.arpa.fvg.it/temi/temi/sviluppo-sostenibile/sezioni-principali/inventario-regionale-emissioni-in-atmosfera/catasto-emissioni-2023/','Le note ARPA associano CC BY a condizioni aggiuntive non commerciali e di notifica: serve chiarire il riuso della distribuzione prima della pubblicazione.'),
 ('review-bus','Posizioni GPS autobus TPL FVG','mobilita','BusOne','https://proxy.busone.app/TPLFVG/readme','Il fornitore richiede consenso scritto per organizzazioni e uso commerciale, oltre a intestazioni identificative del client.'),
 ('review-parking','Posti disponibili nei parcheggi di Udine','mobilita','SSM','https://www.ssm.it/mappa-interattiva-real-time-parking','Feed tecnico individuato, condizioni di riutilizzo non confermate; nessun feed equivalente verificato per Trieste–Monfalcone.'),
 ('review-rf-coordinates','Posizioni dei rilievi RF da confermare','infrastrutture','g844-avf4','https://www.dati.friuliveneziagiulia.it/d/g844-avf4','La tabella è importata per Comune, ma i campi gauss_boaga_* hanno valori che richiedono conferma del CRS prima di posizionare i singoli rilievi.'),
 ('review-bathing-join','Aree di balneazione senza corrispondenza geografica','mare','fpj6-y9vk','https://www.dati.friuliveneziagiulia.it/d/fpj6-y9vk','Le aree con codice geografico associabile sono importate. Per le altre occorre una corrispondenza ufficiale fra i codici delle due anagrafi, senza inventare punti.')]:
 layers.append({'id':id,'title':title,'folder':folder,'status':'blocked','provider':source,'sourceId':source,'sourceUrl':url,'license':'Da chiarire','licenseUrl':url,'description':title,'note':'Da sottoporre alla revisione finale.','cadence':'Non attivato','color':b.COLORS[folder],'problem':problem})
(P/'supplement-catalog.json').write_text(json.dumps({'generatedAt':NOW,'layers':layers},ensure_ascii=False,indent=2)+'\n')
print('DONE SUPPLEMENT',len(layers),flush=True)
