# Stage 2A changelog

41 new files; **zero pre-existing files modified; zero runtime changes**. No original failing test was removed, weakened or marked xfail. Root requirements.txt, conftest.py and pytest.ini are untouched. All pre-existing working-tree hashes match the starting manifest. No Stage2B defect fix, UI migration, service/database/queue/auth infrastructure or broad extraction was introduced.

| File | Classification | Why |
|---|---|---|
| `docs/enterprise/stage2/01_BASELINE_REPORT.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/02_TEST_INVENTORY.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/03_METRIC_DECISION_REGISTER.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/04_GOLDEN_DATASET_CATALOGUE.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/05_GATE_EVIDENCE.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/06_STAGE2A_CHANGELOG.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/README.md` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/baseline_manifest.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/dependency_evidence.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/dependency_import_inventory.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/failure_classifications.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/full_suite_result.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/golden_scenarios.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/initial_suite_result.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/metric_decisions.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/performance_provenance.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/starting_worktree.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `docs/enterprise/stage2/test_inventory.json` | DOCUMENTATION | Stage2A baseline, decisions, inventory, golden/gate evidence or machine-readable provenance. |
| `requirements/README.md` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/build.in` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/core-win-py314.lock` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/core.in` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/full-win-py314.lock` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/full.in` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/optional.in` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/test-win-py314.lock` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `requirements/test.in` | DEPENDENCY | Reviewed direct profile / platform-specific transitive hash lock / reproducible installation instructions; preserves selected versions. |
| `scripts/benchmark_stage2_baseline.py` | TOOLING | Reproducible 10K/100K-only benchmark harness; not an enterprise benchmark. |
| `scripts/run_stage2_baseline.py` | TOOLING | Offline source-only test copies, fake home, complete evidence and process-per-module Tk isolation; existing assertions unchanged. |
| `tests/characterization/test_legacy_conflicts.py` | TEST | Current-behavior characterization and contract checks; known defects are explicitly labeled. |
| `tests/contracts/test_catalogue_integrity.py` | TEST | Current-behavior characterization and contract checks; known defects are explicitly labeled. |
| `tests/contracts/test_metric_golden.py` | TEST | Current-behavior characterization and contract checks; known defects are explicitly labeled. |
| `tests/golden/README.md` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/approvals.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/attendance.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/future_expectations.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/metric_contracts.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/policy.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/timing.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/wfh.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |
| `tests/golden/working_time.json` | FIXTURE | Synthetic hand-reviewable inputs/expected components or metric metadata; no runtime engine. |

The only isolation corrections are in the new runner: disable plugin autoload/dotenv/sockets, use writable source-only copies and a synthetic home, and run each module in a fresh process. This changes test execution isolation, not application code or formulas. Initial failures remain recorded. Draft golden-test authoring corrections are recorded in failure_classifications.json. The full test result remains nonzero.
