# Stage 2B.0 — Test baseline stabilization and current UI repair

Status: complete within this slice, with G01 **FAIL** and G02 **BLOCKED**. No Stage 2B.1 work began.

## Starting state and preservation

Branch `feature/workforce-intelligence`, commit `fcb0ecc9f80e9eff6fa8a9cdeea5afc90252c3fe`. The starting-state JSON records every existing uncommitted path and source hash. The 41-file Stage 2A archive matched the repository before editing. All 18 original Stage 2A evidence files and all golden JSON files still match their starting checksums. Neither MC14 desired-behavior test changed. The Overview test file has one isolated fixture-data repair in test_bu_table_alignments; every line outside that function remains unchanged. No reset, stash, clean, commit, dependency upgrade or analytical runtime modification occurred.

Starting baseline: **534 collected, 517 passed, 14 failed, 3 skipped, zero errors**. This historical result and its manifest were preserved, not regenerated. Stage 2B.0 ending baseline: **538 collected, 533 passed, 2 failed, 3 skipped, zero errors**. Every previously passing node still passes.

## Disposition of every previous TEST_DEFECT

All 11 are resolved without deleting tests, xfail markers or weaker desired assertions.

| Previous test | Original invariant | Why it was obsolete/state-dependent | Current path/assertion |
|---|---|---|---|
| `test_successful_upload_and_snapshot_activation` | A valid upload activates the snapshot and exposes its available scopes. | Removed ts_bu_combo belongs to the legacy Time Series UI. | Current combo_bu options, active snapshot, row count, enabled load control and upload status. |
| `test_dashboard_metrics_matching_existing_analytical_engine` | Displayed metrics match the active analytical engine; revisiting a ready view does not recalculate. | Old timing/leave labels were replaced by Workforce Overview cards; legacy formula meanings remain separately characterized. | Current attendance, leave/approval, arrival/exit and working-hours cards match compute_workforce_intelligence_bundle; the snapshot service retains exact legacy metric parity; ready Overview does not start another load. |
| `test_breakdowns_matching_existing_analytical_engine` | Reporting hierarchy and selected population agree with analytical calculations. | The live UI uses cascading scopes, not the old hierarchy Treeview. | All four snapshot/export breakdowns still match the legacy engine exactly; each current BU/department/manager/employee callback produces the exact canonical-data workforce bundle. |
| `test_search_filtering_without_recalculation` | Typing a search filters prepared options without recomputation or ingest. | The old employee results Treeview search was superseded by the searchable employee selector. | Name and stable-ID matches, clear-to-all options, unchanged selected scope/bundle, zero bridge recalculation and zero prepare_dataset calls. |
| `test_correct_dataset_replacement` | Replacing data replaces active rows, options and displayed metrics. | Old Treeview and dropdown assertions address removed controls; module sharing also required a hazardous restore. | New snapshot identity, DataFrame identity, dataset ID, employee card and exact new option membership; no old Engineering option. |
| `test_failed_upload_preserving_existing_dataset_and_ui_state` | A failed load preserves the previous dataset, label, visible result/scope and source path. | A module-shared App retained later job/path state from earlier tests. | Fresh App and deterministic initial completion; a failed load restores the original path after selecting corrupt input, preserves snapshot/DataFrame/bundle identity, status and filters, clears loading and re-enables upload; error is reported. |
| `test_older_processing_jobs_not_overwriting_newer_results` | Older successful/error callbacks cannot overwrite the latest result. | Legacy dropdown assertion could not observe the current dashboard; shared state made job IDs order-dependent. | Latest snapshot/DataFrame/bundle remain intact, current Executive option stays present, stale error dialog is not shown. |
| `test_11_to_14_global_filters_and_attendance_view` | Attendance population changes with BU/date/employee filters and resets to full scope. | Standalone Attendance/att_kpi_cards are superseded by Overview and Trends. | Actual current callbacks and completed workers update Overview cards/bundle for full, BU, BU/date and employee scopes, then reset to the original seven employees/eight days. |
| `test_15_dataset_replacement_and_stale_job_safeguard` | An older metric job cannot replace the current rendered headcount. | The att_kpi_cards widget and old headcount key no longer represent the live UI. | Current kpi_1_emp_hc card retains 100 after a stale job attempts to render 42. |
| `test_header_dq_badge_accessible_in_both_sidebar_states` | DQ status and its action remain visible and usable with both sidebar state flags. | The old upload grid-column assertion is obsolete because the control uses pack. | Map the real workforce screen; check visible DQ text, click-to-details dispatch, upload visibility/text/enabled state in both configurations. |
| `test_01_02_sidebar_starts_compact_and_no_fullwidth` | The startup rail stays compact with a visible brand mark. | The text lightning glyph was replaced by an image. | Keep original rail width/hidden expansion checks; verify image presence and actual mapped brand visibility. |

Current-navigation evidence: `App._build_workforce_intelligence_frame` aliases legacy analysis routes to WorkforceDashboardView; `VIEW_KEYS` and actual tab construction expose Overview/Trends; `select_view` rejects unknown keys. Stage 0 audit section 9 records two live tabs. Stage 1 describes preservation of Overview and Trends. Git history includes the explicit Overview isolation (`c42952d`) and Trends implementation (`a7e91fb`), rather than an accidental missing Attendance widget. The existing shell suite also tests the current VIEW_KEYS. The standalone Attendance structure is superseded; attendance composition, daily charts and BU comparison remain on Overview. No replacement tab or compatibility widget was added.

The old searchable hierarchy result grid is no longer a live product workflow. Its search invariant is now tested at the current employee selector. Four-level breakdown arithmetic and reuse remain tested at the still-supported snapshot/export boundary. This is an explicit UI-contract disposition, not a claim that the old result-grid screen still exists or that legacy and workforce formulas became identical.

## Isolation and deterministic completion

`conftest.py` now provides a function-scoped App, fresh temporary home, clear snapshot/bridge caches, bounded event-loop completion (including the 50 ms pending filter debounce), and teardown that waits for actual worker threads. Thread.start is only observed and delegates to the real implementation; analytical calculation and asynchronous scheduling are not replaced. Pending Tcl callbacks are cancelled through Tcl without deleting commands owned by child widgets, then the App is destroyed and globals cleared. Module-specific shared-App fixtures were removed. No production reset hooks were introduced.

`pytest.ini` selects `--capture=sys`. On this Windows/Python/Tk combination, repeated App creation under descriptor capture intermittently produced Tcl script-read failures despite existing files. A private library copy and interpreter-lifetime anchor did not solve them. A 12-case sequential App diagnostic passed with Python-level capture; the final targeted, module, full and shuffled runs below validate the retained configuration. A minimal Tk-only 20-case probe passed under both capture modes, so this report does not claim a universal Tcl or pytest defect or an upstream root-cause proof. Native stderr remains available in the runner's process log. Temporary subprocess/private-library experiments were removed.

## Production change: focus restoration

Only `app.py`, function `App._on_flyout_escape`, changes production behavior. CustomTkinter 5.2.2's CTkButton.focus_set delegates to an optional text label; an image-only parent has no such label, causing AttributeError after the flyout closes. The fix uses the public `tkinter.Misc.focus_set` implementation on the parent widget itself when it exists and is viewable. An unavailable parent falls back to the mapped App; a withdrawn App is left unfocused safely. The handler returns `break`. No private CustomTkinter label/canvas field is used and no broad exception swallowing was added.

Four added regression cases cover image-only/text parents and unmapped/destroyed parents. Escape is dispatched through the actual popup binding and checks closure plus Tk's remembered focus target; Windows foreground activation is not assumed for automated windows. Existing dropdown keyboard Up/Down/Enter/Escape tests remain intact. The original outside-click/Escape test now passes. Sidebar representation, navigation destinations, metrics and all other callbacks remain unchanged.

## Verification

The locked Windows CPython 3.14.2 / pytest 9.1.1 environment was reused. All runs use the existing offline source-copy runner: dotenv, network and third-party plugin autoload disabled; synthetic home and input files; no live employee workbook or connector use. Commands, every node/phase, tested hashes and raw-result checksums are in `stage2b0_test_result.json`.

| Mode | Collected | Outcomes | Setup/teardown errors |
|---|---:|---|---:|
| targeted | 19 | {'passed': 19} | 0 |
| modules | 52 | {'passed': 52} | 0 |
| alignment | 1 | {'passed': 1} | 0 |
| overview | 76 | {'passed': 74, 'skipped': 1, 'failed': 1} | 0 |
| full | 538 | {'passed': 533, 'failed': 2, 'skipped': 3} | 0 |
| shuffle42 | 20 | {'passed': 20} | 0 |
| shuffle1729 | 20 | {'passed': 20} | 0 |

The complete suite ran in one pytest process through the original Stage 2A runner, directly exercising cross-module state. The 20 selected changed/state-sensitive cases (including the additional alignment isolation repair) were also run in seeded shuffled orders (42 and 1729). Source hashes were checked against the worktree. The original 19-case targeted and 52-case module passes preceded the alignment repair; their only source-hash difference is that one test function, independently checked against the preserved starting source. The alignment test, Overview module, final full suite and both shuffled runs use the final source. All 60 Stage 2A tests pass; three original external-data/credential skips remain unchanged. No new unexplained test failures or regressions remain.

The first full attempt found an additional state-dependent test: test_bu_table_alignments expected rows left by the preceding header test. It now builds its own synthetic bundle, verifies all three rows and all 13 left-aligned cells, and passes alone and in subsequent verification. No MC14 assertion changed. The first full attempt (532 passed, 3 failed, 3 skipped) is retained as diagnostic evidence; its roughly 13.5-hour wall-clock span across the overnight session is not treated as a performance measurement. Additional passing tests were corrected where necessary to avoid vacuous old callbacks: repeated four-level selection now verifies actual prepared breakdown reuse; tab switching warms and switches the actual Overview/Trends containers while checking zero rereads and no redundant view loads.

## Packaging smoke

The **unchanged current Transformers.spec built successfully** in a source/assets-only copy with the locked full build environment. EXE size: 237,954,258 bytes; SHA256 `1bb6e457576be08c2e719fb4dc1707e89f311019dfa6941202f5e919e2b63a7c`. Source/spec hashes match the current production files. No old distributed binary was overwritten.

**Launch failed**, exit code 1. The isolated-home hidden launch displayed an unhandled exception before App construction: `ModuleNotFoundError: reportlab.graphics.barcode.code128`, reached through app → id_card_module → generate_id_cards → ReportLab's dynamic barcode imports. Native dialog text was captured after an initial hidden-window readiness check was inconclusive. This is a newly evidenced packaging gap in the unchanged spec, not a focus-fix regression. No packaging redesign or hidden-import change was made. Full interactive acceptance is not claimed. Build/launch evidence is recorded separately in `stage2b0_packaging_result.json`.

## Remaining failures, risk and next slice

The two untouched MC14 assertions remain the sole test failures:

- `tests/test_attendance_regularization_ar.py::test_kpi_engine_ar_with_absent_attendance_type_not_absent`
- `tests/test_workforce_overview_kpis.py::test_attendance_composition_and_absent_kpi_remain_unchanged`

Both require A(R) quantity to contribute to present attendance. Current behavior still omits that quantity while excluding it from absent. The passing MC14 characterization deliberately remains unchanged as well. No business metric decision was approved.

Residual risks: current EXE startup is blocked by packaging; tests do not establish full manual accessibility, live connector behavior, clean-machine distribution or production-workbook acceptance. Python-level capture is a demonstrated local test configuration, not proof for all Python/platform versions. The focus correction is narrow and covered, but Windows foreground-focus policy remains outside these automated tests.

Recommend Stage 2B.1 only for the A(R) present-quantity mapping: trace canonical/raw category handling, make the smallest domain correction, keep both desired assertions, deliberately update the MC14 legacy oracle with a recorded semantic change, and verify attendance composition/quantity conservation plus existing absence, regularization, split-day and full-suite contracts. Address the ReportLab packaging gap in a separately scoped packaging correction. Do not combine export/cache/pagination/policy/history work with MC14. **Stop here; Stage 2B.1 is not started.**
