import type {LayerDefinition,MapData} from './types';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
/** ERDDAP names/units are in a table, never inferred from column position. */
export function erddapData(raw:unknown,parameter:string,options:{sensorId?:string;depth?:number;name?:string;profile?:boolean}={}):MapData {
 const table=(raw as {table?:{columnNames?:unknown;columnUnits?:unknown;rows?:unknown}})?.table;
 if(!table||!Array.isArray(table.columnNames)||!Array.isArray(table.rows))throw Error('Tabella ERDDAP non riconosciuta');
 const names=table.columnNames as string[],units=Array.isArray(table.columnUnits)?table.columnUnits:[];
 const index=(s:string)=>names.indexOf(s);const pi=index(parameter),qi=index(parameter+'_QC');
 if(pi<0||index('time')<0||index('latitude')<0||index('longitude')<0)throw Error('Variabile ERDDAP assente');
 const latest=new Map<string,GeoJSON.Feature<GeoJSON.Point>>();
 let rows=table.rows;
 if(options.profile){const times=rows.filter(Array.isArray).filter(r=>finite(r[pi])&&Date.parse(String(r[index('time')]))<=Date.now()).map(r=>String(r[index('time')])).sort();const latest=times.at(-1);rows=rows.filter(r=>Array.isArray(r)&&String(r[index('time')])===latest);}
 for(const row of rows){
  if(!Array.isArray(row))continue;
  const time=row[index('time')],ms=Date.parse(String(time)),lon=row[index('longitude')],lat=row[index('latitude')],value=row[pi],qc=qi<0?null:row[qi];
  if(!finite(lon)||!finite(lat)||Math.abs(lon)>180||Math.abs(lat)>90||!finite(value)||!Number.isFinite(ms)||ms>Date.now()+300000||qc===9)continue;
  const sensor=String(row[index('sensor_id')]??''),depth=row[index('depth')];
  if(options.sensorId&&sensor!==options.sensorId||options.depth!==undefined&&depth!==options.depth)continue;
  const key=[lon,lat,sensor,depth].join(':');const old=latest.get(key);
  if(old&&Date.parse(String(old.properties?.__observedAt))>=ms)continue;
  latest.set(key,{type:'Feature',id:key,geometry:{type:'Point',coordinates:[lon,lat]},properties:{__featureId:key,__name:options.name||'Boa OGS',__value:value,__displayValue:String(value),__unit:String(units[pi]??''),__observedAt:time,__depth:depth==null?'':String(depth),sensor_id:sensor,profondita_m:depth,qualita_qc:qc,qualita:qc===0?'Controllo non eseguito':qc===1?'Dato buono secondo il controllo della fonte':qc===2?'Dato probabilmente buono':qc===3?'Dato da verificare':qc===4?'Dato segnalato non buono':'Vedere controllo qualità della fonte'}});
 }
 return {type:'FeatureCollection',features:[...latest.values()]};
}
export function validateGeoJSON(raw:unknown):MapData {
 if(!raw||typeof raw!=='object'||!('type'in raw)||raw.type!=='FeatureCollection'||!('features'in raw)||!Array.isArray(raw.features))throw Error('Geometrie non valide');
 return raw as MapData;
}
export function metricRange(layer:LayerDefinition,data?:MapData):[number,number]|null{
 if(!layer.metric)return null;
 if(finite(layer.metric.min)&&finite(layer.metric.max)&&layer.metric.min<layer.metric.max)return[layer.metric.min,layer.metric.max];
 if(!data)return null;const values=data.features.map(f=>f.properties?.[layer.metric!.field]).filter(finite);
 if(!values.length)return null;let min=Infinity,max=-Infinity;for(const v of values){min=Math.min(min,v);max=Math.max(max,v);}return min<max?[min,max]:null;
}

/** PCR point products retain observation dates; webcam status is source metadata. */
export function pcrProductData(raw:unknown,kind:'earthquakes'|'webcams'):MapData {
 const product=raw as Record<string,unknown>;
 if(product?.result!=='OK'||!Array.isArray(product[kind]))throw Error('Formato del prodotto PCR non riconosciuto');
 const features:GeoJSON.Feature<GeoJSON.Point>[]=[];
 for(const row of product[kind] as Record<string,unknown>[]){
  if(!finite(row.lon)||!finite(row.lat)||Math.abs(row.lon)>180||Math.abs(row.lat)>90)continue;
  const properties:Record<string,unknown>={...row,__featureId:String(row.id??[row.lon,row.lat,row.dt].join(':')),__name:row.description??row.name??'Punto PCR'};
  if(kind==='earthquakes'){
   const rawTime=String(row.dt??''),time=/Z$|[+-]\d\d:\d\d$/.test(rawTime)?rawTime:rawTime.replace(' ','T')+'Z';
   if(!Number.isFinite(Date.parse(time))||Date.parse(time)>Date.now()+300000)continue;
   properties.__observedAt=time;properties.profondita_km=row.depth;
   if(finite(row.magnitudo)){properties.__value=row.magnitudo;properties.__displayValue=String(row.magnitudo);properties.__unit='M';}
  }
  features.push({type:'Feature',id:String(properties.__featureId),geometry:{type:'Point',coordinates:[row.lon,row.lat]},properties});
 }
 return{type:'FeatureCollection',features};
}
export function defaultOpacity(l:LayerDefinition):number{return l.kind==='pcr'?1:l.kind==='radar'?.65:l.kind==='buildings'?.7:l.kind==='raster'?1:l.geometryTypes?.some(g=>g.includes('Polygon'))?.35:.85;}
