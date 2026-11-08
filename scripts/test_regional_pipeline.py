"""Regression checks for data identity, units and partial-source recovery (no network)."""
import importlib.util,pathlib,unittest
from unittest.mock import patch
from shapely.geometry import shape
HERE=pathlib.Path(__file__).parent
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,HERE/file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
t=load('tables_test','build-regional-tables.py');b=t.b
class RegionalPipeline(unittest.TestCase):
 def test_censored_values_are_not_zero(self):
  self.assertIsNone(t.number('<0.01'));self.assertIsNone(t.number('> 300'));self.assertEqual(t.number('0'),0)
 def test_water_coordinates_are_native_wgs84(self):
  self.assertEqual(t.geometry({'lon_wgs84':'13.7','lat_wgs84':'45.6'},'wthn-aebz')['coordinates'],[13.7,45.6])
  self.assertEqual(t.geometry({'long_wgs84':13.7,'lat_wgs84':45.6},'f68q-kif9')['coordinates'],[13.7,45.6])
 def test_invalid_polygon_is_repaired_and_marked(self):
  feature=b.feature({'type':'Polygon','coordinates':[[[13,46],[13.1,46.1],[13,46.1],[13.1,46],[13,46]]]}, {})
  self.assertTrue(shape(feature['geometry']).is_valid);self.assertTrue(feature['properties']['__geometryRepaired'])
 def test_pagination_overlap_is_rejected(self):
  first=[{'properties':{'ID':i},'geometry':None}for i in range(5000)]
  with patch.object(b,'fetch',side_effect=[{'type':'FeatureCollection','numberMatched':5001,'features':first},{'type':'FeatureCollection','numberMatched':5001,'features':first},{'type':'FeatureCollection','numberMatched':5001,'features':[first[-1]]}]):
   result=b.wfs('RIS_ENERG:imp_ftv_agriftv')
  self.assertEqual(result['status'],'blocked');self.assertIn('duplicati',result['problem'])
 def test_successful_parameters_survive_later_parameter_failure(self):
  sid='wthn-aebz';rows=[{'codicepunto':site,'parametro':par,'um':'mg/l','data':'2026-01-01','lon_wgs84':13.7,'lat_wgs84':45.6,'risultato':'2'}for site,par in [('P1','A'),('P2','B')]]
  def save(definition,features,*args):
   if features[0]['properties']['parametro']=='B':raise ValueError('provider/conversion failure')
   return{**definition,'status':'ready','count':len(features),'retrievedAt':'2026-01-02'}
  with patch.object(b,'fetch',return_value={'name':'Water','license':{'name':'Italian Open Data License 2.0'}}),patch.object(t,'table',return_value=(rows,set(rows[0]),'data',None)),patch.object(b,'save_layer',side_effect=save):result=t.process(sid)
  self.assertEqual([r['status']for r in result],['ready','blocked']);self.assertEqual(result[0]['retrievedAt'],'2026-01-02')
 def test_tourism_uses_code_and_real_metrics(self):
  polygon={'type':'Polygon','coordinates':[[[13,46],[13.1,46],[13.1,46.1],[13,46.1],[13,46]]]}
  municipal={'031003':{'geometry':polygon,'properties':{'COD_ISTAT':'031003'}}}
  with patch.object(t,'municipalities',return_value=municipal),patch.object(b,'save_layer',side_effect=lambda d,fs,*args:{**d,'fs':fs}):
   result=t.aggregate({'id':'tourism','sourceId':'7eps-cpgr','title':'Turismo'},[{'comune_codice':'31003','comune':'DOBERD� DEL LAGO','arrivi':40,'presenze':201}],set())
  self.assertEqual([r['fs'][0]['properties']['__value']for r in result],[40,201])
 def test_bathing_units_preserved(self):
  self.assertEqual(t.BATH_UNITS['escherichia_coli'],'UFC/100 ml');self.assertEqual(t.BATH_UNITS['altezza_onde'],'m');self.assertNotIn('pioggia',t.BATH_UNITS)
if __name__=='__main__':unittest.main()
