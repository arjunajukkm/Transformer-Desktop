# Stage 2B.1 — MC14 A(R) attendance quantity correction

Status: complete for MC14. Technical MC14 correctness is **RESOLVED**, implementation/golden parity **PASS**. G01 remains **FAIL** and overall G02 remains **BLOCKED**. No subsequent slice started.

## Starting state and evidence preservation

Branch `feature/workforce-intelligence`, commit `fcb0ecc9f80e9eff6fa8a9cdeea5afc90252c3fe`. Starting baseline: **538 collected, 533 passed, 2 failed, 3 skipped, zero errors**. Before changes, the worktree source hashes matched the Stage 2B.0 final full-suite copy. `stage2b1_starting_state.json` records the branch, commit, all pre-existing working-tree paths, source hashes, Stage 2A manifest checksum and every Stage 2A/2B.0 evidence checksum.

All prior evidence under `docs/enterprise/stage2` is byte-preserved. The original desired-behavior test files, Stage 2B.0 fixture repairs and `Transformers.spec` remain byte-identical to this slice's starting state. Only the MC14 characterization function changes within its existing test module. No reset, stash, clean, commit, dependency change or unrelated user edit occurred.

## Root cause and runtime trace

The conceptual loss is from **Present composition**, not from the overall current denominator. The executed before-probe finds Present=0, Absent=0, **Unclassified=1**, total=1 for a raw Absent/A(R)/1.0 row without separate approval metadata. The row stays traceable; its category is wrong for the preserved desired contract.

| Boundary | Input → output before correction | Corrected behavior |
|---|---|---|
| `storage/snapshot_service.py::normalize_dataset_dataframe` | Raw Attendance Type=Absent, Status=A(R), Quantity=1 → helper `_att_type=Regularized`; raw columns retained | Unchanged |
| `normalization.py::normalize_attendance_category` / `normalize_workforce_dataframe` | A(R) takes precedence; canonical category=Attendance Regularized; record/row lineage created | Unchanged |
| `data_foundation.py::CanonicalWorkforceData.from_dataframe` | Raw record remains Absent/A(R), quantity=1; day total=1, regularization=true, absent=false, legacy `has_present` flag=false | Unchanged |
| `metrics.py::build_employee_day_facts` | Independent rate facts preserve daily quantity=1 and regularization=true/absent=false; legacy `has_present` flag=false | Unchanged |
| `kpi_engine.py::compute_workforce_intelligence_bundle`, row classification | `_att_type=Regularized` and `_status=A(R)` match neither normal Present nor Absent; `_cat=UNCLASSIFIED` | Exact A(R)/AR status contributes to Present mask and cannot enter Absent mask |
| Same function, employee-day reconstruction | Only an Approved+regularized unclassified row is promoted to Present; missing approval leaves it Unclassified | `_cat=PRESENT` already reaches the unchanged single-row/split-day/overlap logic |
| Same function, `_record_event` and bundle | Present=0, Absent=0, Unclassified=1; same wrong allocation reaches daily/BU composition | Present=1, Absent=0, Unclassified=0; total remains1 |
| `snapshot_bridge.py::get_workforce_metrics` → `dashboard_shell.py::_on_metrics_calc_success` | Snapshot bundle delivers zero Present to card | Same bridge/render path displays **1 day**; no UI adjustment |

Full synthetic input/output state is in `stage2b1_mc14_trace.json`, including normalized rows, canonical records/facts, rate facts, quantity accumulators, daily/BU outputs and trend components. The before/after trace asserts exact equality for all raw, normalization, canonical/rate-fact and monthly-rate fields.

## Minimal production correction and authority

Only **`workforce_intelligence/kpi_engine.py::compute_workforce_intelligence_bundle`** changes: five added/two removed lines. An exact, case/whitespace-normalized status mask recognizes `a(r)` and `ar`, excludes them from Absent and includes them in Present before `_cat` assignment and employee-day aggregation. There is no blanket promotion of every Regularized/Unknown row, no separate approval requirement for A(R), no private UI arithmetic and no broad refactoring.

This is the earliest incorrect boundary in the active **quantity** path. That path does not derive quantity buckets from the separate canonical `has_present` flag. Reworking the canonical category or rate-fact model would also alter regularization/conflict semantics and would not alone fix this KPI path. Those legacy models retain their existing independent flags; this slice does not unify them or assert that their presence flag is equivalent to the corrected quantity bucket. The corrected row categories naturally feed the existing day reconstruction, quantities, percentages, daily chart and BU comparison used by Overview.

Higher-priority leave/WFH/OD/holiday/week-off behavior, missing-swipe classification, quantity fallback/capping and conflicting-day resolution remain unchanged. Tests explicitly protect leave/WFH precedence, normal Absent/Present, P(R) approved/unapproved, generic regularization and unknown input. Existing exception counts still use their separate regularization indicator; it is not added as another composition bucket.

## Quantity conservation, fractional cases and raw evidence

- A(R)1.0: Present1.0 + Absent0 + other composition0 = eligible quantity1.0.
- A(R)0.5: Present0.5 + Absent0 + other composition0 = eligible quantity0.5.
- Present0.5 + Absent/A(R)0.5 on one employee-day: Present1.0, Absent0, Unclassified0, recorded days1 and regularization days1. Both input orders pass.
- All 15 hand-authored matrix cases reconcile the sum of the mutually exclusive composition buckets to the expected total. Daily and BU quantities agree with the bundle. Regularization is an overlapping indicator and is deliberately excluded from that sum.
- Raw DataFrames are unchanged. Snapshot raw Attendance Type remains Absent; canonical records retain the original attendance/status, quantity, record IDs and source-row lineage.
- Missing/invalid/nonpositive quantities retain the existing Overview fallback of1.0, while canonical missing/invalid quantity remains unknown and missing-quantity DQ flags remain set. This is **preserved legacy behavior**, not a newly approved missing-data policy or a conservation claim about an unknown raw quantity.
- A critical 1.5-day overlapping group remains Unclassified1 under the existing conflict/cap rule and is excluded from governed rate denominators. Unknown status/type stays Unclassified. No DQ repair or new eligibility policy was introduced.

The valid-quantity invariant is therefore met without double counting. The unchanged fallback/overlap limits are documented rather than hidden by a generalized equality across different grains or unknown quantities.

## Downstream and legacy paths

Affected outputs: Present quantity/percentage, Unclassified quantity/percentage/membership, daily present quantity, BU present quantity/percentage, and the rendered Present KPI. The overall denominator stays unchanged for the traced normal ingestion cases. A caller supplying pre-normalized raw-Absent helpers also receives Present rather than Absent; that path is explicitly covered.

Confirmed unchanged: regularization counts/rates, absence rates in the normalized fact path, missing-swipe metrics, raw and canonical totals, lineage, request reconstruction, WFH/leave calculations and policy rules. Monthly attendance rates consume separate eligible/evaluable day flags, not the changed composition quantities; both rate numerators/denominators are verified.

The legacy `time_series_analysis.py` snapshot/export calculations remain a separate row-based contract. They do not become the corrected shared quantity path merely because Overview is fixed. Export scope/formula parity, history/split-day storage, pagination and cache/as-of issues remain outside this slice. No claim of new export parity is made.

## Deliberate characterization/version transition

MC14 changes from **KNOWN_DEFECT** to **KNOWN_DEFECT_CORRECTED** in the additive `stage2b1_mc14_decision.json`. Historical Stage 2A/2B.0 documents retain their original results/status. The old characterization node name is retained for inventory continuity; its docstring explicitly declares the v2 correction. The test asserts the recorded legacy expectation, then checks the corrected output from the live engine.

`tests/golden/mc14_correction.json` preserves `mc14-legacy-v1` (0 Present/0 Absent/1 Unclassified) alongside `mc14-v2` (1/0/0) and 15 independent synthetic examples. This is an intentional semantic defect correction. It creates no runtime metric registry, cache-key change, unrelated MC01–MC13 decision or business approval.

## Verification and tests added

Added **26 cases** in `tests/test_mc14_quantity_correction.py`: 15-case classification/conservation matrix; split-day order variants; raw-lineage/fractional rate-fact checks; existing quantity-fallback cases; critical overlap; pre-normalized input; and real snapshot-to-card integration. The two original desired assertions remain unchanged and now pass. Two existing parametrized MC14 characterization cases are intentionally updated; all other Stage 2 tests remain unchanged.

Before the runtime correction, the new matrix plus the two original tests produced **18 failures and10 passes** with no setup/collection errors. Those failures demonstrate the defect across scalar, fractional, split-day, pre-normalized and UI paths. After correction:

| Verification | Collected | Outcomes | Errors |
|---|---:|---|---:|
| targeted | 28 | {'passed': 28} | 0 |
| contracts | 60 | {'passed': 60} | 0 |
| affected | 152 | {'passed': 152} | 0 |
| overview | 76 | {'passed': 75, 'skipped': 1} | 0 |
| full | 564 | {'passed': 561, 'skipped': 3} | 0 |

Final full baseline: **564 collected, 561 passed, 3 skipped, zero failures/errors**. All 538 original node IDs remain; every formerly passing node still passes; both previous failures now pass; the same three external-data/credential skips remain. All 60 existing Stage 2 contract/characterization cases pass. No unexpected regressions remain.

Runs use the unchanged Stage 2A source-copy runner, locked Windows CPython3.14.2 environment, synthetic homes/data, disabled dotenv/network/plugin autoload and Stage 2B.0 test isolation. Commands, hashes and every test phase are in `stage2b1_test_result.json`. No live employee workbook, connector or packaged acceptance is claimed.

## Risks, rollback and remaining gates

The changed semantics affect saved comparisons involving previously unclassified A(R); preserve old output/evidence and identify this build as MC14v2. Restart/recompute when adopting the code so an already running process does not retain an old in-memory bundle. Cache architecture itself is unchanged.

Existing missing-quantity fallback, overlapping-day arbitration and independent canonical/rate/legacy-export meanings remain limitations. Broader regularization aliases or policies are not inferred. Rollback is the reverse of only this slice's patch hunks and matching characterization version, preserving unrelated user changes; it deliberately restores the known defect and must be disclosed as such.

**G01 remains FAIL:** Stage 2B.0 built the unchanged spec successfully but its executable failed at startup with missing `reportlab.graphics.barcode.code128`; that blocker and outstanding manual/clean-machine smoke requirements remain. Packaging was neither changed nor rebuilt in this MC14 slice; the prior packaging evidence is carried forward, not represented as a new build of this code.

**G02 remains BLOCKED overall:** MC14 technical correctness is resolved and implementation/golden evidence passes, but unresolved HR/data/security/technical metric decisions retain their prior status. No other gate is certified.

Recommend the next isolated slice address only the ReportLab packaged-startup gap using the current locked build/spec, a minimal justified collection correction, and fresh executable launch/import smoke. Preserve the MC14 test baseline. **STOP: packaging, history/split-day storage, pagination, export, cache and security remediation have not started.**
