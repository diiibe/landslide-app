"""Lossless cumulative class masks for the low-zoom susceptibility PNGs.

Palette indices are model classes (0 = outside domain). Masking only changes
alpha, never class colours, georeferencing or the original model scores.
"""
from io import BytesIO
from pathlib import Path
from PIL import Image
from pmtiles.reader import Reader, all_tiles
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid


def write_threshold_tiles(source: Path, classes: int) -> list[Path]:
    raw = source.read_bytes()
    get_bytes = lambda offset, length: raw[offset:offset + length]
    reader = Reader(get_bytes)
    header, metadata = reader.header(), reader.metadata()
    original = list(all_tiles(get_bytes))
    outputs = []
    for minimum in range(2, classes + 1):
        output = source.with_name(source.stem + f'_min{minimum}.pmtiles')
        with output.open('wb') as handle:
            writer = Writer(handle)
            for (z, x, y), data in original:
                with Image.open(BytesIO(data)) as image:
                    if image.mode != 'P':
                        raise ValueError('Expected class-indexed palette PNG')
                    if max(image.getdata()) > classes:
                        raise ValueError('Class index outside model metadata')
                    alpha = bytes([0 if k < minimum else 255 for k in range(256)])
                    buf = BytesIO()
                    image.save(buf, format='PNG', transparency=alpha, optimize=True)
                    writer.write_tile(zxy_to_tileid(z, x, y), buf.getvalue())
            writer.finalize(dict(header), {**metadata, 'minimum_class': minimum})
        outputs.append(output)
    return outputs


def write_class_tiles(source: Path, classes: int) -> list[Path]:
    """Independent masks permit non-contiguous selections without blending classes."""
    raw = source.read_bytes()
    get_bytes = lambda offset, length: raw[offset:offset + length]
    reader = Reader(get_bytes)
    header, metadata = reader.header(), reader.metadata()
    original = list(all_tiles(get_bytes))
    outputs = []
    # Always publish five channels; collapsed quantiles simply leave empty ones.
    for selected in range(1, 6):
        output = source.with_name(source.stem + f'_class{selected}.pmtiles')
        temporary = output.with_suffix('.pmtiles.tmp')
        try:
            with temporary.open('wb') as handle:
                writer = Writer(handle)
                for (z, x, y), data in original:
                    with Image.open(BytesIO(data)) as image:
                        if image.mode != 'P' or max(image.getdata()) > classes:
                            raise ValueError('Expected valid class-indexed palette PNG')
                        buf = BytesIO()
                        image.save(buf, format='PNG', transparency=bytes(255 if k == selected else 0 for k in range(256)), optimize=True)
                        writer.write_tile(zxy_to_tileid(z, x, y), buf.getvalue())
                writer.finalize(dict(header), {**metadata, 'visible_classes': [selected]})
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
        outputs.append(output)
    return outputs


if __name__ == '__main__':
    import json
    root = Path(__file__).resolve().parents[1]
    model = json.loads((root / 'public/data/model_v2.json').read_text())
    for which, stats in model['layers'].items():
        for output in write_class_tiles(root / f'public/tiles/v2_{which}_raster.pmtiles', stats['classes']):
            print(output.name, output.stat().st_size)
