#!/usr/bin/env python3
"""Prepare georeferenced Open Data FVG tables, preserving dates and indicators."""
import argparse, concurrent.futures, datetime as dt, importlib.util, json, math, pathlib, re, unicodedata, collections
from pyproj import Transformer
spec=importlib.util.spec_from_file_location('regional_build',pathlib.Path(__file__).with_name('build-regional-data.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
BASE='https://www.dati.friuliveneziagiulia.it'; OUTPUT=b.OUT; CACHE=b.CACHE;NOW=b.NOW
SOURCES={}
for fi,fam in enumerate(b.CONFIG):
 for s in fam['sources']:
  if re.fullmatch(r'[a-z0-9]{4}-[a-z0-9]{4}',s['id'])and s['id']not in SOURCES:
   SOURCES[s['id']]={'id':'open-'+s['id'],'title':fam['title'],'folder':b.FOLDERS[fam['group']],'description':fam['what'],'note':fam['limit'],'family':fi,'provider':'Regione FVG / Open Data FVG','license':'IODL 2.0','licenseUrl':'https://www.dati.friuliveneziagiulia.it/','sourceId':s['id'],'sourceUrl':s['url'],'cadence':fam['cadence'],'color':b.COLORS[b.FOLDERS[fam['group']]]}
# Distinct distributions mentioned inside a family receive their own label.
TITLES={'qp5k-6pvm':'PM10','d63p-pqpr':'PM2.5','ke9b-p6z2':'Biossido d’azoto NO₂','7vnx-28uy':'Ozono O₃','2zdv-x7g2':'Biossido di zolfo SO₂','t274-vki6':'Monossido di carbonio CO · archivio','dayp-qnyx':'Particolato totale sospeso · archivio','efx9-g469':'Parchi e giardini catalogati','7eat-pecq':'Ciclovie locali · PPR','38yx-qk7a':'Ciclovie regionali e d’ambito · 2020','fcre-uegn':'Numeri civici ASCOT · 2024','d28y-fjtt':'Numeri civici non ASCOT · 2024','53ur-f9mj':'Punti Wi-Fi pubblici','vw6s-ayge':'Residenze per anziani','uqpq-dr8x':'Alberi di Villa Manin · archivio','k8yw-gcpj':'Rilievi radon · archivio','fiiw-i5su':'Strutture alberghiere e RTA · per Comune','ti84-itu7':'Siti inquinati · censimento 2025 per Comune','28hy-b3b2':'Stazioni radio base per telefonia','g844-avf4':'Misure del campo elettrico RF','rnci-smsu':'Pollini','7eps-cpgr':'Flussi turistici comunali','nqb3-7fg7':'Commercio Udine · aggregato','vny3-2fkg':'Atti degli albi pretori · per Comune','wthn-aebz':'Qualità delle acque sotterranee','q8d6-8b5n':'Qualità delle acque superficiali interne','qcsf-bwk5':'Qualità delle acque marine e di transizione','7wmi-havi':'Sonde multiparametriche nelle acque','f68q-kif9':'Qualità dei sedimenti','fpj6-y9vk':'Campionamenti di balneazione'}
for sid in SOURCES:SOURCES[sid]['title']=TITLES.get(sid,SOURCES[sid]['title'])

def normal(s):
 s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().upper();return re.sub(r'[^A-Z0-9]','',s)

def iso(s):
 try:return dt.datetime.fromisoformat(str(s).replace('Z','+00:00')).replace(tzinfo=dt.timezone.utc)
 except (ValueError,TypeError):return None

def number(v):
 if v is None or isinstance(v,bool):return None
 if isinstance(v,str)and re.match(r'^\s*[<>≤≥]',v):return None
 try:n=float(str(v).replace(',','.'));return n if math.isfinite(n)else None
 except (ValueError,TypeError):return None

def table(sid, meta):
 columns={c['fieldName']:c for c in meta.get('columns',[])if not c['fieldName'].startswith(':')}
 fields=set(columns);params={};cut=None;latest=None
 datefield=next((x for x in ['data_misura','data_misurazione','al','data','datait']if columns.get(x,{}).get('dataTypeName')=='calendar_date'),None)
 if datefield and sid not in ['28hy-b3b2']:
  first=b.fetch(BASE+'/resource/'+sid+'.json',{'$where':datefield+' is not null','$order':datefield+' DESC','$limit':1})
  if first:latest=iso(first[0].get(datefield))
  if latest:
   cut=(latest-dt.timedelta(days=730)).isoformat()[:10];params['$where']=datefield+" >= '"+cut+"'";params['$order']=datefield+' ASC,:id ASC'
 if sid=='28hy-b3b2':
  group=['impianto','operatore','stato_attivazione','comune','provincia','etrs89est','etrs89nord'];params['$select']=','.join(group)+',max(data) as data';params['$group']=','.join(group);params['$order']=','.join(group)
 else:
  params.setdefault('$order',':id')
  params['$select']='*, :id as source_row_id'
 rows=[];offset=0
 while True:
  d=b.fetch(BASE+'/resource/'+sid+'.json',dict(params,**{'$limit':25000,'$offset':offset}))
  if not isinstance(d,list):raise ValueError('Formato tabella non riconosciuto')
  rows.extend(d)
  if len(d)<25000:break
  offset+=len(d)
  if offset>600000:raise ValueError('Tabella troppo estesa: necessario partizionamento')
 hashes=[str(r.get('source_row_id'))if 'source_row_id'in r else json.dumps(r,sort_keys=True)for r in rows]
 if len(hashes)!=len(set(hashes)):raise ValueError('Paginazione con righe sovrapposte: scarico non pubblicabile')
 countparams={k:v for k,v in params.items()if k not in ['$order','$select']}
 if '$group'in countparams:
  # Number of groups is checked by materialized distinct group keys above.
  expected=len(rows)
 else:
  countparams['$select']='count(*) as n';expected=int(b.fetch(BASE+'/resource/'+sid+'.json',countparams)[0]['n'])
 if len(rows)!=expected:raise ValueError(f'Scarico incompleto: {len(rows)} / {expected} righe')
 return rows,fields,datefield,cut

MUNICIPALITIES=None
def municipalities():
 global MUNICIPALITIES
 if MUNICIPALITIES is None:
  d=b.fetch('https://serviziogc.regione.fvg.it/geoserver/wfs',{'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':'UNITA_AMM:COMUNI_FVG','outputFormat':'application/json','srsName':'EPSG:4326','count':1000})
  if d.get('type')!='FeatureCollection':raise ValueError('Confini comunali non disponibili')
  MUNICIPALITIES={}
  for f in d['features']:
   p=f.get('properties')or{};name=p.get('NOME')or p.get('DENOM_COM')or p.get('COMUNE')or p.get('DENOMINAZIONE')
   if name:MUNICIPALITIES[normal(name)]=f
   code=p.get('COD_ISTAT')or p.get('CODICE_ISTAT')or p.get('PRO_COM')
   if code is not None:MUNICIPALITIES[str(code).split('.')[0].zfill(6)]=f
  if len(MUNICIPALITIES)<200:raise ValueError('Schema dei confini comunali non riconosciuto')
 return MUNICIPALITIES

COORDS=[('longitudine','latitudine'),('lon_wgs84','lat_wgs84'),('long_wgs84','lat_wgs84'),('lon','lat'),('longit','lat'),('coord_long','coord_lat'),('x','y')]
BATH_UNITS={'escherichia_coli':'UFC/100 ml','enterococchi_intestinali':'UFC/100 ml','temp_dell_acqua':'°C','temp_dell_aria':'°C','altezza_onde':'m','direzione_della_corrente':'° rispetto al nord','intensita_della_corrente':'m/s','intensita_del_vento':'m/s'}
BALNEAZIONE=None
def bathing_points():
 global BALNEAZIONE
 if BALNEAZIONE is None:
  d=b.fetch('https://serviziogc.regione.fvg.it/geoserver/wfs',{'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':'IDROGRAF:AP_BALNEAZIONE','outputFormat':'application/json','srsName':'EPSG:4326','count':1000})
  groups=collections.defaultdict(list)
  for f in d.get('features',[]):groups[f.get('properties',{}).get('EUPACODE')].append(f.get('geometry'))
  BALNEAZIONE={key:geometries[0]for key,geometries in groups.items()if len({json.dumps(g,sort_keys=True)for g in geometries})==1}
 return BALNEAZIONE
def geometry(row,sid):
 if sid=='fpj6-y9vk':
  code=str(row.get('id_area_balneazione')or'')
  if re.fullmatch(r'IT006\d{9}',code):return bathing_points().get('IT06BA'+code[5:])
  return None
 for v in row.values():
  if isinstance(v,dict)and v.get('type')in ['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon']:return v
 for lon,lat in COORDS:
  x,y=number(row.get(lon)),number(row.get(lat))
  if x is not None and y is not None and 11.4<x<15.6 and 44.4<y<47.3:return {'type':'Point','coordinates':[x,y]}
 if sid=='28hy-b3b2':
  x,y=number(row.get('etrs89est')),number(row.get('etrs89nord'))
  if x is not None and y is not None:
   lon,lat=Transformer.from_crs('EPSG:25833','EPSG:4326',always_xy=True).transform(x,y)
   return {'type':'Point','coordinates':[lon,lat]}
 return None

def aggregate(defn,rows,fields,result=None):
 if result is None:result=[]
 municipal=municipalities();counts=collections.defaultdict(list);unmatched=0
 for r in rows:
  name=next((r.get(k)for k in ['dencomune','comune','citta','descrizionecomune','ente']if r.get(k)),None)
  if name and str(name).upper().startswith('COMUNE DI '):name=str(name)[10:]
  rawcode=r.get('comune_codice')or r.get('comune_codice_istat')
  code=str(rawcode).split('.')[0].zfill(6)if rawcode is not None else''
  key=code if code in municipal else normal(name)
  if key not in municipal:unmatched+=1;continue
  counts[key].append(r)
 fs=[]
 for key,rr in counts.items():
  mf=municipal[key];p=dict(mf['properties']);p['__name']=str(next((r.get(k)for r in rr for k in ['dencomune','comune','citta','descrizionecomune','ente']if r.get(k)),key));p['__value']=len(rr);p['__unit']='record nel dataset';p['record_censiti']=len(rr)
  if defn['sourceId']=='7eps-cpgr':
   for metric in ['arrivi','presenze']:p[metric]=sum(number(x.get(metric))or 0 for x in rr)
  if defn['sourceId']=='g844-avf4':
   values=[number(x.get('misura_v_m'))for x in rr];values=[v for v in values if v is not None]
   if values:p['massimo_rf_v_m']=max(values)
  p['__summary']='Aggregazione comunale; nessuna localizzazione dei singoli oggetti dedotta.';f=b.feature(mf['geometry'],p)
  if f:fs.append(f)
 warnings=[f'Aggregati {sum(len(r)for r in counts.values())} record per Comune, non punti di singole attività. {unmatched} righe non associabili a un confine escluse.']
 defn['title']+=' · aggregato comunale' if 'Comune'not in defn['title']and'aggregato'not in defn['title']else''
 defn['metric']={'field':'__value','unit':'record nel dataset'}
 if defn['sourceId']in ['7eps-cpgr','g844-avf4']:
  metrics=['arrivi','presenze']if defn['sourceId']=='7eps-cpgr'else['record_censiti','massimo_rf_v_m']
  for metric in metrics:
   d=dict(defn);d['id']+='-'+b.slug(metric);d['title']+=' · '+('massimo osservato V/m'if metric=='massimo_rf_v_m'else metric.replace('_',' '));d['metric']={'field':'__value','unit':'V/m'if metric=='massimo_rf_v_m'else'record nel dataset'if metric=='record_censiti'else metric}
   if metric=='massimo_rf_v_m':d['note']='Massimo dei valori numerici misurati nei campioni del Comune nella finestra acquisita. Non è il campo elettrico in ogni punto, né un confronto con limiti normativi. Le posizioni dei singoli rilievi attendono conferma del CRS.'
   metric_features=[]
   for f in fs:
    p=dict(f['properties'])
    if metric not in p:continue
    p['__value']=p[metric];p['__unit']=d['metric']['unit'];p.pop('__featureId',None)
    metric_features.append(b.feature(f['geometry'],p))
   result.append(b.save_layer(d,metric_features,len(rows),warnings))
  return result
 result.append(b.save_layer(defn,fs,len(rows),warnings));return result

def process(sid):
 definition=dict(SOURCES[sid]);result=[]
 try:
  meta=b.fetch(BASE+'/api/views/'+sid+'.json');license=meta.get('license')or{}
  if license and license.get('name')!='Italian Open Data License 2.0':raise ValueError('Licenza della distribuzione da verificare: '+str(license))
  definition['license']=license.get('name')or'IODL 2.0 · standard regionale (metadato non impostato)';definition['licenseUrl']=license.get('termsLink',b.REGION_LICENSE);definition['sourceTitle']=meta.get('name')
  rows,fields,datefield,cut=table(sid,meta)
  if not rows:raise ValueError('La fonte non contiene righe utilizzabili')
  if cut:definition['windowStart']=cut
  original=len(rows)
  definition['inputRows']=original
  # The latest available period is selected, not all historical declarations added together.
  if sid=='7eps-cpgr':
   year=max(number(r.get('anno'))or 0 for r in rows);rows=[r for r in rows if number(r.get('anno'))==year];definition['dataDate']=str(int(year));definition['note']='Totali comunali per l’anno '+str(int(year))+'. Non presenze osservate in questo momento.'
  if sid=='nqb3-7fg7' and 'trimestre'in fields:
   periods={str(r.get('trimestre')or'')for r in rows};definition['periodValues']=sorted(periods)
   def quarter(value):
    match=re.match(r'^(20\d\d)\s*-\s*(IV|III|II|I)\s+Trimestre',value)
    return (int(match[1]),{'I':1,'II':2,'III':3,'IV':4}[match[2]])if match else None
   if periods and all(quarter(x)for x in periods):
    period=max(periods,key=quarter);rows=[r for r in rows if str(r.get('trimestre'))==period];definition['dataDate']=period
    rows=list({str(r.get('codice')):r for r in rows if r.get('codice')}.values())
  # Consolidate station/parameter observations, and station radio base declarations.
  latest={};valid_rows=[]
  dated=[]
  for r in rows:
   stamp=r.get(datefield)if datefield else r.get('data');tm=iso(stamp)
   if tm and tm>dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5):continue
   valid_rows.append(r)
   if tm:dated.append(tm.isoformat())
   if sid in ['qp5k-6pvm','d63p-pqpr','ke9b-p6z2','7vnx-28uy','2zdv-x7g2','t274-vki6','dayp-qnyx']:
    k=(r.get('ubicazione'),r.get('longitudine'),r.get('latitudine'))
   elif sid=='rnci-smsu':k=(r.get('sito'),r.get('genere'),r.get('famiglia'))
   elif sid=='28hy-b3b2':k=(r.get('impianto'),r.get('operatore'))
   elif sid=='fpj6-y9vk':k=(r.get('id_area_balneazione'),)
   elif datefield and ('parametro'in fields or 'prova'in fields):k=(r.get('codicepunto'),r.get('parametro')or r.get('prova'),r.get('um')or r.get('unitadimisura'),r.get('profondita')or r.get('quotacampionamento')or r.get('profonditasedimento'),r.get('frazionegranulometria'))
   else:k=None
   if k is None:continue
   if k not in latest or str(stamp or'')>str(latest[k][0].get(datefield or'data')or''):latest[k]=[r]
   elif str(stamp or'')==str(latest[k][0].get(datefield or'data')or''):latest[k].append(r)
  rows=[r for rr in latest.values()for r in rr]if latest else valid_rows
  if dated:definition['dataDate']=max(dated)
  hasgeom=any(geometry(r,sid)for r in rows[:200])
  if not hasgeom:
   if any(k in fields for k in ['dencomune','comune','citta','descrizionecomune','ente']):return aggregate(definition,rows,fields,result)
   raise ValueError('La tabella non espone coordinate né un Comune associabile: serve una corrispondenza ufficiale')
  parameter='genere'if sid=='rnci-smsu'else'parametro'if 'parametro'in fields else'prova'if 'prova'in fields else None
  unitfield=next((k for k in ['unita_misura','unita_di_misura','um','unitadimisura']if k in fields),None)
  metrics=([k for k in ['media_giornaliera','media_oraria_max','media_mobile_8h_max']if k in fields]or[next((k for k in ['risultato','dato','valore','media','misura_v_m','temp_dell_acqua']if k in fields),None)])
  if sid=='fpj6-y9vk':metrics=[k for k in ['escherichia_coli','enterococchi_intestinali','temp_dell_acqua','temp_dell_aria','altezza_onde','direzione_della_corrente','intensita_della_corrente','direz_prov_onde','intensita_del_vento','direzione_del_vento','pioggia','copertura_nuvol','stato_del_mare_lago']if k in fields]
  parameters=sorted({(str(r.get(parameter)),str(r.get(unitfield)or''))for r in rows if r.get(parameter)})if parameter else[(None,None)]
  for par,unit in parameters:
   rr=[r for r in rows if str(r.get(parameter))==par and str(r.get(unitfield)or'')==unit]if par else rows
   for metric in metrics:
    d=dict(definition);suffix=('-'+b.slug(par+'-'+unit)+'-'+b.hashlib.sha1(json.dumps([par,unit]).encode()).hexdigest()[:8])if par else''
    if len(metrics)>1:suffix+='-'+b.slug(metric)
    d['id']+=suffix
    if par:
     d['title']+=' · '+par+(' ['+unit+']'if unit else'')
     d['subfolder']=definition.get('sourceTitle',definition['title'])
    if metric and len(metrics)>1:d['title']+=' · '+metric.replace('_',' ')
    fs=[]
    for row in rr:
     props=dict(row)
     if sid=='fcre-uegn':props['__name']=' '.join(str(row.get(k)or'')for k in ['denominaz2','etichetta'])+' · '+str(row.get('denominazi')or'')
     if sid=='d28y-fjtt':props['__name']=' '.join(str(row.get(k)or'')for k in ['indirizzo_','civico'])+' · '+str(row.get('nome_comun')or'')
     if row.get('codicepunto'):props['__name']=str(row.get('nomecorpoidrico')or row.get('nomepunto')or'Punto')+' · '+str(row['codicepunto'])
     depth=row.get('profondita')or row.get('quotacampionamento')or row.get('profonditasedimento')
     if depth is not None:props['__depth']=str(depth)
     if metric:
      v=number(row.get(metric));props['__displayValue']=str(row.get(metric,'Non disponibile'))
      if v is not None:props['__value']=v
      props['__unit']=str(row.get(unitfield)or('V/m'if sid=='g844-avf4'else BATH_UNITS.get(metric,'')if sid=='fpj6-y9vk'else''))
      if v is None and re.match(r'^\s*[<>≤≥]',str(row.get(metric,''))):props['__censored']=True
     if datefield and row.get(datefield):props['__observedAt']=row[datefield]
     if 'genere'in row:props['__parameter']=row['genere']
     elif par:props['__parameter']=par
     f=b.feature(geometry(row,sid),props,d['title'])
     if f:fs.append(f)
    if not fs:continue
    warnings=[]
    if len(fs)<len(rr):warnings.append(f'{len(rr)-len(fs)} righe senza geometria utilizzabile escluse.')
    if sid=='28hy-b3b2':warnings.append('Dichiarazioni consolidate per identificativo impianto e gestore; coordinate ETRS89/UTM33N convertite in WGS84.')
    if sid=='53ur-f9mj':warnings.append('I contatori di stato non hanno un timestamp di osservazione verificato: questo livello mostra la posizione, non disponibilità live.')
    if sid=='fpj6-y9vk':
     warnings.append('Posizioni collegate solo tramite codice area normalizzato IT006 → IT06BA, escludendo codici ambigui. Le aree prive di corrispondenza non sono disegnate; non è una certificazione attuale della balneabilità.')
     d['note']='Campioni stagionali. Non tutte le aree hanno un codice associabile al registro geografico: vedi copertura ed esclusioni. I valori < o > restano limiti analitici, non valori esatti.'
    if metric and(sid!='fpj6-y9vk'or metric in BATH_UNITS):d['metric']={'field':'__value','unit':str(next((f['properties'].get('__unit')for f in fs if f['properties'].get('__unit')),''))}
    timestamps=[str(f['properties']['__observedAt'])for f in fs if f['properties'].get('__observedAt')]
    if timestamps:d['dataDate']=max(timestamps)
    if metric and datefield:d['history']={'kind':'socrata','sourceId':sid,'dateField':datefield,'valueField':metric,'parameterField':parameter,'parameter':par}
    result.append(b.save_layer(d,fs,original,warnings))
  if not result:raise ValueError('Nessuna geometria valida dopo la normalizzazione')
  print('OK TABLE',sid,len(result),'layers',sum(x['count']for x in result),'features',flush=True);return result
 except Exception as e:
  definition.update({'status':'blocked','problem':str(e),'retrievedAt':NOW});print('BLOCKED TABLE',sid,str(e)[:250],flush=True);return result+[definition]

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source',action='append');args=parser.parse_args()
 OUTPUT.mkdir(exist_ok=True,parents=True);CACHE.mkdir(exist_ok=True,parents=True)
 municipalities()
 selected=args.source or list(SOURCES)
 if any(s not in SOURCES for s in selected):raise ValueError('Sorgente non censita')
 with concurrent.futures.ThreadPoolExecutor(3)as ex:groups=list(ex.map(process,selected))
 layers=[l for g in groups for l in g]
 if args.source and(OUTPUT/'tables-catalog.json').exists():
  previous=json.loads((OUTPUT/'tables-catalog.json').read_text())['layers'];layers=[l for l in previous if l['sourceId']not in selected]+layers
 (OUTPUT/'tables-catalog.json').write_text(json.dumps({'generatedAt':NOW,'layers':layers},ensure_ascii=False,indent=2)+'\n');print('DONE TABLES',len(layers),'ready',sum(x['status']=='ready'for x in layers),flush=True)
if __name__=='__main__':main()
