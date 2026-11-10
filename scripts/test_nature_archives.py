import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('nature_archives', Path(__file__).with_name('build-nature-archives.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ArchiveTests(unittest.TestCase):
    def fixture(self, date='2026-08-10', coords='13.01,46.40 13.02,46.40 13.02,46.41 13.01,46.40', area='10'):
        return f'''<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:m="urn:test"><gml:featureMember><m:feature><m:id>1</m:id><m:FIREDATE>{date}</m:FIREDATE><m:COUNTRY>IT</m:COUNTRY><m:COMMUNE>Amaro</m:COMMUNE><m:AREA_HA>{area}</m:AREA_HA><m:msGeometry><gml:Polygon><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>{coords}</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></m:msGeometry></m:feature></gml:featureMember></wfs:FeatureCollection>'''
    def test_selects_study_dates_and_preserves_attributes(self):
        rows = module.parse_gml(self.fixture())
        self.assertEqual(rows[0]['properties']['AREA_HA'], '10')
        self.assertEqual(rows[0]['geometry']['coordinates'][0][0][0], [13.01, 46.4])
        with self.assertRaises(ValueError):
            module.parse_gml(self.fixture(date='2021-04-02'))
    def test_rejects_bad_coordinate_order_and_nonfinite_measurement(self):
        for payload in (self.fixture(coords='46.4,13.01 46.4,13.02 46.41,13.02 46.4,13.01'),self.fixture(area='nan')):
            with self.assertRaises(ValueError):
                module.parse_gml(payload)
    def test_failed_refresh_retains_acquisition_and_geometry(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'archive.json'
            old = {'type':'FeatureCollection','features':module.parse_gml(self.fixture()),'provenance':{'retrievedAt':'2026-01-01'}}
            target.write_text(json.dumps(old))
            with patch.object(module,'TARGET',target),patch.object(module.requests,'get',side_effect=RuntimeError('temporary outage')):
                module.main()
            actual=json.loads(target.read_text())
            self.assertEqual(actual['features'],old['features'])
            self.assertEqual(actual['provenance']['retrievedAt'],'2026-01-01')
            self.assertEqual(actual['provenance']['refreshError'],'temporary outage')
if __name__ == '__main__':
    unittest.main()
