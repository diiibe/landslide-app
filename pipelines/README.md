# pipelines

Offline preprocessing: `.gpkg` + `.parquet` → `.pmtiles`.

## Prereqs
- Python 3.10+
- `pip install -e '.[dev]'`
- `tippecanoe` installed (`brew install tippecanoe` on macOS)

## Run

```
make tiles
```

Outputs to `public/tiles/{j2,j3,iffi}.pmtiles`.
