SRC_DIR := ../ml-landslide-mapping-audit
OUT := public/tiles

.PHONY: tiles tiles-j2 tiles-j3 tiles-iffi clean-tiles test-py

tiles: tiles-j2 tiles-j3 tiles-iffi

tiles-j2:
	python -m pipelines.build_tiles j2 --src-dir $(SRC_DIR) --out-dir $(OUT)

tiles-j3:
	python -m pipelines.build_tiles j3 --src-dir $(SRC_DIR) --out-dir $(OUT)

tiles-iffi:
	python -m pipelines.build_tiles iffi --src-dir $(SRC_DIR) --out-dir $(OUT)

clean-tiles:
	rm -f $(OUT)/*.pmtiles $(OUT)/*.geojson

test-py:
	pytest pipelines/tests -v
