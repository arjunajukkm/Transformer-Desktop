# Performance and background execution architecture

Stage 1 design targets, not measured future-platform results. [Architecture](01_TARGET_ARCHITECTURE.md), [data model](02_DATA_ARCHITECTURE.md), [gates](08_ACCEPTANCE_GATES.md).

## Baseline and target workload

Stage 0 single-run evidence: 10K rows prepared in 3.959 s, cold overview 0.462 s, cold trend 4.678 s, final sampled RSS 230.53 MiB. At 100K: preparation 36.229 s, overview 5.468 s, trend 43.651 s, final RSS 906.22 MiB; source frame 79.069 MiB and fact frame 169.891 MiB. These are not percentiles or peak-memory measurements. The 10K run overlapped tests. Neither run measures browser/API/Excel cost. Do not extrapolate a precise 10M runtime from two observations.

Root risks include full `to_dict(records)` object expansion (`data_foundation.py:419`), repeated scope computations, the V2/V5 cache-key mismatch (`snapshot_bridge.py:527,765`), omitted as-of identity and unbounded pattern scopes. The target changes execution shape rather than merely caching the same unbounded work.

Initial capacity assumption requiring service-owner approval: 25 simultaneously active users, 10 aggregate requests/second, two heavy jobs, 1M routine online events and a 10M supported online test. Fifty million retained historical events can include cold Parquet; cold rehydration is explicitly asynchronous. Dataset row count, query selectivity, employees, months and concurrent work are separate axes.

| Class | Proposed target | Measurement boundary |
|---|---|---|
| Common filter | P95 <300 ms perceived where feasible | User commit → correct chart/table paint; controlled client and network profile |
| Normal analytical API | P50 <150 ms | API ingress → last response byte, auth/cache/serialization included |
| Complex cached dashboard | P95 <500 ms | Same API boundary, cache-hit class explicitly labeled |
| Interactive hard bound | 2 s DB statement, 3 s API deadline initially | Cancel/error or explicit async route; no false empty success |
| UI acknowledgment | <100 ms target | Input feedback/skeleton only; not counted as completed query |
| Async jobs | Per-class budget established at benchmark | Queue delay and execution reported separately |

Record P50/P95/P99 and error/timeout rates for cold, warm and mixed workloads separately. Never claim the cached SLO from a test that omits authorization or serializes an empty payload. Initial performance gate also requires <1% unexpected failures at the agreed load; intentional validation/permission denials are separate. Thresholds become release commitments only after hardware, network, query mix and capacity are signed.

## Bounded query plan

Resolve immutable release and authorized QuerySpec → select eligible aggregate or fact plan → push predicates and select columns in storage → aggregate → bounded typed result. No full dataset DataFrame in API memory. Parameterized SQL, entitlement-aware joins and grain checks are mandatory. Employee-day/request joins cannot multiply rows. Rates combine numerators/denominators, not average displayed percentages. Exact medians and high-cardinality distincts may require heavier plans; do not substitute approximate values silently.

Use tenant/date/entity indexes and inspect real plans, rows read, buffers, temporary bytes and estimates. Partition pruning helps time-bounded scans; it does not fix unrestricted sort/group work. Start with a few measured common aggregate shapes (month × permitted organizational scope × metric components), not every dimension combination. Aggregate materialization is a versioned publication job; ordinary materialized-view refresh is not assumed to be incremental. [PostgreSQL materialized views](https://www.postgresql.org/docs/current/rules-materializedviews.html).

Incremental recomputation follows dependency closure: corrected event → complete employee-day/request → employee-month WFH context → impacted organizational benchmark/cohort → dependent trend/pattern partitions. Use old and new attribution for moved/retracted facts. Non-invertible statistics rebuild the affected partition or use explicitly governed state. Publish compatible fact and aggregate versions together, never a new denominator with an old numerator.

| Surface | Initial bounded contract; benchmark may lower limits |
|---|---|
| Explorer | 100 default/500 max rows per page; signed keyset cursor; 5 cached pages/2,500 rows browser maximum |
| Dashboard | ≤20 series, ≤2,000 total points, ≤1 MiB uncompressed response; require coarser period when exceeded |
| Filter/facet | ≤100 returned values/page; bounded search; exact total optional and independently budgeted |
| Request | ≤50 filter clauses, ≤1,000 values per membership filter, allowlisted operations; reject excessive AST complexity |
| Interactive period | Default 12 complete months; longer supported only when plan fits budget |
| Export | ≤100K rows synchronous-format class but still background job; larger partitioned exports up to proposed 1M/job subject to permission and quota |
| XLSX | Keep sheet rows below Excel's format limit including headers; split intentionally or choose CSV/Parquet package; never truncate |
| All jobs | Explicit input/output/temp-byte ceilings, deadline and progress checkpoint; exceedance is visible failure or approved resubmission |

Large exports do not become API streaming queries holding scarce connections for hours. Format workers read bounded batches from a pinned release. Compression reduces transfer, not query work; record uncompressed and wire bytes. Typed vector/batch serialization avoids per-record object graphs; cap strings and lineage summaries. Frontend virtualizes rows/columns, cancels obsolete requests and limits chart points; browser never receives millions of records.

## Cache correctness

Start with bounded per-process LRU, proposed 128 MiB/512 entries with per-entry 1 MiB ceiling and short freshness TTL. Evict by bytes and entries; account for retained object overhead. Sensitive detail may bypass server cache. Key contains tenant, authorization scope fingerprint/version, normalized QuerySpec, dataset release, metric version, policy version, governance/organization version, analysis-as-of, timezone and representation version. Do not key only by visible filters. TTL is not a security invalidation mechanism.

Authorize before lookup and delivery. Immutable releases eliminate in-place data mutation; active-release pointer selects a new namespace. Entitlement changes invalidate reuse immediately. Deduplicate concurrent same-key work with bounded single-flight and timeout; never cache failures as empty results. Negative/no-data responses carry their semantic state. Stamp UI requests with monotonically increasing selection generation; stale completed response cannot repaint a newer view. Cancel backend work when feasible, but retain display fencing even if cancellation arrives too late. Pinned snapshot sessions show a new-data notice rather than silently mixing versions.

Add Redis only if measured multi-replica duplicate work materially violates SLOs and a shared cache improves end-to-end results enough to justify network, serialization, isolation and operations. Cache warming is optional and must obey budgets and authorization. No unbounded per-user filter cache.

## Memory and admission budgets

Provisional benchmark reference: API/worker host 8 vCPU/16 GiB, PostgreSQL host 8 vCPU/32 GiB, SSD storage, same-region object store; document exact hardware rather than treating these as procurement requirements. Test co-located alternative separately. API process ceiling 512 MiB RSS with ≤128 MiB cache; initially two processes. Worker ceiling 2 GiB each with two active heavy workers, bounded 10K–50K-row batches adjusted for width. Reserve OS, serialization, decoder and temporary buffers; measure actual peak RSS and container memory, not just DataFrame size. DB memory is separately budgeted.

Start with maximum 20 API DB connections total across replicas plus four worker connections, then tune against plans/load. Pool size is an aggregate deployment budget, not a per-replica multiplier. Proposed small query `work_mem` (e.g. 8 MiB) must be validated because PostgreSQL allocates it per operation and concurrent/parallel operators can multiply use. Bound temporary disk and statement time; a connection count alone is not a memory ceiling. [PostgreSQL resource consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html).

Use admission lanes: interactive requests have priority and reserved DB capacity; import/export/rebuild workers have concurrency and per-tenant quotas. Return 429 with retry guidance or queue jobs when capacity is unavailable. Do not spawn unbounded threads/processes per request. Batch readers spill only to quota-controlled encrypted local scratch with cleanup; they must not fall back to reading all input after a spill failure. Polars/DuckDB candidates must respect worker limits and preserve complete group semantics.

## Durable jobs

PostgreSQL job ledger plus separately supervised Python worker processes, same application release. Claim queued jobs in a short transaction using row locks/`SKIP LOCKED`, assign attempt and lease/fencing token, commit before computation. Do not retain the lock for job lifetime. `SKIP LOCKED` is suitable for queue-like consumption, not a general consistent analytical read. [PostgreSQL SELECT locking](https://www.postgresql.org/docs/current/sql-select.html).

| State | Meaning and permitted transition |
|---|---|
| QUEUED | Validated work awaiting capacity; → RUNNING or CANCELLED |
| RUNNING | Claimed attempt with heartbeat; → SUCCEEDED, FAILED, CANCELLED or PARTIAL; expired lease may requeue under retry policy |
| SUCCEEDED | Complete verified artifact/publication and audit metadata committed |
| FAILED | Exhausted retries, invalid data or permanent fault; structured actionable error |
| CANCELLED | Cooperative stop acknowledged; unpublished artifacts cleaned; completed publication cannot be undone by renaming state |
| PARTIAL | Explicit incomplete coverage/output, never indistinguishable from success; normally no active publication |

Persist job type, tenant/requester, canonical input/query hash, pinned versions, idempotency key, attempt count, lease owner/token/expiry, heartbeat, phase, completed/expected units, cancellation request, output refs, timestamps and sanitized error code. If total unknown, report phase/count and indeterminate progress rather than fake percentage.

Proposed heartbeat every 10 s, lease 60 s; long native operations must heartbeat independently or have a compatible lease. Expired worker loses publication authority even if it later returns. Retry transient timeouts/rate limits with bounded exponential backoff and jitter (initial maximum three attempts, honor provider Retry-After); validation/auth/schema faults require intervention. Retry at-least-once computation with idempotent writes; do not claim exactly-once execution. A successful committed idempotency key returns the prior result.

Cancellation sets durable request, stops new page/batch work, cancels DB statements and checks at phase boundaries. Job controller terminates a nonresponsive isolated process after grace period; no partial publication. Resolve cancel-vs-commit in the publication transaction: whichever wins determines terminal outcome; SUCCEEDED may report cancellation arrived too late. Recheck authorization before export execution and retrieval. PARTIAL carries missing ranges/count evidence and requires explicit policy-approved publication, never automatic success after hitting a pagination cap.

## Observability and measurement

Structured request/job IDs correlate API, query and workers. Capture route/query class, elapsed auth/plan/cache/DB/serialization time, hit/miss/eviction, rows scanned/returned, bytes, peak memory, CPU, temporary spill, queue age, attempt count, cancellation latency, import expected/received/unique/rejected counts and release/policy/metric versions. Source total unknown is null/UNKNOWN, not received count relabeled expected. Record error codes and coverage state; alert on incomplete publication attempts, queue starvation, failed backups, memory pressure and SLO burn.

Use low-cardinality metric labels; detailed opaque query/job IDs live in restricted logs. No employee identifiers, raw filters or row data in metrics/logs. Initial request correlation plus metrics is enough; sampled distributed tracing is optional when it resolves demonstrated multi-process diagnostic gaps.

## Million-row benchmark design

Generate deterministic synthetic datasets with manifests, random seed and expected invariants. Suggested primary shapes below are test parameters, not actual workforce estimates. Event count does not equal unique employee-day count.

| Rows | Employees | Time span | BU / departments / managers | Purpose |
|---|---:|---|---|---|
| 10K | 500 | 1 month | 5 / 20 / 50 | Fast correctness/performance smoke |
| 100K | 5,000 | 3 months | 10 / 100 / 500 | Reproduce current bottlenecks |
| 1M | 20,000 | 12 months | 20 / 300 / 2,000 | Routine serving and concurrency gate |
| 10M | 100,000 | 36 months | 50 / 1,000 / 10,000 | Supported online capacity and corrections |
| 50M optional | 250,000 | 84 months | 100 / 3,000 / 25,000 | Cold retention, compaction, restore and rehydration |

For each scale vary independently: balanced versus 80%-in-one-BU skew; narrow versus 4-KiB text; sparse/dense request fanout; 0/10% split days; 0/5% duplicate observations; 0/2% corrections/retractions; org moves; high-cardinality employee filters; missing IDs/dates; policy boundary months; quarter/month-crossing requests; repeated imports. Include adversarial single employee with very large history to expose group-memory assumptions. Test correction closure, not only append throughput.

Run cold application/cache and separately documented DB/OS-cache conditions; never flush shared production caches. Warm-up then at least 1,000 measured requests per interactive class, three repeated runs, 1/5/25 concurrent users and saturation sweep. Mix overview, trends, scoped Explorer/search/facets, exports, sync and correction jobs. Include a ≥30-minute steady-state run and longer soak to expose cache growth. Record seed, commit, dependency lock, hardware, engine config, data shape, SQL plans and all target metrics. Browser perceived tests use an explicit network/client profile; backend results alone cannot establish UX SLOs. Load tools can encode pass/fail thresholds rather than visual impressions: [k6 thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/).

Escalation: first repair plans/pruning, aggregate choice and concurrency. Benchmark DuckDB for isolated batch/cold reads; Polars for identified transform bottlenecks. Consider ClickHouse only if tuned PostgreSQL fails the signed 10M/concurrency SLO or capacity cost and a parity-tested prototype materially wins (proposed ≥2× P95/throughput benefit at comparable cost). Consider broker/Redis only when ledger/cache contention is measured. Fifty million retained rows alone triggers none of these components.
