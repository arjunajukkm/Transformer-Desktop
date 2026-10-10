# Enterprise Architecture Audit — Stage 0

**Application:** KRA Transformer / Transformers desktop application  
**Date:** 4 October 2026  
**Repository:** `C:\Users\ArjunS\OneDrive - Moshpit Technologies Pvt. Ltd\Desktop\Arjun\Projects\Dashboard\Arjun\KRA Transformer`  
**Reference commit:** `fcb0ecc9f80e9eff6fa8a9cdeea5afc90252c3fe`  
**Version assessed:** current working tree, including pre-existing uncommitted changes.

## 1. Executive Summary

This is a capable, specialized **single-user Windows desktop application**, with meaningful workforce analytics and emerging internal service boundaries. It is not currently a browser application, independently deployed backend, database-backed platform, or multi-user service. The domain rules, data-quality governance, snapshot lifecycle, historical workflows and analytical tests are valuable modernization assets. Preserve these before considering a UI or framework rewrite.

The first blockers are **correctness and protection of sensitive HR data**, followed by cold computation and memory growth. Historical loading can discard legitimate split-day records. Workforce exports use a different analytical path from the dashboard and omit part of its filter scope. API pagination can silently stop early. These issues can produce misleading results even with small datasets.

Synthetic measurements demonstrate effective caching but slow cold paths: at 100,000 rows, snapshot preparation took **36.23 seconds**, first overview computation **5.47 seconds**, and first trend computation **43.65 seconds**. Sampled Python process memory reached **906 MiB**, excluding desktop rendering and workbook parsing. One million rows were not tested; readiness for that workload is not demonstrated.

Scores assess readiness for the requested enterprise target, not the utility of the current desktop tool. Scale: 1 = absent/unsafe for target; 5 = useful but materially incomplete; 10 = demonstrated production maturity. Scores are architectural judgments, not certification.

| Dimension | /10 | Rationale |
|---|---:|---|
| Architecture | 5 | Reusable service/engine modules; global state and overlapping models |
| Frontend architecture | 5 | Shared components; two UI modules exceed 5,700 lines each |
| Backend architecture | 4 | In-process services; no independent server/API/worker boundary |
| Data scalability | 3 | Monthly persistence, but full materialization and per-row objects |
| Performance | 5 | Excellent warm cache; expensive cold paths and synchronous UI work |
| Analytics capability | 7 | Policies, governed rates, trends, benchmarks, patterns, drilldowns |
| Security | 3 | Plaintext credentials, ungoverned exports, disabled browser sandbox |
| Testing | 6 | 27 test files; 106 core tests passed; full baseline unresolved |
| Observability | 3 | Logs/progress/benchmarks; no unified operational telemetry |
| UI consistency | 7 | Shared tokens, controls, cards, loading widgets and chart theme |
| UX maturity | 6 | Cascading filters and states; export parity/accessibility gaps |
| Maintainability | 4 | Large functions, duplicate models and unpinned dependencies |
| Production readiness | 4 | Packaging exists; clean install, recovery and scale unproven |

**Method and limits.** Enumerated and AST-parsed all 67 first-party Python source/test/script files (55,394 lines), excluding generated builds, caches, runtime data and scratch experiments. Reviewed entry points, module inventories, important function bodies, call paths, configuration, dependency and build files. This is not a claim that every statement was executed or formally verified. Inspected artifact metadata rather than reverse-engineering binaries. Did not ingest real employee workbooks, use live connectors, scan every historical Git blob, or perform manual visual/accessibility acceptance testing. No application behavior, credentials, dependencies or UI was changed.

Evidence locators are repository-relative `file:line` references from this working tree. “Confirmed” refers to code evidence and, where stated, synthetic reproduction. “Likely” indicates inference. Potential exposure is distinguished from demonstrated exploitation.

## 2. Current Technology Stack

| Layer | Actual implementation |
|---|---|
| Runtime | Python; audit interpreter 3.14.2, 64-bit Windows |
| Desktop | CustomTkinter 5.2.2, Tkinter/ttk, tkcalendar, native dialogs and Canvas |
| Analytics | pandas 2.3.3, NumPy 2.3.5; dataclasses, dictionaries/lists, Python loops |
| Charts | Matplotlib 3.11.2 / FigureCanvasTkAgg and bespoke Tk Canvas charts |
| State/concurrency | Tk variables, App/view attributes, global snapshot/bridge; threads, queues, RLocks and bounded connector thread pools |
| Persistence | Excel/CSV, monthly Parquet/Excel archives, JSON registry/config; no SQL database or ORM found |
| Excel | openpyxl 3.1.5, pandas Excel I/O |
| Services | Keka REST/identity API and portal, Slack profile APIs |
| Networking/secrets | requests 2.32.5 with Session, slack-sdk, python-dotenv 1.0.0, local `.env` |
| Browser | Selenium, webdriver-manager, Chrome, ddddocr CAPTCHA handling |
| Images/PDF | Pillow, reportlab, rembg, onnxruntime, opencv-python-headless, pypdf, pypdfium2 |
| Tests | pytest 9.1.1, unittest.mock, pandas assertions, hidden Tk windows |
| Build/dev | PyInstaller spec (installed 6.19.0), Git, `dev.py` watchdog-if-present/polling restart |

Installed versions describe this environment, **not deployment pins**. `requirements.txt` has 18 unversioned entries. NumPy is directly imported but supplied transitively. pytest/PyInstaller lack a declared development/build set. Parquet is used without a declared engine; pyarrow 22.0.0 happens to be installed. `.xls` support is advertised but xlrd is neither declared nor installed. Optional watchdog is undeclared. Local success does not establish clean-install reproducibility.

No browser SPA, HTTP application server, gateway, SQL migrations, broker, distributed cache or hosted analytics service was found. Browser bundle splitting/memory, CORS and SQL plans are not current-runtime concerns.

## 3. Current Architecture

```text
User / Windows desktop
        |
        v
app.py: App, Tk state, navigation, dialogs, orchestration
        |                            |
        v                            v
WorkforceDashboardView          KRA/OKR/attendance/ID-card workflows
(shared UI + Canvas/Matplotlib)  (pandas, Excel, image/PDF processors)
        |                            +--> local reports/photos/PDFs
        v
TimeSeriesSnapshotService <--- uploaded file / Time & Leave workbook
        ^                     / unified monthly archive DataFrame
        |
create_snapshot --> normalized pandas fact_df
                --> legacy metrics / hierarchy breakdowns
                --> CanonicalWorkforceData objects and indexes
        |
        v
WorkforceIntelligenceBridge
  + KPI engine
  + normalization -> policy -> employee-day facts
  + trends / benchmarks / pattern detection
  + in-process caches -> Python dictionaries -> desktop widgets

Keka REST/OAuth -- requests --> KekaDataFetcher
Keka portal ---- Selenium --> downloaded workbook
Slack ---------- SDK -------> profile photos
                              |
                              v
                    monthly Parquet + XLSX
                    JSON registry / .env / browser profile
```

Business/data processing runs inside the desktop Python process, including worker threads. “Backend” means local modules, not an independently authenticated service. External APIs provide records; they do not calculate this application's dashboard aggregates.

Snapshot preparation builds in isolation and promotes under a completion fence (`storage/snapshot_service.py:292`). The active cache keeps one snapshot (`storage/cache_manager.py:239`). This is a sound reusable boundary, but old references/in-flight workers can retain old data. Pointer replacement does not bound peak memory or enforce DataFrame immutability.

## 4. Repository Structure

| Location | Responsibility |
|---|---|
| `app.py` | 5,787 lines: shell, navigation, settings, orchestration, KRA transform |
| `ui_components.py` | 1,559 lines: tokens, icons, cards, controls, searchable dropdown, loaders |
| `workforce_intelligence/dashboard_shell.py` | 5,836 lines: overview/trends, tables/charts, filters, jobs, exports |
| `storage/` | Snapshot construction/lifecycle, caches and report service |
| `workforce_intelligence/data_foundation.py` | Employee, AttendanceRecord, WorkforceRequest, EmployeeDayFact; reconstruction/indexes |
| `schema.py`, `normalization.py`, `validation.py`, `ingestion.py`, `quality.py` | Aliases, parsing, duplicate governance, provenance, quality reports |
| `requests.py`, `policy.py`, `policy_config.py`, `metrics.py` | Request reconstruction, effective-date rules, facts and metric contracts |
| `kpi_engine.py`, `trends.py`, `patterns.py` | Overview/exception metrics, monthly analysis, deterministic patterns |
| `snapshot_bridge.py`, `charts.py` | View-facing bundles, caches/benchmarks; Matplotlib rendering |
| `historical_sync.py` | Month storage, registry, API/import orchestration, unified history |
| `time_series_analysis.py` | Older normalized schema/metrics, still used for snapshot defaults and exports |
| `time_leave_master.py` | Reconciliation; Daily Performance/Absent Mailer outputs |
| `absent_management.py`, `attendance_summary.py` | Attendance expansion/reconciliation and employee pivot reports |
| `generate_upload.py` | KRA/OKR parsing and employee-mapped upload generation |
| `keka_data_fetcher.py` | 3,358 lines: authentication, pagination, REST/browser ingestion, exports |
| `generate_id_cards.py`, `id_card_module.py` | 4,194-line image/PDF engine; adapter and credential/photo utilities |
| `config/`, root `ingestion/` | Configuration and legacy workflow facade |
| `tests/` | 27 modules: transformations, connectors, engines and desktop integration |
| `scripts/` | Three benchmarks and metric-workbook builder; some reflect older UI |
| `assets/`, root images | UI/card resources |
| `local_data/`, `output/`, `.cache/` | Runtime data/config/caches; local_data/output Git-ignored |
| `build/`, `dist/` | Existing PyInstaller output; executable about 76.4 MB, dated April 2026 |
| `scratch/`, cache directories | Experiments/generated state, not assumed production code |

The existing executable predates current October edits; it cannot establish current packaging correctness. No tracked CI workflow, lockfile or deployment runbook was found.

## 5. Runtime Data Flow

### Upload and dashboard

`App.start_ts_analysis` (`app.py:3623`) -> file path/Tk state -> worker -> `prepare_dataset` -> `create_snapshot` (`storage/snapshot_service.py:166`) -> complete-file read/normalization -> standard metrics and BU/department/manager breakdowns -> canonical objects -> atomic activation -> `_ts_load_success` -> `WorkforceDashboardView` -> `WorkforceIntelligenceBridge.get_workforce_metrics` (`snapshot_bridge.py:567`) -> `compute_workforce_intelligence_bundle` (`kpi_engine.py:729`) -> Python bundle -> cards/composition/daily charts/BU table.

Exception to asynchronous behavior: dataset refresh synchronously requests the full DQ/overview bundle (`dashboard_shell.py:5799`) before launching the overview worker. That cold calculation can block the UI.

### Filters, trends and drilldown

Tk controls -> `_filter_state`/cascading options -> worker -> normalized scope/cache lookup -> policy-evaluated frame and employee-day facts -> monthly series, organization/BU benchmarks and patterns -> queue -> `after()` polling -> rendering (`dashboard_shell.py:5449`). BU heatmap/ranking click updates the BU filter (`:5441`); employee/manager filters support contextual comparison.

Trend completion starts another daemon thread to prewarm every metric (`:5555`). Old jobs are generally ignored by ID but not cancelled. The synchronous cache probe uses `TREND_INTEL_V2` (`snapshot_bridge.py:527`) while computation caches `TREND_INTEL_V5` (`:765`). A probe after successful computation confirmed a miss; the worker's actual lookup can still hit.

### Keka and history

Sync/month selection -> KekaDataFetcher -> OAuth/direct bearer -> paginated REST with retry/limited source concurrency -> attendance/leave/WFH normalization; portal download is fallback -> monthly Parquet/Excel and JSON registry. `load_unified_history` reads all selected months, concatenates, then deduplicates on employee/date (`historical_sync.py:462`). `app.py:3381` calls this before starting the snapshot worker, allowing archive I/O to block its caller/UI thread.

### Time & Leave, absence and summaries

File pickers -> worker -> full file reads -> aliases/date parsing -> request expansion -> employee/date maps -> row reconciliation -> styled Excel. `time_leave_master.py:906` uses dictionaries, not SQL N+1 queries. The older absence workflow repeatedly filters the request frame per employee/date (`absent_management.py:155`). Attendance summary creates processed rows plus an employee pivot (`attendance_summary.py:92`). Time & Leave output feeds the analytics snapshot.

### KRA/OKR and ID cards

KRA transform reads every sheet, extracts/normalizes KRA/KPI/weights, retains transformed sheets, writes/styles Excel (`app.py:5422`, `:5509`). Upload generation interprets sheets and replicates output for employee mappings (`generate_upload.py:7`, `:323`). ID cards validate employees -> local/Keka/Slack photos -> four-worker prefetch -> image processing -> PDFs and reports (`generate_id_cards.py:1150`, `:3333`). These ancillary workflows are not analytical query engines.

### Exports

Live workforce export (`dashboard_shell.py:3849`) passes **BU, department and date-preset text only**. It omits manager, employee and actual date interval, then invokes the older `time_series_analysis.export_time_series_report`, recalculating all hierarchy levels. Preset labels need not match the `_month_clean` filter. A successful export can represent a broader/different population or be empty. This is a confirmed contract mismatch.

## 6. Performance Audit

CRITICAL scale findings indicate risk for the requested workload, not constant failure today.

| ID | Severity | Evidence/function | Reason and impact |
|---|---|---|---|
| P01 | CRITICAL at 1M+ | `data_foundation.py:419`, `from_dataframe` | Full row dictionaries, record/fact/request objects, provenance and indexes; large transient/retained allocations |
| P02 | HIGH | `historical_sync.py:474`; `app.py:3381` | Month frames coexist with concatenation; reads before worker |
| P03 | HIGH | `snapshot_service.py:240`; `time_series_analysis.py:588` | Eager hierarchy breakdowns run complete metrics per group; employee export adds high-cardinality work |
| P04 | HIGH | `snapshot_bridge.py:434`; `kpi_engine.py:748` | Additional normalized/evaluated frames, BU partitions, copies/string scans |
| P05 | HIGH | `dashboard_shell.py:5799` | Cold DQ/overview on UI path; measured engine cost 5.47 s at 100K |
| P06 | HIGH | `dashboard_shell.py:5512`, `:5573` | Threads/prewarm per interaction; no bounded CPU queue/cancellation/single-flight |
| P07 | MEDIUM | `snapshot_bridge.py:527`, `:765` | Cache probe key mismatch defeats synchronous fast path |
| P08 | HIGH | `snapshot_bridge.py:411`, `:1691` | Pattern scopes lack eviction; main cache is count-, not byte-bounded |
| P09 | HIGH | `time_series_analysis.py:647`, `:679`; `historical_sync.py:267` | All-level export recomputation/cell styling and dual-format archive I/O |
| P10 | HIGH, legacy absence | `absent_management.py:155` | Per-row request filtering, potentially O(attendance × requests) |
| P11 | MEDIUM | `dashboard_shell.py:1797`, `:2414`, `:3449` | Widget-per-row/cell tables/heatmaps; no viewport virtualization |
| P12 | MEDIUM | `patterns.py:2222`; `trends.py:666` | Multiple per-employee detectors and repeated month slices |
| P13 | MEDIUM | `keka_data_fetcher.py:314` | JSON pages accumulate in memory; throttling/retries, no streaming sink |
| P14 | LOW–MEDIUM | `generate_id_cards.py:1150`, `:3333` | Per-employee fetch/image/PDF costs and batch photo retention |

Legacy Treeview search (`app.py:3849`) rebuilds matching rows after 100 ms debounce. Current time-series routes alias the workforce view (`app.py:3481`); this old table is not the main live dashboard and should not be optimized before confirming reachability.

**Benchmark method:** one fresh process per scale, repository seeded generator, 20 days, 500/5,000 employees, five BUs, five departments, nine managers. Sequence: snapshot; overview cold/warm; Engineering BU cold/warm; default trend cold/warm. No real HR data, network, UI, workbook parsing/export or all-metric prewarm. RSS is sampled working set, not peak. The 10K run overlapped some test execution. These are single diagnostic samples, not p95 SLAs.

| Measure | 10K rows | 100K rows |
|---|---:|---:|
| Snapshot preparation | 3.959 s | 36.229 s |
| Cold overview | 0.462 s | 5.468 s |
| Warm overview | 0.499 ms | 6.044 ms |
| Cold BU overview | 0.152 s | 1.374 s |
| Warm BU overview | 0.169 ms | 1.295 ms |
| Cold default trend | 4.678 s | 43.651 s |
| Warm default trend | 0.087 ms | 0.117 ms |
| Input frame deep size | 7.891 MiB | 79.069 MiB |
| Snapshot frame deep size | 16.953 MiB | 169.891 MiB |
| RSS before snapshot | 167.94 MiB | 226.02 MiB |
| RSS after snapshot | 220.63 MiB | 572.36 MiB |
| RSS after final trend | 230.53 MiB | 906.22 MiB |

Warm dictionary retrieval is not end-to-end UI latency. Deep DataFrame size is not total process memory. Benchmark comments such as “0.0ms” and hard-coded historical summaries are not current measurements.

## 7. Million-Row Scalability Assessment

Records mean source attendance events, not employees. Split days, expansion, months, text width, duplicates and entity cardinality materially affect cost.

| Rows | Expected behavior |
|---|---|
| 10K | Engine demonstrated viable; preparation/first trend seconds, warm cache fast. Workbook/UI costs unmeasured. |
| 100K | Demonstrated tens-of-seconds cold paths and ~906 MiB sampled process memory. Batch-oriented usability, not immediate cold interaction. |
| 1M | Not run. Same-shape snapshot frame alone projects to ~1.66 GiB; coexisting objects/evaluated frames/caches make several GiB plausible. Simple linear timing illustration: ~6 minutes preparation/~7 minutes first trend; not a capacity promise. |
| 10M | Not run. Same-shape snapshot frame alone projects to ~16.6 GiB, before other representations. Ordinary desktop RAM/responsiveness likely inadequate. |

**First likely breaking point:** correctness may fail first through API truncation/history deduplication. Responsiveness already suffers near 100K through archive I/O, synchronous DQ and cold construction. The primary million-row resource bottleneck is full-data materialization plus Python object expansion, before chart point count. No exact out-of-memory threshold is asserted.

Charts mostly display aggregate days/months/BUs, not raw millions of points. More RAM does not fix redundant computation, scope-cache growth or inaccurate exports. Raw XLSX workflows also encounter sheet size limits; summary exports instead grow with entity count. Establish separate raw-data and summary-export acceptance limits.

## 8. Database and Data-Layer Assessment

There is no application database: SQL indexes, query plans, SQL N+1 and isolation levels are not applicable. Relevant equivalents:

- **Schemas:** canonical aliases/dataclasses coexist with older underscore pandas fields. Workforce ingestion validates required fields and provenance, but snapshot/legacy/history routes do not apply identical contracts.
- **Indexes:** employee/day/organization dictionaries (`data_foundation.py:315`) and reconciliation maps (`time_leave_master.py:906`) help selected lookups. Most scope filters still scan/copy frames and normalize strings.
- **Aggregation:** pandas masks/groupby/pivots and Python loops. Initial BU partitioning scans per BU (`snapshot_bridge.py:459`). Monthly Parquet reads have no column/predicate pushdown and selected months are fully combined; no incremental aggregation strategy was found.
- **Pagination:** Keka defaults to 100 pages ×200; callers also use 20/30/50 pages. Exhausting max_pages returns success (`keka_data_fetcher.py:413`). These are per-call ceilings, not a universal capacity. Local results/options are not served through a paged contract.
- **Search/sort:** local strings, pandas masks, request date sorting and Python result sorting; no query/search index.
- **Persistence:** direct file/JSON overwrite, no transaction across registry/data, lock, atomic publish/checksum/recovery protocol. Write failures can be swallowed (`historical_sync.py:266`); multiple instances/OneDrive sync can race.
- **History correctness:** employee/date `keep='last'` drops distinct events (`:510`). Mock loader reproduction: two 0.5 rows became one 0.5 row. Failed month reads are silently skipped, so requested and loaded scopes can differ.
- **Caches:** each snapshot filter cache has 128 entries; bridge bundles default to 512. Organizational/BU frames remain retained; pattern scopes are unbounded. Shared DataFrames rely on convention, not enforced immutability.
- **Concurrency:** snapshot promotion is locked, but bridge invalidation and out-of-lock calculation/insertion lack a full version fence. Stale-worker contamination is a risk requiring race tests, not a reproduced race. `_defensive_copy_dict` only shallow-copies dicts nested inside lists (`cache_manager.py:42`).

## 9. Frontend Architecture Assessment

CustomTkinter shell, collapsible sidebar and Transform/Analyse/Settings groups route through retained frames (`app.py:846`), not URLs. Workforce has **two live tabs**, Overview and Trends (`dashboard_shell.py:85`), despite comments referring to six.

State spans App variables, view `_filter_state`, bundles, queues, job IDs and singleton services. Retained frames speed navigation but also retain data references. There is no explicit unified state contract. Shared UI colors/fonts/cards/controls and loaders form a real design-system foundation.

Grid weights, scroll frames and resize callbacks support adaptation; the minimum window is 1024×700. Responsive tests exist, but manual DPI/localization/small-screen checks were not performed. Custom CTk tables/heatmaps create widgets per cell; Canvas and Matplotlib charts aggregate data but rebuild work can grow with BUs/months. No generalized virtualized/paged detail table was found.

Explicit loading/empty/error states (`dashboard_shell.py:5263`), active scope/reset, cascading filters, BU click drilldown, expanded daily charts and DQ details are strengths. Sidebar flyouts (`app.py:728`) and dropdowns (`ui_components.py:1106`) include keyboard handling. Keyboard/screen-reader equivalents for custom chart hover/click and color indicators are unverified, not universally absent.

Bundle size means executable/import cost here. The ~76.4 MB April binary is stale; ML/image/browser dependencies broaden packaging. Current startup latency/clean-machine packaging were not measured. These observations alone do not justify replacing the desktop framework.

## 10. Analytics Assessment

A **partial semantic layer exists**: frozen policy configuration, structured rate contracts, trend definitions, canonical facts and provenance. It is distributed across multiple engines rather than used consistently by every screen/export.

| Capability | Formula/grain and limitations |
|---|---|
| Overview | Headcount; quantity-weighted present/on-duty/leave/WFH/holiday/week-off/exception composition (`kpi_engine.py:867` onward) |
| Attendance rates | Exception flags / evaluable eligible employee-days ×100; DQ exclusions explicit (`trends.py:652`, `metrics.py:331`) |
| Policy | Compliant/evaluable requests; DQ-uncertain excluded. Effective 2026-10-01; PL notice 2/15/30 days by quantity; non-PL/WFH post-event allowance 3 days (`policy_config.py:15`) |
| WFH allowance | Employee-month quantity/allowance/excess with partial-month flags (`kpi_engine.py:127`). Legacy export counts rows per employee across selected scope against 3 (`time_series_analysis.py:401`). |
| Application timing | Advance/same-day/late; current catalogue “compliance/timing” labels return days. Legacy leave lead-time = mean(event date − application date), positive means advance. Keep units/sign explicit. |
| Approvals | Mean/median turnaround, pending count/age on requests/months. Cache keys omit `analysis_as_of_date` (`snapshot_bridge.py:764`, `:860`), risking stale age across date changes. |
| Working time | Mean/median effective hours, entry/exit times; older helpers coexist. Overnight/break/eligibility contracts need alignment. |
| Trends | 15 actual catalogue metrics; MoM, direction, streaks, regression/observations and volume flags. Prewarm docstring says 18 but code iterates actual catalogue. |
| Benchmarks | Organization, historical baseline, peer BU and contextual employee/manager comparisons; not external industry benchmarks |
| Patterns | Deterministic recurrence, weekday/calendar/sequence, application/approval timing, concentration/month-boundary rules (`patterns.py:2222`); descriptive evidence, not proven causation/prediction |
| History/drilldown | Monthly files, historical attributes, BU/department/manager/employee filters. Archive dedup and modal hierarchy inference can compromise historical interpretation. |

Legacy exports use source-row “day” counts and earlier WFH/approval definitions; newer engines use quantities, requests, eligible days and DQ exclusions. Reconcile grain, eligibility, units, period attribution, unknown values and policy versions before consolidating code. Averages/medians cannot all be recombined from monthly averages. Partial latest months, inferred request clustering, organizational moves and pending-state history need explicit semantics.

Pattern exceptions become empty results (`snapshot_bridge.py:1653`), allowing calculation failure to appear as no detected patterns. This should be a degraded/error state, not a confident analytical conclusion.

## 11. Security Assessment

No live credential validation, penetration test or package-CVE scan was performed. No confirmed production secret in tracked source was found. Local `.env` contains populated Slack/Keka credential fields; it is ignored/untracked and the available Git path history returned no entries. This does not prove secrets were never shared. Production validity and OneDrive sharing/backup access were not verified. Values are intentionally excluded.

| Severity | Finding/evidence | Consequence and direction |
|---|---|---|
| HIGH | Plaintext credential storage (`app.py:4103`, `id_card_module.py:75`), populated local `.env` | File readers may obtain credentials; project may be synced. Prefer OS-protected storage, verify access/distribution; rotate if actual exposure is established. UI masking is not encryption. |
| HIGH for shared deployment | No app identity, role/row authorization or export authorization (`app.py:33`, `dashboard_shell.py:3849`) | Anyone with app/files/connector credentials can use their HR scope. Decide trusted-endpoint model; filters are not security controls. |
| HIGH | Export scope mismatch (`dashboard_shell.py:3871`) | Manager/employee-filtered screen may export broader HR data; confidentiality and correctness risk |
| HIGH | Chrome `--no-sandbox`, persistent/remembered sessions (`keka_data_fetcher.py:216`, `:2492`, `:1372`) | Weaker browser isolation; profile access and session retention become trust boundaries |
| MEDIUM | Spreadsheet formula interpretation (`time_series_analysis.py:682` and other writers) | Synthetic `=1+1` through pandas/openpyxl became a formula cell. This proves interpretation, not code execution/exfiltration. Write untrusted text as text using a tested policy. |
| MEDIUM | Unpinned packages/runtime driver acquisition (`requirements.txt`, `keka_data_fetcher.py:237`) | Drift/provenance risk; declare locked runtime/build inputs and verify supply chain. No specific CVE alleged. |
| MEDIUM | No consistent input byte/row/decompression/image bounds (`ingestion.py:25`, file/image readers) | Malformed/large inputs can exhaust CPU/RAM. Schema checks do not bound resources. |
| MEDIUM | Local HR exports/photos/archive without app encryption, retention or tamper-evident audit | Data persists broadly. Endpoint ACL/disk encryption were not assessed; no app encryption does not mean no OS protection. |
| MEDIUM | Downloads/input-basename output (`app.py:5453`) | Same-name output may be overwritten; input already in Downloads can be replaced. Path construction confirmed, no destructive reproduction. |
| LOW / hardening | Registry filenames joined without containment checks (`historical_sync.py:482`); shell Explorer call (`dashboard_shell.py:3901`) | Local tampering/path-handling risk; no remote exploit demonstrated. Validate containment/use argument-based calls. |

OAuth/direct bearer, HTTPS/timeouts, retries and some credential-field masking exist. No `verify=False` TLS bypass or application SQL interpreter was found in reviewed runtime paths. There is no inbound HTTP server; missing CORS/CSRF headers are not current vulnerabilities. Errors/logs include paths, employee identifiers and portal URLs without centralized redaction. Source provenance and registry provide partial auditability, but not durable who-exported-what/when records.

## 12. Testing Assessment

**Existing coverage:** 27 modules cover KRA/OKR generation, attendance/Time & Leave reconciliation, AR/duplicates, mocked connectors, snapshot/cache lifecycle, canonical data, policy/trends/patterns/KPIs, filters and desktop responsive behavior. Preserve this investment.

**Executed checks:**

1. AST parsing succeeded for all 67 first-party Python source/test/script files.
2. Full pytest attempt in a source/assets copy, excluding `.env`/employee data and blocking socket connections. It emitted failure/error indicators, then session cleanup failed with `PermissionError [WinError 5]` on the audit temporary directory. No normal summary was produced. **The full suite is unresolved, not passed.** The preceding indicators cannot all be attributed to one cause from that output. Third-party plugin autoload also emitted a Python 3.14/Pydantic compatibility warning.
3. Focused rerun with plugin autoload and dotenv loading disabled: `python -m pytest -q -p no:cacheprovider tests/test_workforce_trends.py tests/test_workforce_policy.py tests/test_workforce_patterns.py tests/test_workforce_kpi_engine.py --tb=short`. **106 passed in 6.48 seconds.** These suites avoid desktop fixtures/pytest directory factories; this result applies only to them.
4. Synthetic 10K/100K engine benchmarks in §6; no 1M/10M or production load test.
5. Controlled probes confirmed capped pagination returning `error=None`, split-day archive loss, V2/V5 cache lookup miss and spreadsheet formula interpretation. No external calls or application changes.

No application tests were added/committed. Needed coverage: screen/export scope and formula parity; split-day archive roundtrip; source caps/partial response counts; archive failures/recovery; concurrent snapshot/bridge generations; as-of cache invalidation; nested cached-result mutation; input/formula limits; packaged Windows startup. Establish a reproducible full-suite baseline and triage failures before relying on release readiness. Existing tiny benchmark fixtures do not prove enterprise capacity. Coverage percentage was not measured.

## 13. Observability Assessment

Module loggers, console/status callbacks, progress indicators, snapshot metadata, cache statistics, generation reports and sync registry are present. Benchmarks use perf_counter, tracemalloc or Windows working-set measurements. These are useful development tools.

No unified structured logging setup in the main desktop runtime, rotating diagnostic pipeline, error-monitoring integration or operational dashboard was found. Distributed tracing is not a present distributed-system requirement, since there is no distributed application yet. `console=False` packaging (`Transformers.spec:32`) makes console-only failures hard to retrieve. Broad catches can hide history/prewarm/pattern/write failures behind defaults. UI “no patterns”, “DQ: Clean” or a subset of months is not proof of a complete successful computation.

Recommended diagnostic fields: dataset version, source fingerprint, requested/loaded months, job ID, scope, row counts, duration, peak memory, cache result and sanitized error code. Start locally if appropriate; remote telemetry infrastructure is not prerequisite. Preserve source lineage without copying HR rows/passwords/tokens into diagnostics.

## 14. Technical Debt Register

| ID | Area | Problem | Severity | Evidence | Impact | Recommended direction |
|---|---|---|---|---|---|---|
| TD01 | History | Employee/date dedup loses events | HIGH | `historical_sync.py:510`; 2→1 probe | Wrong quantities/metrics | Event identity and explicit idempotent merge |
| TD02 | Export | Missing scope, older metrics | HIGH | `dashboard_shell.py:3871`; `time_series_analysis.py:647` | Wrong/broader population | Shared typed scope/metric contract |
| TD03 | Ingestion | Silent pagination ceiling | HIGH | `keka_data_fetcher.py:413`; probe | Incomplete data looks successful | Completeness/count reconciliation |
| TD04 | Resources | Full row/object graph | CRITICAL at scale | `data_foundation.py:419` | RAM/CPU expansion | Compact facts/bounded execution prototypes |
| TD05 | UI jobs | Archive/DQ before worker | HIGH | `app.py:3381`; `dashboard_shell.py:5799` | Frozen interaction | Bounded job orchestration |
| TD06 | Cache | V2 lookup/V5 write | MEDIUM | `snapshot_bridge.py:527`, `:765` | Missed synchronous path | Shared key builder and parity test |
| TD07 | Cache | Missing as-of/version-fenced insert | HIGH | `snapshot_bridge.py:764`, `:860`, `:1923` | Stale aging/data risk | Include time/version; race tests |
| TD08 | Cache | Pattern scopes unbounded | HIGH | `snapshot_bridge.py:411`, `:1691` | RAM growth | Byte/lifetime budgets and telemetry |
| TD09 | Semantics | Row/request/day models compete | HIGH | `time_series_analysis.py:401`; `kpi_engine.py:127`; `metrics.py:331` | Metric drift | Versioned catalogue/golden datasets |
| TD10 | Secrets | Plaintext persistence | HIGH | `id_card_module.py:75` | File-access exposure | OS-protected store/lifecycle |
| TD11 | Access | No authorization/export policy | HIGH for shared use | `app.py:33`; `dashboard_shell.py:3849` | HR exposure | Explicit trust/user model |
| TD12 | Persistence | Nontransactional registry/files | HIGH | `historical_sync.py:66`, `:266` | False success/corruption/races | Atomic publish, validation/recovery |
| TD13 | Structure | Oversized modules/functions | HIGH | App 5,787 lines; dashboard 5,836; bridge method 1,212 | Broad regression surface | Incremental extraction along contracts |
| TD14 | Duplication | Time/status/auth helpers repeated | MEDIUM | `time_series_analysis.py:70`; `normalization.py:97`; `generate_id_cards.py:410`; `keka_data_fetcher.py:78` | Fixes diverge | Equivalence tests before consolidation |
| TD15 | Build | Unpinned/incomplete dependencies | HIGH | requirements/spec | Non-repeatable deployment | Supported Python and locked sets |
| TD16 | Paths | CWD/source/frozen-temp paths mixed | MEDIUM | `config/settings.py:20`; `historical_sync.py:26`; `id_card_module.py:75` | Launch-dependent persistence | Explicit user config/data/cache locations |
| TD17 | Legacy | Old callbacks/stale comments | MEDIUM | `app.py:3481`, `:3766`; `dashboard_shell.py:4466` | Reachability/test confusion | Confirm consumers before retirement |
| TD18 | Errors | Silent pattern/archive failures | HIGH | `snapshot_bridge.py:1653`; `historical_sync.py:487` | Failure appears as valid absence | Partial/degraded/error states |
| TD19 | Types/state | Broad dicts/mutable shared frames | MEDIUM | Bridge bundles/foundation contract | Contract/cache corruption risk | Typed results/controlled ownership |
| TD20 | Files | Formula content/output collision | MEDIUM | XLSX probe; `app.py:5453` | Unsafe content/overwrites | Text-safe writer/collision rules |
| TD21 | Tests | Full suite/packaging unresolved | HIGH | §12; stale April binary | Limited release confidence | Clean environment and startup smoke |
| TD22 | Accessibility | Custom chart/table support unverified | MEDIUM | dashboard custom widgets | Keyboard/screen-reader exclusion | Verify focus/text alternatives |

No circular import failure was observed in exercised paths; local imports and package re-exports still couple modules. No blanket claim that old callbacks are unused is made: compatibility/tests may consume them. No-op cancellation (`app.py:4851`, `:4882`), hard-coded defaults and stale docstrings need explicit disposition, not blind deletion.

## 15. Preserve List

1. KRA/OKR formatting/mapping; attendance/Time & Leave reconciliation; half-days, AR recognition and ID-card workflows.
2. Provenance, exact-duplicate governance, raw versus analytical quantities, evaluable denominators and unknown/DQ distinctions.
3. UI-independent policy, trend, KPI/pattern engines and regression fixtures.
4. Isolated snapshot construction, atomic activation, failed-load preservation, normalized filters and existing bounded LRUs.
5. Monthly history UX, connector retries/timeouts/session reuse, bounded photo prefetch and local/Keka/Slack fallbacks.
6. Shared UI components, scope/reset/cascade filters, empty/loading/error states, queue rendering and aggregate charts.
7. Policy effective dates and internal benchmarking semantics through any later query/storage migration.

These are supported by code and selected tests; live-service and all visual behavior remain unverified.

## 16. Modernization Priorities

### P0 — foundational/blocking

- Establish accepted working-tree/test/build baseline and golden metric outputs with lineage.
- Correct event identity/history merge, pagination completeness and dashboard/export scope/semantic mismatch with regression fixtures.
- Decide endpoint/user/security model, credential lifecycle and export authorization before shared use; rotate secrets based on actual exposure evidence.
- Define workload/latency/memory limits and explicit unsupported/partial/failure behavior.

### P1 — high value

- Consolidate scope/metric contracts while preserving distinct source-event, employee-day and request grains.
- Compare bounded ingestion/query/storage approaches with measured prototypes. Choose database/framework only after workload and deployment decisions.
- Remove synchronous cold UI work; bound/cancel/coalesce jobs; fix cache keys/version fencing and memory budgets.
- Make archive publication recoverable/atomic; lock supported runtime/build dependencies and clarify data paths.

### P2 — important enhancements

- Structured sanitized diagnostics, performance/correctness gates, multi-month/skewed fixtures and packaged clean-machine verification.
- Paged/virtualized high-cardinality detail where measured necessary; scalable exports with completeness metadata.
- Keyboard/screen-reader/DPI/error-state verification and targeted changes within the current component system.

### P3 — optional optimization

- Profile startup/import/package footprint, speculative prewarm and chart redraws before optimizing.
- External benchmarks/prediction only with validated data/product demand.
- UI redesign/framework replacement only as a separately justified decision.

Recommended order: **correctness/reproducibility → security/trust → metric/data contracts → bounded data execution → reliable jobs/cache/exports → observability/accessibility → optional UX expansion**. Nothing from the future architecture was implemented.

## 17. Architecture Questions

- Desktop/offline or shared browser/service target? Simultaneous users/tenants?
- Does 10M mean retained source events, active rows, employee-days or multiple domains? Employee/BU/month cardinality, row width, skew and corrections?
- Supported hardware/RAM, deployment/admin rights and offline needs?
- Cold import/first dashboard/drilldown/warm filter/export latency and freshness SLAs?
- Which metric definition is authoritative where exports/dashboard disagree? Denominators, units, policy versions and partial-month rules?
- Stable employee/event/request IDs, org moves, source corrections/retractions and as-of history requirements?
- Actual tenant API scopes/window/rate/page limits? Code comments differ about history windows; live behavior was not verified.
- Who may see/export employee data? Endpoint encryption/ACLs, OneDrive sharing, retention/deletion/audit rules?
- Must Excel carry complete raw datasets, or can large raw exports use another format alongside summary workbooks?
- Must instances/machines coordinate archives? Backup/restore/recovery expectations?
- Which uncommitted edits/release artifacts are accepted? Which old routes/tests remain supported?

## 18. Recommended Stage 1 Inputs

1. **Workload profile:** de-identified schemas and representative small/medium/large samples, including event/day/request/entity/month counts, skew, history and corrections.
2. **Product/deployment brief:** desktop/shared choice, offline needs, concurrency, named hardware, distribution/support constraints.
3. **Metric catalogue:** owner, grain, unit, formula, eligibility, numerator/denominator, date attribution, policy version, unknown handling and reference outputs. Reconcile the existing Excel logic workbook with implementation.
4. **Source contract:** Keka scopes/endpoints, verified pagination/window/rate limits, identifiers, retention and reconciliation/fallback requirements.
5. **Security/data handling:** roles, view/export scopes, endpoint protections, retention, credentials, audit and approved sync/storage locations.
6. **Acceptance matrix:** cold/warm/UI/export budgets at 10K/100K/1M/10M on named hardware; peak RAM, concurrency and recovery behavior.
7. **Preservation/rollout:** workflow/output compatibility, golden data, triaged full test suite, migration reconciliation and rollback.
8. **Decision evidence:** bounded candidate prototypes using identical data and budgets. Select infrastructure from measured workload, not record count alone.

Supporting public guidance: pandas describes its in-memory model and reducing materialized data in [Scaling to large datasets](https://pandas.pydata.org/docs/user_guide/scale.html). Package reproducibility/protection guidance appears in pip's [Secure installs](https://pip.pypa.io/en/stable/topics/secure-installs/). These support general directions; application findings come from repository evidence and controlled probes.

