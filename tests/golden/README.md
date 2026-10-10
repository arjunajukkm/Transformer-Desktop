# Synthetic characterization fixtures, version 1

All new records use synthetic identifiers and invented organizational labels. JSON expected values are hand-authored arithmetic. Do not refresh them automatically from production outputs.

`metric_contracts.json` is test/documentation metadata, not a runtime semantic engine. `future_expectations.json` contains explicitly unsupported future expectations; its structural test does not establish runtime support or business approval. Current-behavior tests in `tests/characterization/` deliberately reproduce known defects. When Stage 2B corrects a defect, retain its history, add the approved desired assertion, and update the legacy oracle deliberately.

See `docs/enterprise/stage2/04_GOLDEN_DATASET_CATALOGUE.md` for inputs, grains, arithmetic, DQ, lineage limits, scenario count and gate mapping. Source policy checksum and tested runtime hashes are in the baseline manifest.
