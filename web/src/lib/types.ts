/**
 * web/src/lib/types.ts
 * ────────────────────
 * TypeScript interfaces matching the Transformers 2.0 OLAP contracts.
 */

export interface MetricMetadata {
  id: string;
  label: string;
  category: "Attendance" | "Working Time" | "Compliance" | "Approval";
  format: "percentage" | "duration" | "days" | "time" | "integer";
  direction: "lower_is_better" | "higher_is_better" | "neutral";
  description: string;
}

export interface CascadedFilters {
  business_units: string[];
  departments: string[];
  managers: string[];
  employees: string[];
  emp_pairs: [string, string][];
}

export interface TrendChartPoint {
  period: string;
  period_display: string;
  actual: number | null;
  actual_formatted: string;
  dept_benchmark: number | null;
  dept_benchmark_formatted: string;
  bu_benchmark: number | null;
  bu_benchmark_formatted: string;
  org_benchmark: number | null;
  org_benchmark_formatted: string;
  benchmark: number | null;
  benchmark_formatted: string;
  historical: number | null;
  historical_formatted: string;
  peer_comparison?: number | null;
  peer_comparison_formatted?: string;
  gap_vs_dept: number | null;
  gap_vs_dept_formatted: string;
  gap_vs_bu: number | null;
  gap_vs_bu_formatted: string;
  gap_vs_org: number | null;
  gap_vs_org_formatted: string;
  is_low_volume: boolean;
  is_regression: boolean;
  is_post_policy: boolean;
  evaluable: number;
  leave_mgr?: number | null;
  leave_mgr_formatted?: string;
  leave_admin?: number | null;
  leave_admin_formatted?: string;
  wfh_mgr?: number | null;
  wfh_mgr_formatted?: string;
  wfh_admin?: number | null;
  wfh_admin_formatted?: string;
}

export interface TrendPulseCard {
  title: string;
  value: string;
  sub: string;
  note: string;
  color: "green" | "red" | "amber" | "neutral" | null;
}

export interface TrendPulse {
  current_value: number | null;
  current_value_formatted: string;
  previous_value: number | null;
  previous_value_formatted: string;
  mom_change: number | null;
  mom_change_formatted: string;
  mom_change_pp: number | null;
  trend_direction: string;
  streak_direction: string | null;
  streak_months: number;
  gap_vs_benchmark: number | null;
  gap_vs_benchmark_formatted: string;
  benchmark_label: string;
  volume_status: "HIGH" | "MODERATE" | "LOW";
  confidence_label: string;
  valid_observations: number;
}

export interface HeatmapRow {
  business_unit: string;
  current_value: number | null;
  current_formatted: string;
  trend_direction: string;
  monthly_values: { period: string; value: number | null; formatted_value: string }[];
  monthly_deltas: { period: string; delta: number | null; formatted_delta: string; bu_value: number | null; org_value: number | null; org_formatted?: string }[];
}

export interface BenchmarkTableRow {
  business_unit: string;
  current: string;
  current_val: number | null;
  three_month_avg: string;
  org_benchmark: string;
  org_baseline?: string;
  historical: string;
  gap: string;
  gap_val: number | null;
  gap_formatted?: string;
  trend: string;
  trajectory?: string;
  volume: string;
  evaluable: number;
}

export interface EmergingPattern {
  id: string;
  name: string;
  pattern_title?: string;
  category: string;
  badge: "CRITICAL" | "ATTENTION" | "WATCH" | "INFO";
  severity: string;
  strength: string;
  explanation: string;
  scope: string;
  business_unit?: string;
  department?: string;
  persistence: string;
  volume: string;
  why_detected: string;
  score: number;
}

export interface WhatChangedDriver {
  entity?: string;
  driver?: string;
  name?: string;
  dimension?: string;
  direction?: "increased" | "decreased";
  previous_value?: number;
  current_value?: number;
  delta: number;
  delta_pp?: number;
  delta_str?: string;
  formatted_delta?: string;
  contribution_pct?: number;
  contribution_str?: string;
  is_adverse?: boolean;
  summary?: string;
  type?: string;
}

export interface WhatChangedDecomposition {
  has_change: boolean;
  has_movement: boolean;
  title: string;
  headline: string;
  summary: string;
  metric_name: string;
  total_change_str: string;
  direction: "favorable" | "unfavorable" | "neutral";
  drivers: WhatChangedDriver[];
}

export interface TrendBundle {
  metric_id: string;
  metric_def: MetricMetadata;
  benchmark_type: string;
  benchmark_label: string;
  date_range_display: string;
  policy_effective_date: string;
  trend_pulse: TrendPulseCard[];
  pulse: TrendPulse;
  chart: {
    points: TrendChartPoint[];
    metric_id: string;
    metric_name: string;
    unit: string;
    format: string;
    direction: string;
    lower_is_better: boolean;
    reference_range: [number, number] | null;
    comparison_mode?: string;
    entity_label: string;
    dept_label: string;
    bu_label: string;
    org_label: string;
    peer_label?: string;
  };
  heatmap: {
    months: string[];
    rows: HeatmapRow[];
    lower_is_better: boolean;
    org_benchmarks?: { period: string; period_display: string; value: number | null; formatted_value: string }[];
  };
  benchmark_table: {
    columns: [string, string, number, string][];
    rows: BenchmarkTableRow[];
    total: BenchmarkTableRow;
  };
  dept_benchmark_table?: {
    columns: [string, string, number, string][];
    rows: BenchmarkTableRow[];
    total: BenchmarkTableRow;
  };
  what_changed: WhatChangedDecomposition;
  patterns: EmergingPattern[];
  observations: string[];
  execution_time_ms?: number;
}

export interface SnapshotMetadata {
  is_loaded: boolean;
  dataset_id?: string;
  row_count: number;
  employee_count: number;
  date_range?: string;
  min_date?: string;
  max_date?: string;
  business_units_count: number;
  departments_count: number;
  managers_count: number;
  source_name?: string;
}

export interface PunchAnomaly {
  employee_code: string;
  employee_name: string;
  business_unit: string;
  department: string;
  date: string;
  anomaly_score: number;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  in_time: string;
  out_time: string;
  duration_hours: number;
  reasons: string[];
}

export interface AnomalyResponse {
  anomalies: PunchAnomaly[];
  count: number;
  execution_time_ms: number;
}

export interface EmployeeBurnoutProfile {
  employee_code: string;
  employee_name: string;
  business_unit: string;
  department: string;
  burnout_score: number;
  flight_risk_level: "CRITICAL" | "HIGH" | "ELEVATED" | "NOMINAL";
  overtime_shifts_pct: number;
  short_rest_turnarounds: number;
  avg_shift_hours: number;
  top_signals: string[];
  recommended_intervention: string;
}

export interface CohortBurnoutRisk {
  business_unit: string;
  headcount: number;
  avg_burnout_score: number;
  high_risk_count: number;
  high_risk_pct: number;
  primary_stressor: string;
}

export interface BurnoutSummary {
  total_workforce_analyzed: number;
  critical_flight_risks: number;
  high_flight_risks: number;
  global_burnout_index: number;
  at_risk_percentage: number;
}

export interface BurnoutRiskResponse {
  employee_risks: EmployeeBurnoutProfile[];
  cohort_risks: CohortBurnoutRisk[];
  summary: BurnoutSummary;
  execution_time_ms: number;
}

export interface SimulationRequest {
  grace_period_mins: number;
  ot_threshold_hours: number;
  regularization_sla_hours: number;
  wfh_weekly_allowance: number;
  business_unit?: string;
}

export interface BUImpact {
  business_unit: string;
  late_instances_delta: number;
  ot_hours_delta: number;
  est_cost_delta: number;
}

export interface SimulationOutcome {
  baseline_compliance_rate: number;
  simulated_compliance_rate: number;
  compliance_delta: number;
  baseline_late_instances: number;
  simulated_late_instances: number;
  late_delta: number;
  baseline_ot_hours: number;
  simulated_ot_hours: number;
  ot_hours_delta: number;
  est_ot_cost_delta_usd: number;
  friction_index_baseline: number;
  friction_index_simulated: number;
  friction_delta: number;
  policy_health_score: number;
  bu_impacts: BUImpact[];
  recommendation: string;
  execution_time_ms?: number;
}

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "BU_HEAD" | "MANAGER" | "AUDITOR";
  role_label: string;
  title: string;
  allowed_business_units: string[];
  allowed_departments: string[];
  allowed_managers: string[];
  can_manage_connectors: boolean;
  can_simulate_policy: boolean;
  can_view_financials: boolean;
  avatar_initials: string;
}

export interface ConnectorKekaStatus {
  connected: boolean;
  status_message: string;
  subdomain: string;
  has_credentials: boolean;
  last_sync: string;
  total_records_synced: number;
  employees_synced: number;
}

export interface ConnectorSlackStatus {
  connected: boolean;
  status_message: string;
  bot_user?: string;
  bot_id?: string;
  has_token: boolean;
  alert_channel: string;
  last_event: string;
}

export interface LakehouseStatus {
  active_dataset: string;
  active_row_count: number;
  last_materialized: string;
}

export interface ConnectorsStatusResponse {
  keka: ConnectorKekaStatus;
  slack: ConnectorSlackStatus;
  lakehouse: LakehouseStatus;
}

export interface KekaConfigPayload {
  subdomain: string;
  client_id?: string;
  client_secret?: string;
  api_key?: string;
  login_email?: string;
  login_password?: string;
}

export interface SlackConfigPayload {
  bot_token: string;
  bot_id?: string;
  alert_channel?: string;
}

export interface KekaSyncResponse {
  status: string;
  message: string;
  dataset_id: string;
  records_synced: number;
  employees_synced: number;
  business_units: string[];
  execution_time_ms: number;
}

export interface SchedulerExecutionItem {
  timestamp: string;
  action: string;
  status: string;
  details: string;
  execution_time_ms: number;
}

export interface SchedulerStatusResponse {
  is_running: boolean;
  enabled: boolean;
  sync_interval_minutes: number;
  digest_enabled: boolean;
  digest_target_time: string;
  slack_channel: string;
  last_sync_time?: string | null;
  last_sync_status?: string | null;
  next_sync_time?: string | null;
  last_digest_time?: string | null;
  last_digest_status?: string | null;
  next_digest_time?: string | null;
  execution_history: SchedulerExecutionItem[];
}

export interface SchedulerConfigPayload {
  enabled?: boolean;
  sync_interval_minutes?: number;
  digest_enabled?: boolean;
  digest_target_time?: string;
  slack_channel?: string;
}

// ── Executive Overview Analytical Types ──
export interface ExecutiveKPICardData {
  id: string;
  number: number;
  title: string;
  label: string;
  primary: string;
  unit: string;
  secondary: string;
  footnote: string;
  color: string;
  category: "Volume" | "Presence" | "Hybrid" | "Rest" | "Absence" | "Governance" | "Punctuality";
  sparkline?: number[] | null;
}

export interface AttendanceCompositionItem {
  category: string;
  label: string;
  days: number;
  pct: number;
  color: string;
  description: string;
  is_exception?: boolean;
}

export interface DailyAttendanceRecord {
  date_str: string;
  date_iso: string;
  present_days: number;
  absent_days: number;
  wfh_days: number;
  leave_days: number;
  recorded_days: number;
  missing_swipe_days: number;
  regularized_days: number;
}

export interface BUAttendanceComparisonRow {
  business_unit: string;
  observed_headcount: number;
  recorded_employee_days: number;
  total_days?: number;
  calendar_days?: number;
  present_days: number;
  present_pct: number;
  leave_days: number;
  leave_pct: number;
  od_days?: number;
  od_pct?: number;
  wfh_days: number;
  wfh_pct: number;
  holiday_days?: number;
  holiday_pct?: number;
  absent_days: number;
  absent_pct: number;
  week_off_days?: number;
  week_off_pct?: number;
  exception_days: number;
  exception_rate_pct: number;
  missing_swipe_days: number;
  missing_swipe_rate_pct: number;
}

export interface ReconciliationData {
  status: "clean" | "notice" | "warning";
  is_reconciled: boolean;
  total_days: number;
  categorized_days: number;
  conflicts_count: number;
  unclassified_records_count: number;
  unclassified_days: number;
  summary: string;
  description: string;
}

export interface ExecutiveOverviewBundle {
  execution_time_ms: number;
  scope: {
    business_unit: string;
    department: string;
    manager: string;
    employee: string;
    month?: string;
  };
  kpi_cards: ExecutiveKPICardData[];
  reconciliation: ReconciliationData;
  attendance_composition: AttendanceCompositionItem[];
  attendance_composition_denominator: number;
  daily_attendance_trend: DailyAttendanceRecord[];
  bu_attendance_comparison: BUAttendanceComparisonRow[];
  bu_comparison_total: BUAttendanceComparisonRow;
  dept_attendance_comparison?: DeptAttendanceComparisonRow[];
  emp_attendance_comparison?: EmpAttendanceComparisonRow[];
  data_quality: {
    status: string;
    conflicts_count: number;
    unclassified_count: number;
  };
}

export interface DeptAttendanceComparisonRow {
  department: string;
  business_unit: string;
  observed_headcount: number;
  recorded_employee_days: number;
  total_days?: number;
  calendar_days?: number;
  present_days: number;
  present_pct: number;
  leave_days: number;
  leave_pct: number;
  od_days?: number;
  od_pct?: number;
  wfh_days: number;
  wfh_pct: number;
  holiday_days?: number;
  holiday_pct?: number;
  absent_days: number;
  absent_pct: number;
  week_off_days?: number;
  week_off_pct?: number;
  exception_days: number;
  exception_rate_pct: number;
}

export interface EmpAttendanceComparisonRow {
  employee_id: string;
  employee_name: string;
  department: string;
  business_unit: string;
  recorded_employee_days: number;
  total_days?: number;
  calendar_days?: number;
  present_days: number;
  present_pct: number;
  leave_days: number;
  leave_pct: number;
  od_days?: number;
  od_pct?: number;
  wfh_days: number;
  wfh_pct: number;
  holiday_days?: number;
  holiday_pct?: number;
  absent_days: number;
  absent_pct: number;
  week_off_days?: number;
  week_off_pct?: number;
  exception_days: number;
  avg_working_hours: string;
}

export interface AvailableSyncMonth {
  month_key?: string;
  display_name?: string;
  record_count?: number;
  headcount?: number;
  is_current?: boolean;
  is_active?: boolean;
  last_synced?: string;
  key?: string;
  label?: string;
  records?: number;
}

export interface AvailableSyncMonthsResponse {
  active_synced_month: string;
  all_option: {
    month_key: string;
    display_name: string;
    record_count: number;
    headcount?: number;
    key?: string;
    label?: string;
    total_records?: number;
  };
  months: AvailableSyncMonth[];
}

export interface DiffSummary {
  total_previous_records: number;
  total_new_records: number;
  records_modified: number;
  records_added: number;
  records_unchanged: number;
  absences_resolved: number;
  leaves_updated: number;
  wfh_updated: number;
  half_days_updated?: number;
  regularizations_applied: number;
  headcount_delta: number;
}

export interface DiffRecord {
  employee_id: string;
  employee_name: string;
  department: string;
  business_unit: string;
  date: string;
  change_type: "STATUS_CONVERTED" | "PUNCH_UPDATED" | "NEW_RECORD" | "HALF_DAY";
  quantity?: number;
  old_quantity?: number;
  new_quantity?: number;
  old_status: string;
  new_status: string;
  old_att_type: string;
  new_att_type: string;
  old_hours: string;
  new_hours: string;
  in_time: string;
  out_time: string;
  summary_badge: string;
  badge_color: "emerald" | "purple" | "blue" | "cyan" | "rose" | "amber";
}

export interface DiffPayload {
  month_key: string;
  display_name: string;
  synced_at: string;
  summary: DiffSummary;
  records: DiffRecord[];
}

export interface SyncJobStatus {
  job_id: string;
  month: string;
  status: "running" | "completed" | "failed";
  progress: number;
  current_step: string;
  detail: string;
  started_at: string;
  diff_summary: DiffSummary | null;
  diff_records: DiffRecord[];
  error?: string | null;
  total_records?: number;
  headcount?: number;
  synced_months?: string[];
}


