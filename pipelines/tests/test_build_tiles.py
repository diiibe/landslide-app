from pathlib import Path
from unittest import mock

import pytest

from pipelines import build_tiles
from pipelines.build_tiles import parse_args, run_tippecanoe


def test_parse_args_j2():
    ns = parse_args(["j2", "--src-dir", "/tmp/src", "--out-dir", "/tmp/out"])
    assert ns.which == "j2"
    assert ns.src_dir == "/tmp/src"
    assert ns.out_dir == "/tmp/out"


def test_run_tippecanoe_raises_runtimeerror_with_install_hint_when_missing():
    """If `tippecanoe` is not on PATH, surface a helpful RuntimeError
    instead of letting subprocess emit a cryptic FileNotFoundError."""
    with mock.patch("pipelines.build_tiles.shutil.which", return_value=None):
        with pytest.raises(RuntimeError, match="tippecanoe"):
            run_tippecanoe(
                Path("/tmp/in.geojson"),
                Path("/tmp/out.pmtiles"),
                min_zoom=6,
                max_zoom=14,
                layer_name="cells",
            )


def test_run_tippecanoe_passes_parallel_read_flags():
    """The tippecanoe command must include parallel-read flags so I/O
    on multi-million-row GeoJSON inputs is not single-threaded."""
    with (
        mock.patch(
            "pipelines.build_tiles.shutil.which", return_value="/usr/local/bin/tippecanoe"
        ),
        mock.patch("pipelines.build_tiles.subprocess.run") as run,
    ):
        run_tippecanoe(
            Path("/tmp/in.geojson"),
            Path("/tmp/out.pmtiles"),
            min_zoom=6,
            max_zoom=14,
            layer_name="cells",
        )
    assert run.call_count == 1
    cmd = run.call_args[0][0]
    assert cmd[0] == "tippecanoe"
    assert "-P" in cmd
    assert "--read-parallel" in cmd


def test_run_tippecanoe_does_not_invoke_subprocess_when_binary_missing():
    """Subprocess must not even be called when the binary is unavailable."""
    with (
        mock.patch("pipelines.build_tiles.shutil.which", return_value=None),
        mock.patch("pipelines.build_tiles.subprocess.run") as run,
    ):
        with pytest.raises(RuntimeError):
            run_tippecanoe(
                Path("/tmp/in.geojson"),
                Path("/tmp/out.pmtiles"),
                min_zoom=6,
                max_zoom=14,
                layer_name="cells",
            )
    run.assert_not_called()
