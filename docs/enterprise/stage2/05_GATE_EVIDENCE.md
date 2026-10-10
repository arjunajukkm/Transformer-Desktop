# Gate evidence

## G01 — FAIL

| Requirement | Evidence / command | Result | Remaining blocker |
|---|---|---|---|
| Clean reproducible environment | Empty venv + `pip install --no-index --find-links <wheelhouse> --require-hashes --only-binary=:all: -r requirements/full-win-py314.lock`; lock hashes in dependency_evidence.json | PASS; 81 packages installed; pip check clean | Other Python/platform profiles not demonstrated |
| Every test inventoried | `python scripts/run_stage2_baseline.py --work-dir <external-writable-dir> --per-file`; test_inventory.json/full_suite_result.json | 534 collected; no collection errors | None for inventory |
| Trustworthy complete result | Source-only copies, synthetic home, dotenv/network/plugin-autoload blocked; all modules run | {'passed': 517, 'failed': 14, 'skipped': 3} | 14 assertions fail; no waivers |
| Every failure classified | failure_classifications.json with module/test/exception/evidence/owner/action | PASS classification; no UNRESOLVED category | Classification is not remediation |
| Desktop/workflow smoke | Inventory and existing integration suites | PARTIAL; current shell routes exercised | Obsolete tests, focus crash, KRA App-transform/full ID visual smoke, packaging proof |
| Worktree preservation | starting_worktree.json; final baseline_manifest.json | PASS pre-existing files unchanged | None |

## G02 — BLOCKED

| Requirement | Evidence / command | Result | Remaining blocker |
|---|---|---|---|
| Current implementation characterization | `python scripts/run_stage2_baseline.py --work-dir <dir> --test tests/contracts --test tests/characterization` | 60 PASS; 20 contracts / 58 executable domain cases | Does not approve canonical business meaning |
| Identity/components/DQ/null/attribution | Golden JSON + exact assertions, pinned age and source-policy checksum | IMPLEMENTATION_PARITY PASS for characterized cases | Native event revisions/retractions/security absent; future examples are design-only |
| Mean/median/rounded arithmetic | Golden sums/counts/inputs and distinct mean/median fixture | PASS exact assertions; no broad tolerances | MC13 requires explicit future component fields |
| Approved metric semantics | MC01–MC14 decision register | BUSINESS_APPROVAL NOT ASSERTED | HR: MC02–MC06/MC11/MC12; data: MC07/MC09; security+HR/data: MC08; technical: MC01/MC10/MC13/MC14 |
| Existing desired attendance quantity | Two preserved failing AR/composition tests plus MC14 characterization | FAIL desired-behavior parity | Narrow Stage2B AR mapping correction and downstream verification |

Stage2A completion means evidence is established, not that migration gates passed. G03–G15 are not certified; no new platform or future-engine capacity has been tested. No business decision has been marked APPROVED_CHANGE.
