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
  monthly_deltas: { period: string; delta: number | null; formatted_delta: string; bu_value: number | null; org_value: number | null }[];
}

export interface BenchmarkTableRow {
  business_unit: string;
  current: string;
  current_val: number | null;
  three_month_avg: string;
  org_benchmark: string;
  historical: string;
  gap: string;
  gap_val: number | null;
  trend: string;
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
  persistence: string;
  volume: string;
  why_detected: string;
  score: number;
}

export interface WhatChangedDriver {
  entity: string;
  dimension: string;
  direction: "increased" | "decreased";
  previous_value: number;
  current_value: number;
  delta: number;
  delta_pp?: number;
  contribution_pct: number;
  summary: string;
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
    entity_label: string;
    dept_label: string;
    bu_label: string;
    org_label: string;
  };
  heatmap: {
    months: string[];
    rows: HeatmapRow[];
    lower_is_better: boolean;
  };
  benchmark_table: {
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
