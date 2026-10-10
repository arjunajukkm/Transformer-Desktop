# Architecture decision records

Stage 1 proposed architecture, 4 October 2026. **DECIDED** means a design invariant adopted by this blueprint, not deployed code or implicit business approval. **PROVISIONAL** means selected pending implementation validation. **REQUIRES BENCHMARK** blocks a capacity claim. **REQUIRES PRODUCT DECISION** blocks a business/security semantic choice. Supporting detail: [target](01_TARGET_ARCHITECTURE.md), [data](02_DATA_ARCHITECTURE.md), [metrics](03_METRIC_SEMANTIC_LAYER.md), [security](04_SECURITY_ARCHITECTURE.md), [performance](05_PERFORMANCE_ARCHITECTURE.md).

## ADR-001 — Deployment model — PROVISIONAL

- **Context:** current desktop has useful intelligence but no shared security boundary; enterprise exploration and multi-user operation are strategic requirements.
- **Options:** A optimized desktop; B React/local Python/DuckDB; C shared enterprise web; microservices.
- **Decision:** C as a Python modular monolith with separate supervised API/worker processes and React client. Keep desktop during incremental migration. Hosting/provider remains a product/operations decision.
- **Why:** shared authorization, governance and centrally versioned analytics address the objective more directly than many independent local data copies.
- **Trade-offs:** hosting/identity/operations burden; network dependency; offline workflow needs separate treatment.
- **Consequences:** stable domain/service contracts first; no immediate UI rewrite or service-per-domain decomposition.
- **Validation required:** confirm multi-user personas, hosting constraints and workload; complete end-to-end pilot and recovery exercise.
- **Revisit trigger:** mandatory offline operation, residency constraints or evidence that the intended product remains solely single-user.

## ADR-002 — Canonical grains — DECIDED

- **Context:** event, day and request grains coexist; history employee/date dedup drops split events.
- **Options:** one universal wide table; employee-day-only history; explicit grains with lineage.
- **Decision:** separate source observations/events/revisions, employee-day facts, requests, temporal employee/org dimensions, policies, metrics, aggregates and snapshot manifests.
- **Why:** identities, denominators and date attribution differ and cannot safely be collapsed.
- **Trade-offs:** explicit joins/bridges and reconciliation are more work than a single frame.
- **Consequences:** compiler checks grain and fanout; stable native IDs preferred; ambiguous file identity quarantined. Candidate fingerprints are not universal business keys.
- **Validation required:** split-day, duplicate, revision, retraction, org-move and overlapping-file fixtures reconcile exactly.
- **Revisit trigger:** new source grain/identity semantics; revise adapter/schema versions, not the invariant that grains remain explicit.

## ADR-003 — Analytical storage — REQUIRES BENCHMARK

- **Context:** 100K in-memory execution is expensive; 1M routine and 10M supported are unproven.
- **Options:** pandas full-frame; PostgreSQL facts/aggregates; DuckDB embedded; ClickHouse serving; combinations.
- **Decision:** PostgreSQL initial typed serving projections and aggregates, immutable Parquet history; DuckDB candidate for isolated batch/cold workloads. No ClickHouse initially.
- **Why:** reuse operational engine and reduce consistency/operations burden while query shape and workload are bounded.
- **Trade-offs:** PostgreSQL may lose at broad scan concurrency; historical retention requires compaction/rehydration strategy.
- **Consequences:** storage interface and versioned semantic compiler; SQL plans and 1M/10M tests before capacity promises.
- **Validation required:** exact metric parity and signed SLO/memory envelope under mixed load; alternate engine comparable-cost prototype if failing.
- **Revisit trigger:** tuned plans/aggregates still fail 10M target or measured cost; candidate demonstrates material benefit, proposed ≥2× performance/throughput at comparable cost with full parity.

## ADR-004 — Metadata/configuration storage — PROVISIONAL

- **Context:** configuration/history publication/jobs need transactions and multi-user coordination.
- **Options:** local files, SQLite, PostgreSQL, dedicated distributed metadata services.
- **Decision:** PostgreSQL for tenants, grants, versioned policies/catalogue metadata, dataset manifests, jobs, sessions and audit references; versioned migrations.
- **Why:** a single transactional control plane can atomically publish visibility and fence workers.
- **Trade-offs:** managed database operations/backups and schema migration discipline.
- **Consequences:** separate owner/application roles; expand-contract migrations; object storage remains outside the DB transaction.
- **Validation required:** crash/retry publication, backup/restore, migration compatibility and least-privilege tests.
- **Revisit trigger:** deployment must remain offline-only or demonstrated contention requires a separate serving/control instance.

## ADR-005 — API architecture — PROVISIONAL

- **Context:** UI, exports and trends currently assemble scopes separately.
- **Options:** direct DB browser access, ad hoc endpoints, REST typed API, GraphQL.
- **Decision:** FastAPI/Pydantic REST/OpenAPI with one typed QuerySpec and result envelope; same-origin session boundary.
- **Why:** Python reuse and explicit bounded contracts reduce semantic duplication.
- **Trade-offs:** schema/version management; async Python alone does not make CPU analytics nonblocking.
- **Consequences:** heavy work dispatched to processes; generated frontend types; validation/authorization before query planning.
- **Validation required:** API schema, invalid filter/grain, error state, cancellation, scope parity and authorization tests.
- **Revisit trigger:** demonstrated client need for another protocol or stable interoperability constraint, not frontend fashion.

## ADR-006 — Background jobs — PROVISIONAL

- **Context:** imports, exports and patterns block interactive work and need recovery.
- **Options:** UI threads, process-local task queue, PostgreSQL leased ledger, broker/Celery-type distributed system.
- **Decision:** PostgreSQL ledger with separate bounded Python workers, lease/fencing, retries and explicit terminal states.
- **Why:** transactional ownership/publication with few moving parts suits initial workload.
- **Trade-offs:** application must implement lease recovery, quotas and idempotency carefully; at-least-once execution.
- **Consequences:** no long transaction during computation; stale workers cannot publish; PARTIAL is distinct from SUCCEEDED.
- **Validation required:** worker death, lease loss, cancellation/commit race, duplicate delivery, fairness and queue-delay tests.
- **Revisit trigger:** measured ledger contention/throughput, routing complexity or operational needs justify a broker; preserve job contract.

## ADR-007 — Frontend platform — PROVISIONAL

- **Context:** long-term dense exploration, URL state and multi-user experience exceed the current shell's practical role.
- **Options:** enhanced CustomTkinter; packaged web UI; shared React/TypeScript; other web frameworks.
- **Decision:** React/TypeScript SPA, Router, TanStack Query and Table/Virtual, design-token components, ECharts behind chart adapters.
- **Why:** typed service integration and mature routing/state/virtualization support the required interaction model; no server rendering requirement established.
- **Trade-offs:** new JS toolchain, accessibility/interaction engineering, dependency and licensing review.
- **Consequences:** bounded server pages, URL QuerySpec state, explicit loading/error/empty states; no million-row client grids.
- **Validation required:** one complete workflow with keyboard/screen-reader checks, latency, browser memory and stale-response tests; grid/chart licensing and requirements review.
- **Revisit trigger:** required grid capabilities cannot be delivered economically, restrictive deployment/client constraints or accessibility failure.

## ADR-008 — Authentication/authorization — PROVISIONAL; scope policy REQUIRES PRODUCT DECISION

- **Context:** HR information and multiple personas require centrally enforced access; filters are not permissions.
- **Options:** local OS trust, custom passwords, enterprise OIDC; role-only versus scoped entitlements.
- **Decision:** existing enterprise OIDC, server sessions, RBAC intersected with row/org/column grants; application enforcement plus PostgreSQL RLS defense.
- **Why:** federated lifecycle and explicit scoped data access address shared-service risk.
- **Trade-offs:** identity integration and hard policy questions around transfers, history and small cohorts.
- **Consequences:** reauthorize cache/cursor/job/export replay; current grants apply to historical views; deny unsigned policy cases.
- **Validation required:** approved access matrix, cross-tenant negative tests, revoked-session/export tests and DB-role/pool isolation review.
- **Revisit trigger:** identity-provider constraints or new approved access model; no relaxation merely for faster queries.

## ADR-009 — Semantic layer — DECIDED; formula conflicts REQUIRES PRODUCT DECISION

- **Context:** competing grains/formulas and export scope drift undermine trust.
- **Options:** formulas per screen; SQL strings in browser; governed catalogue/query compiler with compatibility versions.
- **Decision:** define metric contracts once with explicit grain, numerator/denominator, eligibility, attribution, unknown/DQ and lineage; reusable typed query compiler.
- **Why:** dashboard/trend/export/Explorer need the same meaning and scope.
- **Trade-offs:** catalogue governance and cross-engine parity work; some existing outputs conflict.
- **Consequences:** retain legacy versions; new late-arrival rate and request-weighted approval rates cannot silently replace current calculations. MC01–MC12 require named decisions.
- **Validation required:** golden metric contracts and differential tests including unrounded components; boundary/unknown cases.
- **Revisit trigger:** approved semantic change creates a new version with migration notes, never an undocumented rewrite.

## ADR-010 — Historical versioning — DECIDED; retention REQUIRES PRODUCT DECISION

- **Context:** mutable history and positional IDs cannot explain corrections or reproduce snapshots reliably.
- **Options:** overwrite current rows; full copy every snapshot; immutable revisions with copy-on-write partition generations/manifests.
- **Decision:** latter; explicit effective/source/received/known times, stable lineage, compatible fact/aggregate publication via atomic metadata pointer.
- **Why:** reproducibility and recoverable publication without duplicating the entire history per release.
- **Trade-offs:** retention/GC/compaction and temporal joins are more complex.
- **Consequences:** immutable verified objects precede DB publication; cold snapshots may require jobs; restore reapplies deletion ledger.
- **Validation required:** as-of/correction/rollback parity, no missing referenced artifacts, crash recovery and retention-aware restore.
- **Revisit trigger:** growth/restore evidence requires alternative physical layout; legal/HR retention approval changes lifecycle, not silent overwrites.

## ADR-011 — Caching — PROVISIONAL

- **Context:** current keys disagree and omit time/version inputs; scope caches can grow.
- **Options:** no cache; unbounded dictionaries; bounded process cache; Redis.
- **Decision:** byte/entry-bounded process LRU with full security/version/query/as-of identity, authorization checks and single-flight bounds.
- **Why:** fix correctness and resource limits before adding shared infrastructure.
- **Trade-offs:** duplicate cache across replicas, cold starts, key discipline.
- **Consequences:** immutable release namespaces; failure is never cached as valid empty; entitlement change prevents reuse independently of TTL.
- **Validation required:** key equivalence/difference cases, revocation, publication races, eviction/soak and mixed cold/warm SLOs.
- **Revisit trigger:** measured cross-replica duplicate work violates targets and Redis prototype produces net value.

## ADR-012 — Exports — DECIDED; quota/retention REQUIRES PRODUCT DECISION

- **Context:** current export can disagree with displayed scope and execute spreadsheet formulas.
- **Options:** screen-specific synchronous exports; browser full-data export; shared semantic background export.
- **Decision:** durable job over authorized pinned QuerySpec, safe literal formatting, private expiring artifact and reauthorized download.
- **Why:** exact scope/formula parity, bounded execution and auditability.
- **Trade-offs:** queue latency, artifact lifecycle and spreadsheet compatibility testing.
- **Consequences:** export permission is separate; include version/coverage metadata; no public download URL by default; proposed 24-hour expiry and 1M-row job ceiling need approval.
- **Validation required:** cell-type/formula checks, dashboard/export equality, revoked-user download denial, row-count/checksum and cancelled-job cleanup.
- **Revisit trigger:** approved bulk interchange demand or retention requirements; preserve semantic and authorization contracts.

## Decision ownership and open approvals

Architecture owner records benchmark/implementation evidence for provisional choices. HR metric owner resolves MC01–MC12 and proposed late-arrival rate/region mapping. Security owner approves entitlement semantics, cohort disclosure rules and sessions. Data owner confirms source keys, authoritative slice rules and retention. Service owner approves workload, hosting, RPO/RTO and capacity/cost targets. Until assigned, these remain explicit unresolved decisions; this document does not manufacture signoff.
