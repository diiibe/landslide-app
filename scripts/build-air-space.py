#!/usr/bin/env python3
"""Refresh the real Pordenonese study from official publications, preserving last good parts."""
import argparse, copy, datetime as dt, hashlib, io, json, math, re, tempfile, unicodedata
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlencode, urljoin
import requests
import openpyxl
from shapely.geometry import shape, Point
from shapely.ops import unary_union
from shapely import make_valid
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'public/data/spaces/air'
ENDPOINTS={'pm10':('qp5k-6pvm','media_giornaliera'),'pm25':('d63p-pqpr','media_giornaliera'),'no2':('ke9b-p6z2','media_oraria_max')}
INVENTORY_PAGE='https://www.arpa.fvg.it/temi/temi/aria/sezioni-principali/inventario-emissioni/inventario-emissioni-2023/'
WFS='https://serviziogc.regione.fvg.it/geoserver/wfs'
NOW=lambda:dt.datetime.now(dt.timezone.utc).isoformat()
def get(url,params=None):
 r=requests.get(url,params=params,timeout=(12,65),headers={'User-Agent':'FriulView/0.8 source-refresh (public environmental study)'})
 r.raise_for_status();return r

def number(v):
 try:
  if v is None or str(v).strip()=='':return None
  n=float(str(v).strip().replace(',','.'))
  return n if math.isfinite(n) else None
 except (TypeError,ValueError):return None

def canonical(s):return ''.join(c for c in unicodedata.normalize('NFD',str(s).split('/')[0].strip().lower()) if unicodedata.category(c)!='Mn')
def atomic(path,data):
 payload=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n'
 with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=path.parent,delete=False)as f:f.write(payload);tmp=Path(f.name)
 tmp.replace(path)

def inventory(data):
 page=get(INVENTORY_PAGE).text
 links=re.findall(r'href=["\']([^"\']+\.xlsx[^"\']*)["\']',page,re.I)
 link=next((x for x in links if 'comunal' in x.lower() and '2023' in x),None)
 if not link:raise ValueError('Nessun inventario comunale 2023 identificato nella pagina ufficiale')
 url=urljoin(INVENTORY_PAGE,link);raw=get(url).content
 rows=list(openpyxl.load_workbook(io.BytesIO(raw),data_only=True,read_only=True).active.values)
 headers=[str(x)for x in rows[0]]
 required=['ISTAT_COMUNE','CODICE_MACROSETTORE','MAC_NOME','NOx','PM10','PM2_5']
 for col in required:
  if col not in headers:raise ValueError('Colonna inventario mancante: '+col)
 by_id={}
 for row in rows[1:]:
  if row[0] is None:continue
  code=str(int(row[headers.index('ISTAT_COMUNE')])).zfill(6)
  if not code.startswith('093'):continue
  values={k:number(row[headers.index(col)])for k,col in [('NOx','NOx'),('PM10','PM10'),('PM2_5','PM2_5')]}
  if any(v is not None and v<0 for v in values.values()):raise ValueError('Emissioni annuali negative')
  by_id.setdefault(code,[]).append({'code':int(row[headers.index('CODICE_MACROSETTORE')]),'name':str(row[headers.index('MAC_NOME')]),'values':values})
 if len(by_id)<40:raise ValueError('Inventario comunale incompleto')
 features=copy.deepcopy(data['municipalities']['features'])
 for f in features:
  code=str(f['properties']['istat']).zfill(6)
  if code not in by_id:raise ValueError('Comune privo di righe ufficiali: '+code)
  f['properties']['sectors']=by_id[code]
 data['municipalities']['features']=features
 for source in data['sources']:
  if source.get('id')=='inemar':source.update(dataUrl=url,sha256=hashlib.sha256(raw).hexdigest(),period='2023',title='INEMAR 2023 · '+('versione in Revisione pubblica' if 'revisione pubblica' in page.lower() else 'edizione pubblicata da ARPA'))
 return {'latestMeasurement':'2023','validation':'Stima annuale; versione e hash della pubblicazione conservati'}

def observations(data):
 since=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=120)).date().isoformat()
 statuses={}
 for measure,(dataset,field)in ENDPOINTS.items():
  checked=NOW();old=data.setdefault('sourceStatus',{}).get(measure,{})
  try:
   rows=get('https://www.dati.friuliveneziagiulia.it/resource/'+dataset+'.json',{'$where':"data_misura >= '"+since+"T00:00:00'",'$limit':50000,'$order':'data_misura,ubicazione'}).json()
   if not isinstance(rows,list)or len(rows)>=50000:raise ValueError('Risposta incompleta o troncata')
   changed=copy.deepcopy(data['stations']);count=0;latest=None
   if data.get('municipalities',{}).get('features') and all(f.get('geometry') for f in data['municipalities']['features']):
    domain=unary_union([make_valid(shape(f['geometry']))for f in data['municipalities']['features']])
    known={s['name'].strip()for s in changed};candidates={str(r.get('ubicazione','')).strip():r for r in rows}
    for name,row in candidates.items():
     lon,lat=number(row.get('longitudine')),number(row.get('latitudine'))
     if name and name not in known and lon is not None and lat is not None and domain.covers(Point(lon,lat)):
      changed.append({'id':hashlib.sha256(name.encode()).hexdigest()[:16],'name':name,'coordinates':[lon,lat],'series':{}});known.add(name)
   for s in changed:
    found={}
    for row in rows:
     if str(row.get('ubicazione','')).strip()!=s['name'].strip():continue
     if row.get('unita_misura')not in ['ug/m3','µg/m³','μg/m³']:raise ValueError('Unità inattesa')
     date=str(row.get('data_misura',''))[:10]
     dt.date.fromisoformat(date)
     if date>dt.datetime.now(dt.timezone.utc).date().isoformat():continue
     raw=row.get(field);n=number(raw);insuff=str(row.get('dati_insuff','')).lower()in ['true','1','vero']
     record={'date':date,'raw':None if raw is None else str(raw),'value':n if not insuff and n is not None and n>=0 else None,'valid':not insuff and n is not None and n>=0,'insufficient':insuff,'maxHour':row.get('ora_media_oraria_max'),'validation':'Stato di validazione giornaliera/mensile/annuale non fornito dall’API'}
     if date in found and found[date]!=record:raise ValueError('Due osservazioni discordanti per sito/data')
     found[date]=record;count+=1;latest=max(latest or date,date)
    if found:
     latest_row=next((r for r in reversed(rows)if str(r.get('ubicazione','')).strip()==s['name'].strip()),None)
     if latest_row and (measure=='pm10' or not s['series'].get('pm10')):
      lon,lat=number(latest_row.get('longitudine')),number(latest_row.get('latitudine'))
      if lon is not None and lat is not None and 11<lon<15 and 45<lat<48:s['coordinates']=[lon,lat]
     previous={r['date']:r for r in s['series'].get(measure,[])};previous.update(found)
     s['series'][measure]=[previous[k]for k in sorted(previous) if k>=since]
   if not count:raise ValueError('Nessuna osservazione del Pordenonese nella risposta')
   data['stations']=changed
   period=[r['date']for st in changed for r in st['series'].get(measure,[])]
   for source in data['sources']:
    if source.get('id')==measure:source['period']=min(period)+' — '+max(period)
   statuses[measure]={'checkedAt':checked,'retrievedAt':checked,'latestMeasurement':latest,'error':None,'cadence':'Statistiche giornaliere · controllo ogni ora, più controllo diretto nell’app','validation':'Il flag dati insufficienti non equivale alla validazione annuale'}
  except Exception as e:statuses[measure]={**old,'checkedAt':checked,'error':str(e),'cadence':'Statistica giornaliera'}
 data['sourceStatus'].update(statuses)
 if all(s.get('error') for s in statuses.values()):raise ValueError('Tutte le serie osservative non raggiungibili; ultime copie conservate')
 return {'latestMeasurement':max((v.get('latestMeasurement')or''for v in statuses.values()),default='')}

class Table(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag.lower()=='tr':self.row=[]
  if tag.lower() in ['td','th']and self.row is not None:self.cell=[]
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag.lower() in ['td','th']and self.cell is not None:
   if self.row is not None:self.row.append(' '.join(self.cell).strip())
   self.cell=None
  if tag.lower()=='tr'and self.row is not None:self.rows.append(self.row);self.row=None

def parse_sme(text):
 parser=Table();parser.feed(text);rows=[]
 for cells in parser.rows:
  if len(cells)<10 or not re.fullmatch(r'\d{2}/\d{2}/\d{4}',cells[0]):continue
  date=dt.datetime.strptime(cells[0],'%d/%m/%Y').date().isoformat()
  if date>dt.datetime.now(dt.timezone.utc).date().isoformat():continue
  rows.append({'date':date,'NOx':number(cells[1]),'SO2':number(cells[2]),'dust':number(cells[3]),'rawNOx':cells[1],'rawSO2':cells[2],'rawDust':cells[3],'status':cells[9],'flow':number(cells[8]),'unit':'mg/Nm³','source':'SME Fanna Cementi · medie giornaliere'})
 if not rows:raise ValueError('Nessuna riga giornaliera SME riconosciuta')
 return rows

def sme(data):
 now=dt.datetime.now(dt.timezone.utc);months=[now.replace(day=1),(now.replace(day=1)-dt.timedelta(days=1)).replace(day=1)];all_rows={r['date']:r for r in data['sme']};sources=[];errors=[]
 for month in months:
  url=f'https://emi-fanna.wietersdorfer.com/sme/www/fanna/pub/{month:%Y/%m/%y%m}__MS.HTM'
  try:
   rows=parse_sme(get(url).text);all_rows.update({r['date']:r for r in rows});sources.append(url)
  except Exception as e:errors.append(str(e))
 if not sources:raise ValueError(' / '.join(errors))
 data['sme']=[all_rows[k]for k in sorted(all_rows)]
 for s in data['sources']:
  if s.get('id')=='sme':s.update(url=sources[0],period='Archivio giornaliero · ultima misura '+max((r['date']for r in data['sme'] if any(r[k]is not None for k in ['NOx','SO2','dust'])),default='non disponibile'))
 return {'latestMeasurement':max((r['date']for r in data['sme'] if any(r[k]is not None for k in ['NOx','SO2','dust'])),default=None),'partialErrors':errors}

def wfs(name):
 value=get(WFS,{'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':name,'outputFormat':'application/json','count':20000,'srsName':'EPSG:4326'}).json()
 if value.get('type')!='FeatureCollection' or not value.get('features') or value.get('numberMatched',0)and isinstance(value.get('numberMatched'),int)and value['numberMatched']>len(value['features']):raise ValueError('Registro WFS incompleto')
 return value['features']

def registry(data):
 fs=wfs('INDUSTR:autorizzazione_integrata_ambientale_aia');features=[]
 for f in fs:
  p=f.get('properties')or{};code=str(p.get('codice_regionale_aia',''))
  if not code.startswith('PN/'):continue
  if f.get('geometry',{}).get('type')!='Point':continue
  ident=code or str(p.get('id',f.get('id')))
  features.append({'type':'Feature','id':ident,'geometry':f['geometry'],'properties':{'id':ident,'name':str(p.get('ragione_sociale','Attività')),'municipality':str(p.get('comune','')),'activity':str(p.get('attivita_aia','')),'state':str(p.get('stato','')),'code':code,'sourceUrl':str(p.get('link_sito_reg','')).strip()}})
 if len(features)<20:raise ValueError('Registro AIA del Pordenonese incompleto')
 data['aia']={'type':'FeatureCollection','features':features}
 for source in data['sources']:
  if source.get('id')=='aia':source.update(period='Registro regionale · acquisizione '+NOW(),dataUrl=WFS+'?'+urlencode({'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':'INDUSTR:autorizzazione_integrata_ambientale_aia','outputFormat':'application/json','count':20000,'srsName':'EPSG:4326'}))
 return {'latestMeasurement':None}

def planning(context,key,name):
 rows=wfs(name);features=[]
 for f in rows:
  p=f.get('properties')or{}
  if str(p.get('COD_PROV','')).zfill(3)!='093':continue
  if f.get('geometry',{}).get('type')not in ['Polygon','MultiPolygon']:continue
  ident=str(f.get('id',p.get('GID',p.get('ID1'))))
  features.append({'type':'Feature','id':ident,'geometry':f['geometry'],'properties':{'id':ident,'name':str(p.get('DEST_PREV')or p.get('DEST_DESCR')or p.get('NOME')or 'Destinazione urbanistica'),'municipality':str(p.get('NOME_COM','')),'zone':str(p.get('ZONA_OMOGE','')),'subzone':str(p.get('SOTTOZONA','')),'validDate':str(p.get('DATA_VAL','')),'variant':str(p.get('VARIANTE','')),'norm':str(p.get('NORMATIVA')or p.get('NORMA')or p.get('NORME')or '')}})
 if not features:raise ValueError('Nessun perimetro della provincia093')
 context[key]={'type':'FeatureCollection','features':features}
 for source in context['sources']:
  if name.split(':')[-1].lower() in source.get('url','').lower():source.pop('fileSha256',None);source.update(url=WFS+'?'+urlencode({'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':name,'outputFormat':'application/json','count':20000,'srsName':'EPSG:4326'}),id={'industrialZones':'industrial','commercialZones':'commercial'}[key],period='Validità specifica in ciascun record; aggiornamento '+NOW(),note='Geometrie originali WFS Regione FVG, estratto COD_PROV093. Destinazioni urbanistiche, non uso effettivo o catasto.')
 return {'latestMeasurement':None}

def refresh(target=TARGET):
 data=json.loads((target/'data.json').read_text());context=json.loads((target/'context.json').read_text());now=NOW();data.setdefault('sourceStatus',{});context.setdefault('sourceStatus',{})
 jobs=[('inemar',lambda:inventory(data),'Inventario annuale · verifica della pubblicazione ogni ora'),('observations',lambda:observations(data),'Statistica giornaliera'),('sme',lambda:sme(data),'Medie giornaliere · verifica del portale ogni ora'),('aia',lambda:registry(data),'Registro amministrativo · verifica ogni ora'),('industrial',lambda:planning(context,'industrialZones','CER:ZONE_INDUSTRIALI_ARTIG_D'),'Destinazione urbanistica · date per record'),('commercial',lambda:planning(context,'commercialZones','CER:ZONE_COMMERCIALI_H'),'Destinazione urbanistica · date per record')]
 for key,job,cadence in jobs:
  status=context['sourceStatus'] if key in ['industrial','commercial']else data['sourceStatus'];old=status.get(key,{})
  try:
   detail=job();status[key]={'checkedAt':now,'retrievedAt':now,'error':None,'cadence':cadence,**detail};print('OK',key)
  except Exception as e:status[key]={**old,'checkedAt':now,'retrievedAt':old.get('retrievedAt'),'error':str(e),'cadence':cadence};print('PRESERVED',key,str(e))
 data['retrievedAt']=context['retrievedAt']=now;data['snapshot']=context['snapshot']=now[:10]
 data.pop('proposal',None);data.pop('wind',None);data['sources']=[s for s in data['sources']if s.get('id')!='wind']
 atomic(target/'data.json',data);atomic(target/'context.json',context)
 return data,context
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--target',type=Path,default=TARGET);args=p.parse_args();refresh(args.target)
