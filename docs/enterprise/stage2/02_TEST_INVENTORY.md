# Complete test inventory

534 collected cases across 30 files: {'passed': 517, 'failed': 14, 'skipped': 3}. Original suite: 474; added: 60. Every node ID is recorded in `test_inventory.json`. Counts include parametrized instances. No coverage percentage is claimed.

| Test file | Domain/workflow | Type/quality | Result | Known gap |
|---|---|---|---|---|
| `tests/characterization/test_legacy_conflicts.py` | characterization: Known defects and competing semantics | characterization; characterization | {'passed': 14} | Deliberately asserts current defects; desired cases separate |
| `tests/contracts/test_catalogue_integrity.py` | contracts: Metadata/reference integrity | contract metadata; structural | {'passed': 2} | Does not prove runtime semantics |
| `tests/contracts/test_metric_golden.py` | metric contracts: 20-contract underlying golden arithmetic | characterization; characterization | {'passed': 44} | Passing does not confer HR approval |
| `tests/test_absent_ui_integration.py` | attendance: Desktop absence controls | existing regression/integration; partial | {'passed': 7} | No visual/manual acceptance |
| `tests/test_attendance_regularization_ar.py` | attendance: AR reconciliation/normalization | existing regression/integration; partial | {'passed': 5, 'failed': 1} | Known KPI quantity defect |
| `tests/test_connectors.py` | connectors: Slack/Keka adapters and configuration | existing regression/integration; partial | {'passed': 17, 'skipped': 2} | Two live tests skipped; offline invalid-token tests are not live API proof |
| `tests/test_data_foundation.py` | canonical data: Event/request/day objects and lineage | existing regression/integration; strong within fixtures | {'passed': 20} | No source revision/retraction engine |
| `tests/test_desktop_architecture.py` | desktop integration: Shell structural behavior | existing regression/integration; partial | {'passed': 3} | No packaging smoke |
| `tests/test_desktop_integration.py` | desktop integration/exports: Snapshot UI and Excel integration | existing regression/integration; partial | {'failed': 7, 'passed': 3} | Several stale-widget tests fail |
| `tests/test_duplicate_governance.py` | DQ/request reconstruction: Duplicate flags, raw vs analytical quantity | existing regression/integration; strong within fixtures | {'passed': 11} | No universal cross-file business identity |
| `tests/test_historical_sync.py` | historical sync: Monthly archive/reload | existing regression/integration; partial | {'passed': 10} | Split-day loss and atomicity gap remain |
| `tests/test_id_generator_methods.py` | ID cards: Local image/PDF/address helpers | existing regression/integration; partial | {'passed': 5} | Some tests exercise mocks/file IO rather than production methods; no full card visual proof |
| `tests/test_keka_data_fetcher.py` | connectors/attendance: Mocked API/normalization | existing regression/integration; partial | {'passed': 11} | Real completeness and provider behavior unverified |
| `tests/test_okr_upload.py` | KRA/OKR: Upload workbook transformation | existing regression/integration; partial | {'passed': 30} | App KRA transform UI lacks complete end-to-end fixture |
| `tests/test_snapshot_engine.py` | snapshot/cache: Preparation, replacement, cache | existing regression/integration; strong within fixtures | {'passed': 14} | Cross-thread deep mutation/version races not fully proven |
| `tests/test_time_leave_master.py` | attendance/leave: Workbook reconciliation | existing regression/integration; strong within fixtures | {'passed': 13} | Large/unusual source layouts unproven |
| `tests/test_time_series_analysis.py` | legacy analytics/exports: Legacy formulas and workbook output | existing regression/integration; partial | {'passed': 6} | Scope and governed formula parity differ |
| `tests/test_unified_time_leave.py` | attendance/leave: Integrated reconciliation | existing regression/integration; partial | {'passed': 14} | No real provider input used |
| `tests/test_workforce_attendance_intelligence.py` | attendance/desktop: Attendance analytical scope and old tab | existing regression/integration; partial | {'passed': 14, 'failed': 2} | Old tab assertions fail |
| `tests/test_workforce_dashboard_shell.py` | desktop integration: Navigation/overview shell | existing regression/integration; partial | {'passed': 10} | No manual accessibility review |
| `tests/test_workforce_filters.py` | scope/cache: BU/manager/employee/date selection | existing regression/integration; partial | {'passed': 28} | No authorization; cross-suite global state required isolation |
| `tests/test_workforce_ingestion.py` | ingestion/DQ: File schema/type validation | existing regression/integration; strong within fixtures | {'passed': 21} | Incomplete source and input resource caps not implemented |
| `tests/test_workforce_kpi_engine.py` | KPI/WFH: Quantities, monthly allowance, punch deviation | existing regression/integration; strong within fixtures | {'passed': 29} | Business decisions still open |
| `tests/test_workforce_overview_kpis.py` | KPI: Overview composition and preserved metrics | existing regression/integration; partial | {'passed': 74, 'failed': 1, 'skipped': 1} | AR defect; production-workbook test intentionally skipped |
| `tests/test_workforce_patterns.py` | patterns: Deterministic rule detectors | existing regression/integration; strong within fixtures | {'passed': 21} | No predictive validity or causality claim |
| `tests/test_workforce_policy.py` | policy/leave/WFH: Notice, effective date, DQ | existing regression/integration; strong within fixtures | {'passed': 29} | Alias decision MC12 remains |
| `tests/test_workforce_step29a_responsive.py` | desktop integration: Responsive control placement | existing regression/integration; partial | {'passed': 4, 'failed': 1} | Stale grid-layout assertion |
| `tests/test_workforce_step29b_sidebar_filters.py` | desktop integration: Sidebar/keyboard/filter UX | existing regression/integration; partial | {'failed': 2, 'passed': 15} | Focus crash and obsolete logo assertion |
| `tests/test_workforce_trends.py` | trends: Monthly statistics and comparisons | existing regression/integration; strong within fixtures | {'passed': 27} | Runtime component fields differ from future semantic contract |
| `tests/test_workforce_trends_tab.py` | trends/desktop: Trend UI bundles/filter/benchmark | existing regression/integration; partial | {'passed': 16} | Performance/race coverage not comprehensive |

## Coverage interpretation
Strong means detailed deterministic cases in the existing domain, not complete enterprise coverage. No meaningful coverage exists for a new authorization service, transactional history/retractions or packaged current executable. KRA upload, attendance, ID-card helpers and desktop routes have partial smoke records; connector live credentials and production workbook validation are intentionally absent. Tests that only assert a mock or locally repeat logic are identified as partial, never counted as full workflow proof.
