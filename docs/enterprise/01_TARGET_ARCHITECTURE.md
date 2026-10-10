# 01 — Target Architecture

Stage 1 • 4 October 2026 • Proposal, not implementation

Read with [data](02_DATA_ARCHITECTURE.md), [semantics](03_METRIC_SEMANTIC_LAYER.md), [security](04_SECURITY_ARCHITECTURE.md), [performance](05_PERFORMANCE_ARCHITECTURE.md), [migration](06_MIGRATION_ROADMAP.md), [ADRs](07_ARCHITECTURE_DECISIONS.md) and [gates](08_ACCEPTANCE_GATES.md). The complete Stage 0 audit was read before recommendations; important implementations were re-inspected. Source locators are relative to the repository root. No runtime changes or infrastructure installations are part of this stage.

## Executive recommendation

Choose **Option C: a React/TypeScript web application over a Python modular monolith, with PostgreSQL as both transactional metadata store and initial interactive analytical store, and private object storage for immutable source files and Parquet history**. Run background workers separately from interactive API processes, using the same domain package and release artifact. Keep the existing desktop as the operational fallback during incremental migration.

This targets shared exploration, contextual drilldown, governed exports and centralized HR access without starting with microservices or a separate analytical cluster. PostgreSQL is the first candidate, not a demonstrated 10M-row SLO guarantee. Admission to the shared release depends on the benchmarks in document 08. Broader cold historical queries can be asynchronous; DuckDB is the first candidate for isolated Parquet/rebuild jobs if benchmarks require it. ClickHouse is an escalation candidate only after measured concurrency/scan limitations.

**“Day 1” means the first shared web production slice after migration gates, not Stage 2 and not an instruction to install anything now.** Architectural invariants may be DECIDED in this proposal; technology choices remain PROVISIONAL until their stated validation. The user's target envelope is adopted: 100K/1M routine, 10M supported, credible path to 50M retained events. Initial sizing assumes 25 active users generating 10 aggregate requests/second plus two heavy jobs; these are explicit planning assumptions, not discovered demand.

## A/B/C comparison

| Criterion | A — Modernized desktop, pandas/Polars + DuckDB | B — React + local Python service + DuckDB/Parquet | C — Shared web modular monolith |
|---|---|---|---|
| Domain preservation | Strong; least adaptation | Strong Python reuse through local API | Strong if extracted behind contracts first |
| Single-machine 1M/10M analytics | Credible with bounded SQL scans; benchmark | Credible; browser stays bounded | Credible with partitions/aggregates; benchmark concurrency |
| Premium linked views/explorer | Possible but extensive custom Tk/UI engineering | Strong web component foundations | Strong web component foundations |
| Shared access, saved views, audit | Separate sync/security system required | Per-device auth/files/version skew; eventual central control still needed | Central identity, versioned data, entitlements and exports |
| Offline capability | Best | Strong, if explicitly engineered | Limited; no HR offline cache by default |
| Operational burden | Endpoint packaging/support | Service ports, packaging, updates, endpoint secrets and sync | Server/database/object storage/IdP operations |
| Main risk | Optimizes current shell while missing collaboration objective | Becomes a second deployment product and delays central governance | Premature rewrite or unproven shared capacity |
| Best fit | Permanently single-user/offline product | Offline/air-gapped requirement or desktop wrapper needed | Stated long-term shared workforce intelligence objective |
| Outcome | Keep as transition/fallback, not strategic target | Contingency if offline is mandatory | Recommended strategic target |

A is not incapable of millions of rows, nor is React intrinsically faster at analytics. The deciding factors are centrally enforced authorization, reproducible shared data, safe exports and product exploration. B does not solve multi-user data consistency merely by adding a browser UI. If product owners establish mandatory offline operation, reopen ADR-001 before the frontend phase; do not maintain two full stacks speculatively.

## Current → target

| Current implementation | Target boundary |
|---|---|
| Tk variables/global DataFrame and snapshot | Typed scope, immutable dataset release ID, bounded API results |
| pandas scans and Python object graph per load | Curated typed facts, parameterized SQL, eligible materialized aggregates |
| Local files + JSON registry | Transactional publication metadata + immutable checked objects |
| Divergent dashboard/export formulas | One versioned semantic query plan shared by all surfaces |
| `.env` credentials and implicit endpoint trust | OIDC user sessions, explicit entitlements, protected service credentials |
| Threads per interaction | Interactive admission control + durable leased background jobs |
| Desktop widgets over complete results | Server filtering/grouping/paging + browser viewport virtualization |
| Silent empty defaults | Typed empty/partial/failed/insufficient-data states |

## Components and boundaries

```text
                         Enterprise OIDC provider
                                  |
Browser -- HTTPS --> reverse proxy/static React assets
   |                              |
   +-- same-origin API ----------> Python modular monolith
                                    Identity/session + authorization
                                    Query validation + semantic compiler
                                    Explorer / saved views / exports / jobs
                                      |                |
                               bounded SQL         job submission
                                      v                v
                             PostgreSQL          PostgreSQL job ledger
                             metadata/access     + separately bounded workers
                             curated facts         (same Python domain package)
                             published aggregates       |
                                      ^                 v
                                      +---- staged validation/publication
                                                        |
Keka / uploads --> connector/import workers --> private object storage
                                              source originals + Parquet
                                              manifests + export artifacts

Existing desktop -- compatibility domain adapter (migration only)
                    same frozen contracts / golden fixtures
Optional later: isolated DuckDB batch execution or ClickHouse serving
                behind the same authorized semantic execution interface
```

One repository/release with modules, not network services per domain. API processes never load the organization's complete dataset. Workers may use bounded pandas adapters while SQL equivalents are proven. No business formula lives in React. No direct browser SQL, database credentials or raw object-store listing. PostgreSQL is private; object storage is private; only the HTTPS entry point is public to the authorized network/user population.

Suggested future module boundaries (names are proposals, no directories created): `domain/identity`, `domain/attendance`, `domain/requests`, `domain/policy`, `domain/metrics`, `application/query`, `application/ingestion`, `application/exports`, `application/jobs`, `adapters/postgres`, `adapters/object_store`, `adapters/keka`, `api`, `web`. Domain code cannot import Tk, React or HTTP request objects. An authorized execution context is passed explicitly, never obtained from a mutable process-global active dataset.

## Technology decision matrix

| Technology | Problem solved | Advantages | Disadvantages | Operational complexity | Scale characteristics | When justified | Recommendation |
|---|---|---|---|---|---|---|---|
| PostgreSQL | Metadata transactions, job claims, indexed explorer and initial facts/aggregates | One mature shared store, constraints and RLS | Wide/high-concurrency scans compete with writes; aggregates need management | Moderate: backup, tuning, pool, migrations | Partition/index/aggregate dependent, not guaranteed by row count | First shared slice | Day 1; require 1M/10M load proof |
| DuckDB | Local analytical scans, Parquet transformations, isolated historical jobs | Embedded columnar SQL, pruning, bounded spill | Embedded ownership/concurrency differs from service DB; arbitrary tenant SQL unsafe | Low embedded, moderate managed job isolation | Useful analytical scans; each worker budget enforced | A/B; or PostgreSQL/batch gates miss | Benchmark candidate, not initial shared DB |
| ClickHouse | Sustained concurrent analytical scans beyond serving budget | Columnar execution and aggregate-oriented serving | Second durable projection, correction/security/parity complexity | High relative to initial stack | Candidate for wider 10M/50M concurrent workloads | Document 05 escalation trigger, not a row-count slogan | Later only after comparative proof |
| Parquet | Compact typed history/replay and bulk interchange | Column-oriented, compressible, partitionable | Not a transaction/auth/query service | Low format; manifests/compaction add work | Pruned scans; small files and skew matter | Raw normalized history and reproducible rebuild | Day 1 durable format |
| Object/file storage | Source originals, manifests, artifacts and backups | Immutable content IDs and cheap retention | Cross-store publish protocol, retention/ACL management | Prefer approved managed private storage | Capacity expands independently; latency not interactive SQL | Shared deployment | Day 1 private object service; filesystem only dev/local adapter |
| Redis | Shared ephemeral cache or queue acceleration | Shared low-latency state | More operations, invalidation and outage modes | Additional service | Helps repeated shared results, not cold query correctness | Multi-replica cache duplication measurably violates budgets | Not Day 1 |
| Polars | Faster lazy/batched normalization | Projection/predicate optimization | Another expression/type system and parity risk | Low library, nontrivial migration | Bounded pipeline dependent; not a metadata DB | Benchmark a specific pandas hot path | Optional, not blanket pandas replacement |
| pandas | Existing domain behavior and golden oracle | Largest preservation value | Whole-data object allocation unsuitable for interactive 10M | Already present | Bounded jobs/fixtures only | Compatibility, selected transforms, small exports | Retain with explicit batch/group limits |

PostgreSQL partition pruning and stored aggregate reads are capabilities, not proof of workload latency ([partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html), [materialized views](https://www.postgresql.org/docs/current/rules-materializedviews.html)). Initial incremental aggregates should be versioned application-maintained tables; a plain materialized-view refresh is not presumed incremental.

DuckDB's embedded read-write file has single-process ownership; multi-process alternatives exist but add a different architecture. Do not put a shared writable `.duckdb` file in OneDrive or treat it as PostgreSQL ([concurrency](https://duckdb.org/docs/current/connect/concurrency), [Parquet scans](https://duckdb.org/docs/current/data/parquet/overview)). Polars lazy optimizations make it a candidate, not a mandate ([official guide](https://docs.pola.rs/user-guide/lazy/optimizations/)).

## Other major technology choices and validation

| Proposal | Why current design is insufficient / alternatives | New complexity / when / evidence required |
|---|---|---|
| React + TypeScript | Retained Tk widgets do not provide browser routes/shared linked state; considered Vue/Svelte and keeping Tk | Web toolchain and accessibility ownership; frontend phase only; prove linked filter/explorer slice and keyboard use. [React](https://react.dev/learn/thinking-in-react), [TypeScript](https://www.typescriptlang.org/docs/handbook/intro.html) |
| Vite SPA + React Router | Authenticated analytical product needs routing, not public SEO/SSR; compare framework SSR only if product requires it | Build/release and URL schema; avoid a second Node backend. Validate startup, route splitting, deep links. [Router modes](https://reactrouter.com/start/modes) |
| TanStack Query | Explicit server state, cancellation and invalidation replace ad hoc global bundle state | Query-key/privacy lifecycle; validate no stale scope mixing or retained HR cache after logout. [Overview](https://tanstack.com/query/latest/docs/framework/react/overview) |
| TanStack Table + Virtual | Backend row model plus bounded cells; compare AG Grid if advanced keyboard/grouping proves too expensive to build | Headless table requires accessibility/testing work; final library choice benchmark/licensing gate. [Virtualization guide](https://tanstack.com/table/latest/docs/framework/react/guide/virtualization) |
| Apache ECharts | Bounded aggregate chart adapter instead of UI-coupled Matplotlib; compare Vega-Lite/Recharts | Interaction and accessible alternatives; validate linked selection, resize and point budgets. [Accessibility support](https://echarts.apache.org/handbook/en/best-practices/aria/) |
| FastAPI + Pydantic | Typed Python boundary reuses domain assets; Django/DRF is reasonable if admin CRUD dominates | Auth integration/schema evolution remain our responsibility; async alone does not accelerate pandas. Separate processes for heavy work. [Deployment concepts](https://fastapi.tiangolo.com/deployment/concepts/) |
| Parameterized SQL/SQLAlchemy Core + Alembic | Explicit query plans and reviewed schema migrations, versus raw dynamic SQL or ORM entity hydration | Migration/backfill discipline; introduce only after Stage 2; validate query plans and expand/contract rollback. [Alembic](https://alembic.sqlalchemy.org/en/latest/tutorial.html) |
| Existing enterprise OIDC IdP | Local connector credentials are not user identity; avoid building passwords or deploying an extra IdP without need | Tenant/group mapping, session/revocation testing; mandatory before shared HR data |
| PostgreSQL job ledger + worker process | Durable jobs without Redis/Celery/RabbitMQ initially | Lease/retry/fencing implementation; adopt established queue library later if reliability/throughput outgrows narrow job model |

Exact package versions are selected/tested/pinned in implementation, not assumed from latest documentation. Infrastructure host, region, IdP vendor and object-store vendor require product/security choices; no cloud purchase is implied.

## Frontend architecture and information architecture

Feature modules own routes and view composition; common `Scope`, metric metadata, result-state and permission types come from versioned API contracts. React Router owns navigable workspace/filter references. TanStack Query owns remote results; local reducers/context own selection, panel layout, open dialogs and drafts. Do not start with Redux/Zustand until shared local-state complexity is demonstrated.

Design tokens cover density, typography, spacing, color, focus and chart semantic colors. Domain components: ScopeBar, MetricCard, MetricExplanation, DatasetVersionBadge, ProvenanceDrawer, ResultState, ExplorerGrid, JobProgress and ExportDialog. Their state contracts precede visual redesign. Cross-filtering commits one normalized scope, cancels superseded requests and links chart/table selections by stable IDs. Drilldown changes grain explicitly and preserves the breadcrumb/return scope.

URLs contain stable workspace/view IDs and non-sensitive settings. Detailed employee filters/search text go in access-controlled saved-view state or short-lived server view handles, not URLs/referrers. Saved views store definitions, not permission grants; reopen under current entitlements. No persistent browser HR data/offline service-worker cache. Loading skeletons match component shape; previous-scope data is hidden or clearly labeled and never presented as current. Empty, unauthorized, insufficient coverage, suppressed, partial and failed are distinct states. Keyboard command/search opens navigation, metrics, saved views and authorized employees; server suggestions/facets never enumerate unauthorized identities.

| Workspace | Purpose / personas | Rollout |
|---|---|---|
| Overview | Governed KPIs and DQ/freshness context; leadership/HRBP | First analytical slice |
| Trends | Time comparison, benchmarks and linked context; leadership/analyst | Next preserved slice |
| Explorer | Source events, employee-days and requests with explicit grain; analyst/HRBP | Early, bounded/detail authorized |
| Insights | Explainable pattern runs, evidence and review status; analyst/HRBP | After parity and privacy checks |
| Reports & Exports | Saved reports, jobs/downloads and governance; authorized roles | With first exports |
| Data Quality | Reconciliation, rejected/quarantined input, lineage and release completeness; steward/admin | Before publication operations |
| Administration | Identity mapping, policy/catalogue versions, connectors and retention; split admin roles | Minimal operations first |
| Analytics | Ad hoc compare/distribution workbench | Start as Explorer/Trends modes; no duplicate empty page |

Accessibility target: WCAG 2.2 AA-oriented acceptance, not certification. Native semantic controls where possible, visible focus, roving grid focus, meaningful announcements, reduced motion, contrast and non-color encodings. Charts need accessible tables/descriptions and keyboard equivalents; turning on library ARIA is insufficient. Dense desktop layout, collapsible side panels and useful tablet/read-only views; do not squeeze a wide explorer into an unusable mobile grid. [WAI grid interaction](https://www.w3.org/WAI/ARIA/apg/patterns/grid/).

## Enterprise Explorer contract

Explicit grain tabs: event / employee-day / request / employee. Server applies allowed columns, typed filter AST, sort, grouping, search and security. Default 100 rows/page, max 500; unique ID final sort key; null ordering/timezone explicit. Cursor binds snapshot, query hash, sort tuple, authorization version and expiry, is signed/opaque, and reauthorized each use. No offset walk over millions; no long-lived database transaction per browser scroll. Immutable logical release yields stable pages. Arbitrary sort is allowlisted; expensive unindexed sort becomes a job, not an unbounded query.

Grouping returns bounded group summaries and a continuation for each expansion, never a million-child array. Facets run through the same security predicates with separate limit/timeout; exact total counts are optional/deferred, approximate counts labeled. Column metadata includes type/unit/grain, permitted operators, sensitivity, lineage and grouping capability. Browser virtualizes rows and wide columns and retains a bounded page window (5 pages/2,500 rows max); virtualization does not replace server pagination. Search starts with authorized IDs/names and PostgreSQL indexed text, not Elasticsearch or arbitrary regex/SQL. Compare pins two complete QuerySpecs, displays coverage/policy differences and applies the same entitlement boundary. Export submits the exact server-validated QuerySpec as a durable job. Query cancellation covers browser AbortSignal and server/database cancellation; latest result ID guards display races.

## Primary flows and trade-offs

1. Import: source pages/upload → quarantine/raw immutable object → typed normalization and DQ → staged events/facts → reconciliation → transactionally publish manifest → new queries resolve new release. Existing sessions can remain pinned.
2. Query: browser scope → authenticated API → authorization → semantic metric resolution → bounded plan → security/version-aware cache → PostgreSQL aggregate/fact reads → small typed result → linked visualization. Exact examples in document 03.
3. Export: authorized QuerySpec + snapshot → job → entitlement recheck → identical semantic plan → streamed safe file → private artifact → reauthorized expiring download.
4. Heavy analysis: explicit run over pinned release → worker budget → versioned evidence/results → insight UI; never silently make expensive work part of every filter click.

Trade-offs: PostgreSQL minimizes initial operations but needs deliberate analytical design; object+DB publication needs a recovery protocol; Python preservation reduces semantic risk but some hot paths require SQL porting; web governance centralizes responsibility and requires reliable hosting. A shared product cannot rely on OS file access alone. The current script-level tests are assets, not proof of shared-service security.

## RECOMMENDED TARGET ARCHITECTURE

| Component | DAY 1 shared release | LATER AT SCALE | OPTIONAL ONLY IF REQUIRED |
|---|---|---|---|
| Frontend | React/TypeScript SPA, Router, Query, table/virtualization, ECharts adapters | Expanded workbench/insights | Packaged wrapper/offline edition |
| API | FastAPI typed REST/OpenAPI, same-origin session boundary | Additional replicas with bounded DB pools | GraphQL only for demonstrated client need |
| Application/domain | Python modular monolith; preserved domain assets | Isolated compute pools | Microservices only for independent operational boundaries |
| Semantic layer | Versioned catalogue + authorized QuerySpec compiler | Proven alternate SQL backends | User-authored metrics only with governed DSL |
| Analytics engine | PostgreSQL SQL + bounded Python workers | DuckDB batch/cold scans or ClickHouse if gates require | Polars for proven transform advantage |
| Operational/metadata | PostgreSQL, migrations and transactional job ledger | Managed HA/read scaling as availability demands | Separate metadata instance if contention requires |
| Analytical storage | PostgreSQL typed facts and published aggregates | Partitioned serving projections; optional columnar engine | No duplicate database without benefit |
| Raw history | Private object storage: originals + Parquet/manifests | Compaction/tiering; 50M retention tests | Local filesystem adapter for dev/offline |
| Cache | Bounded per-process LRU; immutable release keys | Redis only if measured shared-cache need | No caching for inappropriate sensitive results |
| Background | Separate leased worker process, same code/release | More isolated workers/admission lanes | Queue broker when ledger limits demonstrated |
| Authentication | Existing enterprise OIDC SSO | Provisioning/lifecycle integration | New IdP only if none available |
| Authorization | RBAC + scoped entitlements + SQL/RLS defense | More attribute policies after product approval | No client filters as access rules |
| Observability | Structured sanitized logs, request/job IDs, latency/resource metrics | Sampled traces if multi-process diagnosis warrants | No tracing cluster by default |
| Deployment | Single region, supervised containers/VM services, private DB/store, TLS; provider undecided | HA/capacity driven by signed SLO | No Kubernetes mandate |
| Testing | pytest/golden/API/auth/migration tests; frontend tests; Playwright; load harness | 10M/50M and sustained concurrency gates | Extra tooling only for uncovered risk |

No React, database, deployment or runtime migration is created by these documents.
