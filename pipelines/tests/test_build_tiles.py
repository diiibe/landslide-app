from pipelines.build_tiles import parse_args


def test_parse_args_j2():
    ns = parse_args(["j2", "--src-dir", "/tmp/src", "--out-dir", "/tmp/out"])
    assert ns.which == "j2"
    assert ns.src_dir == "/tmp/src"
    assert ns.out_dir == "/tmp/out"
