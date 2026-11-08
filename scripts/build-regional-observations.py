#!/usr/bin/env python3
"""Register OGS observations and every remaining public PCR sensor channel."""
import importlib.util,pathlib,json,datetime as dt,math
spec=importlib.util.spec_from_file_location('b',pathlib.Path(__file__).with_name('build-regional-data.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
P=b.OUT;P.mkdir(parents=True,exist_ok=True);b.CACHE.mkdir(parents=True,exist_ok=True)
OGS='https://nodc.ogs.it/erddap/'

def dataset_url(dataset,parameters):
 cols=['time','latitude','longitude','depth','sensor_id']if dataset=='MAMBO3_TS'else['time','latitude','longitude','depth']if dataset=='MAMBO3_PR'else['time','latitude','longitude']
 for par in parameters:cols.extend([par,par+'_QC'])
 return OGS+'tabledap/'+dataset+'.json?'+','.join(cols)+'&time%3E=now-48hour'

def latest(raw,param,name,sensor=None,profile=False):
 t=raw['table'];names=t['columnNames'];idx={n:i for i,n in enumerate(names)};unit=t['columnUnits'][idx[param]];found={}
 rows=t['rows']
 if profile:
  stamps=[r[idx['time']]for r in rows if isinstance(r[idx[param]],(int,float))and dt.datetime.fromisoformat(str(r[idx['time']]).replace('Z','+00:00'))<=dt.datetime.now(dt.timezone.utc)]
  most_recent=max(stamps)if stamps else None;rows=[r for r in rows if r[idx['time']]==most_recent]
 for row in rows:
  get=lambda n:row[idx[n]]if n in idx else None
  v=get(param);qc=get(param+'_QC');stamp=get('time');lat,lon=get('latitude'),get('longitude');depth=get('depth');sid=get('sensor_id')
  if sensor and sid!=sensor:continue
  if not isinstance(v,(float,int))or not math.isfinite(v)or qc==9:continue
  tm=dt.datetime.fromisoformat(str(stamp).replace('Z','+00:00'))
  if tm>dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5):continue
  key=(lat,lon,depth,sid)
  if key in found and found[key]['properties']['__observedAt']>=stamp:continue
  p={'__name':name,'__value':v,'__displayValue':str(v),'__unit':unit,'__observedAt':stamp,'__depth':str(depth)if depth is not None else'','sensor_id':sid,'profondita_m':depth,'qualita_qc':qc,'qualita':'Controllo non eseguito'if qc==0 else'Dato buono secondo la fonte'if qc==1 else'Verificare il controllo qualità della fonte'}
  found[key]=b.feature({'type':'Point','coordinates':[lon,lat]},p,name)
 return [f for f in found.values()if f],unit

layers=[]
responses={}
def shared_fetch(url):
 if url not in responses:responses[url]=b.fetch(url)
 return responses[url]
def ogs_layer(id,title,datasets,param,sensor=None):
 d={'id':id,'title':title,'folder':'mare','subfolder':'Osservazioni OGS','description':'Misure osservate presso le boe OGS. Ogni punto conserva ora, profondità, unità e controllo qualità.','note':'Misure locali: non rappresentano l’intero golfo. QC=0 significa controllo non eseguito; i campioni più vecchi restano datati.','status':'ready','provider':'OGS — Istituto Nazionale di Oceanografia e di Geofisica Sperimentale','sourceId':','.join(datasets),'sourceUrl':OGS+'info/'+datasets[0]+'/index.html','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','cadence':'Verifica automatica ogni minuto · passo della fonte variabile','color':'#5ebfcc','live':[],'liveKind':'erddap'}
 try:
  fs=[];units=set()
  for dataset in datasets:
   meta=shared_fetch(OGS+'info/'+dataset+'/index.json');license_rows=[r for r in meta['table']['rows']if len(r)>4 and r[2]=='license'];lic=' '.join(str(r[4])for r in license_rows)
   if 'creativecommons.org/licenses/by/4.0'not in lic.lower()and'cc-by-4.0'not in lic.lower():raise ValueError('Licenza CC BY 4.0 non confermata nei metadati OGS')
   available={r[1]for r in meta['table']['rows']if r[0]=='variable'}
   pars=sorted(p for p in available if p+'_QC'in available)
   url=dataset_url(dataset,pars);raw=shared_fetch(url);name='MAMBO3'if dataset.startswith('MAMBO')else dataset.removesuffix('_TS');rows,unit=latest(raw,param,name,sensor,dataset=='MAMBO3_PR');fs.extend(rows);units.add(unit)
   s={'url':url,'parameter':param,'name':name}
   if sensor:s['sensorId']=sensor
   if dataset=='MAMBO3_PR':s['profile']=True
   d['live'].append(s)
  if len(units)!=1:raise ValueError('Unità diverse fra i dataset: occorre separarli')
  d['retrievedAt']=min(b.FETCH_TIMES[s['url']]for s in d['live']);d['metric']={'field':'__value','unit':next(iter(units))};d['dataDate']=max(f['properties']['__observedAt']for f in fs)
  result=b.save_layer(d,fs);layers.append(result);print('OK OGS',id,len(fs),flush=True)
 except Exception as e:d.update({'status':'blocked','problem':str(e),'retrievedAt':b.NOW});layers.append(d);print('BLOCKED OGS',id,str(e)[:200],flush=True)

for par,label in [('TEMP','Temperatura acqua a 10 m'),('PSAL','Salinità a 10 m'),('DOXY','Ossigeno disciolto a 10 m'),('CPWC','Clorofilla a a 10 m'),('TUR4','Torbidità a 10 m')]:ogs_layer('ogs-mambo3-'+par.lower(),label+' · MAMBO3',['MAMBO3_TS'],par,'RBRCON3_01')
for par,label in [('EWCT','Corrente est–ovest per profondità'),('NSCT','Corrente nord–sud per profondità')]:ogs_layer('ogs-mambo3-'+par.lower(),label+' · MAMBO3',['MAMBO3_PR'],par)
ogs_layer('ogs-mambo3-vcsp','Componente verticale della corrente · MAMBO3',['MAMBO3_PR'],'VCSP')
for par,label in [('VHM0','Altezza significativa delle onde'),('VTPK','Periodo di picco delle onde'),('VPED','Direzione di picco delle onde')]:ogs_layer('ogs-wave-'+par.lower(),label+' · boe OGS',['DWRG1_TS','DWRG2_TS','DWRG3_TS'],par)
for par,label in [('VZMX','Altezza massima delle onde'),('VTMX','Periodo dell’onda massima'),('VH110','Altezza del decimo più alto delle onde'),('VT110','Periodo del decimo più alto delle onde'),('VAVH','Altezza media delle onde'),('VAVT','Periodo medio delle onde'),('VPSP','Dispersione direzionale delle onde'),('VTZA','Periodo medio zero-crossing')]:ogs_layer('ogs-wave-'+par.lower(),label+' · boe OGS',['DWRG1_TS','DWRG2_TS','DWRG3_TS'],par)
for par,label in [('WDIR','Direzione di provenienza del vento'),('WSPD','Velocità vento'),('DRYT','Temperatura aria'),('ATMS','Contenuto di vapore acqueo'),('RELH','Umidità relativa'),('GSPD','Raffica vento'),('GDIR','Direzione verso cui soffia la raffica'),('HEAD','Parametro HEAD'),('EWSB','Parametro EWSB')]:
 ogs_layer('ogs-mambo3-'+par.lower(),label+' · boa MAMBO3',['MAMBO3_TS'],par,'METEO_01')
 layers[-1]['folder']='meteo'
for par,label in [('CNDC','Conducibilità elettrica acqua'),('PRES','Pressione acqua'),('SVEL','Velocità del suono in acqua')]:ogs_layer('ogs-mambo3-'+par.lower(),label+' · MAMBO3',['MAMBO3_TS'],par,'RBRCON3_01')

# The app already has explicit renderers for these 19 channels.
EXISTING={2,3,6,7,18,22,24,27,38,39,40,41,52,53,57,86,110,111,112}
try:
 cat=b.fetch('https://monitor.protezionecivile.fvg.it/api/sensors');raw=b.fetch('https://monitor.protezionecivile.fvg.it/api/measures/latest');rows=raw if isinstance(raw,list)else raw.get('measures',[])
 if cat.get('result')!='OK' or not isinstance(cat.get('sensors'),list):raise ValueError('Catalogo PCR non riconosciuto')
 for sensor in cat['sensors']:
  sid=sensor.get('id')
  if not isinstance(sid,int)or sid in EXISTING:continue
  name=str(sensor.get('name')or sensor.get('code')or f'Canale {sid}');text=name.lower();folder='mare'if any(s in text for s in ['mare','corrente','foce'])else'acqua'if any(s in text for s in ['idrom','portata','pozzo','falda'])else'verde'if any(s in text for s in ['suolo','foglia','bagnatura'])else'infrastrutture'if any(s in text for s in ['inclin','spostamento','deformaz'])else'meteo'
  d={'id':'pcr-extra-'+str(sid),'title':name+' · '+str(sensor.get('code',sid)),'folder':folder,'subfolder':'Altri canali della rete PCR','description':'Canale del catalogo pubblico PCR. La disponibilità dipende dalle stazioni che pubblicano questa misura.','note':'Nome e unità sono quelli della fonte. Un canale senza osservazioni non viene trasformato in valori nulli o simulati.','status':'ready','kind':'geojson','liveKind':'pcr','pcrSensorId':sid,'provider':'Protezione Civile della Regione Friuli Venezia Giulia','sourceId':'PCR:'+str(sid),'sourceUrl':'https://monitor.protezionecivile.fvg.it/','license':'CC BY 4.0','licenseUrl':'https://www.protezionecivile.fvg.it/note-legali','cadence':'Verifica automatica ogni minuto','color':b.COLORS.get(folder,'#76acb1'),'metric':{'field':'__value','unit':str(sensor.get('unit')or'')}}
  fs=[]
  for r in rows:
   if r.get('sensor_id')!=sid:continue
   val=r.get('value');tm=r.get('dt')
   if not isinstance(val,(int,float))or not math.isfinite(val):continue
   p={'__name':r.get('station_name',name),'__value':val,'__displayValue':str(val),'__unit':d['metric']['unit'],'__observedAt':str(tm).replace(' ','T')+'Z','stationId':r.get('station_id'),'sensorId':sid}
   f=b.feature({'type':'Point','coordinates':[r.get('lon'),r.get('lat')]},p,name)
   if f:fs.append(f)
  if fs:d=b.save_layer(d,fs);d['liveKind']='pcr';d['pcrSensorId']=sid
  else:d.update({'count':0,'retrievedAt':b.NOW,'geometryTypes':['Point'],'warnings':['Nessuna osservazione nella risposta latest al momento dell’acquisizione. Il canale viene verificato automaticamente.']})
  layers.append(d)
 print('PCR catalog',len(cat['sensors']),'registered extras',sum(l.get('liveKind')=='pcr'for l in layers),flush=True)
except Exception as e:print('PCR EXTRA ERROR',str(e),flush=True);raise
(P/'observations-catalog.json').write_text(json.dumps({'generatedAt':b.NOW,'layers':layers},ensure_ascii=False,indent=2)+'\n')
print('DONE OBSERVATIONS',len(layers),flush=True)
