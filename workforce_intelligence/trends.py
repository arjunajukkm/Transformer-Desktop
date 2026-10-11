"""
trends.py
─────────
Deterministic workforce time-series and monthly trends analytical engine.
Provides monthly aggregations, month-over-month comparisons, trend direction,
streak detection, regression detection, volume classification, and deterministic
management intelligence observations.
"""

from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from workforce_intelligence.metrics import (
    _safe_rate,
    build_employee_day_facts,
    normalize_approval_state,
)
from workforce_intelligence.policy_config import (
    POLICY_EFFECTIVE_DATE,
    POLICY_EFFECTIVE_DATE_STR,
)


# ── Trend Metric Catalogue ──────────────────────────────────────────────

@dataclass(frozen=True)
class TrendMetricDefinition:
    id: str
    label: str
    category: str       # "Compliance", "Attendance", "Approval", "Working Time"
    format: str         # "percentage", "days", "duration", "time", "integer"
    direction: str      # "higher_is_better", "lower_is_better", "neutral"
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


TREND_METRICS: Dict[str, TrendMetricDefinition] = {
    # 1. Compliance
    "leave_application_compliance": TrendMetricDefinition(
        id="leave_application_compliance",
        label="Leave Application Compliance / Timing",
        category="Compliance",
        format="days",
        direction="lower_is_better",
        description="Timing of leave applications relative to leave start date, with advance, same-day, and post-leave classifications.",
    ),
    "wfh_application_compliance": TrendMetricDefinition(
        id="wfh_application_compliance",
        label="WFH Application Compliance / Timing",
        category="Compliance",
        format="days",
        direction="lower_is_better",
        description="Timing of WFH applications relative to availed date, with advance, same-day, and post-WFH classifications.",
    ),

    # 2. Attendance
    "missing_swipe_rate": TrendMetricDefinition(
        id="missing_swipe_rate",
        label="Missing Swipe Rate",
        category="Attendance",
        format="percentage",
        direction="lower_is_better",
        description="Monthly percentage of eligible attendance days with status P(MS).",
    ),
    "absence_rate": TrendMetricDefinition(
        id="absence_rate",
        label="Absence Rate",
        category="Attendance",
        format="percentage",
        direction="lower_is_better",
        description="Monthly percentage of evaluable eligible employee-days marked as absent.",
    ),
    "regularization_rate": TrendMetricDefinition(
        id="regularization_rate",
        label="Attendance Regularisation Rate",
        category="Attendance",
        format="percentage",
        direction="neutral",
        description="Monthly percentage of evaluable eligible scheduled working days where Attendance Type = Regularized.",
    ),

    # 3. Approval
    "median_approval_turnaround": TrendMetricDefinition(
        id="median_approval_turnaround",
        label="Median Approval Turnaround",
        category="Approval",
        format="days",
        direction="lower_is_better",
        description="Median turnaround time (in days) from application to approval for requests applied in the month.",
    ),
    "average_approval_turnaround": TrendMetricDefinition(
        id="average_approval_turnaround",
        label="Average Approval Turnaround",
        category="Approval",
        format="days",
        direction="lower_is_better",
        description="Average turnaround time (in days) from application to approval for requests applied in the month.",
    ),
    "pending_approval_count": TrendMetricDefinition(
        id="pending_approval_count",
        label="Pending Approval Count",
        category="Approval",
        format="integer",
        direction="lower_is_better",
        description="Count of pending approval requests applied in the month.",
    ),
    "average_pending_approval_age": TrendMetricDefinition(
        id="average_pending_approval_age",
        label="Average Pending Approval Age",
        category="Approval",
        format="days",
        direction="lower_is_better",
        description="Average age (in days) of pending approval requests applied in the month.",
    ),

    # 4. Working Time
    "average_effective_hours": TrendMetricDefinition(
        id="average_effective_hours",
        label="Average Effective Hours",
        category="Working Time",
        format="duration",
        direction="neutral",
        description="Average effective working hours per valid working day.",
    ),
    "median_effective_hours": TrendMetricDefinition(
        id="median_effective_hours",
        label="Median Effective Hours",
        category="Working Time",
        format="duration",
        direction="neutral",
        description="Median effective working hours per valid working day.",
    ),
    "average_arrival_time": TrendMetricDefinition(
        id="average_arrival_time",
        label="Average Arrival Time",
        category="Working Time",
        format="time",
        direction="neutral",
        description="Average morning arrival time for valid working days.",
    ),
    "median_arrival_time": TrendMetricDefinition(
        id="median_arrival_time",
        label="Median Arrival Time",
        category="Working Time",
        format="time",
        direction="neutral",
        description="Median morning arrival time for valid working days.",
    ),
    "average_exit_time": TrendMetricDefinition(
        id="average_exit_time",
        label="Average Exit Time",
        category="Working Time",
        format="time",
        direction="neutral",
        description="Average evening departure time for valid working days.",
    ),
    "median_exit_time": TrendMetricDefinition(
        id="median_exit_time",
        label="Median Exit Time",
        category="Working Time",
        format="time",
        direction="neutral",
        description="Median evening departure time for valid working days.",
    ),
}


def get_trend_metric_catalogue() -> Dict[str, List[Dict[str, Any]]]:
    """Return trend metric catalogue grouped by category."""
    grouped: Dict[str, List[Dict[str, Any]]] = {
        "Compliance": [],
        "Attendance": [],
        "Approval": [],
        "Working Time": [],
    }
    for m in TREND_METRICS.values():
        grouped[m.category].append(m.to_dict())
    return grouped


# ── Materiality Thresholds ──────────────────────────────────────────────

MATERIALITY_THRESHOLD_RATE = 1.0       # 1.0 percentage point
MATERIALITY_THRESHOLD_DAYS = 0.5       # 0.5 day for approval turnaround
MATERIALITY_THRESHOLD_MINUTES = 10.0   # 10 minutes for timing/duration
MATERIALITY_THRESHOLD_COUNT = 1.0      # 1 unit for integer count


def get_materiality_threshold(metric_def: TrendMetricDefinition) -> float:
    """Return the materiality threshold for a given metric."""
    if metric_def.format == "percentage":
        return MATERIALITY_THRESHOLD_RATE
    if metric_def.format == "days":
        return MATERIALITY_THRESHOLD_DAYS
    if metric_def.format in ("duration", "time"):
        return MATERIALITY_THRESHOLD_MINUTES
    return MATERIALITY_THRESHOLD_COUNT


# ── Volume Classification ───────────────────────────────────────────────

def classify_volume_status(count_or_denominator: Optional[int]) -> str:
    """
    Classify volume status deterministically:
    - LOW: < 10
    - MODERATE: 10 - 49
    - HIGH: >= 50
    """
    if count_or_denominator is None or count_or_denominator < 10:
        return "LOW"
    if count_or_denominator <= 49:
        return "MODERATE"
    return "HIGH"


# ── Formatting Helpers ──────────────────────────────────────────────────

def format_time_minutes(minutes: Optional[Union[float, int]]) -> Optional[str]:
    """Format minutes from midnight into '09:42 AM' or '06:31 PM'."""
    if minutes is None or pd.isna(minutes):
        return None
    total_mins = int(round(float(minutes))) % 1440
    hours = total_mins // 60
    mins = total_mins % 60
    suffix = "AM" if hours < 12 else "PM"
    h12 = hours % 12
    if h12 == 0:
        h12 = 12
    return f"{h12:02d}:{mins:02d} {suffix}"


def format_duration_minutes(minutes: Optional[Union[float, int]]) -> Optional[str]:
    """Format duration minutes into '8h 14m'."""
    if minutes is None or pd.isna(minutes):
        return None
    total_mins = int(round(float(minutes)))
    hours = total_mins // 60
    mins = total_mins % 60
    return f"{hours}h {mins:02d}m"


def format_timing_days(days: Optional[Union[float, int]], event_type: str = "leave") -> Optional[str]:
    """Format timing days into 'Applied 5 days before leave' or 'Applied 2 days after leave'."""
    if days is None or pd.isna(days):
        return None
    d = float(days)
    if abs(d) < 0.05:
        return "Applied on same day"
    ev_name = "WFH" if "wfh" in event_type.lower() else "leave"
    if d < 0:
        val_abs = abs(d)
        d_str = f"{int(round(val_abs))}" if abs(val_abs - round(val_abs)) < 0.05 else f"{val_abs:.1f}"
        unit = "day" if d_str == "1" else "days"
        return f"Applied {d_str} {unit} before {ev_name}"
    d_str = f"{int(round(d))}" if abs(d - round(d)) < 0.05 else f"{d:.1f}"
    unit = "day" if d_str == "1" else "days"
    return f"Applied {d_str} {unit} after {ev_name}"


def format_benchmark_diff(
    diff: Optional[Union[float, int]],
    format_type: str,
    metric_id: str = "",
) -> str:
    """Format difference against benchmark using natural executive language."""
    if diff is None or pd.isna(diff):
        return "—"
    fd = float(diff)
    if abs(fd) < 0.01:
        return "At benchmark"

    sign = "+" if fd > 0 else "-"
    abs_d = abs(fd)

    if metric_id in ("leave_application_compliance", "wfh_application_compliance"):
        ev = "WFH" if "wfh" in metric_id else "leave"
        d_str = f"{int(round(abs_d))}" if abs(abs_d - round(abs_d)) < 0.05 else f"{abs_d:.1f}"
        unit = "day" if d_str == "1" else "days"
        # Negative diff means applied earlier/before; positive means applied later/after
        rel = "later" if fd > 0 else "earlier"
        return f"{d_str} {unit} {rel}"

    if format_type == "percentage":
        return f"{sign}{abs_d:.1f} pp"

    if format_type in ("duration", "time"):
        total_mins = int(round(abs_d))
        hours = total_mins // 60
        mins = total_mins % 60
        if hours > 0 and mins > 0:
            t_str = f"{hours}h {mins:02d}m"
        elif hours > 0:
            t_str = f"{hours}h"
        else:
            t_str = f"{mins} mins"
        if format_type == "time":
            rel = "later" if fd > 0 else "earlier"
            return f"{t_str} {rel}"
        return f"{sign}{t_str}"

    if format_type == "days":
        d_str = f"{int(round(abs_d))}" if abs(abs_d - round(abs_d)) < 0.05 else f"{abs_d:.1f}"
        unit = "day" if d_str == "1" else "days"
        if "turnaround" in metric_id or "age" in metric_id:
            rel = "slower" if fd > 0 else "faster"
            return f"{d_str} {unit} {rel}"
        return f"{sign}{d_str} {unit}"

    if format_type == "integer":
        return f"{sign}{int(round(abs_d))}"

    return f"{sign}{abs_d:.1f}"


def get_approval_turnaround_color(days: Optional[Union[float, int]]) -> Optional[str]:
    """Return executive color for approval turnaround (0-2d green, >2-5d amber, >5d red)."""
    if days is None or pd.isna(days):
        return None
    d = float(days)
    if d <= 2.0:
        return "#10B981"  # Green
    if d <= 5.0:
        return "#F59E0B"  # Amber
    return "#F43F5E"      # Red


def get_missing_swipe_color(rate: Optional[Union[float, int]]) -> Optional[str]:
    """Return executive color for missing swipe rate (<5% green, 5-15% amber, >15% red)."""
    if rate is None or pd.isna(rate):
        return None
    r = float(rate)
    if r < 5.0:
        return "#10B981"  # Green
    if r <= 15.0:
        return "#F59E0B"  # Amber
    return "#F43F5E"      # Red


def format_metric_value(
    val: Optional[Union[float, int]],
    format_type: str,
    metric_id: Optional[str] = None,
) -> Optional[str]:
    """Format a metric value for display based on its format type and metric id."""
    if val is None or pd.isna(val):
        return None
    fval = float(val)
    if metric_id in ("leave_application_compliance", "wfh_application_compliance"):
        return format_timing_days(fval, "leave" if "leave" in metric_id else "WFH")
    if format_type == "percentage":
        return f"{fval:.1f}%"
    if format_type == "days":
        d_str = f"{int(round(fval))}" if abs(fval - round(fval)) < 0.05 else f"{fval:.1f}"
        return f"{d_str} d"
    if format_type == "time":
        return format_time_minutes(fval)
    if format_type == "duration":
        return format_duration_minutes(fval)
    if format_type == "integer":
        return f"{int(round(fval))}"
    return f"{fval:.2f}"


def format_period_label(period_month_str: str) -> str:
    """Format '2026-08-01' into 'Aug 2026'."""
    try:
        dt = datetime.strptime(period_month_str, "%Y-%m-01")
        return dt.strftime("%b %Y")
    except Exception:
        return period_month_str


# ── Monthly Point Contract ──────────────────────────────────────────────

@dataclass
class TrendPoint:
    period: str                      # "2026-08-01"
    period_display: str              # "Aug 2026"
    value: Optional[float]           # Metric value (in minutes for time/duration, % for rate, days for turnaround/timing)
    formatted_value: Optional[str]   # Human readable representation (e.g. "84.0%", "8h 14m", "Applied 5 days before leave")
    
    # Denominator & governance context
    total_applicable: Optional[int] = None
    evaluable: Optional[int] = None
    excluded_data_quality: Optional[int] = None
    numerator: Optional[int] = None
    denominator: Optional[int] = None
    rate: Optional[float] = None
    valid_observation_count: Optional[int] = None
    
    # Volume status
    volume_status: Optional[str] = None
    volume_label: Optional[str] = None

    # MoM movement
    previous_value: Optional[float] = None
    mom_change: Optional[float] = None
    mom_change_pp: Optional[float] = None

    # Timing & Submitter breakdowns (Leave & WFH compliance)
    timing_display: Optional[str] = None
    pct_before: Optional[float] = None
    pct_same_day: Optional[float] = None
    pct_after: Optional[float] = None
    count_before: Optional[int] = None
    count_same_day: Optional[int] = None
    count_after: Optional[int] = None
    pct_employee: Optional[float] = None
    pct_admin: Optional[float] = None
    pct_unknown: Optional[float] = None
    count_employee: Optional[int] = None
    count_admin: Optional[int] = None
    count_unknown: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── Monthly Aggregations ────────────────────────────────────────────────

def extract_canonical_month(dt: Any) -> Optional[str]:
    """Extract canonical 'YYYY-MM-01' period string from any date representation."""
    if dt is None or pd.isna(dt):
        return None
    if isinstance(dt, str):
        # Fast path for standard ISO 'YYYY-MM-DD' strings
        if len(dt) >= 7 and dt[4] == "-" and dt[:4].isdigit() and dt[5:7].isdigit():
            return f"{dt[:7]}-01"
    elif isinstance(dt, (date, datetime)):
        return f"{dt.year:04d}-{dt.month:02d}-01"
    try:
        ts = pd.to_datetime(dt, format="mixed", errors="coerce")
        if pd.isna(ts):
            return None
        return ts.strftime("%Y-%m-01")
    except Exception:
        return None


def calculate_monthly_compliance(
    evaluated_df: pd.DataFrame,
    evaluated_requests: Optional[List[Dict[str, Any]]],
    metric_id: str,
) -> List[TrendPoint]:
    """Aggregate monthly compliance metrics with timing and submitter source breakdowns."""
    points: List[TrendPoint] = []

    if metric_id == "leave_application_compliance":
        if not evaluated_requests:
            return []
        req_df = pd.DataFrame(evaluated_requests)
        if req_df.empty or "request_start_date" not in req_df.columns:
            return []

        if "_month" not in req_df.columns:
            req_df["_month"] = pd.to_datetime(req_df["request_start_date"], format="mixed", errors="coerce").dt.strftime("%Y-%m-01")
        valid_reqs = req_df[req_df["_month"].notna()].copy()

        for p_month in sorted(valid_reqs["_month"].unique()):
            m_group = valid_reqs[valid_reqs["_month"] == p_month]
            tot = len(m_group)
            dq_ex = int((m_group["compliance_status"] == "DATA_QUALITY_UNCERTAIN").sum()) if "compliance_status" in m_group.columns else 0
            evaluable_group = m_group[m_group["compliance_status"] != "DATA_QUALITY_UNCERTAIN"] if "compliance_status" in m_group.columns else m_group
            evaluable = len(evaluable_group)

            lag_series = []
            for _, r in evaluable_group.iterrows():
                app_on = r.get("applied_on")
                st_dt = r.get("request_start_date")
                if app_on is not None and pd.notna(app_on) and st_dt is not None and pd.notna(st_dt):
                    try:
                        app_d = pd.to_datetime(app_on).date()
                        st_d = pd.to_datetime(st_dt).date()
                        lag_series.append((app_d - st_d).days)
                    except Exception:
                        pass

            valid_lags = pd.Series(lag_series, dtype=float) if lag_series else pd.Series([], dtype=float)
            obs_cnt = len(valid_lags)

            if not valid_lags.empty:
                avg_timing = round(float(valid_lags.mean()), 1)
                before_cnt = int((valid_lags < 0).sum())
                same_cnt = int((valid_lags == 0).sum())
                after_cnt = int((valid_lags > 0).sum())
                pct_before = round((before_cnt / obs_cnt) * 100.0, 1)
                pct_same = round((same_cnt / obs_cnt) * 100.0, 1)
                pct_after = round((after_cnt / obs_cnt) * 100.0, 1)
            else:
                avg_timing = None
                before_cnt = same_cnt = after_cnt = 0
                pct_before = pct_same = pct_after = None

            emp_cnt = adm_cnt = unk_cnt = 0
            for _, r in evaluable_group.iterrows():
                src_val = r.get("applied_by") or r.get("Applied By") or ""
                s_str = str(src_val).strip().lower()
                if "emp" in s_str:
                    emp_cnt += 1
                elif "adm" in s_str or "hr" in s_str or "sys" in s_str:
                    adm_cnt += 1
                elif not s_str or s_str in ("na", "none", "unknown", "nan", ""):
                    unk_cnt += 1
                else:
                    unk_cnt += 1

            src_total = emp_cnt + adm_cnt + unk_cnt
            if src_total > 0:
                pct_emp = round((emp_cnt / src_total) * 100.0, 1)
                pct_adm = round((adm_cnt / src_total) * 100.0, 1)
                pct_unk = round((unk_cnt / src_total) * 100.0, 1)
            else:
                pct_emp = pct_adm = pct_unk = None

            vol_st = classify_volume_status(obs_cnt if obs_cnt > 0 else evaluable)
            vol_lbl = f"Volume: {vol_st.capitalize()} · {obs_cnt} evaluable timing request{'s' if obs_cnt != 1 else ''}"

            points.append(TrendPoint(
                period=p_month,
                period_display=format_period_label(p_month),
                value=avg_timing,
                formatted_value=format_timing_days(avg_timing, "leave") if avg_timing is not None else "Insufficient Data",
                timing_display=format_timing_days(avg_timing, "leave"),
                total_applicable=tot,
                evaluable=obs_cnt if obs_cnt > 0 else evaluable,
                excluded_data_quality=dq_ex,
                numerator=before_cnt + same_cnt,
                denominator=obs_cnt if obs_cnt > 0 else evaluable,
                rate=round(((before_cnt + same_cnt) / obs_cnt) * 100.0, 1) if obs_cnt > 0 else None,
                valid_observation_count=obs_cnt,
                volume_status=vol_st,
                volume_label=vol_lbl,
                pct_before=pct_before,
                pct_same_day=pct_same,
                pct_after=pct_after,
                count_before=before_cnt,
                count_same_day=same_cnt,
                count_after=after_cnt,
                pct_employee=pct_emp,
                pct_admin=pct_adm,
                pct_unknown=pct_unk,
                count_employee=emp_cnt,
                count_admin=adm_cnt,
                count_unknown=unk_cnt,
            ))

    elif metric_id == "wfh_application_compliance":
        wfh_df = evaluated_df[evaluated_df["policy_event_type"] == "WFH"].copy() if "policy_event_type" in evaluated_df.columns else pd.DataFrame()
        if wfh_df.empty or "Date" not in wfh_df.columns:
            return []

        if "_month" not in wfh_df.columns:
            wfh_df["_month"] = pd.to_datetime(wfh_df["Date"], format="mixed", errors="coerce").dt.strftime("%Y-%m-01")
        valid_wfh = wfh_df[wfh_df["_month"].notna()].copy()

        for p_month in sorted(valid_wfh["_month"].unique()):
            m_group = valid_wfh[valid_wfh["_month"] == p_month]
            tot = len(m_group)
            comp_c = "compliance_status" if "compliance_status" in m_group.columns else ("Compliance Status" if "Compliance Status" in m_group.columns else None)
            dq_ex = int((m_group[comp_c] == "DATA_QUALITY_UNCERTAIN").sum()) if comp_c else 0
            evaluable_group = m_group[m_group[comp_c] != "DATA_QUALITY_UNCERTAIN"] if comp_c else m_group
            evaluable = len(evaluable_group)

            lag_series = []
            for _, r in evaluable_group.iterrows():
                app_on = r.get("Applied On") or r.get("applied_on")
                wfh_dt = r.get("Date")
                if app_on is not None and pd.notna(app_on) and wfh_dt is not None and pd.notna(wfh_dt):
                    try:
                        app_d = pd.to_datetime(app_on).date()
                        wfh_d = pd.to_datetime(wfh_dt).date()
                        lag_series.append((app_d - wfh_d).days)
                    except Exception:
                        pass

            valid_lags = pd.Series(lag_series, dtype=float) if lag_series else pd.Series([], dtype=float)
            obs_cnt = len(valid_lags)

            if not valid_lags.empty:
                avg_timing = round(float(valid_lags.mean()), 1)
                before_cnt = int((valid_lags < 0).sum())
                same_cnt = int((valid_lags == 0).sum())
                after_cnt = int((valid_lags > 0).sum())
                pct_before = round((before_cnt / obs_cnt) * 100.0, 1)
                pct_same = round((same_cnt / obs_cnt) * 100.0, 1)
                pct_after = round((after_cnt / obs_cnt) * 100.0, 1)
            else:
                avg_timing = None
                before_cnt = same_cnt = after_cnt = 0
                pct_before = pct_same = pct_after = None

            emp_cnt = adm_cnt = unk_cnt = 0
            for _, r in evaluable_group.iterrows():
                src_val = r.get("Applied By") or r.get("applied_by") or ""
                s_str = str(src_val).strip().lower()
                if "emp" in s_str:
                    emp_cnt += 1
                elif "adm" in s_str or "hr" in s_str or "sys" in s_str:
                    adm_cnt += 1
                elif not s_str or s_str in ("na", "none", "unknown", "nan", ""):
                    unk_cnt += 1
                else:
                    unk_cnt += 1

            src_total = emp_cnt + adm_cnt + unk_cnt
            if src_total > 0:
                pct_emp = round((emp_cnt / src_total) * 100.0, 1)
                pct_adm = round((adm_cnt / src_total) * 100.0, 1)
                pct_unk = round((unk_cnt / src_total) * 100.0, 1)
            else:
                pct_emp = pct_adm = pct_unk = None

            vol_st = classify_volume_status(obs_cnt if obs_cnt > 0 else evaluable)
            vol_lbl = f"Volume: {vol_st.capitalize()} · {obs_cnt} evaluable WFH request{'s' if obs_cnt != 1 else ''}"

            points.append(TrendPoint(
                period=p_month,
                period_display=format_period_label(p_month),
                value=avg_timing,
                formatted_value=format_timing_days(avg_timing, "WFH") if avg_timing is not None else "Insufficient Data",
                timing_display=format_timing_days(avg_timing, "WFH"),
                total_applicable=tot,
                evaluable=obs_cnt if obs_cnt > 0 else evaluable,
                excluded_data_quality=dq_ex,
                numerator=before_cnt + same_cnt,
                denominator=obs_cnt if obs_cnt > 0 else evaluable,
                rate=round(((before_cnt + same_cnt) / obs_cnt) * 100.0, 1) if obs_cnt > 0 else None,
                valid_observation_count=obs_cnt,
                volume_status=vol_st,
                volume_label=vol_lbl,
                pct_before=pct_before,
                pct_same_day=pct_same,
                pct_after=pct_after,
                count_before=before_cnt,
                count_same_day=same_cnt,
                count_after=after_cnt,
                pct_employee=pct_emp,
                pct_admin=pct_adm,
                pct_unknown=pct_unk,
                count_employee=emp_cnt,
                count_admin=adm_cnt,
                count_unknown=unk_cnt,
            ))

    return points


def calculate_monthly_attendance(
    employee_day_facts: pd.DataFrame,
    metric_id: str,
) -> List[TrendPoint]:
    """Aggregate monthly governed attendance metrics from employee-day facts."""
    if employee_day_facts.empty or "Date" not in employee_day_facts.columns:
        return []

    facts = employee_day_facts.copy()
    if "_month" not in facts.columns:
        facts["_month"] = pd.to_datetime(facts["Date"], format="mixed", errors="coerce").dt.strftime("%Y-%m-01")
    valid_facts = facts[facts["_month"].notna()].copy()

    points: List[TrendPoint] = []
    for p_month in sorted(valid_facts["_month"].unique()):
        m_group = valid_facts[valid_facts["_month"] == p_month]
        
        raw_eligible = int((m_group["is_eligible_attendance_day"] == True).sum())
        evaluable_mask = (m_group["is_eligible_attendance_day"] == True) & (m_group["is_metric_evaluable"] == True)
        evaluable = int(evaluable_mask.sum())
        dq_ex = raw_eligible - evaluable

        evaluable_rows = m_group[evaluable_mask]

        if metric_id == "missing_swipe_rate":
            num = int((evaluable_rows["has_missing_swipe"] == True).sum())
        elif metric_id == "absence_rate":
            num = int((evaluable_rows["has_absent"] == True).sum())
        elif metric_id == "regularization_rate":
            num = int((evaluable_rows["has_regularization"] == True).sum())
        else:
            num = 0

        rate = _safe_rate(num, evaluable)
        vol_st = classify_volume_status(evaluable)
        vol_lbl = f"Volume: {vol_st.capitalize()} · {evaluable} evaluable employee-days"

        points.append(TrendPoint(
            period=p_month,
            period_display=format_period_label(p_month),
            value=rate,
            formatted_value=format_metric_value(rate, "percentage", metric_id),
            total_applicable=raw_eligible,
            evaluable=evaluable,
            valid_observation_count=evaluable,
            excluded_data_quality=dq_ex,
            numerator=num,
            denominator=evaluable,
            rate=rate,
            volume_status=vol_st,
            volume_label=vol_lbl,
        ))

    return points


def calculate_monthly_approvals(
    evaluated_df: pd.DataFrame,
    metric_id: str,
    analysis_as_of_date: Optional[Union[date, datetime]] = None,
) -> List[TrendPoint]:
    """Aggregate monthly manager approval cycle metrics grouped by application month."""
    if evaluated_df.empty or "Applied On" not in evaluated_df.columns:
        return []

    df = evaluated_df.copy()
    if "_app_month" not in df.columns:
        df["_app_month"] = pd.to_datetime(df["Applied On"], format="mixed", errors="coerce").dt.strftime("%Y-%m-01")
    valid_df = df[df["_app_month"].notna()].copy()
    if valid_df.empty:
        return []

    if "approval_state" not in valid_df.columns:
        valid_df["approval_state"] = valid_df["Approval Status"].apply(normalize_approval_state) if "Approval Status" in valid_df.columns else "UNKNOWN"

    # As of date for pending age
    if analysis_as_of_date is None:
        if "Date" in evaluated_df.columns:
            d_series = pd.to_datetime(evaluated_df["Date"], format="mixed", errors="coerce").dropna()
            if not d_series.empty:
                analysis_as_of_date = d_series.max().date()
            else:
                analysis_as_of_date = date.today()
        else:
            analysis_as_of_date = date.today()
    elif isinstance(analysis_as_of_date, datetime):
        analysis_as_of_date = analysis_as_of_date.date()

    points: List[TrendPoint] = []
    as_of_ts = pd.Timestamp(analysis_as_of_date) if analysis_as_of_date else pd.Timestamp(date.today())

    for p_month in sorted(valid_df["_app_month"].unique()):
        m_group = valid_df[valid_df["_app_month"] == p_month]
        
        approved_rows = m_group[m_group["approval_state"] == "APPROVED"]
        valid_turnarounds = (
            approved_rows["approval_turnaround_days"].dropna().astype(float)
            if "approval_turnaround_days" in approved_rows.columns
            else pd.Series([], dtype=float)
        )
        valid_obs = len(valid_turnarounds)

        pending_rows = m_group[m_group["approval_state"] == "PENDING"]
        pending_cnt = len(pending_rows)

        val: Optional[float] = None
        fmt_type = "days"

        if metric_id == "median_approval_turnaround":
            val = round(float(valid_turnarounds.median()), 2) if not valid_turnarounds.empty else None
        elif metric_id == "average_approval_turnaround":
            val = round(float(valid_turnarounds.mean()), 2) if not valid_turnarounds.empty else None
        elif metric_id == "pending_approval_count":
            val = float(pending_cnt)
            fmt_type = "integer"
            valid_obs = pending_cnt
        elif metric_id == "average_pending_approval_age":
            if not pending_rows.empty and "Applied On" in pending_rows.columns:
                app_ts = pd.to_datetime(pending_rows["Applied On"], format="mixed", errors="coerce")
                ages = (as_of_ts - app_ts).dt.days
                valid_ages = ages[(ages >= 0) & ages.notna()]
                val = round(float(valid_ages.mean()), 2) if not valid_ages.empty else None
                valid_obs = len(valid_ages)
            else:
                val = None
                valid_obs = 0

        vol_st = classify_volume_status(valid_obs)
        vol_lbl = f"Volume: {vol_st.capitalize()} · {valid_obs} observation{'s' if valid_obs != 1 else ''}"

        points.append(TrendPoint(
            period=p_month,
            period_display=format_period_label(p_month),
            value=val,
            formatted_value=format_metric_value(val, fmt_type, metric_id),
            evaluable=valid_obs,
            valid_observation_count=valid_obs,
            denominator=valid_obs,
            volume_status=vol_st,
            volume_label=vol_lbl,
        ))

    return points


def _extract_time_minutes_series(df: pd.DataFrame, kind: str) -> pd.Series:
    """
    Robustly extract minutes from midnight (0..1439) for arrival/exit or duration minutes.
    Searches all canonical, internal, and source column aliases.
    """
    if df.empty:
        return pd.Series([], dtype=float)

    if kind == "in":
        candidates = [
            "in_time_minutes", "_in_mins", "In Time", "First In", "First In Time",
            "in_time", "first_in", "first_in_time", "Punch In", "punch_in",
            "Clock In", "clock_in", "arrival_time", "Arrival Time"
        ]
    elif kind == "out":
        candidates = [
            "out_time_minutes", "_out_mins", "Out Time", "Last Out", "Last Out Time",
            "out_time", "last_out", "last_out_time", "Punch Out", "punch_out",
            "Clock Out", "clock_out", "departure_time", "Departure Time", "exit_time", "Exit Time"
        ]
    else:  # duration / working hours
        candidates = [
            "effective_hours_minutes", "total_hours_minutes", "_work_hours",
            "Effective Hours", "Total Hours", "Total Duration", "Duration",
            "Work Hours", "effective_hours", "total_hours", "work_hours"
        ]

    for col in candidates:
        if col in df.columns:
            s = df[col].dropna()
            if s.empty:
                continue
            if col in ("in_time_minutes", "_in_mins", "out_time_minutes", "_out_mins", "effective_hours_minutes", "total_hours_minutes"):
                nums = pd.to_numeric(s, errors="coerce").dropna()
                if not nums.empty:
                    return nums.astype(float)
            elif col == "_work_hours":
                nums = pd.to_numeric(s, errors="coerce").dropna()
                if not nums.empty:
                    return (nums * 60.0).astype(float)
            else:
                from workforce_intelligence.normalization import parse_time_to_minutes, parse_duration_to_minutes
                parse_fn = parse_duration_to_minutes if kind == "duration" else parse_time_to_minutes
                parsed = s.apply(parse_fn).dropna()
                if not parsed.empty:
                    return parsed.astype(float)

    return pd.Series([], dtype=float)


def calculate_monthly_working_time(
    evaluated_df: pd.DataFrame,
    metric_id: str,
) -> List[TrendPoint]:
    """
    Aggregate monthly working time metrics (minutes internally, formatted for display).
    Only includes rows where Attendance Status is P or P(MS).
    """
    if evaluated_df.empty or "Date" not in evaluated_df.columns:
        return []

    df = evaluated_df.copy()
    if "_month" not in df.columns:
        df["_month"] = pd.to_datetime(df["Date"], format="mixed", errors="coerce").dt.strftime("%Y-%m-01")
    valid_df = df[df["_month"].notna()].copy()
    if valid_df.empty:
        return []

    # Strictly filter rows to Attendance Status in ('P', 'P(MS)')
    status_col = None
    for sc in ("Status", "_status", "Attendance Status"):
        if sc in valid_df.columns:
            status_col = sc
            break
    if status_col:
        st_clean = valid_df[status_col].astype(str).str.strip().str.upper()
        valid_df = valid_df[st_clean.isin(["P", "P(MS)", "P (MS)"])].copy()
    if valid_df.empty:
        return []

    points: List[TrendPoint] = []
    for p_month in sorted(valid_df["_month"].unique()):
        m_group = valid_df[valid_df["_month"] == p_month]

        val: Optional[float] = None
        fmt_type = "duration" if "hours" in metric_id else "time"
        valid_obs = 0

        if metric_id in ("average_effective_hours", "median_effective_hours"):
            series = _extract_time_minutes_series(m_group, "duration")
            valid_obs = len(series)
            if not series.empty:
                val = round(float(series.mean()), 1) if metric_id == "average_effective_hours" else round(float(series.median()), 1)

        elif metric_id in ("average_arrival_time", "median_arrival_time"):
            series = _extract_time_minutes_series(m_group, "in")
            valid_obs = len(series)
            if not series.empty:
                val = round(float(series.mean()), 1) if metric_id == "average_arrival_time" else round(float(series.median()), 1)

        elif metric_id in ("average_exit_time", "median_exit_time"):
            series = _extract_time_minutes_series(m_group, "out")
            valid_obs = len(series)
            if not series.empty:
                val = round(float(series.mean()), 1) if metric_id == "average_exit_time" else round(float(series.median()), 1)

        vol_st = classify_volume_status(valid_obs)
        vol_lbl = f"Volume: {vol_st.capitalize()} · {valid_obs} observation{'s' if valid_obs != 1 else ''}"

        points.append(TrendPoint(
            period=p_month,
            period_display=format_period_label(p_month),
            value=val,
            formatted_value=format_metric_value(val, fmt_type, metric_id),
            evaluable=valid_obs,
            valid_observation_count=valid_obs,
            denominator=valid_obs,
            volume_status=vol_st,
            volume_label=vol_lbl,
        ))

    return points


# ── Time-Series Comparisons & Indicators ─────────────────────────────────

def attach_mom_comparisons(points: List[TrendPoint], metric_def: TrendMetricDefinition) -> List[TrendPoint]:
    """Calculate and attach Month-over-Month changes to each point in the series."""
    for i in range(len(points)):
        if i == 0:
            points[i].previous_value = None
            points[i].mom_change = None
            points[i].mom_change_pp = None
        else:
            prev_val = points[i - 1].value
            curr_val = points[i].value
            points[i].previous_value = prev_val
            if prev_val is not None and curr_val is not None:
                diff = round(curr_val - prev_val, 2)
                points[i].mom_change = diff
                if metric_def.format == "percentage":
                    points[i].mom_change_pp = diff
            else:
                points[i].mom_change = None
                points[i].mom_change_pp = None
    return points


def calculate_trend_direction(
    points: List[TrendPoint],
    metric_def: TrendMetricDefinition,
) -> str:
    """
    Determine deterministic trend direction:
    - If fewer than 3 points: INSUFFICIENT_DATA
    - Uses 3-month window linear slope vs materiality threshold
    - Directional: IMPROVING, DETERIORATING, STABLE
    - Neutral: INCREASING, DECREASING, STABLE
    """
    valid_points = [p for p in points if p.value is not None]
    if len(valid_points) < 3:
        return "INSUFFICIENT_DATA"

    # Take most recent 3 months
    window = valid_points[-3:]
    y = [p.value for p in window]
    x = [0.0, 1.0, 2.0]

    # Linear slope
    slope = float(np.polyfit(x, y, 1)[0])
    threshold = get_materiality_threshold(metric_def)

    if metric_def.direction == "higher_is_better":
        if slope >= threshold:
            return "IMPROVING"
        if slope <= -threshold:
            return "DETERIORATING"
        return "STABLE"

    elif metric_def.direction == "lower_is_better":
        if slope <= -threshold:
            return "IMPROVING"
        if slope >= threshold:
            return "DETERIORATING"
        return "STABLE"

    else:  # "neutral"
        if slope >= threshold:
            return "INCREASING"
        if slope <= -threshold:
            return "DECREASING"
        return "STABLE"


def calculate_streak(
    points: List[TrendPoint],
    metric_def: TrendMetricDefinition,
) -> Tuple[Optional[str], int]:
    """
    Calculate consecutive monthly movement in the same direction above materiality threshold.
    Returns (trend_streak_direction, trend_streak_months).
    """
    valid_points = [p for p in points if p.value is not None]
    if len(valid_points) < 2:
        return None, 0

    threshold = get_materiality_threshold(metric_def)
    
    # Check latest step
    latest_delta = valid_points[-1].value - valid_points[-2].value
    if abs(latest_delta) < threshold:
        return "STABLE", 0

    # Determine step direction
    if metric_def.direction == "higher_is_better":
        target_dir = "IMPROVING" if latest_delta > 0 else "DETERIORATING"
    elif metric_def.direction == "lower_is_better":
        target_dir = "IMPROVING" if latest_delta < 0 else "DETERIORATING"
    else:
        target_dir = "INCREASING" if latest_delta > 0 else "DECREASING"

    # Count consecutive backwards
    streak_count = 0
    for i in range(len(valid_points) - 1, 0, -1):
        delta = valid_points[i].value - valid_points[i - 1].value
        if abs(delta) < threshold:
            break

        if metric_def.direction == "higher_is_better":
            step_dir = "IMPROVING" if delta > 0 else "DETERIORATING"
        elif metric_def.direction == "lower_is_better":
            step_dir = "IMPROVING" if delta < 0 else "DETERIORATING"
        else:
            step_dir = "INCREASING" if delta > 0 else "DECREASING"

        if step_dir == target_dir:
            streak_count += 1
        else:
            break

    return target_dir, streak_count


def detect_regression(
    points: List[TrendPoint],
    metric_def: TrendMetricDefinition,
) -> bool:
    """
    Detect deterministic trend regression:
    Only triggers after meaningful prior improvement followed by sustained deterioration.
    """
    valid_points = [p for p in points if p.value is not None]
    if len(valid_points) < 3 or metric_def.direction == "neutral":
        return False

    threshold = get_materiality_threshold(metric_def)

    # Compute step directions for all consecutive pairs
    step_dirs = []
    for i in range(1, len(valid_points)):
        delta = valid_points[i].value - valid_points[i - 1].value
        if abs(delta) < threshold:
            step_dirs.append("STABLE")
        elif metric_def.direction == "higher_is_better":
            step_dirs.append("IMPROVING" if delta > 0 else "DETERIORATING")
        else:
            step_dirs.append("IMPROVING" if delta < 0 else "DETERIORATING")

    # Look for at least one prior IMPROVING step followed by recent DETERIORATING steps
    has_prior_improvement = False
    for d in step_dirs[:-1]:
        if d == "IMPROVING":
            has_prior_improvement = True
            break

    latest_is_deteriorating = step_dirs[-1] == "DETERIORATING"
    # Sustained or meaningful deterioration: either last 2 steps deteriorating or last step deteriorating after improvement
    if has_prior_improvement and latest_is_deteriorating:
        # Check if the cumulative deterioration reverses prior gains
        if len(step_dirs) >= 2 and step_dirs[-2] == "DETERIORATING":
            return True
        # Or if latest deterioration exceeds cumulative prior improvement
        if len(step_dirs) >= 2 and step_dirs[-2] == "IMPROVING":
            prior_delta = abs(valid_points[-2].value - valid_points[-3].value)
            recent_deterioration = abs(valid_points[-1].value - valid_points[-2].value)
            if recent_deterioration >= prior_delta * 0.8:
                return True

    return False


def generate_trend_observations(
    points: List[TrendPoint],
    metric_def: TrendMetricDefinition,
    current_value: Optional[float],
    previous_value: Optional[float],
    mom_change: Optional[float],
    first_value: Optional[float],
    change_since_first: Optional[float],
    trend_direction: str,
    streak_direction: Optional[str],
    streak_months: int,
    regression_detected: bool,
    volume_status: Optional[str],
) -> List[str]:
    """Generate 3-5 deterministic, management intelligence observations (no AI)."""
    obs: List[str] = []
    label = metric_def.label

    if len(points) == 0:
        return ["No workforce data is available for the selected filters."]

    if len(points) == 1:
        single = points[0]
        obs.append(f"The dataset contains only one month ({single.period_display}); more history is required to determine a trend.")
        if single.formatted_value:
            obs.append(f"{label} for {single.period_display} was {single.formatted_value}.")
        if single.denominator is not None:
            ex_txt = f" ({single.excluded_data_quality} excluded for data quality)" if single.excluded_data_quality else ""
            obs.append(f"Evaluated across {single.denominator} evaluable units{ex_txt} ({single.volume_status or 'Low'} volume).")
        return obs

    latest = points[-1]
    curr_fmt = latest.formatted_value

    # 1. MoM change statement
    if mom_change is not None and previous_value is not None:
        prev_fmt = format_metric_value(previous_value, metric_def.format)
        if metric_def.format == "percentage":
            direction_word = "increased" if mom_change > 0 else "decreased"
            abs_pp = abs(mom_change)
            obs.append(f"{label} {direction_word} by {abs_pp:.1f} percentage points in {latest.period_display} (from {prev_fmt} to {curr_fmt}).")
        elif metric_def.format == "days":
            direction_word = "increased" if mom_change > 0 else "decreased"
            abs_days = abs(mom_change)
            obs.append(f"{label} {direction_word} by {abs_days:.1f} days in {latest.period_display} (from {prev_fmt} to {curr_fmt}).")
        elif metric_def.format in ("duration", "time"):
            direction_word = "increased" if mom_change > 0 else "decreased"
            abs_mins = abs(mom_change)
            obs.append(f"{label} moved by {abs_mins:.0f} minutes in {latest.period_display} (current: {curr_fmt}).")
        else:
            obs.append(f"{label} changed from {prev_fmt} to {curr_fmt} in {latest.period_display}.")

    # 2. Change since first available month
    if len(points) >= 3 and change_since_first is not None and first_value is not None:
        first_p = points[0]
        first_fmt = format_metric_value(first_value, metric_def.format)
        if metric_def.format == "percentage":
            net_word = "up" if change_since_first > 0 else "down"
            obs.append(f"Net change since {first_p.period_display} is {net_word} {abs(change_since_first):.1f} percentage points (baseline: {first_fmt}).")
        elif metric_def.format == "days":
            net_word = "up" if change_since_first > 0 else "down"
            obs.append(f"Turnaround is {net_word} {abs(change_since_first):.1f} days compared to {first_p.period_display} ({first_fmt}).")

    # 3. Streak or Direction Statement
    if streak_months >= 2 and streak_direction:
        dir_word = streak_direction.lower()
        obs.append(f"{label} has been {dir_word} for {streak_months} consecutive months.")
    elif trend_direction in ("IMPROVING", "DETERIORATING"):
        obs.append(f"Recent short-term trajectory indicates a {trend_direction.lower()} trend.")
    elif trend_direction == "STABLE":
        obs.append(f"{label} has remained stable over the recent 3-month window within the materiality threshold.")

    # 4. Regression Warning
    if regression_detected:
        obs.append("Performance regression detected: prior gains were reversed by recent deterioration.")

    # 5. Volume Context
    if latest.volume_status == "LOW" and latest.denominator is not None:
        obs.append(f"{latest.period_display} {label} is based on only {latest.denominator} evaluable observation{'s' if latest.denominator != 1 else ''} (Low volume).")

    # Keep between 3 and 5 observations
    return obs[:5]


# ── Primary Engine Function ─────────────────────────────────────────────

def calculate_time_series_trends(
    evaluated_df: pd.DataFrame,
    evaluated_requests: Optional[List[Dict[str, Any]]] = None,
    employee_day_facts: Optional[pd.DataFrame] = None,
    metric_id: str = "missing_swipe_rate",
    analysis_as_of_date: Optional[Union[date, datetime]] = None,
) -> Dict[str, Any]:
    """
    Main analytical engine entrypoint for Workforce Trends.
    Takes normalized, policy-evaluated datasets and generates a complete,
    deterministic time-series response.
    """
    if metric_id not in TREND_METRICS:
        raise ValueError(f"Unknown trend metric '{metric_id}'. Must be one of {list(TREND_METRICS.keys())}")

    metric_def = TREND_METRICS[metric_id]

    if metric_def.category == "Attendance" and employee_day_facts is None:
        employee_day_facts = build_employee_day_facts(evaluated_df)

    df_eval_included = (
        evaluated_df[evaluated_df["include_in_analysis"] == True].copy()
        if "include_in_analysis" in evaluated_df.columns
        else evaluated_df.copy()
    )

    # 1. Monthly Aggregations
    if metric_def.category == "Compliance":
        raw_points = calculate_monthly_compliance(df_eval_included, evaluated_requests, metric_id)
    elif metric_def.category == "Attendance":
        raw_points = calculate_monthly_attendance(employee_day_facts, metric_id)
    elif metric_def.category == "Approval":
        raw_points = calculate_monthly_approvals(df_eval_included, metric_id, analysis_as_of_date)
    elif metric_def.category == "Working Time":
        raw_points = calculate_monthly_working_time(df_eval_included, metric_id)
    else:
        raw_points = []

    # 2. Attach MoM comparisons
    points = attach_mom_comparisons(raw_points, metric_def)

    # 3. Overall Time Series Summary
    valid_points = [p for p in points if p.value is not None]

    current_val: Optional[float] = valid_points[-1].value if valid_points else None
    current_fmt: Optional[str] = valid_points[-1].formatted_value if valid_points else None
    current_period: Optional[str] = valid_points[-1].period if valid_points else None
    current_period_display: Optional[str] = valid_points[-1].period_display if valid_points else None

    previous_val: Optional[float] = valid_points[-2].value if len(valid_points) >= 2 else None
    previous_fmt: Optional[str] = valid_points[-2].formatted_value if len(valid_points) >= 2 else None

    mom_change: Optional[float] = None
    mom_change_pp: Optional[float] = None
    if current_val is not None and previous_val is not None:
        mom_change = round(current_val - previous_val, 2)
        if metric_def.format == "percentage":
            mom_change_pp = mom_change

    first_val: Optional[float] = valid_points[0].value if valid_points else None
    first_fmt: Optional[str] = valid_points[0].formatted_value if valid_points else None
    change_since_first: Optional[float] = None
    change_since_first_pp: Optional[float] = None
    if current_val is not None and first_val is not None:
        change_since_first = round(current_val - first_val, 2)
        if metric_def.format == "percentage":
            change_since_first_pp = change_since_first

    # 4. Trend Direction, Streak, Regression, Volume
    direction = calculate_trend_direction(points, metric_def)
    streak_dir, streak_months = calculate_streak(points, metric_def)
    regression_detected = detect_regression(points, metric_def)
    vol_status = valid_points[-1].volume_status if valid_points else None

    # 5. Deterministic Observations
    observations = generate_trend_observations(
        points=points,
        metric_def=metric_def,
        current_value=current_val,
        previous_value=previous_val,
        mom_change=mom_change,
        first_value=first_val,
        change_since_first=change_since_first,
        trend_direction=direction,
        streak_direction=streak_dir,
        streak_months=streak_months,
        regression_detected=regression_detected,
        volume_status=vol_status,
    )

    # 6. Overall Date Range Display
    if len(points) > 0:
        first_dt = datetime.strptime(points[0].period, "%Y-%m-01")
        last_dt = datetime.strptime(points[-1].period, "%Y-%m-01")
        if first_dt.year == last_dt.year and first_dt.month == last_dt.month:
            date_range_display = first_dt.strftime("%B %Y")
        else:
            date_range_display = f"{first_dt.strftime('%B')}–{last_dt.strftime('%B %Y')}"
    else:
        date_range_display = "No data"

    return {
        "metric": metric_def.to_dict(),
        "time_series": [p.to_dict() for p in points],
        "current_period": current_period,
        "current_period_display": current_period_display,
        "current_value": current_val,
        "current_value_formatted": current_fmt,
        "previous_value": previous_val,
        "previous_value_formatted": previous_fmt,
        "mom_change": mom_change,
        "mom_change_pp": mom_change_pp,
        "first_available_value": first_val,
        "first_available_value_formatted": first_fmt,
        "change_since_first": change_since_first,
        "change_since_first_pp": change_since_first_pp,
        "trend_direction": direction,
        "streak_direction": streak_dir,
        "streak_months": streak_months,
        "regression_detected": regression_detected,
        "volume_status": vol_status,
        "observations": observations,
        "date_range_display": date_range_display,
        "policy_effective_date": POLICY_EFFECTIVE_DATE_STR,
    }
