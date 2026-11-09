"""Published analysis assets must match their manifest and model metadata."""
from pathlib import Path
import gzip
import hashlib
import json
import struct
import pytest

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/spaces'


def sha(data):
    return hashlib.sha256(data).hexdigest()[:16]


def test_analysis_manifest_matches_current_model():
    manifest = json.loads((DATA / 'manifest.json').read_text())
    model = json.loads((ROOT / 'public/data/model_v2.json').read_text())
    assert manifest['modelHash'] == sha((ROOT / 'public/data/model_v2.json').read_bytes())
    raw = gzip.decompress((DATA / manifest['modelGrid']['file']).read_bytes())
    magic, width, height, x0, y0, cell = struct.unpack_from('<8sIIddd', raw)
    assert magic == b'FVGRID1\0'
    assert len(raw) == 40 + width * height * 10
    assert cell == model['grid']['cell']
    assert (width, height) == (model['grid']['width'], model['grid']['height'])
    assert (x0, y0) == (model['grid']['x0'], model['grid']['y0'])


@pytest.mark.parametrize('name', ['modelGrid', 'roads', 'trails'])
def test_assets_are_complete_and_versioned(name):
    manifest = json.loads((DATA / 'manifest.json').read_text())
    entry = manifest['modelGrid'] if name == 'modelGrid' else manifest['networks'][name]
    packed = (DATA / entry['file']).read_bytes()
    assert len(packed) == entry['bytes']
    assert sha(packed) == entry['sha']
    raw = gzip.decompress(packed)
    assert sha(raw) == entry['rawSha']
    if name != 'modelGrid':
        magic, count, _, _, stride = struct.unpack_from('<8sIddI', raw)
        assert magic == b'FVNET1\0\0'
        assert stride == 16
        assert count == entry['segments']
        assert len(raw) == 32 + count * stride
        assert sha((ROOT / 'public/tiles' / entry['tiles']).read_bytes()) == entry['tileSha']
