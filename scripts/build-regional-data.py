#!/usr/bin/env python3
"""Fetch the public distributions listed in regional-sources.json.

Dependencies: requests, shapely, pyproj; tippecanoe on PATH for large layers.
Raw responses are cached outside the repository; shipped files contain only map data.
All failures remain explicit catalog entries, never empty successful layers.
"""
import argparse, concurrent.futures, datetime as dt, hashlib, json, math, os, pathlib, re, subprocess, time, unicodedata
import requests
from shapely.geometry import shape, mapping
from shapely.validation import make_valid
from shapely.ops import unary_union

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/regional'
CACHE = pathlib.Path(os.environ.get('FVG_REGIONAL_CACHE', '/tmp/fvg-regional-cache'))
CONFIG = json.loads((ROOT / 'scripts/regional-sources.json').read_text())['families']
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
FETCH_TIMES = {}
CACHE_TTL_SECONDS = 3600
REGION_LICENSE = 'https://www.regione.fvg.it/rafvg/cms/RAFVG/ambiente-territorio/conoscere-ambiente-territorio/FOGLIA4/'
FOLDERS = {'Mare':'mare','Aria':'aria','Energia':'energia','Trasformazioni':'trasformazioni','Attività':'attivita','Ambiente':'ambiente','Acqua':'acqua','Verde':'verde','Città':'servizi','Mobilità':'mobilita','Infrastrutture':'infrastrutture','Base 3D':'contesto'}
COLORS = {'mare':'#5ebfcc','aria':'#a58bc1','energia':'#d5ae58','trasformazioni':'#c58d69','attivita':'#d3a26a','ambiente':'#b8a787','acqua':'#6cafd1','verde':'#86b381','servizi':'#c58dba','mobilita':'#b0b7b0','infrastrutture':'#9ba8ca','contesto':'#a3b8b4'}
NAMES = {
 'imp_ftv_agriftv':'Fotovoltaico e agrivoltaico · AUE','prog_impaue_v_bess_public':'Accumuli elettrici BESS','prog_impaue_v_biomasse_biometano_public':'Biomasse e biometano · AUE','prog_impaue_v_idroelettrici_public':'Idroelettrico · AUE','autorizzazione_unica_ambientale_aua':'Stabilimenti AUA','rischi_incidenti_rilevanti_rir':'Stabilimenti Seveso','prog_masterplan_vm_siti_masterplan':'Aree industriali dismesse · Masterplan','SCUOLE_GEO':'Scuole','ImpiantiSportiviFVG':'Impianti sportivi','v_alberi_monumentali_e_notevoli':'Alberi monumentali e notevoli','v_aree_degradate':'Aree degradate','PARCHI_COMUNALI_RAFVG':'Parchi comunali e intercomunali','SEZ_CENS_2021':'Sezioni di censimento · 2021','IDR_GIS_PRESE_SOTTERRANEE':'Prese d’acqua sotterranee','IDR_GIS_IMPIANTI':'Impianti delle utilizzazioni d’acqua','IDR_GIS_SCARICHI':'Scarichi delle derivazioni d’acqua','MV_IMPIANTO':'Impianti di gestione rifiuti','CENTRI_DI_RACCOLTA':'Centri di raccolta rifiuti','DISCARICHE_2025':'Discariche · 2025','VIA_REG_LOC_PROGETTI':'Progetti VIA regionali','SCREENING_VIA_REG':'Progetti di screening ambientale','AREE_PATRIMONIALI_T':'Porto di Trieste · aree patrimoniali','AREE_PATRIMONIALI_M':'Porto di Monfalcone · aree patrimoniali','PRP_TRIESTE_AZZONAMENTO_FUNZIONALE_RDN2008':'Porto di Trieste · azzonamento funzionale','v_beni_culturali':'Beni culturali','v_beni_immobili_interesse_storico_artistico_parte_ii':'Immobili di interesse storico e artistico','v_zone_interesse_archeologico':'Zone di interesse archeologico','V_INCENDI_PUNTOINIZIO':'Incendi boschivi · punti storici','SUPERFICIE_BOSCATA_BRUCIATA':'Superfici boscate bruciate · archivio','ZONE_COMMERCIALI_H':'Zone commerciali dei piani','ZONE_INDUSTRIALI_ARTIG_D':'Zone industriali e artigianali dei piani','FOTOVOLTAICO_FVG':'Fotovoltaico per Comune · archivio','RETI_DISTRIBUZIONE_FVG':'Tipologia rete gas per Comune','AREECONVENZIONALI_CP':'Aree convenzionali cabine primarie','RECIR_2022':'Rete ciclabile RECIR · piano 2022','SIC':'Natura 2000 · SIC e ZSC','PRATISTABILI':'Prati stabili','AWC_CAPACITA_ACQUA_DISP':'Capacità del suolo di trattenere acqua','CARTA_SUOLI_GO_TS':'Carta dei suoli · Gorizia e Trieste','C_HABITAT_A_FVG_2017':'Habitat · Carta della Natura 2017','v_rete_ecologica_ecotopi':'Rete ecologica · ecotopi','GRAFO_STRADALE_FVG':'Grafo stradale regionale','DBPRIOR_0513_TRATTA_FER':'Rete ferroviaria regionale','VIABILITAFORESTALEPUBBLICA':'Viabilità forestale pubblica','AP_BALNEAZIONE':'Punti delle aree di balneazione','QU_LAS_LIDAR_FVG':'Rilievi LiDAR · quadro di copertura','QU_DTM_LIDAR_FVG':'DTM LiDAR · quadro di copertura','QU_AGEA2023':'Ortofoto AGEA 2023 · copertura','QU_TRUEORTO1720_FVG':'True ortofoto 2017–2020 · copertura'}

def slug(s):
    value=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
    return value if len(value)<110 else value[:90]+'-'+hashlib.sha1(value.encode()).hexdigest()[:12]
def fetch(url, params=None, fresh=False):
    req = requests.Request('GET',url,params=params).prepare(); key=hashlib.sha256(req.url.encode()).hexdigest(); file=CACHE/(key+'.json')
    if file.exists() and not fresh and os.environ.get('FVG_DATA_REFRESH')!='1' and time.time()-file.stat().st_mtime<CACHE_TTL_SECONDS:
        FETCH_TIMES[req.url]=dt.datetime.fromtimestamp(file.stat().st_mtime,dt.timezone.utc).isoformat()
        return json.loads(file.read_text())
    for attempt in range(3):
        try:
            r=requests.get(req.url,headers={'Origin':'https://diiibe.github.io','User-Agent':'FVG-regional-map/1.0 (public data integration)'},timeout=(15,150)); r.raise_for_status(); result=r.json(); file.write_text(json.dumps(result,ensure_ascii=False)); FETCH_TIMES[req.url]=dt.datetime.now(dt.timezone.utc).isoformat(); return result
        except (requests.RequestException,ValueError):
            if attempt==2: raise
            time.sleep(attempt+1)

def valid_geometry(g):
    if not isinstance(g,dict) or g.get('type') not in ['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection']: return None
    try:
        s=shape(g)
        if s.is_empty:return None
        b=s.bounds
        if len(b)!=4 or not all(math.isfinite(v) for v in b) or b[0]<-180 or b[2]>180 or b[1]<-90 or b[3]>90: return None
        if not (b[0]<15.6 and b[2]>11.4 and b[1]<47.3 and b[3]>44.4):return None
        if not s.is_valid:
            s=make_valid(s)
            if s.geom_type=='GeometryCollection':
                polygons=[x for x in s.geoms if x.geom_type in ['Polygon','MultiPolygon']]
                if polygons:s=unary_union(polygons)
            if s.is_empty or not s.is_valid or s.geom_type=='GeometryCollection':return None
            return mapping(s)
        return g
    except (ValueError,TypeError):return None

def clean_props(p):
    # Keep public domain attributes; omit personal/contact identifiers unnecessary to map reading.
    skip={'codice_fiscale','partitaiva','partita_iva','email','telefono','rm_auto','rm_non_auto','source_row_id'}
    return {str(k): (json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v) for k,v in p.items() if k.lower() not in skip and not str(k).startswith(':@') and v is not None}

def name_for(p, fallback):
    keys={k.lower():k for k in p}
    for n in ['__name','denominazionescuola','denominazione','ragione_sociale','ditta','nome_progetto','denominaz','dettaglio2','nome','name','stazione','sito','ubicazione','nome_volgare','indirizzo','comune']:
        if n in keys and str(p[keys[n]]).strip():return str(p[keys[n]])[:300]
    return fallback

def feature(geometry,p, fallback='Elemento'):
    g=valid_geometry(geometry)
    if not g:return None
    props=clean_props(p); props['__name']=name_for(props,fallback)
    if not shape(geometry).is_valid:
        props['qualita_geometria']='Geometria non valida nella fonte, riparata per la visualizzazione con make_valid.'
        props['__geometryRepaired']=True
    fid=hashlib.sha1(json.dumps([g,props],sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16];props['__featureId']=fid
    return {'type':'Feature','id':fid,'geometry':g,'properties':props}

def save_layer(definition, features, raw_count=None, warnings=()):
    features=[f for f in features if f]; count=len(features)
    if not count:raise ValueError('Nessuna geometria valida disponibile: non pubblico un layer vuoto')
    # Map display geometry, not cadastral survey precision. Preserve topology
    # while avoiding hundred-megabyte tiles for regional polygon datasets.
    for f in features:
        if f['geometry']['type'] not in ['Point','MultiPoint']:
            g=shape(f['geometry']); simplified=g.simplify(0.000015,preserve_topology=True)
            if not simplified.is_empty:f['geometry']=mapping(simplified)
    stage=CACHE/'generated';stage.mkdir(exist_ok=True,parents=True)
    fc={'type':'FeatureCollection','features':features};file=stage/(definition['id']+'.geojson');file.write_text(json.dumps(fc,ensure_ascii=False,separators=(',',':')))
    b=[shape(f['geometry']).bounds for f in features];bounds=[[min(v[0]for v in b),min(v[1]for v in b)],[max(v[2]for v in b),max(v[3]for v in b)]]
    acquired=[v for u,v in list(FETCH_TIMES.items()) if definition.get('sourceId','!missing!') in requests.utils.unquote(u)]
    definition.update({'count':count,'sourceCount':raw_count if raw_count is not None else count,'retrievedAt':definition.get('retrievedAt')or(min(acquired)if acquired else NOW),'generatedAt':NOW,'bounds':bounds,'geometryTypes':sorted({f['geometry']['type']for f in features}),'fields':list(dict.fromkeys(k for f in features[:50]for k in f['properties'] if not k.startswith('__'))),'warnings':list(warnings),'status':'ready','kind':'geojson','file':file.name})
    repaired=sum(bool(f['properties'].get('__geometryRepaired'))for f in features)
    if repaired:definition['warnings'].append(f'{repaired} geometrie non valide nella fonte riparate con make_valid per la visualizzazione; gli originali restano disponibili alla fonte.')
    if definition.get('metric'):
        vals=[f['properties'].get(definition['metric']['field'])for f in features];vals=[v for v in vals if isinstance(v,(int,float))and math.isfinite(v)]
        if vals and min(vals)<max(vals):definition['metric'].update({'min':min(vals),'max':max(vals)})
    will_tile=file.stat().st_size>1800000 or count>8000
    if will_tile:definition['kind']='vector'
    # Navigation indexes are content-addressed and prepared before publication.
    # A conversion failure cannot overwrite an index retained by the old catalog.
    from regional_overviews import publish_overview
    publish_overview(definition, features)
    if will_tile:
        tiled=stage/(definition['id']+'.pmtiles')
        proc=subprocess.run(['tippecanoe','-o',str(tiled),'-l','data','-Z','5','-z','14','--drop-densest-as-needed','--maximum-tile-bytes=500000','--force',str(file)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
        if proc.returncode:raise RuntimeError('Conversione PMTiles fallita: '+proc.stderr[-400:])
        definition.update({'kind':'vector','file':tiled.name,'sourceLayer':'data'});file.unlink();tiled.replace(OUT/tiled.name)
        definition['warnings'].append('Geometrie generalizzate in tile vettoriali; gli elementi piccoli/densi si leggono aumentando lo zoom.')
    else:file.replace(OUT/file.name)
    return definition

SPECS={}
for fi,fam in enumerate(CONFIG):
    for s in fam['sources']:
        if ':' in s['id'] and s['id'] not in SPECS:
            sid=s['id'];short=sid.split(':',1)[1];SPECS[sid]={'id':'region-'+slug(sid),'title':NAMES.get(short,short.replace('_',' ').capitalize()),'folder':FOLDERS[fam['group']],'description':fam['what'],'note':fam['limit'],'family':fi,'provider':'Regione autonoma Friuli Venezia Giulia / IRDAT','license':'IODL 2.0 · standard regionale','licenseUrl':REGION_LICENSE,'sourceId':sid,'sourceUrl':s['url'],'cadence':'Registro territoriale · non telemetria','color':COLORS[FOLDERS[fam['group']]]}
for sid in ['GRIGLIEGEO:QU_LAS_LIDAR_FVG','GRIGLIEGEO:QU_DTM_LIDAR_FVG','GRIGLIEGEO:QU_AGEA2023','GRIGLIEGEO:QU_TRUEORTO1720_FVG']:
    SPECS[sid]={'id':'region-'+slug(sid),'title':NAMES[sid.split(':')[1]],'folder':'contesto','description':'Copertura dei rilievi e riferimenti di consultazione/scarico. Non è una nuvola di punti caricata nel browser.','note':'Il quadro di unione descrive i lotti disponibili; consultare la scheda per il rilievo originale.','family':48,'provider':'Regione autonoma Friuli Venezia Giulia / IRDAT','license':'IODL 2.0 · standard regionale','licenseUrl':REGION_LICENSE,'sourceId':sid,'sourceUrl':'https://irdat.regione.fvg.it/consultatore-dati-ambientali-territoriali/home?language=it','cadence':'Campagne di rilievo','color':COLORS['contesto']}
sid='INDUSTR:autorizzazione_integrata_ambientale_aia'
SPECS[sid]={'id':'region-'+slug(sid),'title':'Stabilimenti AIA','folder':'attivita','description':'Registro regionale delle autorizzazioni integrate ambientali.','note':'Stato amministrativo, non emissioni o operatività misurate in questo momento.','provider':'Regione FVG / IRDAT','license':'IODL 2.0 · standard regionale','licenseUrl':REGION_LICENSE,'sourceId':sid,'sourceUrl':'https://serviziogc.regione.fvg.it/geoserver/wfs?service=WFS&request=GetCapabilities','cadence':'Sincronizzazione automatica ogni 6 ore','color':COLORS['attivita']}

def wfs(sid):
    spec=dict(SPECS[sid]); base='https://serviziogc.regione.fvg.it/geoserver/wfs'; rows=[];start=0;expected=None;sort=None
    try:
        while True:
            params={'service':'WFS','version':'2.0.0','request':'GetFeature','typeNames':sid,'outputFormat':'application/json','srsName':'EPSG:4326','count':5000}
            if start:params['startIndex']=start
            if sort:params['sortBy']=sort
            d=fetch(base,params)
            if d.get('type')!='FeatureCollection':raise ValueError('Il servizio non ha restituito GeoJSON')
            total=d.get('numberMatched');expected=int(total)if str(total).isdigit()else expected;part=d.get('features',[])
            if start==0 and expected and expected>5000 and not sort:
                keys=list((part[0].get('properties') or {})if part else {})
                override={'SITI_PROT:PRATISTABILI':['ID_2025','ID_2023','ID_PS'],'CART_NAT:C_HABITAT_A_FVG_2017':['ID_POLY'],'IDROGRAF:IDR_GIS_PRESE_SOTTERRANEE':['OBJECTID','CODICE_OPERA','N_PRATICA','N_OPERA_PRATICA']}.get(sid)
                candidates=[k for k in (override or ['OBJECTID','ID','id','GID','gid','FID','ID1'])if k in keys]
                sort=','.join(candidates)if candidates else None
                if not sort:raise ValueError('Paginazione senza una chiave ordinabile verificata')
                continue # Fetch the first page again using the same order as later pages.
            rows.extend(part);start+=len(part)
            if expected is not None and start>=expected:break
            if len(part)<5000:break
            if start>500000:raise ValueError('Dimensione oltre il limite di preparazione; richiede partizionamento dedicato')
        if expected is not None and len(rows)!=expected:raise ValueError(f'Scarico incompleto: {len(rows)} di {expected}')
        # Distinct content check detects unstable/paged duplicate responses.
        rawkeys=[hashlib.sha1(json.dumps([r.get('geometry'),r.get('properties')],sort_keys=True).encode()).digest()for r in rows]
        unique=len(set(rawkeys))
        if len(rows)>5000 and unique!=len(rows):raise ValueError(f'Paginazione con record duplicati ({unique}/{len(rows)}): richiede ordinamento dedicato')
        if sort:
            order_keys=sort.split(',');identities={json.dumps([r.get('properties',{}).get(k)for k in order_keys],sort_keys=True)for r in rows}
            if len(identities)!=len(rows):raise ValueError(f'Chiave di ordinamento non univoca ({len(identities)}/{len(rows)}): richiede chiave composta verificata')
        fs=[feature(r.get('geometry'),r.get('properties') or {},spec['title'])for r in rows]
        warnings=[]
        if sum(f is None for f in fs):warnings.append(f'{sum(f is None for f in fs)} record privi di geometria utilizzabile esclusi; gli attributi non sono stati geocodificati artificialmente.')
        result=save_layer(spec,fs,len(rows),warnings)
        print('OK',sid,result['count'],result['file'],flush=True);return result
    except Exception as e:
        spec.update({'status':'blocked','problem':str(e),'retrievedAt':NOW});print('BLOCKED',sid,str(e)[:200],flush=True);return spec

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',choices=['wfs'],default='wfs');parser.add_argument('--workers',type=int,default=3);parser.add_argument('--source',action='append');args=parser.parse_args()
    OUT.mkdir(exist_ok=True,parents=True);CACHE.mkdir(exist_ok=True,parents=True)
    selected=args.source or list(SPECS)
    if any(s not in SPECS for s in selected):raise ValueError('Sorgente sconosciuta')
    with concurrent.futures.ThreadPoolExecutor(args.workers)as ex:layers=list(ex.map(wfs,selected))
    if args.source and(OUT/'wfs-catalog.json').exists():
        previous=json.loads((OUT/'wfs-catalog.json').read_text())['layers'];new={l['sourceId']:l for l in layers};layers=[new.pop(l['sourceId'],l)for l in previous]+list(new.values())
    (OUT/'wfs-catalog.json').write_text(json.dumps({'generatedAt':NOW,'layers':layers},ensure_ascii=False,indent=2)+'\n')
    print('DONE',len(layers),'ready',sum(x['status']=='ready'for x in layers),flush=True)
if __name__=='__main__':main()
