from io import BytesIO
from pathlib import Path

from PIL import Image
from pmtiles.reader import Reader, all_tiles

from pipelines.threshold_tiles import write_threshold_tiles


def test_threshold_archives_preserve_every_pixel_and_hide_only_lower_classes(tmp_path):
    """Use the shipped real input rather than synthesizing a different tile contract."""
    source = Path(__file__).parents[2] / 'public/tiles/v2_bodies_raster.pmtiles'
    copied = tmp_path / source.name
    copied.write_bytes(source.read_bytes())
    raw = copied.read_bytes()
    original = dict(all_tiles(lambda o, n: raw[o:o+n]))
    for minimum, output in enumerate(write_threshold_tiles(copied, 5), 2):
        result = output.read_bytes()
        getter = lambda o, n: result[o:o+n]
        assert Reader(getter).metadata()['minimum_class'] == minimum
        tiles = dict(all_tiles(getter))
        assert tiles.keys() == original.keys()
        for key, data in tiles.items():
            before = Image.open(BytesIO(original[key]))
            after = Image.open(BytesIO(data))
            assert after.mode == before.mode == 'P'
            assert after.tobytes() == before.tobytes()
            assert after.getpalette() == before.getpalette()
            alpha = after.convert('RGBA').getchannel('A').tobytes()
            assert alpha == bytes(0 if k < minimum else 255 for k in before.tobytes())


def test_single_class_masks_keep_classes_geography_and_colour_exact(tmp_path):
    from pipelines.threshold_tiles import write_class_tiles
    for which in ('bodies', 'diffuse'):
        source = Path(__file__).parents[2] / f'public/tiles/v2_{which}_raster.pmtiles'
        copied = tmp_path / source.name
        copied.write_bytes(source.read_bytes())
        raw = copied.read_bytes()
        original = dict(all_tiles(lambda o, n: raw[o:o+n]))
        for selected, output in enumerate(write_class_tiles(copied, 5), 1):
            result = output.read_bytes()
            getter = lambda o, n: result[o:o+n]
            assert Reader(getter).metadata()['visible_classes'] == [selected]
            tiles = dict(all_tiles(getter))
            assert tiles.keys() == original.keys()
            for key, data in tiles.items():
                before = Image.open(BytesIO(original[key]))
                after = Image.open(BytesIO(data))
                assert after.mode == before.mode == 'P'
                assert after.tobytes() == before.tobytes()
                assert after.getpalette() == before.getpalette()
                assert after.convert('RGBA').getchannel('A').tobytes() == bytes(255 if c == selected else 0 for c in before.tobytes())
