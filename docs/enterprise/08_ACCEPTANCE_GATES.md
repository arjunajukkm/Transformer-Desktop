# Acceptance gates and evidence plan

Stage 1 defines gates; it does not claim future gates have passed. Existing baseline: 106 selected core tests passed in Stage 0; the attempted full suite did not produce a clean final result because of temporary-directory permission/cleanup failures, with earlier failures requiring classification. Do not represent that as a passing full suite. No runtime tests or million-row benchmarks were run in Stage 1 because runtime behavior was not changed.

## Gate rules

Every implementation PR names its applicable gates and attaches machine-readable results, commit/dependency versions, deterministic fixture seed, environment and reviewer. All applicable correctness/security tests must pass; no percentage-based allowance for failed critical tests. Existing failures must be resolved or documented as demonstrably unrelated with owner and expiry before proceeding; an affected workflow cannot waive its own failing gate. Performance numbers require the workload/hardware in [05_PERFORMANCE_ARCHITECTURE.md](05_PERFORMANCE_ARCHITECTURE.md), not an unqualified claim of speed.

| Gate | Required evidence and objective pass condition | Blocks |
|---|---|---|
| G01 Reproducible baseline | Clean environment built from reviewed pinned/locked dependencies including direct imports; complete test inventory and full-suite report; fixtures synthetic; no unexplained failure; desktop smoke workflows recorded | Stage 2 fixes/extraction confidence |
| G02 Metric correctness | Golden expected numerator, denominator, exclusions, unknown state, attribution and rounded result match for every migrated metric; count/identity exact; decimal quantities exact where representable; floating tolerance explicitly approved per metric (initial relative 1e-9/absolute 1e-9 for unrounded means only); no generic tolerance hiding count drift | Domain or engine replacement |
| G03 Ingestion completeness/identity | Cap hit, repeated cursor, missing page, midstream timeout and count mismatch cannot report complete success; same input retry is idempotent; two 0.5 split-day events remain two observations and total 1.0 where applicable; correction/retraction preserves lineage; ambiguity quarantined | History/storage migration |
| G04 Scope and export parity | Same canonical QuerySpec/release produces identical dashboard/export components and included IDs across BU, department, manager, employee, custom interval and as-of; absent filters never broaden access; file row count/checksum verified | Any export replacement |
| G05 Export/secret safety | Adversarial formula/control-character cells remain literals in XLSX and documented CSV policy; no macros/external links generated; credentials absent from newly persisted config/logs; private expiring artifact and revoked download tests pass | Shared exports/connector deployment |
| G06 Cache/race/error correctness | Distinct as-of, policy, metric, release and authorization versions cannot collide; stale response cannot repaint newer selection; bounds hold in soak; failed detector/query yields explicit error, never valid empty; cancellation outcome deterministic | Interactive adapter replacement |
| G07 Atomic history/recovery | Fault injection before/after each object write, staging and publication step exposes either old complete or new complete release; expired lease cannot publish; concurrent parent CAS conflict detected; retry does not duplicate; old release remains readable within retention | New store authority |
| G08 Capacity/memory | 1M routine and 10M supported dataset families finish applicable ingest/query/export runs within signed budgets; API peak RSS ≤512 MiB/process and heavy worker ≤2 GiB under proposed reference configuration; response/page/cache limits hold; no OOM/unbounded growth or full-frame API materialization | Capacity claim/serving engine selection |
| G09 Authorization | Every role/scope operation has positive and negative tests; no cross-tenant rows/counts/facets/lineage/jobs/downloads; revoked scope invalidates cursors/cache/exports; historical views use current authority; RLS role/pool leakage tests pass | Shared-user pilot |
| G10 Jobs | Worker kill/restart, lease expiry, duplicate delivery, transient/permanent failure, queued/running cancel and cancel-vs-publish tests pass; at most one visible publication per idempotency key; PARTIAL distinct; no orphan active lease indefinitely | Async production work |
| G11 API and UX performance | Signed mixed load: normal API P50 <150 ms, complex cached P95 <500 ms and common filter P95 perceived <300 ms where agreed feasible; ≥1,000 measurements/class, three runs, ≥30-minute steady run, <1% unexpected errors; cold/warm/P99/queue delay all reported. A missed target requires documented redesign or explicit revised commitment before claiming success | Performance release claim |
| G12 Migration/operations | Upgrade from prior schema and supported rollback/forward-recovery rehearsal; encrypted DB+object restore meets owner-approved RPO ≤1h/RTO ≤4h proposal; all referenced artifacts readable; deletion ledger reapplied; deployment health/shutdown jobs tested | Shared production release |
| G13 Frontend workflow | Keyboard navigation, focus, accessible chart/table alternative, contrast and reduced-motion checks; correct filter URL replay; latest-result fencing; bounded rows/points; error/empty/DQ distinction; task-based pilot acceptance; no unresolved critical accessibility defect | First web workflow |
| G14 Parallel reconciliation | Two representative reporting cycles plus correction/retraction cycle on equivalent pinned inputs; per-grain counts/quantities and all migrated metric components reconcile; every difference approved/versioned; critical workflow owner acceptance and fallback tested | Broad workflow cutover |
| G15 Retirement | Complete workflow inventory disposition, no orphan required capability, security/data/service owner signoff, tested last lossless rollback point and post-cutover replay, recovery runbook/support ownership, legacy retention plan | Legacy UI retirement |

Numbers labeled proposed are starting budgets, not current product achievements. Owners may revise capacity/performance targets based on evidence before implementation commitment; record the reason and version. Correctness, no silent truncation, authorization and no silent semantic drift are non-negotiable invariants.

## Testing pyramid

| Layer | Representative coverage | Cadence/tool direction |
|---|---|---|
| Pure unit | Policy thresholds/effective date, date attribution, raw vs analytical quantity, unknown/DQ, identity normalization | Every change, pytest; preserve existing fixtures |
| Metric contract/golden | One fixture per metric plus policy boundaries, partial month, zero denominator, row-vs-request approvals, late-arrival cohort semantics | Every affected change; versioned reviewed expected outputs |
| Property/metamorphic | Input order independence where promised, retry idempotence, split quantity conservation, partition/recombine equivalence only for additive metrics, retraction reversibility | Deterministic seeds; Hypothesis optional when it improves coverage |
| Ingestion/integration | Connector pagination/auth/retry, malformed file, schema evolution, raw-object/DB publication, temporal joins and deletion | CI isolated services; real secrets/source disabled |
| API/security | Contract validation, every permission/scope surface, injection/depth limits, session expiry/CSRF, cache/cursor revocation, column restrictions | CI and pre-pilot; mocked IdP plus staging provider smoke |
| Frontend component | Scope controls, URL serialization, loading/error/empty, keyboard grid and chart adapter | Every frontend change with chosen JS test harness |
| E2E | Login → filter → drilldown → export/download, new-release notice, cancel and revoked access | Small critical suite; Playwright supported browser projects |
| Race/fault | Late responses, old worker lease, cancel/commit, concurrent publishers, object loss, crash/restart and unavailable provider | CI targeted suite and pre-release fault rehearsal |
| Performance/load | Full data-shape matrix, cold/warm queries, mixed users/jobs, peak memory/CPU/payload/scans, soak | Small smoke per relevant change; 1M release gate; 10M capacity release; optional 50M retention milestone |
| Migration reconciliation | Old/new adapters and engines on equivalent frozen inputs, staged schema upgrades, rollback/replay | Every schema/semantic migration |
| Packaging/deployment | Locked install/build, supported runtime, startup config failure, readiness, graceful shutdown, secret injection, backup restore | Release pipeline and periodic recovery drill |

Playwright can define distinct browser/device/configuration projects; select supported clients based on enterprise needs rather than claiming all browsers from one run. [Playwright projects](https://playwright.dev/docs/test-projects). Use versioned migration scripts and reviewed upgrade paths; tooling does not guarantee safe data migration. [Alembic tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html).

## Mandatory golden scenarios

1. Two distinct half-day leave events on one employee/date; repeated source observation; same native ID revised; overlapping report without source ID; explicit deletion versus absence from incomplete page.
2. Policy start boundary at 2026-10-01, non-PL/WFH lag boundary, PL quantity/notice tiers and alias conflicts; missing applied date versus DQ uncertainty. Preserve current rule outcome until approved change.
3. WFH employee-month allowance across a partial displayed interval, missing/nonpositive quantity legacy behavior and multi-month excess; no chunk-local allowance reset.
4. Missing swipe/absence/regularization rates: numerator 0 with valid denominator, denominator 0, excluded critical DQ, warning-only input, split-day evidence and missing period.
5. Approval counts from repeated evaluated rows versus distinct requests; compatibility output explicit. Leave timing request-start month and sign; pending age pinned as-of rather than wall-clock drift.
6. Late-arrival descriptive >60-minute rounded employee-vs-BU mean difference, exact 60, >240 cohort anomaly/N/A; no invented shift denominator.
7. Employee transfers across org effective dates, late correction known after reporting date, visibility revocation and company benchmark unavailable to partial scope.
8. Export with employee/manager/date filters, safe formula-like text, null versus zero, metadata versions and incomplete coverage banner.

## Reconciliation ledger and benchmark evidence

For each import record received observations, rejected/quarantined observations, duplicate observations, unique business events, current revisions, retractions, derived day facts and requests separately. Do not assert equality between counts of different grains. Reconciliation includes reason-coded bridges and raw/analytical quantity totals. Persist requested/received coverage and source totals when provided; unknown source count remains unknown.

Benchmark report fields: code/lock/config identifiers; seed/data-shape manifest; engine and host versions; cold-cache definition; query mix/selectivity; users/RPS; ingest/export time; P50/P95/P99; timeout/error rates; peak process/container memory and DB resources; CPU/spill; rows scanned/returned; response bytes; cache hits/misses; queue delay and job run time. A single timing or final RSS sample cannot pass G08/G11. Fifty-million retention testing additionally measures manifest size, compaction, recovery, object availability and cold-release rehydration; it does not inherit interactive SLOs automatically.

## Stage 0 finding → planned control traceability

| Validated finding | Blueprint control | Gate |
|---|---|---|
| History employee/date dedup drops split events | Native identity/revisions, observation lineage, ambiguity quarantine | G03/G07 |
| Pagination cap returns partial data as success | Completeness envelope, terminal evidence, preserve active release | G03/G10 |
| Export omits dashboard scope | Canonical QuerySpec/semantic compiler and pinned export | G04 |
| Competing grains/formulas | Catalogue, typed grain plans, compatibility versions and MC decisions | G02/G14 |
| Expensive cold analytics/full materialization | Storage pushdown, bounded batches, aggregates and async work | G08/G11 |
| Synchronous UI tasks | Worker isolation and explicit progress/cancellation | G10/G13 |
| Cache key/version/scoping defects | Full version/security keys, bounds, fencing | G06/G09 |
| Plaintext credentials/no authorization | Secret adapter, OIDC, RBAC/scoped grants/RLS defense | G05/G09 |
| Export formula risk/unrestricted downloads | Literal cell output and private reauthorized artifacts | G05 |
| Nontransactional persistence | Immutable staged objects + atomic manifest visibility | G07/G12 |
| Unpinned dependencies/large modules | Reproducible baseline, incremental domain extraction | G01/G02 |
| Errors represented as empty analyses | Typed result states and error propagation | G06 |

## Stage 1 completion check

Eight linked planning documents exist; important audit claims were checked against source; the approval-trend grain correction is explicitly documented in document 03. Recommendation distinguishes day-one, later and optional components. No application behavior, UI, database, dependency installation or broad refactoring is part of this stage. Stage 2 begins only as subsequent implementation work scoped to correctness/contracts/baseline.
