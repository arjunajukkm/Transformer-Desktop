# 02 — Data Architecture

Stage 1 proposal • No database, migration or runtime change created. Deployment choice is in [01](01_TARGET_ARCHITECTURE.md); metric semantics in [03](03_METRIC_SEMANTIC_LAYER.md); release gates in [08](08_ACCEPTANCE_GATES.md).

## Invariants and current evidence

Source event, employee-day, request and employee are different grains. Every persistent/query contract identifies its grain and tenant. No generic “record count” can silently stand for attendance days, people or requests. The existing `data_foundation.py` entities, `validation.py` governance flags, `requests.py` reconstruction, `policy.py` effective-date rules and tests survive as specifications/adapters.

Current `historical_sync.py:448` and `:510` deduplicate on employee/date: both paths must preserve legitimate split-day events. `data_foundation.py:424` assigns positional IDs, which are useful source-row locators but not stable cross-ingestion business identities. Full `to_dict(records)` at `:419` is not the proposed storage model. `snapshot_service.py:292` provides the useful principle of building privately and atomically replacing the active version; extend that principle to durable releases.

## Canonical grains and keys

| Entity | Exactly one row represents | Proposed identity and relationships | Important constraints |
|---|---|---|---|
| Source artifact | One received immutable file/API page object | tenant + artifact_id; content checksum, connector/account, fetch run, schema fingerprint | Original bytes preserved under retention rules; repeated identical file has one content object and multiple receipt records |
| Source observation | One occurrence in an artifact/page | observation_id; artifact_id + sheet/page + row/occurrence locator | Never drop lineage because two rows look the same |
| Source event revision | One revision of one logical source event | tenant + event_id + revision_id; source native ID if stable; references observations | Multiple same-day events permitted; payload hash detects revision, not identity |
| Employee-day fact | One employee's analytical day under one derivation version | tenant + employee_id + local_date + fact_generation | References all contributing event revisions; typed category quantities, flags and DQ |
| Request revision | One logical leave/WFH/regularization application at one known revision | tenant + source/account + request_id + revision; inference algorithm/confidence if no source ID | A multi-day request is not multiplied by joining daily events |
| Employee | Stable person/employment identity mapping | tenant + employee_id; source aliases with validity | Name/email not a key; rehires/ID reuse require explicit employment mapping |
| Organization dimension | One organizational entity version | org_id + version, parent, effective/known intervals | Region/BU/department/location/manager identifiers, no name joins or assumed hierarchy |
| Employee assignment | One effective organizational membership version | employee_id + effective interval + known interval | No overlapping primary assignment unless domain permits; fact joins must not fan out |
| Policy | Approved rule set valid in a business interval | policy_id + immutable version + effective_from/to | Rule selection explicit; no in-place threshold changes |
| Metric | One immutable measure definition | metric_id + version | Grain, inputs, eligibility, aggregation, DQ and lineage contract |
| Aggregate | Sufficient statistics at declared metric/dimension/time grain | generation + metric/version + policy/version + bucket + dimension keys | Sum/count, flags or approved sketch; not unweighted average of averages |
| Snapshot / dataset release | Consistent manifest of published data/derivation versions | dataset_id + release_id; parent, source watermark, manifest digest | Immutable after publication, active pointer changes atomically |
| Historical version | What was valid and what was known at a chosen time | effective interval + recorded interval + release membership | Event correction history distinct from query's business date |

Every table carrying protected data has tenant_id, classification and provenance appropriate to its grain. Tenant IDs are server-selected from identity membership, never accepted as authority from a browser payload. Primary/foreign keys include tenant scope; storage layouts must not permit a foreign-tenant dimension join.

## Identity, duplicate governance and idempotency

1. **Native IDs available:** namespace by tenant, connector instance/source account, entity type and source-native ID. Do not incorporate mutable category, quantity, employee name or timestamp into event identity. A new payload/source revision creates a new revision of the same event; repeated same revision/hash only creates receipt lineage if needed.
2. **Native IDs absent (Excel/report rows):** stable observation identity = source artifact content digest + sheet + row/occurrence. This guarantees retry identity for identical bytes, not identity across rearranged/corrected exports. A normalized content fingerprint is a *matching candidate*, not a universal unique key. Include occurrence multiplicity; two indistinguishable half-day rows can be legitimate.
3. **Cross-file reconciliation:** record source_mode explicitly: append events, incremental changes, or authoritative full replacement for a declared coverage slice. A replacement is accepted only with complete coverage proof and reviewed reconciliation rules. Ambiguous overlapping files are quarantined or preserved with DQ status pending stewardship; never apply employee/date last-wins.
4. **No source key, changed payload:** do not guess that an old event was corrected from matching employee/date. Use a source-provided correction mapping, approved slice replacement or steward decision linking supersedes_event_id. Algorithmic candidate matches include confidence/reason/version and are reversible.
5. **Import idempotency:** unique key includes tenant, connector/source, caller idempotency key, declared coverage, input checksum and parser/normalization version. Same key + different body returns conflict. Retry produces the same logical publication; a new parser version is a new derivation, not duplicated source events.
6. **Analytical duplicate exclusion:** preserve the existing tested exact/cross-file duplicate rules initially as a versioned governance decision with `include_in_analysis`, exclusion_reason and duplicate_of links. It is separate from storage deduplication. New identity rules cannot silently reclassify identical-looking rows without an approved metric/governance version.

Example: event A is Present 0.5 and event B Leave 0.5 for employee E/date D. Store both. Fact F totals 1.0 with both categories and A/B lineage. Retry of the artifact adds no analytical quantity. A corrected B=0.25 is B revision 2; a later release recomputes F=0.75 without deleting revision 1. If the source retracts B, append a tombstone revision; future releases exclude B, prior authorized releases remain reproducible unless privacy retention requires redaction. Missing B in an incomplete API response does **not** mean deletion.

## Schema and layers

**Raw:** private originals/API pages plus normalized Parquet observations. Persist original source values and source timezone; restrict raw access more strongly than aggregate access. API pages retain request coverage/cursor/page counts and sanitized source response metadata, never authorization headers. HR payload stays in protected data storage, not logs.

**Curated:** PostgreSQL typed event revisions, employees/assignments, requests, employee-day facts, quality findings and lineage bridges. Dates are DATE for local attendance day; instants are timezone-aware UTC timestamps with source zone/precision retained. Quantities use fixed precision decimal with null distinct from zero. Durations use integer minutes/seconds at source precision. Strings/enums preserve unknown status plus raw value. Flexible source-specific JSON is bounded and not the primary interactive filter schema. Reject incompatible type changes; never coerce failed parsing to compliant/zero.

**Aggregate:** published statistic tables for approved grains and dimensions (employee/day or authorized org/day where safe, then month). Definitions and refresh dependencies come from metric contracts. Current-domain pandas may be a small-cohort oracle, not a giant persistent object graph. No Python dataclass instance for every retained row in an API process.

Conceptual tables, not executable DDL:

- `tenant`, `employee`, `employee_source_identity`, `organization_version`, `employee_assignment_version`.
- `ingestion_run`, `source_receipt`, `source_artifact`, `source_observation`, `event_identity`, `event_revision`.
- `request_revision`, `request_event_link`, `employee_day_generation`, `fact_event_link`, `quality_finding`.
- `dataset_release`, `release_partition`, `derivation_run`, `metric_definition`, `policy_version`, `aggregate_generation`.
- `entitlement`, `saved_view`, `job`, `job_attempt`, `export_artifact`, `audit_event` (see security/performance documents).

Avoid a wide mutable EAV fact model. Schema migrations use reviewed additive changes, backfill and validation before tightening constraints. Event identity uniqueness independent of date is held in the identity table; date-partitioned revision/fact keys include partition keys as required. Do not assume a globally unique index across date partitions is automatically enforced.

## Historical organization and two time axes

Track `source_occurred_at`, `source_updated_at`, `received_at`, `recorded_from/to` (when the platform knew a revision), and `effective_from/to` (business validity). A source timestamp is not a trustworthy total ordering unless its contract guarantees it; equal/out-of-order versions use source sequence or an explicit conflict rule.

Employees moving BU retain stable employee identity. Facts bind to the organizational assignment effective on the event day under the chosen dimension version. Request metrics declare whether attribution follows application date, request start date or another explicit point. A transfer within a month cannot be handled by an arbitrary modal/latest name. Existing WFH code chooses the last distinct BU encountered (`kpi_engine.py:310`); preserve that as a legacy conflict pending an approved attribution rule, not as the universal target default.

Three query controls are separate:

- `business_period`: which days/requests belong in the answer.
- `knowledge_as_of` / pinned release: which corrections/statuses had been received and published.
- `analysis_as_of`: date for age calculations, e.g. pending approval age; never implicit server today in reproducible reports.

Policy valid time is selected per metric (leave request start currently controls enforceability), and policy version is included in result lineage. An explicit restatement under a newer policy/assignment version is a different run. Historical “as known then” is not reconstructable before the first retained observation unless the source supplies history. Mark unavailable history; do not invent it from current approval state.

## Versioned publication without copying the entire warehouse

Use copy-on-write **partition generations** and a release manifest. A release maps logical tenant/grain/period partitions to physical generation IDs, plus dimension/policy/normalizer versions and source watermarks. New release R2 reuses untouched generations from R1; only affected partitions are rebuilt. PostgreSQL queries resolve a small manifest into allowed generation IDs plus date predicates. Index `(tenant_id, period, generation_id, ...)` patterns after plan measurement. Old generations remain until no retained release/job/view references them and retention permits collection.

Different grains need different partition keys: event local month, employee-day local month, request application/start month as defined, and employee-month allowance. No assumption that one request fits one month. A correction identifies dependency closure: affected event days, both old/new org assignments, complete employee-month allowance windows, entire request clusters across boundaries, relevant benchmark populations and pattern lookback windows. Recompute those dependencies, not just the upload's file month. Global percentiles/rankings may require a broader rebuild.

Hot current publications remain PostgreSQL-serving projections. Append-only historical revisions and older generations can be compacted to Parquet for cold replay. Metadata explicitly records whether a release is online or requires asynchronous rehydration. This supports 50M retained events without promising 50M arbitrary cold scans under 300 ms. Snapshot manifests are not permanently open SQL transactions.

## Ingestion and atomicity protocol

1. Register run/idempotency key and expected coverage; capture previous active release. Stream upload/API pages to bounded raw staging. Validate format/size and checksum.
2. Fetch all pages with terminal cursor/count proof. Record requested/received/unique/duplicate/quarantined counts, source totals if supplied and freshness. A hard page cap is an explicit incomplete error, never success (`keka_data_fetcher.py:413` is the current defect).
3. Validate schema and normalize in bounded batches. Group-sensitive logic gets a complete logical group or persisted continuation state, not arbitrary chunk-local calculations. Link identity/revisions and reconcile counts without destroying observations.
4. Build staged curated/fact/aggregate generations. Verify golden invariants, event coverage and numerator/denominator reconciliation. Failed/partial source slices do not replace known-good complete slices.
5. Upload final immutable objects under unique content/generation keys; verify checksums/readability. Finish staged database writes before publication. No rename-as-transaction assumption for object storage.
6. In a short PostgreSQL transaction, verify the run's lease/fencing token and expected parent release, register immutable manifest/object references and flip active release via compare-and-swap. Conflicting concurrent publishers rebase/revalidate, never blind last-wins. Add success/audit metadata in the same transaction.
7. After commit, release is visible. Notification/cache warmup is retryable and not part of correctness. Crash before commit leaves unreachable staged generations; janitor removes them after a grace period only if unreferenced. Crash after commit retries safely and cannot double publish.

There is no distributed transaction across PostgreSQL and object storage. Writing/verifying immutable objects **before** a single visibility transaction, plus referenced-object retention and reconciliation, makes publication recoverable. Missing referenced objects trigger degraded release/read failure and operator recovery, not silent empty results.

API sync is initially scheduled batch, not streaming/Kafka. Use source cursors/watermarks only after successful publish and overlap windows for late corrections. Pagination sessions without stable snapshot semantics require source-count reconciliation/re-fetch strategy. If the provider cannot prove completeness, label coverage UNKNOWN/PARTIAL and prevent a supposedly complete release. Product may explicitly publish partial slices with a coverage banner and locked known-good other slices; default is preserve the active complete release.

## Indexing, partitioning, retention and recovery

- PostgreSQL: tenant-first indexes for entitlement-safe employee/date keyset access; dimension/date indexes for common filters; generated searchable normalized columns where justified. Monthly fact partitioning is a candidate at 10M, based on measured pruning/maintenance; do not create thousands of tiny tenant partitions.
- Parquet: tenant/grain/year/month, sorted by high-value date/entity keys where useful. Start with 128–512 MiB compressed objects and bounded row groups as benchmark parameters, not guarantees. Do not partition by employee. Compact small batches after publication without changing logical IDs/results; manifest distinguishes physical rewrite from semantic revision.
- Retention is class-specific: raw, curated revisions, aggregates, audit, exports and backups. Default export expiry proposal 24 hours, subject to policy; raw HR retention requires owner approval, not indefinite accumulation to meet a scale goal. Legal holds and deletion tombstones must propagate to projections, caches and recoveries.
- Restore PostgreSQL plus all objects referenced by the recovered manifest. Proposed RPO ≤1 hour/RTO ≤4 hours must be signed by the service owner and tested. Release rollback flips to an earlier valid manifest after authorization/compatibility checks; never rolls back security revocations.
- Backups are encrypted/restricted and restore-tested. Reapply deletion ledger/retention policy after backup restore. Source outages preserve last-known-good data with age/coverage markers. Schema evolution versions parsers/migrations; old raw artifacts remain readable by their parser version until retention ends.

## Data acceptance examples

Repeat identical import: no new analytical rows/quantities. Same native ID with revision: one current revision, old revision traceable. Two half-day categories: both retained. Retracted event: removed from new facts only, subject to historical access. Late correction: all dependent request/month/benchmark results restated with new version. Moved employee: correct historical attribution, no duplicate fact through dimension join. Failed page 21: PARTIAL/FAILED, previous release unchanged. Worker crash between object write/metadata commit: no half-visible release. Malformed date/quantity: DQ/unknown, not zero or compliance success.

Storage capabilities informing this proposal: [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html), [DuckDB Parquet projection/filter pushdown](https://duckdb.org/docs/current/data/parquet/overview). The temporal model, publication protocol and identity rules above are application design recommendations, not claims that a file format provides them automatically.
