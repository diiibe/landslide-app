SRC_DIR := ../ml-landslide-mapping-audit
OUT := public/tiles
# HazardFVG export of the v2 model (bodies.parquet, diffuse.parquet)
V2_MAP_DIR := ../HazardFVG/data/processed/model/map

.PHONY: tiles tiles-j2 tiles-j3 tiles-iffi tiles-v2 clean-tiles test-py

tiles: tiles-j2 tiles-j3 tiles-iffi

tiles-j2:
	python -m pipelines.build_tiles j2 --src-dir $(SRC_DIR) --out-dir $(OUT)

tiles-j3:
	python -m pipelines.build_tiles j3 --src-dir $(SRC_DIR) --out-dir $(OUT)

tiles-iffi:
	python -m pipelines.build_tiles iffi --src-dir $(SRC_DIR) --out-dir $(OUT)

# Not part of `tiles`: needs the HazardFVG repo; also writes public/data/model_v2.json
tiles-v2:
	python -m pipelines.model_v2 --map-dir $(V2_MAP_DIR) --tiles-dir $(OUT) --data-dir public/data

clean-tiles:
	rm -f $(OUT)/*.pmtiles $(OUT)/*.geojson

test-py:
	pytest pipelines/tests -v
