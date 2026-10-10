# Metric decision register

Current characterization is not business approval. No entry is APPROVED_CHANGE or APPROVED_LEGACY_COMPATIBILITY. MC13/MC14 are new evidence, not a redesign of Stage 1. Source files retain their existing behavior.

## MC01 — KNOWN_DEFECT

- **Current Behavior A:** Dashboard manager/employee/custom-date filters affect selected analytics

- **Current Behavior B:** Export callback sends BU, department and date-preset only

- **Repository Evidence:** dashboard_shell.py:_on_export_excel; snapshot_bridge.py:get_workforce_metrics

- **Affected Surface:** Overview/Trends → Excel

- **Affected Grain:** scope across event/day/request

- **Current Business Label:** Workforce Intelligence Report

- **Risk Of Keeping:** Broader or empty export than visible population

- **Risk Of Changing:** Changing reports may alter historical output populations

- **Recommended Long Term Direction:** Shared explicit scope including actual interval

- **Backward Compatibility Option:** Retain named legacy export only with disclosed scope

- **Golden Tests Created:** test_mc01_export_callback_omits_manager_employee_and_interval; test_scope_manager_employee_and_custom_interval_membership

- **Decision Owner Required:** Technical owner with security review

## MC02 — REQUIRES_HR_DECISION

- **Current Behavior A:** Legacy export counts WFH rows per employee over full scope minus 3

- **Current Behavior B:** KPI sums quantities per employee-calendar-month minus 3

- **Repository Evidence:** time_series_analysis.py:compute_time_series_metrics; kpi_engine.py:compute_wfh_allowance_monthly

- **Affected Surface:** WFH KPI and Excel

- **Affected Grain:** row vs employee-month quantity

- **Current Business Label:** WFH Excess Days

- **Risk Of Keeping:** Half-days/multiple months change allowance result

- **Risk Of Changing:** Historical KPI/report totals change

- **Recommended Long Term Direction:** Governed employee-month quantity definition after HR approval

- **Backward Compatibility Option:** Keep legacy.wfh_row_excess version alongside monthly quantity

- **Golden Tests Created:** test_mc02_legacy_wfh_counts_rows_across_months; test_legacy_wfh_month_quantity_scope_and_transfer_order

- **Decision Owner Required:** HR metric owner

## MC03 — REQUIRES_HR_DECISION

- **Current Behavior A:** Legacy event Date minus Applied On: positive is advance

- **Current Behavior B:** Request timing Applied On minus request start: negative is advance

- **Repository Evidence:** time_series_analysis.py:compute_time_series_metrics; trends.py:calculate_monthly_compliance

- **Affected Surface:** Excel versus Trends

- **Affected Grain:** event row vs request

- **Current Business Label:** Average Leave Apply Days / Compliance Timing

- **Risk Of Keeping:** Opposite sign can reverse interpretation

- **Risk Of Changing:** Comparisons flip if relabeled without version

- **Recommended Long Term Direction:** Explicit units, sign and request attribution

- **Backward Compatibility Option:** Keep both named metric IDs and migration mapping

- **Golden Tests Created:** test_mc03_legacy_leave_lead_time_positive_means_advance; test_legacy_leave_timing_components_not_compliance_rate

- **Decision Owner Required:** HR metric owner

## MC04 — REQUIRES_HR_DECISION

- **Current Behavior A:** Trend approval averages/medians/counts are source-row weighted

- **Current Behavior B:** Request-weighted alternative differs for repeated multi-day rows

- **Repository Evidence:** trends.py:calculate_monthly_approvals; calculate_time_series_trends

- **Affected Surface:** Approval Trends

- **Affected Grain:** source row versus distinct request

- **Current Business Label:** Average/Median Approval Turnaround; Pending Approval Count

- **Risk Of Keeping:** Large requests overweight approval statistics

- **Risk Of Changing:** Switch changes trend series and benchmarks

- **Recommended Long Term Direction:** Separate request-weighted version only after approval

- **Backward Compatibility Option:** Preserve approval.*_rows version with clear label

- **Golden Tests Created:** test_legacy_approval_row_weighting_and_pinned_age

- **Decision Owner Required:** HR metric owner

## MC05 — REQUIRES_HR_DECISION

- **Current Behavior A:** Compliance/timing trend displays calendar-day mean

- **Current Behavior B:** Core post-policy compliance is compliant/evaluable percentage

- **Repository Evidence:** trends.py:TREND_METRICS; metrics.py:calculate_core_metrics

- **Affected Surface:** Trends versus compliance summary

- **Affected Grain:** request, but different statistic/unit

- **Current Business Label:** Leave Application Compliance / Timing

- **Risk Of Keeping:** Readers may interpret days as compliance rate

- **Risk Of Changing:** Label/API renaming affects consumers

- **Recommended Long Term Direction:** Publish distinct timing and policy-compliance IDs/units

- **Backward Compatibility Option:** Alias old label with explicit timing unit

- **Golden Tests Created:** test_legacy_leave_timing_components_not_compliance_rate; test_legacy_post_policy_compliance_components

- **Decision Owner Required:** HR/product owner

## MC06 — REQUIRES_HR_DECISION

- **Current Behavior A:** Attendance trend rates use eligible/evaluable employee-day flags

- **Current Behavior B:** Overview uses quantities; legacy export uses source row denominator

- **Repository Evidence:** metrics.py:build_employee_day_facts; kpi_engine.py:compute_workforce_intelligence_bundle; time_series_analysis.py:compute_time_series_metrics

- **Affected Surface:** Attendance Overview/Trends/export

- **Affected Grain:** employee-day versus event quantity/row

- **Current Business Label:** Present Days / Attendance Exception Rate

- **Risk Of Keeping:** Counts look comparable while denominators differ

- **Risk Of Changing:** Universal normalization can erase split days or DQ exclusions

- **Recommended Long Term Direction:** Metric-specific grains and quantity conservation; resolve AR defect MC14

- **Backward Compatibility Option:** Retain compatibility contracts per surface

- **Golden Tests Created:** test_legacy_attendance_components_and_membership; test_legacy_zero_is_distinct_from_null; test_mc14_legacy_regularized_ar_missing_from_present_quantity

- **Decision Owner Required:** HR/data owner

## MC07 — REQUIRES_DATA_DECISION

- **Current Behavior A:** WFH helper maps null/zero/negative quantity to 1.0

- **Current Behavior B:** Canonical quantity/DQ preserves uncertainty and fractions

- **Repository Evidence:** kpi_engine.py:compute_wfh_allowance_monthly; normalization.py:normalize_quantity

- **Affected Surface:** WFH Overview

- **Affected Grain:** employee-month derived from rows

- **Current Business Label:** WFH Days

- **Risk Of Keeping:** Unobserved quantity becomes definitive full day

- **Risk Of Changing:** Changing fallback reduces totals and affects thresholds

- **Recommended Long Term Direction:** Explicit unknown handling chosen by HR/data owner

- **Backward Compatibility Option:** Keep fallback in legacy version with limitation

- **Golden Tests Created:** test_legacy_wfh_unknown_or_nonpositive_quantity_becomes_one

- **Decision Owner Required:** Data steward and HR owner

## MC08 — REQUIRES_SECURITY_DECISION

- **Current Behavior A:** Full available employee-month drives excess despite partial display scope

- **Current Behavior B:** Last distinct BU in input order gets attribution; min/max dates imply coverage

- **Repository Evidence:** kpi_engine.py:compute_wfh_allowance_monthly

- **Affected Surface:** Filtered WFH and BU comparison

- **Affected Grain:** employee-month versus display event scope

- **Current Business Label:** Additional WFH Days by BU

- **Risk Of Keeping:** Order-sensitive transfers and inference from partial source

- **Risk Of Changing:** New attribution shifts BU totals; security cannot widen scope

- **Recommended Long Term Direction:** Separate display/evaluation scope, temporal attribution and explicit coverage; approve required entitlements

- **Backward Compatibility Option:** Freeze current order-dependent mapping as legacy only

- **Golden Tests Created:** test_legacy_wfh_month_quantity_scope_and_transfer_order; future authorization_membership

- **Decision Owner Required:** Security + HR + data owners

## MC09 — REQUIRES_DATA_DECISION

- **Current Behavior A:** Request reconstruction groups employee/leave/application/approval metadata

- **Current Behavior B:** Canonical request models/native source IDs can have different boundaries

- **Repository Evidence:** requests.py:build_leave_requests; data_foundation.py:CanonicalWorkforceData

- **Affected Surface:** Leave policy/timing/drilldown

- **Affected Grain:** request versus daily observation

- **Current Business Label:** Leave Request

- **Risk Of Keeping:** Corrections and gaps may regroup request identities

- **Risk Of Changing:** New clustering changes PL tiers and timing weights

- **Recommended Long Term Direction:** Stable native identity where provided; explicit inference versions otherwise

- **Backward Compatibility Option:** Retain inference algorithm/version and source row links

- **Golden Tests Created:** test_mc09_request_reconstruction_preserves_two_row_lineage; future same_native_revision/ambiguous_overlap

- **Decision Owner Required:** Source/data owner with HR review

## MC10 — KNOWN_DEFECT

- **Current Behavior A:** Pending age accepts analysis_as_of_date

- **Current Behavior B:** Bridge cache key omits as-of and V2 probe differs from V5 result key

- **Repository Evidence:** snapshot_bridge.py:get_trend_intelligence/get_cached_trend_intelligence

- **Affected Surface:** Approval Trends/cache

- **Affected Grain:** row age under scope

- **Current Business Label:** Average Pending Approval Age

- **Risk Of Keeping:** New as-of returns stale cached result

- **Risk Of Changing:** Corrected values change previously stale displays

- **Recommended Long Term Direction:** Shared cache key includes time and dataset/semantic inputs

- **Backward Compatibility Option:** Invalidate old cache on correction; preserve historical report as-of

- **Golden Tests Created:** test_mc10_cached_pending_age_ignores_new_as_of

- **Decision Owner Required:** Technical owner

## MC11 — REQUIRES_HR_DECISION

- **Current Behavior A:** Current late-arrival output counts employees >60min versus BU mean

- **Current Behavior B:** Proposed shift-based Late Arrival Rate / region mapping absent

- **Repository Evidence:** kpi_engine.py:compute_punch_deviations_bu; Stage1 metric document

- **Affected Surface:** Overview punch deviation/future query

- **Affected Grain:** employee/BU comparison, no denominator

- **Current Business Label:** Late Arrival Employees

- **Risk Of Keeping:** Mislabeling descriptive cohort difference as policy lateness

- **Risk Of Changing:** Invented denominator/schedule would create new policy

- **Recommended Long Term Direction:** Retain descriptive count; design distinct rate only with approved schedule/eligibility

- **Backward Compatibility Option:** No substitution; qualified count remains available

- **Golden Tests Created:** test_legacy_late_arrival_count_is_descriptive_not_rate

- **Decision Owner Required:** HR metric owner

## MC12 — REQUIRES_HR_DECISION

- **Current Behavior A:** PolicyConfig recognizes configured privilege aliases/status PL

- **Current Behavior B:** Vectorized classify includes earned/annual/EL independently

- **Repository Evidence:** policy_config.py:PolicyConfig.is_pl_leave; policy.py:classify_policy_event/evaluate_policy

- **Affected Surface:** Policy classifications and reconstructed leave

- **Affected Grain:** row versus request

- **Current Business Label:** PL / Non-PL

- **Risk Of Keeping:** Same leave label can select inconsistent rules

- **Risk Of Changing:** Changing classification changes notice tiers/compliance

- **Recommended Long Term Direction:** Choose authoritative alias set with HR; share only after fixtures

- **Backward Compatibility Option:** Preserve each observed path until versioned decision

- **Golden Tests Created:** test_mc12_scalar_and_vectorized_alias_classification_disagree

- **Decision Owner Required:** HR policy owner

## MC13 — REQUIRES_TECHNICAL_DECISION

- **Current Behavior A:** Stage1 semantic contract describes mean numerator as sum of lag

- **Current Behavior B:** Legacy TrendPoint.numerator is before+same count; approval/working points do not expose sufficient statistics

- **Repository Evidence:** trends.py:calculate_monthly_compliance/calculate_monthly_approvals/calculate_monthly_working_time

- **Affected Surface:** TrendPoint/API migration contract

- **Affected Grain:** mean statistic versus timing-classification count

- **Current Business Label:** Timing / Turnaround / Working Time

- **Risk Of Keeping:** SQL adapter could reuse wrong numerator as mean sum

- **Risk Of Changing:** Repurposing existing fields breaks consumers

- **Recommended Long Term Direction:** Introduce separate named sum/count components in future contract; keep existing fields unchanged now

- **Backward Compatibility Option:** Document legacy fields and independent golden mean inputs

- **Golden Tests Created:** test_legacy_leave_timing_components_not_compliance_rate; test_legacy_approval_row_weighting_and_pinned_age

- **Decision Owner Required:** Semantic/API technical owner with HR unit review

## MC14 — KNOWN_DEFECT

- **Current Behavior A:** Existing AR tests explicitly require A(R) to contribute present quantity

- **Current Behavior B:** KPI returns present=0 for synthetic A(R) with Absent/Regularized type, despite excluding it from absent

- **Repository Evidence:** tests/test_attendance_regularization_ar.py:test_kpi_engine_ar_with_absent_attendance_type_not_absent; tests/test_workforce_overview_kpis.py:test_attendance_composition_and_absent_kpi_remain_unchanged; kpi_engine.py

- **Affected Surface:** Attendance composition/present KPI

- **Affected Grain:** event quantity versus regularization flag

- **Current Business Label:** Present Days / Absent Days

- **Risk Of Keeping:** Regularized quantity can disappear from expected present composition

- **Risk Of Changing:** Correction changes live composition; must preserve request/rate semantics

- **Recommended Long Term Direction:** Trace canonical category mapping and make a narrowly reviewed Stage2B correction against existing desired tests

- **Backward Compatibility Option:** Keep current characterization plus existing failing desired-behavior tests

- **Golden Tests Created:** test_mc14_legacy_regularized_ar_missing_from_present_quantity

- **Decision Owner Required:** Attendance domain technical owner; HR confirms downstream presentation
