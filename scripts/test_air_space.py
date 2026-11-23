import copy, importlib.util, io, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import openpyxl
spec=importlib.util.spec_from_file_location('air_pipeline',Path(__file__).with_name('build-air-space.py'))
air=importlib.util.module_from_spec(spec);spec.loader.exec_module(air)
class Response:
 def __init__(self,text='',content=b'',payload=None):self.text=text;self.content=content;self.payload=payload
 def json(self):return self.payload
class AirSources(unittest.TestCase):
 def test_sme_keeps_missing_invalid_and_raw_qualifiers(self):
  def row(date,nox,so2,dust):return '<tr>'+''.join('<td>'+v+'</td>'for v in [date,nox,so2,dust,'','','','','220000','Impianto in Produzione'])+'</tr>'
  rows=air.parse_sme('<table>'+row('01/11/2026','449.6','52.9','4.8')+row('02/11/2026','(5s)','(5s)','(5s)')+row('03/11/2026','','','')+'</table>')
  self.assertEqual(rows[0]['NOx'],449.6);self.assertEqual(rows[0]['SO2'],52.9);self.assertEqual(rows[0]['dust'],4.8)
  self.assertIsNone(rows[1]['NOx']);self.assertEqual(rows[1]['rawNOx'],'(5s)');self.assertIsNone(rows[2]['dust']);self.assertEqual(rows[0]['unit'],'mg/Nm³')
 def test_inventory_maps_the_actual_column_names_without_zeroing_blanks(self):
  w=openpyxl.Workbook();sheet=w.active;sheet.append(['ISTAT_COMUNE','COMUNE','CODICE_MACROSETTORE','MAC_NOME','NOx','PM10','PM2_5'])
  for i in range(1,41):sheet.append([93000+i,'Comune',3,'Industria',.001,None,2.5])
  buf=io.BytesIO();w.save(buf)
  data={'municipalities':{'features':[{'properties':{'istat':93001}}]},'sources':[{'id':'inemar'}]}
  with patch.object(air,'get',side_effect=[Response(text='<a href="/documents/Inventario_2023_Comunale.xlsx">Dati</a>'),Response(content=buf.getvalue())]):air.inventory(data)
  self.assertEqual(data['municipalities']['features'][0]['properties']['sectors'][0]['values'],{'NOx':.001,'PM10':None,'PM2_5':2.5})
  self.assertEqual(len(data['sources'][0]['sha256']),64)
 def test_observations_keep_insufficient_and_missing_values(self):
  measure_rows=[{'ubicazione':'Sito','data_misura':'2026-11-01T00:00:00','unita_misura':'ug/m3','media_giornaliera':'20','media_oraria_max':'30','dati_insuff':'True'}]
  data={'stations':[{'name':'Sito','series':{}}],'sourceStatus':{},'sources':[]}
  with patch.object(air,'get',return_value=Response(payload=measure_rows)):air.observations(data)
  for key in ['pm10','pm25','no2']:
   row=data['stations'][0]['series'][key][0];self.assertIsNone(row['value']);self.assertFalse(row['valid']);self.assertTrue(row['insufficient']);self.assertEqual(row['raw'],'30'if key=='no2'else'20')
 def test_discovers_stations_using_validated_domain_without_changing_published_polygons(self):
  geometry={'type':'Polygon','coordinates':[[[12,45],[13,46],[12,46],[13,45],[12,45]]]}
  data={'municipalities':{'features':[{'geometry':geometry}]},'stations':[],'sourceStatus':{},'sources':[]}
  row={'ubicazione':'Nuovo sito','longitudine':'12.5','latitudine':'45.8','data_misura':'2026-11-01','unita_misura':'ug/m3','media_giornaliera':'15','media_oraria_max':'25'}
  original=copy.deepcopy(geometry)
  with patch.object(air,'get',return_value=Response(payload=[row])):air.observations(data)
  self.assertEqual(len(data['stations']),1);self.assertEqual(data['stations'][0]['coordinates'],[12.5,45.8]);self.assertEqual(data['municipalities']['features'][0]['geometry'],original)
 def test_failed_sources_preserve_last_good_data_atomically(self):
  data={'snapshot':'2026-11-01','municipalities':{'features':[{'properties':{'istat':93033,'sectors':[]}}]},'stations':[],'aia':{'type':'FeatureCollection','features':[]},'sme':[{'date':'2026-11-01','NOx':42,'dust':None,'SO2':None}],'sourceStatus':{},'sources':[]};context={'industrialZones':{'type':'FeatureCollection','features':[]},'commercialZones':{'type':'FeatureCollection','features':[]},'sources':[]}
  with tempfile.TemporaryDirectory()as directory:
   target=Path(directory);(target/'data.json').write_text(json.dumps(data));(target/'context.json').write_text(json.dumps(context))
   with patch.object(air,'get',side_effect=RuntimeError('source unavailable')):air.refresh(target)
   actual=json.loads((target/'data.json').read_text());self.assertEqual(actual['municipalities'],data['municipalities']);self.assertEqual(actual['sme'],data['sme']);self.assertEqual(actual['sourceStatus']['inemar']['error'],'source unavailable');self.assertIsNone(actual['sourceStatus']['inemar']['retrievedAt']);self.assertEqual(len(list(target.iterdir())),2)
 def test_planning_source_ids_continue_matching_the_refresh_status(self):
  context={'sources':[{'url':'https://example.test/CER:ZONE_INDUSTRIALI_ARTIG_D'},{'url':'https://example.test/CER:ZONE_COMMERCIALI_H'}]}
  rows=[{'id':'1','geometry':{'type':'Polygon','coordinates':[[[12,45],[13,45],[12,46],[12,45]]]},'properties':{'COD_PROV':'093'}}]
  with patch.object(air,'wfs',return_value=rows):
   air.planning(context,'industrialZones','CER:ZONE_INDUSTRIALI_ARTIG_D');air.planning(context,'commercialZones','CER:ZONE_COMMERCIALI_H')
  self.assertEqual([s['id']for s in context['sources']],['industrial','commercial'])
 def test_numeric_parser_does_not_coerce_censored_or_nonfinite_to_zero(self):
  for value in ['(5s)','nan','inf','',None]:self.assertIsNone(air.number(value))
  self.assertEqual(air.number('0'),0);self.assertEqual(air.number('0,0006'),.0006)
if __name__=='__main__':unittest.main()
