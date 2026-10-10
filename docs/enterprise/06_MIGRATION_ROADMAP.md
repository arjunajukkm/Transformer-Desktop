# Incremental migration roadmap

Stage 1 ends with these documents. All paths/components below are proposed future work, not changes made in this stage. Gates are defined in [08_ACCEPTANCE_GATES.md](08_ACCEPTANCE_GATES.md); decisions in [07_ARCHITECTURE_DECISIONS.md](07_ARCHITECTURE_DECISIONS.md).

## Delivery discipline

Keep desktop workflows usable while introducing replaceable boundaries. A phase is a sequence of small reviewed changes, not one rewrite. Each change owns one contract/adapter/workflow and has independent regression evidence. Preserve existing uncommitted user changes; record a clean baseline without resetting them. Introduce feature flags at application boundaries, avoid long-lived parallel formula implementations, and retain a release manifest connecting code, parser, policy, semantic and dataset versions.

No fixed calendar estimates are defensible until staffing, hosting, identity provider, source identity guarantees and metric owners are confirmed. Dependencies below define order. Do not migrate UI before correctness, service and security gates. A rollback restores application/data compatibility, never revoked permissions or deleted sensitive data.

## Stage 2A — Reproducible baseline and metric contracts

- **Objective:** establish what must remain identical and which defects are intentionally corrected.
- **Scope:** reproducible dependency environment; complete test inventory; sanitized golden fixtures; explicit metric catalogue and MC01–MC12 conflict decisions from document 03. Record current outputs before changing behavior.
- **Dependencies:** Stage 1 review; owners for metrics/data; preserve current working tree.
- **Files/modules affected:** `requirements.txt`, existing `tests/`, `workforce_intelligence/metrics.py`, `trends.py`, `kpi_engine.py`, `policy.py`, `policy_config.py`, `requests.py`, `normalization.py` are inspected and characterized; no broad rewrite.
- **New components:** proposed `tests/golden/`, `tests/contracts/`, dependency lock and baseline manifest; contract schema/fixtures first, not a new frontend.
- **Preserved:** policy effective dates, raw/analytical quantities, DQ/unknown distinction, evaluated denominators, request construction, KRA/OKR and attendance outputs, existing regression fixtures.
- **Tests:** complete suite in a writable isolated environment; classify every failure; golden outputs around effective dates, WFH month boundaries, approval row weighting, late-arrival definition and request date attribution. Record benchmark harness assumptions.
- **Acceptance:** G01 and G02; full test baseline accounted for, no unexplained failures, each migrated metric has approved legacy/changed status and exact comparison rules.
- **Rollback:** documentation/fixture/lock changes revert independently; runtime remains current desktop.
- **Risk:** freezing known defects as intended behavior. Separate characterization from approved correction; label legacy contracts explicitly.

## Stage 2B — Correctness and security defect slices

- **Objective:** eliminate demonstrated data-loss, truncation and scope defects before moving them into services.
- **Scope:** one fix per slice: pagination completeness; split-day-safe history reconciliation; shared dashboard/export scope; explicit analytical error states; bounded/versioned caches; credential and formula-safe export remediation. Decide ambiguous file identity before replacing history merge logic.
- **Dependencies:** 2A golden baseline and approved defect expectations.
- **Files/modules affected:** `keka_data_fetcher.py`, `historical_sync.py`, `storage/snapshot_service.py`, `workforce_intelligence/snapshot_bridge.py`, `dashboard_shell.py`, `time_series_analysis.py`, `id_card_module.py` and their tests. Scope changes stay surgical.
- **New components:** completeness envelope, validated QueryScope value object, identity/reconciliation adapter, credential adapter and export cell sanitizer, introduced individually.
- **Preserved:** connector retry/session behavior, snapshot isolated preparation/commit fence, valid desktop imports, ID-card/KRA/OKR workflows and expected analytical outputs outside approved defect cases.
- **Tests:** G03–G06 plus cap-hit/failing-page/retry tests, split-day and overlapping-file cases, manager/employee/custom-date export equality, stale-result race and formula literal checks.
- **Acceptance:** no silent partial success; no employee-date-only destructive dedup; exact scope parity; failures cannot appear as valid empty results; secrets no longer newly persisted in plaintext.
- **Rollback:** feature-flag replacement adapters where safe; preserve original source artifacts and history backup. Do not roll back to a known destructive writer; disable affected import/export operation if a safe previous adapter is unavailable.
- **Risk:** changing already persisted history cannot reconstruct lost events without raw sources. Inventory affected history and rebuild only from validated originals; disclose irrecoverable gaps.

## Stage 3A — Extract pure domain and scope boundaries

- **Objective:** make existing intelligence callable independently of Tkinter.
- **Scope:** extract one bounded service at a time: policy evaluation, request construction, day-fact generation, metric calculation, export query scope. Desktop calls adapters; no SQL port yet.
- **Dependencies:** 2A/2B gates, especially grain and metric decisions.
- **Files/modules affected:** `workforce_intelligence/{policy,policy_config,normalization,requests,metrics,trends,kpi_engine,data_foundation,snapshot_bridge}.py`, call sites in `dashboard_shell.py`; KRA/OKR modules get characterization first, extraction only when required.
- **New components:** proposed `domain/`, `application/`, typed contracts and repository/query interfaces; actual package layout chosen in implementation review.
- **Preserved:** tested pure functions, configuration, detectors, lineage, snapshot semantics and desktop presenters. Avoid physically moving every file merely for naming consistency.
- **Tests:** unit/golden/property tests; identical old and new adapter outputs on same release/scope; architecture import checks prevent Tkinter/IO in pure domain.
- **Acceptance:** G02/G06; a headless runner can execute the selected workflow without importing UI state; no formula drift or material baseline regression.
- **Rollback:** switch desktop caller back to prior adapter; retain one authoritative formula implementation behind either adapter.
- **Risk:** global state/time defaults and hidden UI dependencies. Make clock/as-of/config explicit before concurrency.

## Stage 3B — Versioned storage and bounded query prototype

- **Objective:** prove storage correctness and 1M/10M execution before committing to a serving engine.
- **Scope:** metadata/migrations, raw-object adapter, event identity/revisions, staged employee-day/request projections, atomic manifest publication; port one metric family and Explorer grain, then extend after parity. Prototype PostgreSQL first; compare DuckDB only for a measured batch/cold path.
- **Dependencies:** pure contracts, source identity rules, hosting/deletion policy, benchmark hardware.
- **Files/modules affected:** proposed `infrastructure/storage/`, `migrations/`, `application/ingestion/`, semantic query adapter; existing `historical_sync.py`/`storage/snapshot_service.py` behind interfaces, no in-place destructive cutover.
- **New components:** PostgreSQL schema/migration history, private object storage, release ledger, versioned aggregates, benchmark runner.
- **Preserved:** originals, old history and desktop reader, policy/metric evaluators and golden fixtures.
- **Tests:** G07/G08/G12; repeat ingest, revisions/retractions, late corrections, crash-before/after-commit, concurrent publishers, dimension movements and SQL/Python parity. Benchmark 1M and 10M with full row-width/group variation.
- **Acceptance:** reconciliation explains every source observation; bounded memory; complete immutable release or prior release only; agreed serving capacity proven or engine ADR revised with evidence.
- **Rollback:** desktop uses previous history adapter; keep new store read-only for investigation. No automatic reverse conversion unless tested lossless; preserve publication manifests.
- **Risk:** false identity and joins multiplying facts. Quarantine ambiguity; avoid dual writers to the same logical history. Shadow ingest can run from identical immutable originals without becoming authoritative.

## Stage 3C — API, jobs and shared-service security

- **Objective:** expose stable, scoped contracts with durable background execution.
- **Scope:** FastAPI typed endpoints for catalogue/query/Explorer/jobs; OIDC/session integration; entitlements, RLS defense, audit; leased workers; governed export; no frontend migration yet beyond test client.
- **Dependencies:** validated serving slice, approved permission matrix/IdP, security and retention owners.
- **Files/modules affected:** proposed `api/`, `application/jobs/`, `infrastructure/auth/`, `infrastructure/observability/`, deployment config; existing connectors/domain/export adapters reused.
- **New components:** supervised API/worker processes, job ledger, session store, authorization resolver and deployment pipeline.
- **Preserved:** domain implementations, source retry logic, dataset publication protocol and desktop operation.
- **Tests:** G04/G05/G09/G10/G11/G12; authorization matrix on all surfaces, lease loss/cancel races, endpoint schema, redaction, restore and deployment smoke tests.
- **Acceptance:** no unauthorized row/count/column leakage; revoked export inaccessible; jobs fenced/idempotent; service rollback and restore rehearsal pass; API meets signed load targets.
- **Rollback:** disable shared entry point and return users to permitted desktop workflows; preserve new releases and job evidence. Revoke pilot sessions, keep audit history.
- **Risk:** centralizing previously local sensitive data; no shared pilot until security gate passes even if localhost demos work.

## Stage 4A — One complete web workflow

- **Objective:** validate product quality through one end-to-end Overview → Trends → Explorer → export journey.
- **Scope:** React/TypeScript shell, routing, design tokens, typed server-state/query scope, accessible grids/charts, loading/error/DQ states and URL state. Start one approved metric family; avoid eight mostly empty pages.
- **Dependencies:** stable API/security/jobs, approved metric and interaction contracts.
- **Files/modules affected:** proposed `frontend/`, API contract generation, E2E tests. No replacement of desktop KRA/OKR/ID-card workflows yet.
- **New components:** Router/Query/Table+Virtual/ECharts adapters and reusable controls; build tool and locked dependencies.
- **Preserved:** backend semantic compiler, authorization, existing desktop workflow as fallback.
- **Tests:** G13 plus component/keyboard tests, delayed-response races, scoped export, browser memory/point limits, realistic network perceived latency.
- **Acceptance:** same values/scope/provenance across linked views; accessible operation; meaningful empty/error states; no browser full-data download; pilot users can complete defined tasks.
- **Rollback:** disable web workflow flag; retain service compatibility and desktop access policy.
- **Risk:** cosmetic success hiding analytical differences. Require task-based and numerical parity evidence together.

## Stage 4B — Workflow migration and parallel validation

- **Objective:** expand only proven workflows while maintaining operational continuity.
- **Scope:** migrate imports/DQ, saved views, reports, then insights; separately assess KRA/OKR, attendance reconciliation, ID cards and auxiliary workflows for web migration, desktop retention or explicit retirement. Each gets its own change and owner signoff.
- **Dependencies:** 4A pilot, workflow inventory and support/runbook readiness.
- **Files/modules affected:** corresponding frontend/API adapters and existing workflow modules; proposed migration reconciliation tooling.
- **New components:** approved missing workflow adapters, comparison reports and support diagnostics; predictive features are separate later proposals.
- **Preserved:** old artifacts, golden fixtures, desktop for unmigrated workflows, deterministic pattern algorithms and historic snapshots subject to retention.
- **Tests:** G14; at least two representative full reporting cycles, correction/retraction cycle, source outage, export reconciliation and recovery drill; new and legacy read from equivalent frozen inputs.
- **Acceptance:** no unexplained numerical/scope differences; all critical workflows have owner acceptance and tested fallback; documented intentional differences versioned and communicated.
- **Rollback:** route selected workflows back; freeze new writes if compatibility uncertain and recover via approved replay. Never have two unsynchronized authoritative writers.
- **Risk:** dual-running inconsistent source periods or policy versions creates false discrepancies. Compare pinned releases/as-of/policy, not today's mutable outputs.

## Stage 5 — Controlled cutover and retirement

- **Objective:** make the web service authoritative only after complete evidence.
- **Scope:** approved write/read cutover, source schedules, user access, final reconciliation, archive desktop as needed, remove redundant code only after retention window and owner approval.
- **Dependencies:** G01–G14 relevant to every migrated workflow; accepted operations ownership, support and recovery SLOs.
- **Files/modules affected:** deployment/configuration, release manifests/runbooks, legacy entry points only after inventory approval.
- **New components:** cutover checklist and restore/replay package; no required new infrastructure.
- **Preserved:** historical evidence, audit, reproducible releases and any explicitly retained local workflows.
- **Tests:** production-like rehearsal, login/authorization/export smoke, restore, active-job handling, source watermark and final counts reconciliation.
- **Acceptance:** G15; service/data/security owners sign documented result. No retirement based solely on matching dashboard screenshots.
- **Rollback:** time-bounded tested application rollback and manifest restore; new writes since cutover replayed or safely reconciled. Define the last lossless rollback point before switching; beyond it use forward recovery or maintenance mode, not blind old-binary launch.
- **Risk:** schema and data incompatibility. Expand-contract migrations retain old read compatibility during rollout; destructive schema cleanup comes only after rollback window closes.

## Explicit later work

ClickHouse, Redis, queue broker, HA expansion, distributed traces, advanced forecasting and prescriptive scenarios are gated follow-ups, not hidden prerequisites. Each needs a measured problem and revised ADR. Stage 2's immediate objective remains correctness/contracts/baseline; it does not install React, introduce production databases or begin the broad UI rewrite.
