# 03 — Governed Metric Semantic Layer

Stage 1 proposal. Existing formulas are evidence, not silently rewritten requirements. [Data grains](02_DATA_ARCHITECTURE.md), [authorization](04_SECURITY_ARCHITECTURE.md) and [execution limits](05_PERFORMANCE_ARCHITECTURE.md) are part of every metric contract.

## One definition, many surfaces

The catalogue owns metric ID/version, grain, eligibility, aggregation, date attribution, policy selection, DQ/unknown handling, formatting, comparison direction and lineage. Dashboard, trends, benchmarks, Explorer summaries, exports and future reports submit the same `QuerySpec` to the same application query service. Export changes serialization and delivery, not scope or arithmetic. Browser labels cannot redefine a percentage denominator.

Authoring is version-controlled typed definitions reviewed by a domain owner and engineer. Published catalogue versions are immutable. No arbitrary Python/SQL expressions entered by end users. An allowlisted semantic expression tree maps to parameterized SQL or a named tested domain function. AST validation rejects incompatible grain/dimension joins, unbounded fanout, unsupported rollups and unavailable fields. SQL uses identifiers from the catalogue, not interpolated browser strings.

Lifecycle: DRAFT → VALIDATED (contract/golden tests) → APPROVED → ACTIVE → DEPRECATED. Metric changes that affect results create a new version and explicit backfill/restatement decision. A legacy metric can remain active under a qualified legacy ID for comparison; two meanings never share one ID. Product ownership/sign-off is required before activating unresolved definitions. Definition checksum and implementation build digest are recorded separately.

## Required catalogue model

| Field | Meaning / validation |
|---|---|
| metric_id, name, description, version | Stable machine identity, precise human meaning and immutable version |
| grain | source_event / employee_day / request / employee_month / employee_BU_scope, etc. |
| unit | percent, day_equivalent, calendar_days, minutes, employees, requests or observations |
| numerator, denominator | Typed expression or explicitly not-applicable; expose sufficient statistics |
| eligibility_rules | Included events/facts and validity predicates; benchmark population separately specified |
| date_attribution | Event local day, request start, application date or explicit period; timezone/calendar |
| aggregation_behavior | Sum, ratio-of-sums, distinct, sum/count mean, exact median, context-dependent; allowed rollups |
| policy_version | None, explicit version, or effective-date resolution rule with manifest |
| unknown_handling | Null/unknown separate from zero; missing dimensions use explicit unknown member |
| dq_exclusion_behavior | Rule IDs and total_applicable/evaluable/excluded counts; severity not inferred by UI |
| allowed_dimensions | Allowlisted join path, cardinality, historical attribution and sensitivity |
| formatting, comparison_direction | Unit-aware numeric format and higher/lower/neutral guidance, distinct from formula |
| source_lineage | Input grain/columns/revisions, parser/governance/policy/derivation versions and drill path |
| owner, status, tests | Business approver, lifecycle state, golden case IDs and implementation parity |
| evaluation_scope | Data needed to calculate vs user display scope, e.g. complete employee-month |
| security_behavior | Required permission, suppression policy, allowed benchmark coverage; never widen entitlements |
| coverage_behavior | Incomplete month/source handling and minimum evidence; not merely whether result is non-null |
| dependency_versions | Fact schema, rule engine, organization assignment, calendar and code version |

`numerator`/`denominator` may be sum and observation count for a mean. For a median they are explicitly null and a valid-observation count is returned; do not invent additive statistics. Labels such as “compliance” are not a substitute for a typed unit.

## Mapped repository contracts

Common inherited fields for all examples below: status `DRAFT_MIGRATION_CONTRACT`; version `legacy-v1` until approved; owner `HR metric owner (to be named)`; tenant scope mandatory; allowed dimensions limited to mapped BU/department/manager/employee/time where the existing calculation supports them; region only after authoritative assignment mapping (not a present inferred field); lineage includes release, source event revisions, normalization/governance and function reference. Historical dimension semantics must be approved before new labels claim historical accuracy. Changes listed as conflicts below are **not** applied to these compatibility definitions.

### M01 — Missing swipe rate (employee-day)

```yaml
metric_id: attendance.missing_swipe_rate
version: legacy-v1
name: Missing Swipe Rate
description: Percentage of evaluable eligible employee-days flagged for missing swipes.
grain: employee_day
unit: percent
numerator: count(is_eligible_attendance_day AND is_metric_evaluable AND has_missing_swipe)
denominator: count(is_eligible_attendance_day AND is_metric_evaluable)
eligibility_rules: existing build_employee_day_facts flags, frozen by golden cases
date_attribution: employee_day.local_date; calendar month in configured source timezone
aggregation_behavior: 100 * sum(numerator) / sum(denominator); never average displayed rates
policy_version: not_applicable; governance_rule_version required
unknown_handling: null when denominator=0; no data is not 0 percent
dq_exclusion_behavior: eligible_but_not_metric_evaluable excluded; return their count
allowed_dimensions: [event_time_BU, event_time_department, event_time_manager, employee, month]
formatting: percent_2_decimal
comparison_direction: lower_is_better
source_lineage: workforce_intelligence/trends.py:652 and metrics.py:27
evaluation_scope: authorized employee-days in business_period
security_behavior: same authorization for numerator and denominator; cohort suppression if configured
coverage_behavior: show source coverage and excluded counts; partial never labeled complete
```

Source `trends.py:669`–`:685` explicitly counts eligible/evaluable facts and returns `_safe_rate`, which rounds to two decimals and returns None for nonpositive denominator (`metrics.py:324`). New SQL must reproduce existing fact flags, including split-day/AR rules; fixing a flag is a separately approved semantic correction.

### M02–M07 — Additional precise mappings

Each row inherits the common fields above and explicitly supplies the remaining contract behavior.

| Contract | Grain, unit, numerator/denominator | Eligibility, attribution, aggregation | Policy, unknown/DQ, formatting/direction | Lineage and unresolved limits |
|---|---|---|---|---|
| `attendance.absence_rate@legacy-v1` — Absence Rate | employee-day; percent; count(evaluable eligible `has_absent`)/count(evaluable eligible) | Same denominator as M01; event-day month; ratio-of-sums | No attendance policy inferred; DQ exclusions same as M01; null empty denominator; 2 decimals; lower better | `trends.py:652`/`:678`; same allowed dimensions and coverage as M01 |
| `attendance.regularization_rate@legacy-v1` — Regularisation Rate | employee-day; percent; count(evaluable eligible `has_regularization`)/count(evaluable eligible) | Same fact eligibility/date; ratio-of-sums | Governance version; null for no evaluable days; DQ counts; 2 decimals; **neutral**, not automatically misconduct | `trends.py:680`; differs from source-row export regularization/total rows |
| `leave.application_timing@legacy-v1` — Leave application timing | reconstructed leave request; calendar days; sum(applied_on − request_start_date)/valid date-pair count | Exclude DATA_QUALITY_UNCERTAIN requests; bucket request start month; aggregate underlying sum/count, round mean to 1 decimal | Policy version affects evaluation metadata, but value is timing, not compliance percentage; missing date skipped from mean and reported as unobserved; lower better per current catalogue | `trends.py:445`, especially `:479`; old UI ID is `leave_application_compliance`; explicit alias, not a rate |
| `leave.post_policy_compliance@legacy-v1` — Post-policy leave compliance | request; percent; count(policy_compliant true)/(post-policy applicable − DQ-uncertain) | Request-start date determines post-policy; numerator from evaluated requests; ratio-of-sums | Existing 2026-10-01 rule set, PL quantity notice buckets and non-PL ≤3-day lag; missing application date is noncompliant (not automatically DQ exclusion); null denominator; 2 decimals; higher better | `metrics.py:387`; `policy.py:51`; allowed request-start org attribution pending approval |
| `wfh.additional_days@legacy-v1` — WFH days above allowance | employee-calendar-month; day-equivalent; sum(max(0, monthly_WFH_quantity −3)); denominator N/A | Scoped employees/months, full available employee-month evaluation; preserve separate within-display-scope quantity; sum employee-month excess once | Default allowance 3; current missing/nonpositive quantity becomes 1.0; current code not a universal DQ exclusion path; partial observed months flagged; day-equivalent decimal; lower better as allowance signal | `kpi_engine.py:127`, `:191`, `:261`; do not sum BU versions of same employee-month or silently change unknown fallback |
| `approval.average_turnaround_rows@legacy-v1` — Mean approval turnaround (row-weighted legacy) | **included evaluated source row**, not request; days; sum(non-null turnaround of approved rows)/valid observation count | Top-level included rows; application-month bucket; mean and round 2 decimals | Approval-state normalization; null if no valid observations; no blanket request DQ exclusion added; negative source durations retained if currently admitted; lower better | `trends.py:707` and `:1189`/`:1201`; migration needs a distinct request-weighted future metric if approved |

M08 `approval.pending_age_rows@legacy-v1`: included evaluated source-row grain; pending state plus valid Applied On; date attribution application month; numerator sum(nonnegative analysis_as_of − Applied On), denominator valid nonnegative age count, arithmetic mean rounded two decimals; missing/negative ages excluded from observation count, not coerced to zero. Existing default as-of is maximum event Date, falling back to today (`trends.py:726`); compatibility caller must resolve and record that date. New API always requires/resolves an explicit as-of and cache key. Dimensions follow row metadata; source is `trends.py:767`; lower-is-better label; no policy-enforceability assertion. Missing/unknown approval state remains unknown.

M09 `attendance.late_arrival_deviation_employee_count@legacy-v1`: employee-BU-within-scope evaluation, output distinct employees. Physical rows only (Present/Missing Swipes aliases); compute employee average entry and BU average entry; if circular shift difference >240 minutes comparison is N/A; otherwise rounded one-decimal deviation strictly >60 minutes flags employee. Exactly 60 does not flag. Source `kpi_engine.py:401`/`:485`/`:515`. Numerator is distinct flagged employee IDs; denominator N/A (existing output is a count, not a rate). Date scope influences both means; non-additive across months/BUs; recompute from underlying valid punches and deduplicate employee IDs. Missing punches are unknown, not midnight. Benchmark population and visibility must be authorized. This is descriptive deviation, **not scheduled-shift lateness or policy violation**.

## Conflicts requiring explicit decisions

| ID | Observed conflict | Required disposition before activation |
|---|---|---|
| MC01 | Dashboard/export scopes differ (`dashboard_shell.py:3871`) | One typed scope including employee/manager/date interval; parity regression |
| MC02 | Legacy WFH counts rows per employee over scope (`time_series_analysis.py:401`); newer logic quantities by employee-month | Keep both named compatibility measures until authoritative rule approved; do not relabel silently |
| MC03 | Legacy leave lead time Date − Applied On; trend uses Applied On − request start | Distinct IDs/sign labels and explicit migration mapping |
| MC04 | Stage 0 described approval trends as request-oriented, but `trends.py:1201` passes included rows to `calculate_monthly_approvals` | Stage 1 correction: preserve row-weighted legacy oracle; distinct-request version requires approved new formula/golden outputs |
| MC05 | “Leave Application Compliance” trend is days, while policy compliance is a rate | Rename/alias with units, not arithmetic change |
| MC06 | Fact counts vs attendance quantities vs source-row totals; AR/half-day categories vary | Approve metric-by-metric eligibility and conservation tests; no universal denominator |
| MC07 | WFH missing/nonpositive quantity defaults to 1.0 vs canonical unknown preservation | Version any rule correction; display uncertainty now rather than inventing definitive quantity |
| MC08 | WFH evaluates full month and picks last BU in input order; partial coverage inferred from min/max dates | Approve full evaluation scope, transfer allocation, authorization behavior and stronger source coverage; do not infer completeness from boundary dates alone |
| MC09 | Inferred leave clusters vs explicit source request IDs/canonical reconstruction | Stable request version/lineage and ambiguity rules; prove cross-month reconstruction |
| MC10 | `analysis_as_of_date` omitted from bridge cache key | Key includes as-of and all dependencies; aging tests across dates/releases |
| MC11 | Example “Late Arrival Rate” and Region=India are not established contracts | New scheduled-shift/region definitions and authoritative mapping required; no invented denominator/region |
| MC12 | Policy aliases in configuration versus vectorized PL classification differ (`policy.py:183`) | Freeze both observed paths in fixtures, then approve authoritative classification |

These conflicts are not all bugs to normalize automatically. MC04 corrects an audit overstatement; this blueprint does not edit the Stage 0 historical document. Approval metrics called “requests” by a UI may currently overweight multi-day applications. Report that limitation explicitly.

## Query API: authorization before cache and computation

`POST /api/v1/analytics/query` accepts a constrained AST, not SQL. Browser supplies display filters and requested versions; server resolves tenant, principal, entitlements, released dataset, catalogue/policy validity and permitted dimensions. Invalid/unauthorized filters are rejected or produce authorized empty scope under a documented rule; never ignored. Cache retrieval happens only after this resolution. Each response carries a query ID, exact resolved scope, versions, unit/grain, numerator/denominator/observation counts, DQ counts, completeness and result state.

Requested example, assuming region mapping is approved but late-arrival metric is not:

```json
{
  "dataset_id": "workforce",
  "release": "latest_published",
  "metric": {"id": "attendance.late_arrival_rate", "version": "1"},
  "business_period": {"from": "2025-10-01", "to_exclusive": "2026-10-01", "timezone": "Asia/Kolkata"},
  "analysis_as_of": "2026-10-04",
  "filters": {"and": [
    {"field": "region_id", "op": "eq", "value": "IN"},
    {"field": "business_unit_id", "op": "eq", "value": "bu_engineering"}
  ]},
  "group_by": ["calendar_month"],
  "completeness": "require_complete"
}
```

Until MC11 is resolved: `409 METRIC_NOT_ACTIVATED`, with safe explanation “Late Arrival Rate requires an approved schedule, eligibility and denominator contract.” If region metadata is unavailable, `422 UNSUPPORTED_DIMENSION` instead. Do not substitute M09's employee count or return a fabricated rate.

After that new metric is approved, flow is browser → API session → RBAC/row scope → registered late-arrival semantics → bounded query plan → security/version-aware cache → PostgreSQL aggregate or eligible fact scan → statistic result → visualization. If it needs full benchmark context outside authorization, refuse or return NOT_AUTHORIZED_FOR_EVALUATION; never widen to all organization rows silently.

A currently evidenced metric example can use the same scope with `attendance.missing_swipe_rate@legacy-v1`. Illustrative response (synthetic numbers, not repository measurements; future region mapping assumed):

```json
{
  "query_id": "q_example",
  "result_state": "OK",
  "resolved": {
    "dataset_release": "release_example_42",
    "metric_id": "attendance.missing_swipe_rate",
    "metric_version": "legacy-v1",
    "policy_version": null,
    "governance_version": "governance_example_1",
    "organization_version": "org_example_7",
    "analysis_as_of": "2026-10-04",
    "scope_token": "opaque_server_scope_handle",
    "business_period": {"from": "2025-10-01", "to_exclusive": "2026-10-01"}
  },
  "grain": "employee_day",
  "unit": "percent",
  "coverage": {"state": "COMPLETE", "requested_months": 12, "loaded_months": 12},
  "summary": {"value": 2.0, "numerator": 120, "denominator": 6000, "total_applicable": 6200, "excluded_dq": 200},
  "series": [],
  "series_note": "omitted from this documentation example; production returns at most 12 monthly points here",
  "lineage_ref": "/api/v1/queries/q_example/lineage",
  "warnings": [],
  "next_cursor": null
}
```

The scope handle references canonical filters and current authorization metadata; it is not a bearer permission. Revalidate on replay/export. Rates are numeric, formatting separate. Zero numerator with positive denominator is 0; denominator zero is null with NO_EVALUABLE_DATA. Missing months are visible gaps, not zeros. `PARTIAL`, `FAILED`, `SUPPRESSED`, `INSUFFICIENT_COVERAGE` and valid empty are separate envelopes. Budget overflow is `202` with explicit job semantics or `422 QUERY_REQUIRES_ASYNC`, never successful empty data.

## Aggregation, comparisons and explanation

- Additive quantities sum only at disjoint grains. Employee/day headcount distinct cannot be summed over months. Request/event joins use bridge semijoins or pre-aggregation to avoid fanout.
- Ratios use sufficient numerator/denominator sums, means sum/count, exact medians/percentiles retain compatible values or recompute. Approximate sketches require a different version/accuracy declaration and subtraction/retraction strategy.
- WFH monthly allowance cannot be calculated independently in arbitrary date chunks; pass complete authorized employee-month context and separate evaluation/display scope. If visibility lacks required context, result is not evaluable, not a reduced-denominator guess.
- Organization/peer benchmarks explicitly define inclusion of selected cohort, weighting, as-of/policy/time coverage and minimum cohort size. Never recompute a “company” benchmark on an HRBP's subset while retaining the company label.
- Drilldown explains included/excluded facts and rule reasons; raw employee evidence needs stronger permission. Lineage is a bounded summary plus paged authorized evidence, not all source IDs embedded in every chart point.
- A metric registry endpoint exposes allowed filters/units/format/available versions, not executable SQL or sensitive inaccessible dimensions.

## Analytical capability roadmap

| Class | Capabilities | Dependencies and boundaries |
|---|---|---|
| Descriptive, first | Overview KPIs, historical trends, internal/peer benchmarks, variance, distributions, percentiles | Approved facts and exact statistic semantics; expensive distributions asynchronous |
| Diagnostic, phased | Contribution/concentration, cohort comparisons, explainable patterns/outliers, change detection and driver decomposition | Versioned scope/baseline, adequate coverage, evidence and multiple-testing safeguards; deterministic decomposition is not causation |
| Predictive, later | Anomaly models and forecasts | Held-out time evaluation, leakage controls, calibration/uncertainty, drift monitoring, HR review; no punitive automatic employee scoring |
| Prescriptive, optional | Scenario comparison and proposed interventions | Explicit assumptions/constraints and human judgment; simulated effects are not causal guarantees or automatic HR decisions |

Preserve the existing detectors as deterministic domain functions. Run expensive patterns on pinned releases/cohorts in jobs, store algorithm/evidence versions and distinguish failure from “no pattern.” Do not introduce a model platform merely to label the current rules as AI.
