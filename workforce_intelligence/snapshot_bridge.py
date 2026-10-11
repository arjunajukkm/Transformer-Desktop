"""
workforce_intelligence/snapshot_bridge.py
────────────────────────────────────────
Thread-safe analytical bridge connecting AnalyticalSnapshot to the
Workforce Intelligence KPI calculation engine.

Provides the decoupled, UI-independent analytical service interface:
- Retrieves active snapshot and canonical foundation without reloading data.
- Bounded LRU cache (default 128 items) for on-demand filtered requests.
- Automatic cache invalidation when the active dataset is replaced.
- Supports background execution without UI or disk blocking.
- Provides benchmarking tools for initial computation vs. cached retrieval.
"""

from collections import OrderedDict
from dataclasses import asdict
from datetime import date, datetime
import threading
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from storage.cache_manager import (
    AnalyticalSnapshot,
    CacheManager,
    snapshot_cache,
    _defensive_copy_dict,
)
from workforce_intelligence.kpi_engine import (
    EmployeeMonthWFH,
    EmployeePunchDeviation,
    RepeatExceptionDossier,
    _empty_bundle,
    compute_punch_deviations_bu,
    compute_repeated_exceptions,
    compute_wfh_allowance_monthly,
    compute_workforce_intelligence_bundle,
    ensure_clean_dataframe,
    get_effective_bu,
)
from workforce_intelligence.patterns import (
    detect_patterns,
    PatternResult,
    PatternSummary,
)
from workforce_intelligence.metrics import build_employee_day_facts
from workforce_intelligence.policy import evaluate_policy
from workforce_intelligence.trends import (
    TREND_METRICS,
    TrendMetricDefinition,
    calculate_time_series_trends,
    format_metric_value,
    format_benchmark_diff,
    get_approval_turnaround_color,
    get_missing_swipe_color,
    get_materiality_threshold,
    POLICY_EFFECTIVE_DATE_STR,
)
from workforce_intelligence.olap_engine import OLAPRollupEngine
import time_series_analysis as tsa


def _norm_str(val: Optional[str]) -> Optional[str]:
    """Normalize filter strings to None if empty or 'All'."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("all", "all business units", "all departments", "all managers", "all reporting managers", "all employees", "none", "nan"):
        return None
    return s.lower()


def _norm_emp(val: Optional[str]) -> Optional[str]:
    """Normalize employee filter string to stable employee ID prefix if format is 'EMP001 — Name'."""
    s = _norm_str(val)
    if s is None:
        return None
    if " — " in s:
        return s.split(" — ")[0].strip()
    return s


def _safe_point_volume(pt: Optional[Dict[str, Any]]) -> int:
    """Extract evaluable volume or valid observation count as guaranteed integer >= 0."""
    if not pt or not isinstance(pt, dict):
        return 0
    for key in ("evaluable", "valid_observation_count", "denominator", "total_applicable"):
        val = pt.get(key)
        if val is not None and not pd.isna(val):
            try:
                return max(0, int(val))
            except (ValueError, TypeError):
                pass
    return 0


def _filter_workforce_df(
    df: pd.DataFrame,
    business_unit: Optional[str] = None,
    department: Optional[str] = None,
    manager: Optional[str] = None,
    employee: Optional[str] = None,
    date_range: Optional[Tuple[date, date]] = None,
) -> pd.DataFrame:
    if df is None or df.empty:
        return df if df is not None else pd.DataFrame()

    filtered = df

    # 1. Business Unit
    if business_unit and str(business_unit).strip() not in ("All", "All Business Units", "", "None", "nan"):
        bu_clean = str(business_unit).strip().lower()
        if "_eff_bu" in filtered.columns:
            bu_series = filtered["_eff_bu"].astype(str).str.strip().str.lower()
        elif "Business Unit" in filtered.columns:
            bu_series = filtered["Business Unit"].astype(str).str.strip().str.lower()
        elif "_bu" in filtered.columns:
            bu_series = filtered["_bu"].astype(str).str.strip().str.lower()
        else:
            bu_series = None

        if bu_series is not None:
            if bu_clean in ("unknown", "unknown / unassigned", "unassigned"):
                filtered = filtered[bu_series.isin(("unknown / unassigned", "unknown", "unassigned", "", "nan", "none"))]
            else:
                if "_bu" in filtered.columns and "_eff_bu" in filtered.columns:
                    raw_bu_series = filtered["_bu"].astype(str).str.strip().str.lower()
                    filtered = filtered[(bu_series == bu_clean) | (raw_bu_series == bu_clean)]
                else:
                    filtered = filtered[bu_series == bu_clean]

    # 2. Department
    if department and str(department).strip() not in ("All", "All Departments", "", "None", "nan"):
        dept_clean = str(department).strip().lower()
        dept_col = "_dept" if "_dept" in filtered.columns else ("Department" if "Department" in filtered.columns else None)
        if dept_col:
            dept_series = filtered[dept_col].astype(str).str.strip().str.lower()
            if dept_clean in ("unknown", "unknown / unassigned", "unassigned"):
                filtered = filtered[filtered[dept_col].isna() | dept_series.isin(("unknown / unassigned", "unknown", "unassigned", "", "nan", "none"))]
            else:
                filtered = filtered[dept_series == dept_clean]

    # 3. Manager
    if manager and str(manager).strip() not in ("All", "All Managers", "All Reporting Managers", "", "None", "nan"):
        mgr_clean = str(manager).strip().lower()
        mgr_col = "_rm" if "_rm" in filtered.columns else ("Reporting Manager" if "Reporting Manager" in filtered.columns else None)
        if mgr_col:
            mgr_series = filtered[mgr_col].astype(str).str.strip().str.lower()
            if mgr_clean in ("unknown", "unknown / unassigned", "unassigned"):
                filtered = filtered[filtered[mgr_col].isna() | mgr_series.isin(("unknown / unassigned", "unknown", "unassigned", "", "nan", "none"))]
            else:
                filtered = filtered[mgr_series == mgr_clean]

    # 4. Employee
    if employee and str(employee).strip() not in ("All", "All Employees", "", "None", "nan"):
        emp_raw = str(employee).strip()
        if " — " in emp_raw:
            emp_id_key = emp_raw.split(" — ")[0].strip().lower()
        elif " - " in emp_raw:
            emp_id_key = emp_raw.split(" - ")[0].strip().lower()
        else:
            emp_id_key = emp_raw.lower()

        emp_num_col = "_emp_num" if "_emp_num" in filtered.columns else ("Employee Number" if "Employee Number" in filtered.columns else None)
        emp_name_col = "_emp_name" if "_emp_name" in filtered.columns else ("Employee Name" if "Employee Name" in filtered.columns else None)

        if emp_num_col and emp_name_col:
            filtered = filtered[
                (filtered[emp_num_col].astype(str).str.strip().str.lower() == emp_id_key) |
                (filtered[emp_name_col].astype(str).str.strip().str.lower() == emp_raw.lower())
            ]
        elif emp_num_col:
            filtered = filtered[filtered[emp_num_col].astype(str).str.strip().str.lower() == emp_id_key]

    # 5. Date Range (Vectorized)
    if date_range and len(date_range) == 2:
        raw_start, raw_end = date_range
        if raw_start is not None and raw_end is not None:
            start_d = raw_start.date() if isinstance(raw_start, datetime) else raw_start
            end_d = raw_end.date() if isinstance(raw_end, datetime) else raw_end
            if isinstance(start_d, date) and isinstance(end_d, date):
                if start_d > end_d:
                    return filtered.iloc[0:0].copy()
                d_col = "_date" if "_date" in filtered.columns else ("Date" if "Date" in filtered.columns else None)
                if d_col and not filtered.empty:
                    d_series = pd.to_datetime(filtered[d_col], errors="coerce").dt.date
                    filtered = filtered[(d_series >= start_d) & (d_series <= end_d)]

    return filtered


def _derive_employee_hierarchy(
    df: pd.DataFrame,
    employee: Optional[str],
    olap_engine: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """
    Given an employee identifier or raw string, extract their:
    - emp_num: Employee Number / ID
    - emp_name: Full Employee Name
    - dept: Department / Function
    - bu: Business Unit
    - manager: Reporting Manager
    """
    if olap_engine is not None and hasattr(olap_engine, "get_employee_hierarchy"):
        res = olap_engine.get_employee_hierarchy(employee)
        if res.get("emp_num") or res.get("dept") or res.get("bu") or res.get("manager"):
            return res

    if df is None or df.empty or not employee:
        return {"emp_num": None, "emp_name": None, "dept": None, "bu": None, "manager": None}

    emp_raw = str(employee).strip()
    if " — " in emp_raw:
        emp_id_key = emp_raw.split(" — ")[0].strip().lower()
    elif " - " in emp_raw:
        emp_id_key = emp_raw.split(" - ")[0].strip().lower()
    else:
        emp_id_key = emp_raw.lower()

    emp_num_col = "_emp_num" if "_emp_num" in df.columns else ("Employee Number" if "Employee Number" in df.columns else None)
    emp_name_col = "_emp_name" if "_emp_name" in df.columns else ("Employee Name" if "Employee Name" in df.columns else None)

    matched = pd.DataFrame()
    if emp_num_col and emp_name_col:
        matched = df[
            (df[emp_num_col].astype(str).str.strip().str.lower() == emp_id_key) |
            (df[emp_name_col].astype(str).str.strip().str.lower() == emp_raw.lower())
        ]
    elif emp_num_col:
        matched = df[df[emp_num_col].astype(str).str.strip().str.lower() == emp_id_key]
    elif emp_name_col:
        matched = df[df[emp_name_col].astype(str).str.strip().str.lower() == emp_raw.lower()]

    if matched.empty and emp_name_col:
        matched = df[df[emp_name_col].astype(str).str.strip().str.lower().str.contains(emp_id_key, regex=False, na=False)]

    if matched.empty:
        return {"emp_num": None, "emp_name": emp_raw, "dept": None, "bu": None, "manager": None}

    def _get_val(cols):
        for c in cols:
            if c in matched.columns:
                s = matched[c].dropna().astype(str).str.strip()
                s = s[~s.isin(("", "None", "nan", "Unknown", "unknown", "none"))]
                if not s.empty:
                    return s.mode().iloc[0]
        return None

    emp_num = _get_val(["_emp_num", "Employee Number"])
    emp_name = _get_val(["_emp_name", "Employee Name"]) or emp_raw
    dept = _get_val(["_dept", "Department", "Function"])
    bu = _get_val(["_eff_bu", "Business Unit", "_bu"])
    rm = _get_val(["_rm", "Reporting Manager", "Reporting Manager Name"])

    return {
        "emp_num": emp_num,
        "emp_name": emp_name,
        "dept": dept,
        "bu": bu,
        "manager": rm,
    }


def _derive_manager_hierarchy(
    df: pd.DataFrame,
    manager: Optional[str],
    olap_engine: Optional[Any] = None,
) -> Dict[str, Optional[str]]:
    """
    Given a reporting manager identifier or raw string, extract their:
    - mgr_name: Clean Manager Name
    - dept: Department / Function (derived from team members or manager record)
    - bu: Business Unit (derived from team members or manager record)
    """
    if olap_engine is not None and hasattr(olap_engine, "get_manager_hierarchy"):
        res = olap_engine.get_manager_hierarchy(manager)
        if res.get("dept") or res.get("bu") or res.get("mgr_name"):
            return res

    if df is None or df.empty or not manager:
        return {"mgr_name": None, "dept": None, "bu": None}

    mgr_raw = str(manager).strip()
    mgr_clean = mgr_raw.lower()
    mgr_col = "_rm" if "_rm" in df.columns else ("Reporting Manager" if "Reporting Manager" in df.columns else None)

    team_matched = pd.DataFrame()
    if mgr_col:
        team_matched = df[df[mgr_col].astype(str).str.strip().str.lower() == mgr_clean]
        if team_matched.empty:
            team_matched = df[df[mgr_col].astype(str).str.strip().str.lower().str.contains(mgr_clean, regex=False, na=False)]

    emp_name_col = "_emp_name" if "_emp_name" in df.columns else ("Employee Name" if "Employee Name" in df.columns else None)
    mgr_as_emp = pd.DataFrame()
    if emp_name_col:
        mgr_as_emp = df[df[emp_name_col].astype(str).str.strip().str.lower() == mgr_clean]

    def _get_val_from(dframe, cols):
        for c in cols:
            if c in dframe.columns:
                s = dframe[c].dropna().astype(str).str.strip()
                s = s[~s.isin(("", "None", "nan", "Unknown", "unknown", "none"))]
                if not s.empty:
                    return s.mode().iloc[0]
        return None

    source_df = team_matched if not team_matched.empty else mgr_as_emp

    dept = _get_val_from(source_df, ["_dept", "Department", "Function"])
    bu = _get_val_from(source_df, ["_eff_bu", "Business Unit", "_bu"])
    clean_name = _get_val_from(source_df, ["_rm", "Reporting Manager"]) or mgr_raw

    return {
        "mgr_name": clean_name,
        "dept": dept,
        "bu": bu,
    }


def _empty_trend_bundle(metric_id: str = "missing_swipe_rate", benchmark_type: str = "ORGANIZATION") -> Dict[str, Any]:
    metric_def = TREND_METRICS.get(metric_id, TREND_METRICS["missing_swipe_rate"])
    return {
        "metric_id": metric_id,
        "metric_def": metric_def.to_dict(),
        "benchmark_type": benchmark_type,
        "benchmark_label": "Organisation",
        "date_range_display": "No dataset loaded",
        "policy_effective_date": POLICY_EFFECTIVE_DATE_STR,
        "time_series": [],
        "org_time_series": [],
        "benchmark_time_series": [],
        "historical_baseline_value": None,
        "historical_baseline_formatted": "—",
        "current_period": None,
        "current_period_display": None,
        "trend_pulse": [
            {"title": "Current Value", "value": "—", "sub": "Selected Metric Value", "note": "Awaiting dataset ingestion", "color": None},
            {"title": "MoM Change", "value": "—", "sub": "vs last month", "note": "Month-over-month trajectory", "color": None},
            {"title": "3-Month Trend", "value": "—", "sub": "Trajectory", "note": "Trailing directional pattern", "color": None},
            {"title": "Benchmark Gap", "value": "—", "sub": f"vs {benchmark_type.lower()}", "note": "Performance vs target baseline", "color": None},
            {"title": "Data Confidence", "value": "—", "sub": "Awaiting Data", "note": "0 observations recorded", "color": None},
        ],
        "pulse": {
            "current_value": None,
            "current_value_formatted": "—",
            "previous_value": None,
            "previous_value_formatted": "—",
            "mom_change": None,
            "mom_change_formatted": "—",
            "mom_change_pp": None,
            "trend_direction": "INSUFFICIENT_DATA",
            "streak_direction": None,
            "streak_months": 0,
            "gap_vs_benchmark": None,
            "gap_vs_benchmark_formatted": "—",
            "benchmark_label": "Organisation",
            "volume_status": "LOW",
            "confidence_label": "Awaiting Data",
            "valid_observations": 0,
        },
        "chart": {
            "points": [],
            "metric_id": metric_id,
            "metric_name": metric_def.label,
            "format": metric_def.format,
            "direction": metric_def.direction,
            "reference_range": None,
        },
        "heatmap": {
            "months": [],
            "rows": [],
            "lower_is_better": metric_def.direction == "lower_is_better",
        },
        "bu_heatmap": {
            "months": [],
            "rows": [],
            "lower_is_better": metric_def.direction == "lower_is_better",
        },
        "what_changed": {
            "has_change": False,
            "has_movement": False,
            "title": "What Changed?",
            "headline": "No dataset loaded. Ingest data to evaluate workforce trends.",
            "summary": "No dataset loaded. Ingest data to evaluate workforce trends.",
            "total_change_str": "—",
            "direction": "neutral",
            "drivers": [],
        },
        "patterns": [],
        "benchmark_table": {
            "columns": [
                ("bu", "Business Unit", 160, "w"),
                ("curr", "Current", 80, "w"),
                ("avg3m", "3M Average", 80, "w"),
                ("org", "Organisation", 80, "w"),
                ("hist", "Historical", 80, "w"),
                ("gap", "Gap", 75, "w"),
                ("trend", "Trend", 95, "w"),
                ("volume", "Volume", 90, "w"),
            ],
            "rows": [],
            "total": {},
            "total_row": {},
        },
        "scope_description": "Awaiting Dataset Ingestion",
        "observations": ["No workforce dataset loaded. Ingest a performance file to analyze trends."],
    }


class WorkforceIntelligenceBridge:
    """
    Decoupled analytical service interface for Transformers 2.0 Workforce Intelligence.
    Interacts with TimeSeriesSnapshotService and AnalyticalSnapshot.
    Maintains a thread-safe, bounded LRU cache for workforce KPI requests and
    precomputed canonical dataset foundations for instantaneous multi-metric switching.
    """

    def __init__(
        self,
        snapshot_service: Optional[Any] = None,
        max_cache_size: int = 512,
    ):
        self._service = snapshot_service
        self._max_cache_size = max_cache_size
        self._cache: OrderedDict[Tuple[Any, ...], Dict[str, Any]] = OrderedDict()
        self._last_dataset_id: Optional[str] = None
        self._lock = threading.RLock()

        # Precomputed dataset-level analytical foundation
        self._clean_org_df: Optional[pd.DataFrame] = None
        self._org_eval_df: Optional[pd.DataFrame] = None
        self._org_eval_reqs: Optional[List[Dict[str, Any]]] = None
        self._org_employee_day_facts: Optional[pd.DataFrame] = None
        self._all_bus: List[str] = []
        self._bu_eval_dfs: Dict[str, pd.DataFrame] = {}
        self._bu_eval_reqs: Dict[str, List[Dict[str, Any]]] = {}
        self._bu_employee_day_facts: Dict[str, pd.DataFrame] = {}
        self._pattern_cache: Dict[Tuple[Any, ...], List[Dict[str, Any]]] = {}
        self._org_trends_cache: Dict[str, Dict[str, Any]] = {}
        self._bu_trends_cache: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._olap_engine: Optional[OLAPRollupEngine] = None
        self._global_pattern_pool: List[Dict[str, Any]] = []
        self._pattern_computing_keys: Set[Tuple[Any, ...]] = set()

    @property
    def service(self):
        if self._service is not None:
            return self._service
        from storage.snapshot_service import snapshot_service
        return snapshot_service

    def _sync_dataset_state(self, snap: Optional[AnalyticalSnapshot]) -> None:
        """Invalidate cached results if the active dataset has changed or been purged."""
        current_id = snap.dataset_id if snap and snap.is_valid() else None
        if current_id != self._last_dataset_id:
            with self._lock:
                self._cache.clear()
                self._pattern_cache.clear()
                self._org_trends_cache.clear()
                self._bu_trends_cache.clear()
                self._clean_org_df = None
                self._org_eval_df = None
                self._org_eval_reqs = None
                self._org_employee_day_facts = None
                self._all_bus = []
                self._bu_eval_dfs.clear()
                self._bu_eval_reqs.clear()
                self._bu_employee_day_facts.clear()
                self._olap_engine = None
                self._global_pattern_pool.clear()
                self._pattern_computing_keys.clear()
                self._last_dataset_id = current_id

    def _format_pattern_results(self, pattern_results: List[Any]) -> List[Dict[str, Any]]:
        """Format PatternResult domain objects into UI presentation dictionary contracts."""
        pattern_items = []
        for p in pattern_results[:5]:
            p_title = getattr(p, "pattern_title", getattr(p, "pattern_name", getattr(p, "pattern_type", "Governance Pattern")))
            p_desc = getattr(p, "description", getattr(p, "why_detected", "Recurring behavioral or process pattern observed."))
            p_why = getattr(p, "why_detected", p_desc)
            p_scope = getattr(p, "entity_name", getattr(p, "entity_id", "Organisation"))
            e_type = getattr(p, "entity_type", "EMPLOYEE")
            if hasattr(e_type, "replace"):
                scope_str = f"{e_type.replace('_', ' ').title()}: {p_scope}"
            else:
                scope_str = f"Scope: {p_scope}"
            pers = str(getattr(p, "persistence", "Single Period")).replace("_", " ").title()
            ev_cnt = getattr(p, "event_count", len(getattr(p, "evidence_items", [])))
            d_mo = getattr(p, "distinct_months", 1)

            pattern_items.append({
                "id": getattr(p, "pattern_id", "pat_item"),
                "name": p_title,
                "pattern_name": p_title,
                "pattern_title": p_title,
                "category": getattr(p, "pattern_category", "Attendance"),
                "badge": getattr(p, "severity", "ATTENTION"),
                "severity": getattr(p, "severity", "ATTENTION"),
                "strength": getattr(p, "strength", "MEDIUM"),
                "explanation": p_desc,
                "scope": scope_str,
                "persistence": pers,
                "volume": f"{ev_cnt} events ({d_mo} mo)",
                "why_detected": p_why,
                "score": getattr(p, "pattern_score", 50.0),
            })
        return pattern_items

    def _trigger_background_pattern_detection(
        self,
        pat_cache_key: Tuple[Any, ...],
        scoped_eval_df: pd.DataFrame,
        scoped_eval_reqs: List[Dict[str, Any]],
        scoped_facts: pd.DataFrame,
    ) -> None:
        """Trigger asynchronous non-blocking pattern detection on a daemon worker."""
        with self._lock:
            if pat_cache_key in self._pattern_cache or pat_cache_key in self._pattern_computing_keys:
                return
            self._pattern_computing_keys.add(pat_cache_key)

        def _worker():
            try:
                from workforce_intelligence.patterns import detect_patterns
                _, results = detect_patterns(scoped_eval_df, scoped_eval_reqs, employee_day_facts=scoped_facts)
                items = self._format_pattern_results(results)
                with self._lock:
                    self._pattern_cache[pat_cache_key] = items
                    if pat_cache_key == ("all", "all", "all", "all", "all"):
                        self._global_pattern_pool = items
            except Exception:
                pass
            finally:
                with self._lock:
                    self._pattern_computing_keys.discard(pat_cache_key)

        t = threading.Thread(target=_worker, daemon=True)
        t.start()

    def get_cascaded_filter_options(
        self,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Instant sub-millisecond retrieval of dependent filter dropdowns from OLAP dimension catalog."""
        if self._olap_engine is not None:
            return self._olap_engine.get_cascaded_filter_options(
                business_unit=business_unit,
                department=department,
                manager=manager,
            )
        return None

    def _ensure_dataset_foundation(self, raw_df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Dict[str, Any]], pd.DataFrame, List[str]]:
        """
        Compute or retrieve canonical evaluated org_eval_df, evaluated requests,
        employee_day_facts, and BU partitions in a single unified pass.
        """
        with self._lock:
            if self._org_eval_df is not None and self._org_employee_day_facts is not None:
                return self._org_eval_df, self._org_eval_reqs or [], self._org_employee_day_facts, self._all_bus

            org_df = ensure_clean_dataframe(raw_df)
            org_eval_df, org_eval_reqs = evaluate_policy(org_df)
            org_facts = build_employee_day_facts(org_eval_df)

            # Discover all distinct BUs
            if "_eff_bu" in org_eval_df.columns:
                bu_col = org_eval_df["_eff_bu"]
            else:
                bu_col = org_eval_df.get("_bu", pd.Series([], dtype=str))
            raw_bus = [str(b).strip() for b in bu_col.dropna().unique() if str(b).strip() not in ("", "nan", "None")]
            all_bus = sorted(list(set(raw_bus)))

            # Pre-partition BU slices for ultra-fast heatmap and peer benchmarks
            bu_eval_dfs = {}
            bu_facts = {}
            bu_reqs = {}
            for bu_name in all_bus:
                b_clean = bu_name.strip().lower()
                if b_clean in ("unknown", "unknown / unassigned", "unassigned"):
                    bu_mask = org_eval_df["_eff_bu"].astype(str).str.strip().str.lower().isin(("unknown / unassigned", "unknown", "unassigned", "", "nan", "none"))
                else:
                    bu_mask = (org_eval_df["_eff_bu"].astype(str).str.strip().str.lower() == b_clean) | (org_eval_df.get("_bu", pd.Series([], dtype=str)).astype(str).str.strip().str.lower() == b_clean)
                b_df = org_eval_df[bu_mask]
                bu_eval_dfs[bu_name] = b_df
                
                # Partition requests
                if not b_df.empty and "request_id" in b_df.columns:
                    b_req_ids = set(b_df["request_id"].dropna().unique())
                    bu_reqs[bu_name] = [r for r in org_eval_reqs if r.get("request_id") in b_req_ids]
                else:
                    bu_reqs[bu_name] = []

                # Partition employee day facts
                if not org_facts.empty and "Business Unit" in org_facts.columns:
                    b_f_mask = org_facts["Business Unit"].astype(str).str.strip().str.lower() == b_clean
                    bu_facts[bu_name] = org_facts[b_f_mask]
                else:
                    bu_facts[bu_name] = org_facts.iloc[0:0].copy()

            self._clean_org_df = org_df
            self._org_eval_df = org_eval_df
            self._org_eval_reqs = org_eval_reqs
            self._org_employee_day_facts = org_facts
            self._all_bus = all_bus
            self._bu_eval_dfs = bu_eval_dfs
            self._bu_employee_day_facts = bu_facts
            self._bu_eval_reqs = bu_reqs

            # Initialize Vectorized Columnar OLAP Engine with evaluated foundation
            try:
                self._olap_engine = OLAPRollupEngine(
                    org_eval_df,
                    employee_day_facts=org_facts,
                    evaluated_requests=org_eval_reqs,
                )
                active_snap = self.service.get_active_snapshot() if hasattr(self, "service") else None
                if active_snap and hasattr(active_snap, "olap_engine"):
                    active_snap.olap_engine = self._olap_engine
            except Exception as e:
                self._olap_engine = None

            # Asynchronously pre-warm global pattern pool in background daemon
            self._trigger_background_pattern_detection(
                ("all", "all", "all", "all", "all"),
                org_eval_df,
                org_eval_reqs,
                org_facts,
            )

            return self._org_eval_df, self._org_eval_reqs, self._org_employee_day_facts, self._all_bus

    def get_cached_trend_intelligence(
        self,
        metric_id: str = "missing_swipe_rate",
        benchmark_type: str = "ORGANIZATION",
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Fast synchronous check for cached trend intelligence bundle (0ms response)."""
        snap = self.service.get_active_snapshot()
        if not snap or not snap.is_valid():
            return None

        current_id = snap.dataset_id if snap and snap.is_valid() else None
        if current_id != self._last_dataset_id:
            return None

        bench_mode = str(benchmark_type or "ORGANIZATION").strip().upper()
        if "HIST" in bench_mode:
            bench_mode = "HISTORICAL"
        elif "PEER" in bench_mode:
            bench_mode = "PEER"
        else:
            bench_mode = "ORGANIZATION"

        bu_key = _norm_str(business_unit)
        dept_key = _norm_str(department)
        mgr_key = _norm_str(manager)
        emp_key = _norm_emp(employee)
        dr_key = (date_range[0], date_range[1]) if date_range and len(date_range) == 2 else None

        cache_key = (
            "TREND_INTEL_V2",
            metric_id,
            bench_mode,
            bu_key,
            dept_key,
            mgr_key,
            emp_key,
            dr_key,
        )

        with self._lock:
            if cache_key in self._cache:
                self._cache.move_to_end(cache_key)
                return _defensive_copy_dict(self._cache[cache_key])
        return None

    def precompute_trend_metrics(
        self,
        benchmark_type: str = "ORGANIZATION",
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
    ) -> None:
        """Precompute all 18 trend metrics for the active scope in the background."""
        for m_id in TREND_METRICS.keys():
            try:
                self.get_trend_intelligence(
                    metric_id=m_id,
                    benchmark_type=benchmark_type,
                    business_unit=business_unit,
                    department=department,
                    manager=manager,
                    employee=employee,
                    date_range=date_range,
                )
            except Exception:
                pass

    def get_workforce_metrics(
        self,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
        exception_threshold: int = 3,
        wfh_allowance: float = 3.0,
        late_departure_threshold_mins: float = 60.0,
    ) -> Dict[str, Any]:
        """
        Retrieve comprehensive Workforce Intelligence KPI bundle.
        Uses cached results if available for identical filter parameters.
        Otherwise computes from the active snapshot's shared fact DataFrame.
        """
        snap = self.service.get_active_snapshot()
        if not snap or not snap.is_valid():
            return _empty_bundle(exception_threshold, wfh_allowance)

        self._sync_dataset_state(snap)

        bu_key = _norm_str(business_unit)
        dept_key = _norm_str(department)
        mgr_key = _norm_str(manager)
        emp_key = _norm_emp(employee)
        dr_key = (date_range[0], date_range[1]) if date_range and len(date_range) == 2 else None

        cache_key = (
            bu_key,
            dept_key,
            mgr_key,
            emp_key,
            dr_key,
            int(exception_threshold),
            float(wfh_allowance),
            float(late_departure_threshold_mins),
        )

        with self._lock:
            if cache_key in self._cache:
                self._cache.move_to_end(cache_key)
                return _defensive_copy_dict(self._cache[cache_key])

        # Compute new bundle using the shared DataFrame (read-only contract)
        foundation = getattr(snap, "workforce_foundation", None)
        bundle = compute_workforce_intelligence_bundle(
            df=snap.fact_df,
            canonical_data=foundation,
            business_unit=business_unit,
            department=department,
            manager=manager,
            employee=employee,
            date_range=date_range,
            exception_threshold=exception_threshold,
            wfh_allowance=wfh_allowance,
            late_departure_threshold_mins=late_departure_threshold_mins,
        )

        with self._lock:
            self._cache[cache_key] = bundle
            if len(self._cache) > self._max_cache_size:
                self._cache.popitem(last=False)

        return _defensive_copy_dict(bundle)

    def get_wfh_allowance_audit(
        self,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
        wfh_allowance: float = 3.0,
    ) -> Dict[str, Any]:
        """
        Retrieve WFH allowance audit records and summary.
        Reuses cached workforce bundle if available.
        """
        bundle = self.get_workforce_metrics(
            business_unit=business_unit,
            department=department,
            manager=manager,
            employee=employee,
            date_range=date_range,
            wfh_allowance=wfh_allowance,
        )
        return {
            "summary": bundle.get("wfh_monthly_summary", {}),
            "breakdown": bundle.get("wfh_employee_month_breakdown", []),
            "partially_observed_months": bundle.get("wfh_partially_observed_months", []),
            "total_additional_wfh_days": bundle.get("wfh_total_additional_days", 0.0),
            "employees_exceeding_allowance": bundle.get("wfh_employees_exceeding_allowance", 0),
        }

    def get_punch_deviations(
        self,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
        deviation_threshold_mins: float = 60.0,
    ) -> Dict[str, Any]:
        """
        Retrieve Business Unit benchmark deviations for employees.
        """
        bundle = self.get_workforce_metrics(
            business_unit=business_unit,
            department=department,
            manager=manager,
            employee=employee,
            date_range=date_range,
            late_departure_threshold_mins=deviation_threshold_mins,
        )
        return {
            "bu_benchmarks": bundle.get("bu_benchmarks", {}),
            "deviations": bundle.get("employee_punch_deviations", []),
            "late_arrival_count": bundle.get("late_arrival_employees_count", 0),
            "early_departure_count": bundle.get("early_departure_employees_count", 0),
        }

    def get_repeated_exceptions(
        self,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
        threshold: int = 3,
    ) -> Dict[str, Any]:
        """
        Retrieve repeated attendance exception dossiers.
        """
        bundle = self.get_workforce_metrics(
            business_unit=business_unit,
            department=department,
            manager=manager,
            employee=employee,
            date_range=date_range,
            exception_threshold=threshold,
        )
        return {
            "threshold": bundle.get("repeated_exception_threshold", threshold),
            "affected_employees_count": bundle.get("repeated_exception_employees_count", 0),
            "affected_rate_pct": bundle.get("repeated_exception_rate_pct", 0.0),
            "dossiers": bundle.get("repeated_exception_dossiers", []),
        }

    def get_trend_intelligence(
        self,
        metric_id: str = "missing_swipe_rate",
        benchmark_type: str = "ORGANIZATION",
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
        date_range: Optional[Tuple[date, date]] = None,
        analysis_as_of_date: Optional[Union[date, datetime]] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve complete deterministic Workforce Trend Intelligence bundle:
        - Time series trajectories for the active filter scope.
        - Contextual comparison modes (Employee vs Dept vs BU vs Org, or Manager vs Dept vs BU vs Org).
        - 5 Contextual Trend Pulse cards.
        - Contextual comparison matrix (Month x [Entity, Dept, BU, Org]) and summary rows.
        - Contextual What Changed? driver narrative.
        - Top 3-5 Emerging Patterns from patterns.py.
        - Multi-dimension benchmark table.
        """
        snap = self.service.get_active_snapshot()
        if not snap or not snap.is_valid():
            return _empty_trend_bundle(metric_id, benchmark_type)

        self._sync_dataset_state(snap)

        if metric_id not in TREND_METRICS:
            metric_id = "missing_swipe_rate"
        metric_def = TREND_METRICS[metric_id]

        bench_mode = str(benchmark_type or "ORGANIZATION").strip().upper()
        if "HIST" in bench_mode:
            bench_mode = "HISTORICAL"
            bench_label = "Historical Baseline"
        elif "PEER" in bench_mode:
            bench_mode = "PEER"
            bench_label = "Peer Business Unit"
        else:
            bench_mode = "ORGANIZATION"
            bench_label = "Organisation"

        bu_key = _norm_str(business_unit)
        dept_key = _norm_str(department)
        mgr_key = _norm_str(manager)
        emp_key = _norm_emp(employee)
        dr_key = (date_range[0], date_range[1]) if date_range and len(date_range) == 2 else None

        cache_key = (
            "TREND_INTEL_V5",
            metric_id,
            bench_mode,
            bu_key,
            dept_key,
            mgr_key,
            emp_key,
            dr_key,
        )

        with self._lock:
            if cache_key in self._cache:
                self._cache.move_to_end(cache_key)
                return _defensive_copy_dict(self._cache[cache_key])

        raw_df = snap.fact_df
        if raw_df is None or len(raw_df) == 0:
            return _empty_trend_bundle(metric_id, bench_mode)

        # Single-pass evaluated dataset foundation
        org_eval_df, org_eval_reqs, org_facts, all_bus = self._ensure_dataset_foundation(raw_df)

        # Detect comparison mode
        is_employee_mode = emp_key is not None
        is_manager_mode = (mgr_key is not None) and not is_employee_mode
        if is_employee_mode:
            comparison_mode = "EMPLOYEE"
        elif is_manager_mode:
            comparison_mode = "MANAGER"
        else:
            comparison_mode = "NORMAL"

        is_approval_metric = metric_id in (
            "median_approval_turnaround",
            "average_approval_turnaround",
            "pending_approval_count",
            "average_pending_approval_age",
        )

        # 1. Scoped Dataset slice
        is_global_scope = (bu_key is None and dept_key is None and mgr_key is None and emp_key is None and dr_key is None)
        if is_global_scope:
            scoped_eval_df = org_eval_df
            scoped_eval_reqs = org_eval_reqs
            scoped_facts = org_facts
        elif comparison_mode == "MANAGER" and is_approval_metric:
            # For manager approval metrics: evaluate manager's own approval behavior
            mgr_clean = str(manager).strip().lower()
            scoped_eval_reqs = [
                r for r in org_eval_reqs
                if str(r.get("approved_by") or "").strip().lower() == mgr_clean
                or str(r.get("reporting_manager") or "").strip().lower() == mgr_clean
            ]
            sc_req_ids = {r.get("request_id") for r in scoped_eval_reqs if r.get("request_id")}
            if "request_id" in org_eval_df.columns:
                scoped_eval_df = org_eval_df[org_eval_df["request_id"].isin(sc_req_ids)]
            else:
                scoped_eval_df = _filter_workforce_df(org_eval_df, manager=manager, date_range=date_range)
            scoped_facts = _filter_workforce_df(org_facts, manager=manager, date_range=date_range)
        else:
            scoped_eval_df = _filter_workforce_df(
                org_eval_df,
                business_unit=business_unit,
                department=department,
                manager=manager,
                employee=employee,
                date_range=date_range,
            )
            if scoped_eval_df.empty:
                scoped_eval_reqs = []
                scoped_facts = org_facts.iloc[0:0].copy()
            else:
                if "request_id" in scoped_eval_df.columns:
                    sc_req_ids = set(scoped_eval_df["request_id"].dropna().unique())
                    scoped_eval_reqs = [r for r in org_eval_reqs if r.get("request_id") in sc_req_ids]
                else:
                    scoped_eval_reqs = org_eval_reqs
                scoped_facts = _filter_workforce_df(
                    org_facts,
                    business_unit=business_unit,
                    department=department,
                    manager=manager,
                    employee=employee,
                    date_range=date_range,
                )

        # 2. Main Scoped Trend & Benchmarks via Vectorized OLAP Engine (< 5ms)
        if self._olap_engine is not None:
            scope_trend = self._olap_engine.query_trend_response(
                metric_id=metric_id,
                business_unit=business_unit,
                department=department,
                manager=manager,
                employee=employee,
                date_range=date_range,
                analysis_as_of_date=analysis_as_of_date,
            )
            with self._lock:
                if metric_id in self._org_trends_cache:
                    org_trend = self._org_trends_cache[metric_id]
                else:
                    org_trend = self._olap_engine.query_trend_response(
                        metric_id=metric_id,
                        analysis_as_of_date=analysis_as_of_date,
                    )
                    self._org_trends_cache[metric_id] = org_trend

            bu_trends = self._olap_engine.query_all_bu_benchmarks(
                metric_id, all_bus, analysis_as_of_date=analysis_as_of_date
            )
        else:
            scope_trend = calculate_time_series_trends(
                scoped_eval_df,
                scoped_eval_reqs,
                employee_day_facts=scoped_facts,
                metric_id=metric_id,
                analysis_as_of_date=analysis_as_of_date,
            )

            # Cached Org-level Trend per metric_id
            with self._lock:
                if metric_id in self._org_trends_cache:
                    org_trend = self._org_trends_cache[metric_id]
                else:
                    org_trend = calculate_time_series_trends(
                        org_eval_df,
                        org_eval_reqs,
                        employee_day_facts=org_facts,
                        metric_id=metric_id,
                        analysis_as_of_date=analysis_as_of_date,
                    )
                    self._org_trends_cache[metric_id] = org_trend

            # 3. BU-level time series for heatmap and peer benchmarks
            bu_trends: Dict[str, Dict[str, Any]] = {}
            for bu_name in all_bus:
                bu_cache_k = (bu_name, metric_id)
                with self._lock:
                    if bu_cache_k in self._bu_trends_cache:
                        bu_trends[bu_name] = self._bu_trends_cache[bu_cache_k]
                        continue

                b_df = self._bu_eval_dfs.get(bu_name)
                b_reqs = self._bu_eval_reqs.get(bu_name, [])
                b_facts = self._bu_employee_day_facts.get(bu_name)

                if b_df is not None and not b_df.empty:
                    b_tr = calculate_time_series_trends(
                        b_df,
                        b_reqs,
                        employee_day_facts=b_facts,
                        metric_id=metric_id,
                        analysis_as_of_date=analysis_as_of_date,
                    )
                else:
                    b_tr = {"time_series": []}

                with self._lock:
                    self._bu_trends_cache[bu_cache_k] = b_tr
                bu_trends[bu_name] = b_tr

        org_series = org_trend.get("time_series", [])
        scope_series = scope_trend.get("time_series", [])

        # 4. Contextual Hierarchy & Department / BU Benchmarks
        derived_dept = None
        derived_bu = None
        derived_rm = None
        entity_label = "Actual"
        dept_label = department if department and str(department).strip() not in ("All", "All Departments", "") else "Department"
        bu_label = business_unit if business_unit and str(business_unit).strip() not in ("All", "All Business Units", "") else "Business Unit"
        org_label = "Organisation"

        dept_trend: Dict[str, Any] = {"time_series": []}
        bu_benchmark_trend: Dict[str, Any] = {"time_series": []}

        derived_dept = None
        derived_bu = None
        derived_rm = None

        if comparison_mode == "EMPLOYEE":
            emp_info = _derive_employee_hierarchy(org_eval_df, employee, olap_engine=self._olap_engine)
            derived_dept = emp_info.get("dept")
            derived_bu = emp_info.get("bu")
            derived_rm = emp_info.get("manager")
            raw_ename = emp_info.get("emp_name") or str(employee)
            if " — " in raw_ename:
                entity_label = raw_ename.split(" — ")[1].strip()
            elif " - " in raw_ename:
                entity_label = raw_ename.split(" - ")[1].strip()
            else:
                entity_label = raw_ename
            dept_label = derived_dept or dept_label
            bu_label = derived_bu or bu_label

        elif comparison_mode == "MANAGER":
            mgr_info = _derive_manager_hierarchy(org_eval_df, manager, olap_engine=self._olap_engine)
            derived_dept = mgr_info.get("dept")
            derived_bu = mgr_info.get("bu")
            entity_label = mgr_info.get("mgr_name") or str(manager)
            dept_label = derived_dept or dept_label
            bu_label = derived_bu or bu_label

        if comparison_mode in ("EMPLOYEE", "MANAGER"):
            dept_df = None
            bu_df = None
            if self._olap_engine is not None:
                if derived_dept:
                    dept_trend = self._olap_engine.query_trend_response(metric_id, department=derived_dept)
                else:
                    dept_trend = org_trend

                if derived_bu:
                    bu_benchmark_trend = self._olap_engine.query_trend_response(metric_id, business_unit=derived_bu)
                else:
                    bu_benchmark_trend = org_trend
            else:
                # Department Benchmark Calculation
                if derived_dept:
                    dept_df = _filter_workforce_df(org_eval_df, department=derived_dept, date_range=date_range)
                    dept_f = _filter_workforce_df(org_facts, department=derived_dept, date_range=date_range)
                    dept_r_ids = set(dept_df["request_id"].dropna().unique()) if "request_id" in dept_df.columns else None
                    dept_r = [r for r in org_eval_reqs if r.get("request_id") in dept_r_ids] if dept_r_ids is not None else org_eval_reqs
                    dept_trend = calculate_time_series_trends(dept_df, dept_r, employee_day_facts=dept_f, metric_id=metric_id, analysis_as_of_date=analysis_as_of_date)
                else:
                    dept_trend = org_trend

                # Business Unit Benchmark Calculation
                if derived_bu:
                    bu_df = _filter_workforce_df(org_eval_df, business_unit=derived_bu, date_range=date_range)
                    bu_f = _filter_workforce_df(org_facts, business_unit=derived_bu, date_range=date_range)
                    bu_r_ids = set(bu_df["request_id"].dropna().unique()) if "request_id" in bu_df.columns else None
                    bu_r = [r for r in org_eval_reqs if r.get("request_id") in bu_r_ids] if bu_r_ids is not None else org_eval_reqs
                    bu_benchmark_trend = calculate_time_series_trends(bu_df, bu_r, employee_day_facts=bu_f, metric_id=metric_id, analysis_as_of_date=analysis_as_of_date)
                else:
                    bu_benchmark_trend = org_trend

            # Scaling for pending_approval_count in manager comparison mode
            if comparison_mode == "MANAGER" and metric_id == "pending_approval_count":
                def _distinct_mgr_count(d_slice):
                    if d_slice is None or d_slice.empty:
                        return 1
                    m_c = "_rm" if "_rm" in d_slice.columns else ("Reporting Manager" if "Reporting Manager" in d_slice.columns else None)
                    if m_c and not d_slice.empty:
                        vals = set(d_slice[m_c].dropna().astype(str).str.strip().str.lower().unique()) - {"", "none", "nan", "unknown"}
                        return max(1, len(vals))
                    return 1

                if self._olap_engine is not None:
                    dept_mgrs = [m for (b, d), mgrs in getattr(self._olap_engine, "_mgrs_by_bu_dept", {}).items() if d == derived_dept for m in mgrs] if derived_dept else []
                    dept_mgr_cnt = max(1, len(set(dept_mgrs))) if dept_mgrs else 1
                    bu_mgrs = getattr(self._olap_engine, "_mgrs_by_bu", {}).get(derived_bu, []) if derived_bu else []
                    bu_mgr_cnt = max(1, len(set(bu_mgrs))) if bu_mgrs else 1
                    org_mgr_cnt = max(1, len(getattr(self._olap_engine, "_all_mgrs", [])))
                else:
                    dept_mgr_cnt = _distinct_mgr_count(dept_df if (derived_dept and dept_df is not None) else org_eval_df)
                    bu_mgr_cnt = _distinct_mgr_count(bu_df if (derived_bu and bu_df is not None) else org_eval_df)
                    org_mgr_cnt = _distinct_mgr_count(org_eval_df)

                dept_trend_series = []
                for pt in dept_trend.get("time_series", []):
                    pt_c = dict(pt)
                    if pt_c.get("value") is not None:
                        val_sc = round(float(pt_c["value"]) / dept_mgr_cnt, 1)
                        pt_c["value"] = val_sc
                        pt_c["formatted_value"] = f"{val_sc:.1f}"
                    dept_trend_series.append(pt_c)
                dept_trend["time_series"] = dept_trend_series

                bu_trend_series = []
                for pt in bu_benchmark_trend.get("time_series", []):
                    pt_c = dict(pt)
                    if pt_c.get("value") is not None:
                        val_sc = round(float(pt_c["value"]) / bu_mgr_cnt, 1)
                        pt_c["value"] = val_sc
                        pt_c["formatted_value"] = f"{val_sc:.1f}"
                    bu_trend_series.append(pt_c)
                bu_benchmark_trend["time_series"] = bu_trend_series

                scaled_org_series = []
                for pt in org_series:
                    pt_c = dict(pt)
                    if pt_c.get("value") is not None:
                        val_sc = round(float(pt_c["value"]) / org_mgr_cnt, 1)
                        pt_c["value"] = val_sc
                        pt_c["formatted_value"] = f"{val_sc:.1f}"
                    scaled_org_series.append(pt_c)
                org_series = scaled_org_series

        # 5. Peer Benchmark & Historical Baseline Series
        periods = [p["period"] for p in org_series]
        peer_points: List[Dict[str, Any]] = []
        hist_points: List[Dict[str, Any]] = []

        # Scope values mapped by period
        scope_pt_map = {p["period"]: p for p in scope_series}
        org_pt_map = {p["period"]: p for p in org_series}
        dept_pt_map = {p["period"]: p for p in dept_trend.get("time_series", [])}
        bu_bench_pt_map = {p["period"]: p for p in bu_benchmark_trend.get("time_series", [])}

        # Calculate Peer Benchmark per period (median of peer BUs)
        for p_idx, period_str in enumerate(periods):
            p_display = org_pt_map[period_str]["period_display"]
            peer_vals = []
            for bu_name, bu_tr in bu_trends.items():
                bu_pts = {pt["period"]: pt for pt in bu_tr.get("time_series", [])}
                if period_str in bu_pts:
                    pt_val = bu_pts[period_str].get("value")
                    ev_cnt = bu_pts[period_str].get("evaluable", 0) or bu_pts[period_str].get("valid_observation_count", 0)
                    if pt_val is not None and ev_cnt is not None and ev_cnt >= 5:
                        peer_vals.append(pt_val)
                    elif pt_val is not None:
                        peer_vals.append(pt_val)

            peer_val = round(float(np.median(peer_vals)), 2) if peer_vals else org_pt_map[period_str].get("value")
            peer_points.append({
                "period": period_str,
                "period_display": p_display,
                "value": peer_val,
                "formatted_value": format_metric_value(peer_val, metric_def.format, metric_id),
            })

            # Historical baseline for scope (trailing 3-month median of preceding months)
            prior_vals = []
            for prev_idx in range(max(0, p_idx - 3), p_idx):
                prev_period = periods[prev_idx]
                if prev_period in scope_pt_map and scope_pt_map[prev_period].get("value") is not None:
                    prior_vals.append(scope_pt_map[prev_period]["value"])
            if prior_vals:
                hist_val = round(float(np.median(prior_vals)), 2)
            else:
                hist_val = scope_pt_map.get(period_str, {}).get("value")

            hist_points.append({
                "period": period_str,
                "period_display": p_display,
                "value": hist_val,
                "formatted_value": format_metric_value(hist_val, metric_def.format, metric_id),
            })

        # Historical baseline overall (median of all previous months in scope)
        all_prior_scope_vals = [p["value"] for p in scope_series[:-1] if p.get("value") is not None]
        if all_prior_scope_vals:
            hist_baseline_val = round(float(np.median(all_prior_scope_vals)), 2)
        elif scope_series and scope_series[-1].get("value") is not None:
            hist_baseline_val = scope_series[-1]["value"]
        else:
            hist_baseline_val = None
        hist_baseline_fmt = format_metric_value(hist_baseline_val, metric_def.format, metric_id) if hist_baseline_val is not None else "—"

        # 6. Active Benchmark Series & Current Value
        if bench_mode == "ORGANIZATION":
            benchmark_series = org_series
            current_bench_val = org_series[-1]["value"] if org_series else None
            current_bench_fmt = org_series[-1]["formatted_value"] if org_series else "—"
        elif bench_mode == "HISTORICAL":
            benchmark_series = hist_points
            current_bench_val = hist_baseline_val
            current_bench_fmt = hist_baseline_fmt
        else:  # "PEER"
            benchmark_series = peer_points
            current_bench_val = peer_points[-1]["value"] if peer_points else None
            current_bench_fmt = peer_points[-1]["formatted_value"] if peer_points else "—"

        # 7. Gap vs Benchmark Calculation
        curr_val = scope_trend.get("current_value")
        if curr_val is not None and current_bench_val is not None:
            gap_val = round(curr_val - current_bench_val, 2)
            gap_fmt = format_benchmark_diff(gap_val, metric_def.format, metric_id)
        else:
            gap_val = None
            gap_fmt = "—"

        # 8. MoM Change Formatted
        mom_change = scope_trend.get("mom_change")
        if mom_change is not None:
            sign_str = "+" if mom_change > 0 else ""
            if metric_def.format == "percentage":
                mom_change_fmt = f"{sign_str}{mom_change:.1f} pp"
            elif metric_def.format == "days":
                mom_change_fmt = f"{sign_str}{mom_change:.1f} d"
            elif metric_def.format in ("duration", "time"):
                mom_change_fmt = f"{sign_str}{mom_change:.0f}m"
            elif metric_def.format == "integer":
                mom_change_fmt = f"{sign_str}{int(round(mom_change))}"
            else:
                mom_change_fmt = f"{sign_str}{mom_change:.1f}"
        else:
            mom_change_fmt = "Baseline (First Month)"

        valid_obs = 0
        if scope_series:
            valid_obs = _safe_point_volume(scope_series[-1])
        vol_status = scope_trend.get("volume_status") or ("HIGH" if valid_obs >= 50 else ("MODERATE" if valid_obs >= 10 else "LOW"))
        conf_label = f"{vol_status.capitalize()} confidence · {valid_obs:,} observations" if valid_obs > 0 else "Low confidence · 0 observations"

        # 9. Chart Combined Points
        chart_points = []
        bench_pt_map = {p["period"]: p for p in benchmark_series}
        hist_pt_map = {p["period"]: p for p in hist_points}

        all_chart_vals = []
        for period_str in periods:
            sc_p = scope_pt_map.get(period_str, {})
            bn_p = bench_pt_map.get(period_str, {})
            hs_p = hist_pt_map.get(period_str, {})
            dp_p = dept_pt_map.get(period_str, {})
            bu_p = bu_bench_pt_map.get(period_str, {})
            og_p = org_pt_map.get(period_str, {})

            v_act = sc_p.get("value")
            v_bn = bn_p.get("value")
            v_hs = hs_p.get("value")
            v_dp = dp_p.get("value")
            v_bu = bu_p.get("value")
            v_og = og_p.get("value")

            if v_act is not None:
                all_chart_vals.append(v_act)
            if v_bn is not None:
                all_chart_vals.append(v_bn)
            if v_dp is not None:
                all_chart_vals.append(v_dp)
            if v_bu is not None:
                all_chart_vals.append(v_bu)

            p_dt = pd.to_datetime(period_str, errors="coerce")
            pol_dt = pd.to_datetime(POLICY_EFFECTIVE_DATE_STR, errors="coerce")
            is_post_pol = bool(pd.notna(p_dt) and pd.notna(pol_dt) and p_dt.date() >= pol_dt.date())
            is_low_vol = bool(sc_p.get("volume_status") == "LOW")

            g_dept = round(v_act - v_dp, 2) if v_act is not None and v_dp is not None else None
            g_bu = round(v_act - v_bu, 2) if v_act is not None and v_bu is not None else None
            g_org = round(v_act - v_og, 2) if v_act is not None and v_og is not None else None

            chart_points.append({
                "period": period_str,
                "period_display": org_pt_map[period_str]["period_display"],
                "actual": v_act,
                "actual_formatted": sc_p.get("formatted_value") or "—",
                "dept_benchmark": v_dp,
                "dept_benchmark_formatted": dp_p.get("formatted_value") or "—",
                "bu_benchmark": v_bu,
                "bu_benchmark_formatted": bu_p.get("formatted_value") or "—",
                "org_benchmark": v_og,
                "org_benchmark_formatted": og_p.get("formatted_value") or "—",
                "benchmark": v_og if comparison_mode in ("EMPLOYEE", "MANAGER") else v_bn,
                "benchmark_formatted": og_p.get("formatted_value") if comparison_mode in ("EMPLOYEE", "MANAGER") else (bn_p.get("formatted_value") or "—"),
                "historical": v_hs,
                "historical_formatted": hs_p.get("formatted_value") or "—",
                "gap_vs_dept": g_dept,
                "gap_vs_dept_formatted": format_benchmark_diff(g_dept, metric_def.format, metric_id),
                "gap_vs_bu": g_bu,
                "gap_vs_bu_formatted": format_benchmark_diff(g_bu, metric_def.format, metric_id),
                "gap_vs_org": g_org,
                "gap_vs_org_formatted": format_benchmark_diff(g_org, metric_def.format, metric_id),
                "is_low_volume": is_low_vol,
                "is_regression": False,
                "is_post_policy": is_post_pol,
                "evaluable": sc_p.get("evaluable") or sc_p.get("valid_observation_count") or 0,
            })

        # Mark regression on chart if detected
        if scope_trend.get("regression_detected") and len(chart_points) >= 1:
            chart_points[-1]["is_regression"] = True

        # Reference Range
        if all_chart_vals:
            ref_min = max(0.0, float(np.percentile(all_chart_vals, 10)))
            ref_max = float(np.percentile(all_chart_vals, 90))
            ref_range = (round(ref_min, 1), round(ref_max, 1))
        else:
            ref_range = None

        # 10. Business Unit Trend Heatmap & Benchmark Table Rows
        heatmap_months = [org_pt_map[p]["period_display"] for p in periods]
        heatmap_rows = []
        table_rows = []

        org_curr_val = org_series[-1]["value"] if org_series else None
        org_curr_fmt = org_series[-1]["formatted_value"] if org_series else "—"
        org_valid_pts = [p["value"] for p in org_series if p.get("value") is not None]
        org_3m_avg_val = round(float(np.mean(org_valid_pts[-3:])), 2) if org_valid_pts else org_curr_val
        org_3m_avg_fmt = format_metric_value(org_3m_avg_val, metric_def.format, metric_id) if org_3m_avg_val is not None else "—"

        for bu_name in all_bus:
            b_tr = bu_trends.get(bu_name, {})
            b_series = b_tr.get("time_series", [])
            b_pt_map = {p["period"]: p for p in b_series}

            b_curr_val = b_tr.get("current_value")
            b_curr_fmt = b_tr.get("current_value_formatted", "—")
            b_valid_pts = [p["value"] for p in b_series if p.get("value") is not None]
            b_3m_avg = round(float(np.mean(b_valid_pts[-3:])), 2) if b_valid_pts else b_curr_val
            b_3m_avg_fmt = format_metric_value(b_3m_avg, metric_def.format, metric_id) if b_3m_avg is not None else "—"

            b_hist_pts = b_valid_pts[:-1] if len(b_valid_pts) >= 2 else b_valid_pts
            b_hist_val = round(float(np.median(b_hist_pts)), 2) if b_hist_pts else None
            b_hist_fmt = format_metric_value(b_hist_val, metric_def.format, metric_id) if b_hist_val is not None else "—"

            if b_curr_val is not None and org_curr_val is not None:
                b_gap_val = round(b_curr_val - org_curr_val, 2)
                b_gap_fmt = format_benchmark_diff(b_gap_val, metric_def.format, metric_id)
            else:
                b_gap_val = None
                b_gap_fmt = "—"

            b_vol_count = _safe_point_volume(b_series[-1]) if b_series else 0
            b_vol_st = b_tr.get("volume_status") or ("High" if b_vol_count >= 50 else ("Moderate" if b_vol_count >= 10 else "Low"))
            b_trend_dir = b_tr.get("trend_direction", "INSUFFICIENT_DATA")

            # Monthly deltas for heatmap
            m_vals = []
            m_deltas = []
            for period_str in periods:
                b_p = b_pt_map.get(period_str, {})
                o_p = org_pt_map.get(period_str, {})
                bv = b_p.get("value")
                ov = o_p.get("value")
                m_vals.append({
                    "period": period_str,
                    "value": bv,
                    "formatted_value": b_p.get("formatted_value") or "—",
                })
                if bv is not None and ov is not None:
                    d_val = round(bv - ov, 2)
                    d_fmt = format_benchmark_diff(d_val, metric_def.format, metric_id)
                else:
                    d_val = None
                    d_fmt = "—"
                m_deltas.append({
                    "period": period_str,
                    "delta": d_val,
                    "formatted_delta": d_fmt,
                    "bu_value": bv,
                    "org_value": ov,
                })

            heatmap_rows.append({
                "business_unit": bu_name,
                "current_value": b_curr_val,
                "current_formatted": b_curr_fmt,
                "trend_direction": b_trend_dir,
                "monthly_values": m_vals,
                "monthly_deltas": m_deltas,
            })

            table_rows.append({
                "business_unit": bu_name,
                "current": b_curr_fmt,
                "current_val": b_curr_val,
                "three_month_avg": b_3m_avg_fmt,
                "org_benchmark": org_curr_fmt,
                "historical": b_hist_fmt,
                "gap": b_gap_fmt,
                "gap_val": b_gap_val,
                "trend": b_trend_dir.replace("_", " ").title(),
                "volume": f"{b_vol_count:,} ({b_vol_st.capitalize()})",
                "evaluable": b_vol_count,
            })

        # Organization-Wide Total Row for Table
        org_vol_cnt = _safe_point_volume(org_series[-1]) if org_series else 0
        org_vol_st = org_trend.get("volume_status") or ("High" if org_vol_cnt >= 50 else "Moderate")

        org_total_row = {
            "business_unit": "Total (Organisation-Wide)",
            "current": org_curr_fmt,
            "current_val": org_curr_val,
            "three_month_avg": org_3m_avg_fmt,
            "org_benchmark": org_curr_fmt,
            "historical": hist_baseline_fmt,
            "gap": "—",
            "gap_val": 0.0,
            "trend": org_trend.get("trend_direction", "STABLE").replace("_", " ").title(),
            "volume": f"{org_vol_cnt:,} ({org_vol_st.capitalize()})",
            "evaluable": org_vol_cnt,
        }

        # Contextual summary & table rows if in Comparison Mode
        act_valid = [p["actual"] for p in chart_points if p.get("actual") is not None]
        dp_valid = [p["dept_benchmark"] for p in chart_points if p.get("dept_benchmark") is not None]
        bu_valid = [p["bu_benchmark"] for p in chart_points if p.get("bu_benchmark") is not None]
        og_valid = [p["org_benchmark"] for p in chart_points if p.get("org_benchmark") is not None]

        avg3m_act = round(float(np.mean(act_valid[-3:])), 2) if act_valid else None
        avg3m_dp = round(float(np.mean(dp_valid[-3:])), 2) if dp_valid else None
        avg3m_bu = round(float(np.mean(bu_valid[-3:])), 2) if bu_valid else None
        avg3m_og = round(float(np.mean(og_valid[-3:])), 2) if og_valid else None

        avg3m_gap_dp = round(avg3m_act - avg3m_dp, 2) if avg3m_act is not None and avg3m_dp is not None else None
        avg3m_gap_bu = round(avg3m_act - avg3m_bu, 2) if avg3m_act is not None and avg3m_bu is not None else None
        avg3m_gap_og = round(avg3m_act - avg3m_og, 2) if avg3m_act is not None and avg3m_og is not None else None

        latest_pt = chart_points[-1] if chart_points else {}

        contextual_comparison = {
            "entity_name": entity_label,
            "dept_name": dept_label,
            "bu_name": bu_label,
            "org_name": "Organisation",
            "rows": [
                {
                    "period": pt["period"],
                    "period_display": pt["period_display"],
                    "entity": pt["actual_formatted"],
                    "entity_val": pt["actual"],
                    "dept": pt["dept_benchmark_formatted"],
                    "dept_val": pt["dept_benchmark"],
                    "bu": pt["bu_benchmark_formatted"],
                    "bu_val": pt["bu_benchmark"],
                    "org": pt["org_benchmark_formatted"],
                    "org_val": pt["org_benchmark"],
                    "gap_dept": pt["gap_vs_dept_formatted"],
                    "gap_dept_val": pt["gap_vs_dept"],
                    "gap_org": pt["gap_vs_org_formatted"],
                    "gap_org_val": pt["gap_vs_org"],
                }
                for pt in chart_points
            ],
            "summary_rows": [
                {
                    "label": "Current Month",
                    "entity": latest_pt.get("actual_formatted", "—"),
                    "dept": latest_pt.get("dept_benchmark_formatted", "—"),
                    "bu": latest_pt.get("bu_benchmark_formatted", "—"),
                    "org": latest_pt.get("org_benchmark_formatted", "—"),
                    "gap_dept": latest_pt.get("gap_vs_dept_formatted", "—"),
                    "gap_org": latest_pt.get("gap_vs_org_formatted", "—"),
                },
                {
                    "label": "3-Month Average",
                    "entity": format_metric_value(avg3m_act, metric_def.format, metric_id) if avg3m_act is not None else "—",
                    "dept": format_metric_value(avg3m_dp, metric_def.format, metric_id) if avg3m_dp is not None else "—",
                    "bu": format_metric_value(avg3m_bu, metric_def.format, metric_id) if avg3m_bu is not None else "—",
                    "org": format_metric_value(avg3m_og, metric_def.format, metric_id) if avg3m_og is not None else "—",
                    "gap_dept": format_benchmark_diff(avg3m_gap_dp, metric_def.format, metric_id),
                    "gap_org": format_benchmark_diff(avg3m_gap_og, metric_def.format, metric_id),
                },
            ],
        }

        contextual_summary = {
            "entity_name": entity_label,
            "entity_type": comparison_mode,
            "dept_name": dept_label,
            "bu_name": bu_label,
            "org_name": "Organisation",
            "current_month_display": latest_pt.get("period_display", "Current"),
            "current": {
                "entity": latest_pt.get("actual_formatted", "—"),
                "dept": latest_pt.get("dept_benchmark_formatted", "—"),
                "bu": latest_pt.get("bu_benchmark_formatted", "—"),
                "org": latest_pt.get("org_benchmark_formatted", "—"),
                "gap_dept": latest_pt.get("gap_vs_dept_formatted", "—"),
                "gap_bu": latest_pt.get("gap_vs_bu_formatted", "—"),
                "gap_org": latest_pt.get("gap_vs_org_formatted", "—"),
            },
            "three_month_avg": {
                "entity": format_metric_value(avg3m_act, metric_def.format, metric_id) if avg3m_act is not None else "—",
                "dept": format_metric_value(avg3m_dp, metric_def.format, metric_id) if avg3m_dp is not None else "—",
                "bu": format_metric_value(avg3m_bu, metric_def.format, metric_id) if avg3m_bu is not None else "—",
                "org": format_metric_value(avg3m_og, metric_def.format, metric_id) if avg3m_og is not None else "—",
                "gap_dept": format_benchmark_diff(avg3m_gap_dp, metric_def.format, metric_id),
                "gap_org": format_benchmark_diff(avg3m_gap_og, metric_def.format, metric_id),
            },
        }

        if comparison_mode in ("EMPLOYEE", "MANAGER"):
            entity_type_title = "Selected Employee" if comparison_mode == "EMPLOYEE" else "Selected Manager Team"
            dept_series_pts = dept_trend.get("time_series", [])
            bu_series_pts = bu_benchmark_trend.get("time_series", [])
            dept_vol = _safe_point_volume(dept_series_pts[-1]) if dept_series_pts else 0
            bu_vol = _safe_point_volume(bu_series_pts[-1]) if bu_series_pts else 0
            comp_table_rows = [
                {
                    "business_unit": f"{entity_label} ({entity_type_title})",
                    "current": latest_pt.get("actual_formatted", "—"),
                    "current_val": latest_pt.get("actual"),
                    "three_month_avg": format_metric_value(avg3m_act, metric_def.format, metric_id) if avg3m_act is not None else "—",
                    "org_benchmark": latest_pt.get("org_benchmark_formatted", "—"),
                    "historical": hist_baseline_fmt,
                    "gap": latest_pt.get("gap_vs_org_formatted", "—"),
                    "gap_val": latest_pt.get("gap_vs_org"),
                    "trend": scope_trend.get("trend_direction", "STABLE").replace("_", " ").title(),
                    "volume": f"{valid_obs:,} observations",
                    "evaluable": valid_obs,
                },
                {
                    "business_unit": f"{dept_label} (Department Benchmark)",
                    "current": latest_pt.get("dept_benchmark_formatted", "—"),
                    "current_val": latest_pt.get("dept_benchmark"),
                    "three_month_avg": format_metric_value(avg3m_dp, metric_def.format, metric_id) if avg3m_dp is not None else "—",
                    "org_benchmark": latest_pt.get("org_benchmark_formatted", "—"),
                    "historical": hist_baseline_fmt,
                    "gap": format_benchmark_diff(round(latest_pt.get("dept_benchmark", 0) - latest_pt.get("org_benchmark", 0), 2) if latest_pt.get("dept_benchmark") is not None and latest_pt.get("org_benchmark") is not None else None, metric_def.format, metric_id),
                    "gap_val": round(latest_pt.get("dept_benchmark", 0) - latest_pt.get("org_benchmark", 0), 2) if latest_pt.get("dept_benchmark") is not None and latest_pt.get("org_benchmark") is not None else 0.0,
                    "trend": dept_trend.get("trend_direction", "STABLE").replace("_", " ").title(),
                    "volume": f"{dept_vol:,} observations",
                    "evaluable": dept_vol,
                },
                {
                    "business_unit": f"{bu_label} (Business Unit Benchmark)",
                    "current": latest_pt.get("bu_benchmark_formatted", "—"),
                    "current_val": latest_pt.get("bu_benchmark"),
                    "three_month_avg": format_metric_value(avg3m_bu, metric_def.format, metric_id) if avg3m_bu is not None else "—",
                    "org_benchmark": latest_pt.get("org_benchmark_formatted", "—"),
                    "historical": hist_baseline_fmt,
                    "gap": format_benchmark_diff(round(latest_pt.get("bu_benchmark", 0) - latest_pt.get("org_benchmark", 0), 2) if latest_pt.get("bu_benchmark") is not None and latest_pt.get("org_benchmark") is not None else None, metric_def.format, metric_id),
                    "gap_val": round(latest_pt.get("bu_benchmark", 0) - latest_pt.get("org_benchmark", 0), 2) if latest_pt.get("bu_benchmark") is not None and latest_pt.get("org_benchmark") is not None else 0.0,
                    "trend": bu_benchmark_trend.get("trend_direction", "STABLE").replace("_", " ").title(),
                    "volume": f"{bu_vol:,} observations",
                    "evaluable": bu_vol,
                },
            ]
            table_rows = comp_table_rows

        # 11. What Changed? Narrative
        if comparison_mode in ("EMPLOYEE", "MANAGER"):
            valid_pts = [p for p in chart_points if p.get("actual") is not None and not pd.isna(p.get("actual"))]
            if len(valid_pts) >= 2:
                latest_p = valid_pts[-1]
                prev_p = valid_pts[-2]
                tot_delta = round(latest_p["actual"] - prev_p["actual"], 2)
                dir_w = "increased" if tot_delta > 0 else ("decreased" if tot_delta < 0 else "remained stable")
                sign_s = "+" if tot_delta > 0 else ""

                if metric_def.format == "percentage":
                    tot_chg_str = f"{sign_s}{tot_delta:.1f} pp"
                elif metric_def.format == "days":
                    tot_chg_str = f"{sign_s}{tot_delta:.1f} d"
                elif metric_def.format in ("duration", "time"):
                    tot_chg_str = f"{sign_s}{abs(tot_delta):.0f}m"
                elif metric_def.format == "integer":
                    tot_chg_str = f"{sign_s}{int(round(tot_delta))}"
                else:
                    tot_chg_str = f"{sign_s}{tot_delta:.1f}"

                g_dp = latest_p.get("gap_vs_dept")
                if g_dp is not None:
                    if abs(g_dp) < 0.05:
                        dp_eval = f"tracking at the {dept_label} benchmark ({latest_p['dept_benchmark_formatted']})"
                    elif metric_def.direction == "lower_is_better":
                        dp_eval = f"outperforming {dept_label} benchmark ({latest_p['dept_benchmark_formatted']}) by {latest_p['gap_vs_dept_formatted']}" if g_dp < 0 else f"above {dept_label} benchmark ({latest_p['dept_benchmark_formatted']}) by {latest_p['gap_vs_dept_formatted']}"
                    else:
                        dp_eval = f"above {dept_label} benchmark ({latest_p['dept_benchmark_formatted']}) by {latest_p['gap_vs_dept_formatted']}" if g_dp > 0 else f"below {dept_label} benchmark ({latest_p['dept_benchmark_formatted']}) by {latest_p['gap_vs_dept_formatted']}"
                else:
                    dp_eval = f"tracking in {dept_label}"

                prefix = f"{entity_label}'s" if comparison_mode == "EMPLOYEE" else f"{entity_label}'s team"
                if comparison_mode == "MANAGER" and is_approval_metric:
                    prefix = f"{entity_label}'s"

                if metric_def.format == "percentage":
                    delta_unit_txt = f"{abs(tot_delta):.1f} pp"
                elif metric_def.format == "days":
                    delta_unit_txt = f"{abs(tot_delta):.1f} days"
                elif metric_def.format in ("duration", "time"):
                    delta_unit_txt = f"{abs(tot_delta):.0f} minutes"
                elif metric_def.format == "integer":
                    delta_unit_txt = f"{int(round(abs(tot_delta)))}"
                else:
                    delta_unit_txt = f"{abs(tot_delta):.1f}"

                headline = f"{prefix} {metric_def.label} {dir_w} by {delta_unit_txt} in {latest_p['period_display']} (from {prev_p['actual_formatted']} to {latest_p['actual_formatted']}), {dp_eval}."
                summary = f"{prefix} recorded {latest_p['actual_formatted']} in {latest_p['period_display']}. Department ({dept_label}) benchmark is {latest_p['dept_benchmark_formatted']} ({latest_p.get('gap_vs_dept_formatted', '—')}), Business Unit ({bu_label}) is {latest_p['bu_benchmark_formatted']} ({latest_p.get('gap_vs_bu_formatted', '—')}), and Organisation average is {latest_p['org_benchmark_formatted']} ({latest_p.get('gap_vs_org_formatted', '—')})."

                drivers = [
                    {
                        "driver": f"{dept_label} (Department)",
                        "name": f"{dept_label} (Department)",
                        "delta": latest_p.get("gap_vs_dept") or 0.0,
                        "delta_str": latest_p.get("gap_vs_dept_formatted", "—"),
                        "formatted_delta": latest_p.get("gap_vs_dept_formatted", "—"),
                        "contribution_str": f"Benchmark: {latest_p['dept_benchmark_formatted']}",
                        "is_adverse": bool((latest_p.get("gap_vs_dept") or 0) > 0 if metric_def.direction == "lower_is_better" else (latest_p.get("gap_vs_dept") or 0) < 0),
                        "type": "DEPT",
                    },
                    {
                        "driver": f"{bu_label} (Business Unit)",
                        "name": f"{bu_label} (Business Unit)",
                        "delta": latest_p.get("gap_vs_bu") or 0.0,
                        "delta_str": latest_p.get("gap_vs_bu_formatted", "—"),
                        "formatted_delta": latest_p.get("gap_vs_bu_formatted", "—"),
                        "contribution_str": f"Benchmark: {latest_p['bu_benchmark_formatted']}",
                        "is_adverse": bool((latest_p.get("gap_vs_bu") or 0) > 0 if metric_def.direction == "lower_is_better" else (latest_p.get("gap_vs_bu") or 0) < 0),
                        "type": "BU",
                    },
                    {
                        "driver": "Organisation-Wide",
                        "name": "Organisation-Wide",
                        "delta": latest_p.get("gap_vs_org") or 0.0,
                        "delta_str": latest_p.get("gap_vs_org_formatted", "—"),
                        "formatted_delta": latest_p.get("gap_vs_org_formatted", "—"),
                        "contribution_str": f"Benchmark: {latest_p['org_benchmark_formatted']}",
                        "is_adverse": bool((latest_p.get("gap_vs_org") or 0) > 0 if metric_def.direction == "lower_is_better" else (latest_p.get("gap_vs_org") or 0) < 0),
                        "type": "ORG",
                    },
                ]

                what_changed_data = {
                    "has_change": True,
                    "has_movement": True,
                    "title": "What Changed?",
                    "headline": headline,
                    "summary": summary,
                    "metric_name": metric_def.label,
                    "total_change_str": tot_chg_str,
                    "direction": dir_w,
                    "drivers": drivers,
                }
            else:
                latest_p = valid_pts[0] if valid_pts else (chart_points[0] if chart_points else {})
                prefix = f"{entity_label}" if comparison_mode == "EMPLOYEE" else f"{entity_label}'s team"
                headline = f"Baseline established for {prefix} at {latest_p.get('actual_formatted', '—')} in {latest_p.get('period_display', 'Current')}. Compared against {dept_label} ({latest_p.get('dept_benchmark_formatted', '—')}) and {bu_label} ({latest_p.get('bu_benchmark_formatted', '—')})."
                summary = f"{prefix} recorded {latest_p.get('actual_formatted', '—')} for {latest_p.get('period_display', 'Current')}. Department benchmark is {latest_p.get('dept_benchmark_formatted', '—')}, BU benchmark is {latest_p.get('bu_benchmark_formatted', '—')}, and Organisation benchmark is {latest_p.get('org_benchmark_formatted', '—')}."
                what_changed_data = {
                    "has_change": False,
                    "has_movement": False,
                    "title": "What Changed?",
                    "headline": headline,
                    "summary": summary,
                    "metric_name": metric_def.label,
                    "total_change_str": "Baseline",
                    "direction": "neutral",
                    "drivers": [],
                }
        else:
            # Standard Global / Scope What Changed Driver Decomposition
            valid_pts = [p for p in scope_series if p.get("value") is not None and not pd.isna(p.get("value"))]
            if len(valid_pts) >= 2:
                latest_p = valid_pts[-1]
                prev_p = valid_pts[-2]
                tot_delta = round(latest_p["value"] - prev_p["value"], 2)
                dir_w = "increased" if tot_delta > 0 else ("decreased" if tot_delta < 0 else "remained stable")
                sign_s = "+" if tot_delta > 0 else ""

                if metric_def.format == "percentage":
                    u_txt = " percentage points"
                    tot_chg_str = f"{sign_s}{tot_delta:.1f} pp"
                elif metric_def.format == "days":
                    u_txt = " days"
                    tot_chg_str = f"{sign_s}{tot_delta:.1f} d"
                elif metric_def.format in ("duration", "time"):
                    u_txt = " minutes"
                    tot_chg_str = f"{sign_s}{abs(tot_delta):.0f}m" if abs(tot_delta) < 60 else f"{sign_s}{tot_delta/60:.1f}h"
                elif metric_def.format == "integer":
                    u_txt = " requests"
                    tot_chg_str = f"{sign_s}{int(round(tot_delta))}"
                else:
                    u_txt = " units"
                    tot_chg_str = f"{sign_s}{tot_delta:.1f}"

                what_summary = f"{metric_def.label} {dir_w} by {abs(tot_delta):.1f}{u_txt} in {latest_p['period_display']} (from {prev_p['formatted_value']} to {latest_p['formatted_value']})."

                drivers = []
                bu_deltas = []
                tot_eval_curr = latest_p.get("evaluable") or latest_p.get("valid_observation_count") or 1

                for bu_name in all_bus:
                    b_tr = bu_trends.get(bu_name, {})
                    b_pts = {pt["period"]: pt for pt in b_tr.get("time_series", [])}
                    if latest_p["period"] in b_pts and prev_p["period"] in b_pts:
                        bv_curr = b_pts[latest_p["period"]].get("value")
                        bv_prev = b_pts[prev_p["period"]].get("value")
                        bu_ev = b_pts[latest_p["period"]].get("evaluable") or b_pts[latest_p["period"]].get("valid_observation_count") or 0
                        if bv_curr is not None and bv_prev is not None and not pd.isna(bv_curr) and not pd.isna(bv_prev):
                            d_bu = round(bv_curr - bv_prev, 2)
                            weight = bu_ev / max(1, tot_eval_curr)
                            contrib = round(d_bu * weight, 2)
                            bu_deltas.append((bu_name, d_bu, contrib))

                bu_deltas.sort(key=lambda x: (abs(x[1]), abs(x[2])), reverse=True)
                top_bus = bu_deltas[:4]
                for bu_name, d_bu, contrib in top_bus:
                    if abs(d_bu) >= 0.05:
                        sign_b = "+" if d_bu > 0 else ""
                        is_adv = bool((d_bu > 0 and metric_def.direction == "lower_is_better") or (d_bu < 0 and metric_def.direction == "higher_is_better"))
                        fmt_d = format_benchmark_diff(d_bu, metric_def.format, metric_id)
                        c_str = f"{format_benchmark_diff(contrib, metric_def.format, metric_id)} contribution"

                        drivers.append({
                            "driver": bu_name,
                            "name": bu_name,
                            "delta": d_bu,
                            "delta_str": fmt_d,
                            "formatted_delta": fmt_d,
                            "contribution_str": c_str,
                            "is_adverse": is_adv,
                            "type": "BU",
                        })

                if len(bu_deltas) > 4:
                    other_contrib = round(sum(x[2] for x in bu_deltas[4:]), 2)
                    if abs(other_contrib) >= 0.05:
                        sign_o = "+" if other_contrib > 0 else ""
                        fmt_o = format_benchmark_diff(other_contrib, metric_def.format, metric_id)
                        drivers.append({
                            "driver": "Other Business Units",
                            "name": "Other Business Units",
                            "delta": other_contrib,
                            "delta_str": fmt_o,
                            "formatted_delta": fmt_o,
                            "contribution_str": f"{sign_o}{other_contrib:.1f} net contribution",
                            "is_adverse": bool(other_contrib > 0 if metric_def.direction == "lower_is_better" else other_contrib < 0),
                            "type": "BU",
                        })

                what_changed_data = {
                    "has_change": True,
                    "has_movement": True,
                    "title": "What Changed?",
                    "headline": what_summary,
                    "summary": what_summary,
                    "metric_name": metric_def.label,
                    "total_change_str": tot_chg_str,
                    "direction": dir_w,
                    "drivers": drivers,
                }
            else:
                single_lbl = valid_pts[0]["period_display"] if valid_pts else (scope_series[0]["period_display"] if scope_series else "Current period")
                single_val = valid_pts[0]["formatted_value"] if valid_pts else (scope_series[0]["formatted_value"] if scope_series else "—")
                what_changed_data = {
                    "has_change": False,
                    "has_movement": False,
                    "title": "What Changed?",
                    "headline": f"Baseline established for {single_lbl} ({single_val}). Multi-month archive unlocks automated driver attribution.",
                    "summary": f"Baseline established for {single_lbl} ({single_val}). Multi-month archive unlocks automated driver attribution.",
                    "metric_name": metric_def.label,
                    "total_change_str": "Baseline",
                    "direction": "neutral",
                    "drivers": [],
                }

        # 12. Emerging Patterns (< 0.1ms retrieval, non-blocking background mining)
        pat_cache_key = (bu_key, dept_key, mgr_key, emp_key, dr_key)
        with self._lock:
            pattern_items = self._pattern_cache.get(pat_cache_key)

        if pattern_items is None:
            if self._global_pattern_pool:
                matched = []
                for p_dict in self._global_pattern_pool:
                    p_scope = str(p_dict.get("scope", "")).lower()
                    if emp_key != "all" and str(emp_key).lower() in p_scope:
                        matched.append(p_dict)
                    elif dept_key != "all" and str(dept_key).lower() in p_scope:
                        matched.append(p_dict)
                    elif bu_key != "all" and str(bu_key).lower() in p_scope:
                        matched.append(p_dict)
                pattern_items = matched[:5] if matched else self._global_pattern_pool[:5]
                with self._lock:
                    self._pattern_cache[pat_cache_key] = pattern_items
                self._trigger_background_pattern_detection(pat_cache_key, scoped_eval_df, scoped_eval_reqs, scoped_facts)
            else:
                if len(scoped_eval_df) <= 2000:
                    try:
                        _, pattern_results = detect_patterns(scoped_eval_df, scoped_eval_reqs, employee_day_facts=scoped_facts)
                    except Exception:
                        pattern_results = []
                    pattern_items = self._format_pattern_results(pattern_results)
                    with self._lock:
                        self._pattern_cache[pat_cache_key] = pattern_items
                        if pat_cache_key == ("all", "all", "all", "all", "all"):
                            self._global_pattern_pool = pattern_items
                else:
                    pattern_items = []
                    self._trigger_background_pattern_detection(pat_cache_key, scoped_eval_df, scoped_eval_reqs, scoped_facts)

        # Trend Pulse: 5 Contextual Cards in Comparison Mode, else standard
        if comparison_mode in ("EMPLOYEE", "MANAGER"):
            curr_fmt = latest_pt.get("actual_formatted", "—")
            dept_curr_fmt = latest_pt.get("dept_benchmark_formatted", "—")
            bu_curr_fmt = latest_pt.get("bu_benchmark_formatted", "—")
            org_curr_fmt = latest_pt.get("org_benchmark_formatted", "—")

            gap_dp_val = latest_pt.get("gap_vs_dept")
            gap_bu_val = latest_pt.get("gap_vs_bu")
            gap_og_val = latest_pt.get("gap_vs_org")

            gap_dp_fmt = latest_pt.get("gap_vs_dept_formatted", "—")
            gap_bu_fmt = latest_pt.get("gap_vs_bu_formatted", "—")
            gap_og_fmt = latest_pt.get("gap_vs_org_formatted", "—")

            if metric_id == "missing_swipe_rate":
                curr_color = get_missing_swipe_color(curr_val)
            elif "turnaround" in metric_id or "age" in metric_id:
                curr_color = get_approval_turnaround_color(curr_val)
            else:
                curr_color = None

            def _gap_color(g):
                if g is None or abs(g) < 0.01:
                    return None
                if metric_def.direction == "lower_is_better":
                    return "#10B981" if g < 0 else "#F43F5E"
                elif metric_def.direction == "higher_is_better":
                    return "#10B981" if g > 0 else "#F43F5E"
                return None

            trend_pulse = [
                {
                    "title": "Current Value",
                    "value": curr_fmt,
                    "sub": f"{entity_label}",
                    "note": f"Latest period: {latest_pt.get('period_display', 'Current')}",
                    "color": curr_color,
                },
                {
                    "title": "MoM Change",
                    "value": mom_change_fmt,
                    "sub": "vs last month" if mom_change is not None else "Baseline",
                    "note": f"Previous: {scope_trend.get('previous_value_formatted', '—')}",
                    "color": _gap_color(mom_change),
                },
                {
                    "title": "vs Department",
                    "value": gap_dp_fmt,
                    "sub": f"vs {dept_label} ({dept_curr_fmt})",
                    "note": f"Department Benchmark: {dept_label}",
                    "color": _gap_color(gap_dp_val),
                },
                {
                    "title": "vs Business Unit",
                    "value": gap_bu_fmt,
                    "sub": f"vs {bu_label} ({bu_curr_fmt})",
                    "note": f"BU Benchmark: {bu_label}",
                    "color": _gap_color(gap_bu_val),
                },
                {
                    "title": "Data Confidence",
                    "value": f"{'High' if valid_obs >= 50 else ('Medium' if valid_obs >= 15 else 'Low')} Confidence",
                    "sub": f"{valid_obs:,} observations",
                    "note": f"vs Organisation: {gap_og_fmt}",
                    "color": "#F59E0B" if valid_obs < 15 else ("#3B82F6" if valid_obs < 50 else "#10B981"),
                },
            ]
        else:
            trend_pulse = [
                {
                    "title": "Current Value",
                    "value": scope_trend.get("current_value_formatted", "—"),
                    "sub": metric_def.label,
                    "note": f"Latest period: {scope_trend.get('current_period_display', 'Current')}",
                    "color": get_missing_swipe_color(curr_val) if metric_id == "missing_swipe_rate" else None,
                },
                {
                    "title": "MoM Change",
                    "value": mom_change_fmt,
                    "sub": "vs last month" if mom_change is not None else "Baseline",
                    "note": f"Previous: {scope_trend.get('previous_value_formatted', '—')}",
                    "color": "#F43F5E" if (mom_change and mom_change > 0 and metric_def.direction == "lower_is_better") else ("#10B981" if mom_change and mom_change < 0 and metric_def.direction == "lower_is_better" else None),
                },
                {
                    "title": "3-Month Trend",
                    "value": scope_trend.get("trend_direction", "INSUFFICIENT_DATA").replace("_", " ").title(),
                    "sub": f"{scope_trend.get('streak_months', 0)}-mo {scope_trend.get('streak_direction', '').lower()} streak" if scope_trend.get('streak_months') else "Trajectory",
                    "note": "Based on 3-month trailing movement",
                    "color": "#10B981" if "impr" in str(scope_trend.get("trend_direction", "")).lower() else ("#F43F5E" if "detr" in str(scope_trend.get("trend_direction", "")).lower() or "regress" in str(scope_trend.get("trend_direction", "")).lower() else None),
                },
                {
                    "title": "Benchmark Gap",
                    "value": gap_fmt,
                    "sub": f"vs {bench_label} ({current_bench_fmt})",
                    "note": f"Benchmark: {bench_label}",
                    "color": "#F43F5E" if (gap_val and gap_val > 0 and metric_def.direction == "lower_is_better") else ("#10B981" if gap_val and gap_val < 0 and metric_def.direction == "lower_is_better" else None),
                },
                {
                    "title": "Data Confidence",
                    "value": f"{vol_status.capitalize()} Confidence",
                    "sub": f"{valid_obs:,} observations",
                    "note": f"Evaluated across {len(periods)} months",
                    "color": "#10B981" if vol_status == "HIGH" else ("#F59E0B" if vol_status == "MODERATE" else None),
                },
            ]

        # Scope description
        parts = []
        if comparison_mode == "EMPLOYEE":
            parts.append(f"Employee: {entity_label}")
            if derived_dept:
                parts.append(f"Dept: {derived_dept}")
            if derived_bu:
                parts.append(f"BU: {derived_bu}")
            if derived_rm:
                parts.append(f"Mgr: {derived_rm}")
        elif comparison_mode == "MANAGER":
            parts.append(f"Manager: {entity_label}")
            if derived_dept:
                parts.append(f"Dept: {derived_dept}")
            if derived_bu:
                parts.append(f"BU: {derived_bu}")
        else:
            if business_unit:
                parts.append(f"BU: {business_unit}")
            if department:
                parts.append(f"Dept: {department}")
            if manager:
                parts.append(f"Mgr: {manager}")
            if employee:
                parts.append(f"Emp: {employee}")
        if date_range:
            parts.append(f"{date_range[0]} to {date_range[1]}")
        scope_description = " • ".join(parts) if parts else "Complete Active Population"

        bundle = {
            "metric_id": metric_id,
            "metric_name": metric_def.label,
            "metric_def": metric_def.to_dict(),
            "benchmark_type": bench_mode,
            "benchmark_label": bench_label,
            "comparison_mode": comparison_mode,
            "entity_label": entity_label,
            "dept_label": dept_label,
            "bu_label": bu_label,
            "org_label": org_label,
            "hierarchy": {
                "department": dept_label,
                "business_unit": bu_label,
                "reporting_manager": derived_rm,
            } if comparison_mode in ("EMPLOYEE", "MANAGER") else None,
            "scope_description": scope_description,
            "date_range_display": scope_trend.get("date_range_display", "No data"),
            "policy_effective_date": POLICY_EFFECTIVE_DATE_STR,
            "time_series": scope_series,
            "org_time_series": org_series,
            "benchmark_time_series": benchmark_series,
            "historical_baseline_value": hist_baseline_val,
            "historical_baseline_formatted": hist_baseline_fmt,
            "current_period": scope_trend.get("current_period"),
            "current_period_display": scope_trend.get("current_period_display"),
            "trend_pulse": trend_pulse,
            "pulse": {
                "current_value": curr_val,
                "current_value_formatted": scope_trend.get("current_value_formatted", "—"),
                "previous_value": scope_trend.get("previous_value"),
                "previous_value_formatted": scope_trend.get("previous_value_formatted", "—"),
                "mom_change": mom_change,
                "mom_change_formatted": mom_change_fmt,
                "mom_change_pp": scope_trend.get("mom_change_pp"),
                "trend_direction": scope_trend.get("trend_direction", "INSUFFICIENT_DATA"),
                "streak_direction": scope_trend.get("streak_direction"),
                "streak_months": scope_trend.get("streak_months", 0),
                "gap_vs_benchmark": gap_val,
                "gap_vs_benchmark_formatted": gap_fmt,
                "benchmark_label": bench_label,
                "volume_status": vol_status,
                "confidence_label": conf_label,
                "valid_observations": valid_obs,
            },
            "chart": {
                "points": chart_points,
                "metric_id": metric_id,
                "metric_name": metric_def.label,
                "unit": metric_def.unit if hasattr(metric_def, "unit") else "%",
                "format": metric_def.format,
                "direction": metric_def.direction,
                "lower_is_better": metric_def.direction == "lower_is_better",
                "reference_range": ref_range,
                "policy_effective_date": POLICY_EFFECTIVE_DATE_STR,
                "comparison_mode": comparison_mode,
                "entity_label": entity_label,
                "dept_label": dept_label,
                "bu_label": bu_label,
                "org_label": org_label,
            },
            "heatmap": {
                "months": heatmap_months,
                "rows": heatmap_rows,
                "lower_is_better": metric_def.direction == "lower_is_better",
            },
            "bu_heatmap": {
                "months": heatmap_months,
                "rows": heatmap_rows,
                "lower_is_better": metric_def.direction == "lower_is_better",
            },
            "contextual_comparison": contextual_comparison,
            "contextual_summary": contextual_summary,
            "what_changed": what_changed_data,
            "patterns": pattern_items,
            "benchmark_table": {
                "columns": [
                    ("bu", "Business Unit" if comparison_mode == "NORMAL" else "Dimension / Level", 160, "w"),
                    ("curr", "Current", 80, "w"),
                    ("avg3m", "3M Average", 80, "w"),
                    ("org", "Organisation", 80, "w"),
                    ("hist", "Historical", 80, "w"),
                    ("gap", "Gap", 75, "w"),
                    ("trend", "Trend", 95, "w"),
                    ("volume", "Volume", 90, "w"),
                ],
                "rows": table_rows,
                "total": org_total_row,
                "total_row": org_total_row,
            },
            "observations": scope_trend.get("observations", []),
        }

        with self._lock:
            self._cache[cache_key] = bundle
            if len(self._cache) > self._max_cache_size:
                self._cache.popitem(last=False)

        return _defensive_copy_dict(bundle)

    def get_filter_cache_stats(self) -> Dict[str, Any]:
        """Return counts and metadata for the internal LRU cache."""
        snap = self.service.get_active_snapshot()
        self._sync_dataset_state(snap)
        with self._lock:
            return {
                "cached_bundles": len(self._cache),
                "max_cache_size": self._max_cache_size,
                "active_dataset_id": self._last_dataset_id,
            }

    def clear_cache(self) -> None:
        """Purge all cached analytical bundles."""
        with self._lock:
            self._cache.clear()

    def benchmark_performance(
        self,
        iterations: int = 5,
    ) -> Dict[str, float]:
        """
        Benchmark initial preparation vs. cached retrieval time.
        Returns average timings in milliseconds.
        """
        snap = self.service.get_active_snapshot()
        if not snap or not snap.is_valid():
            return {"initial_ms": 0.0, "cached_ms": 0.0}

        self.clear_cache()

        # 1. Measure initial calculation time
        t0 = time.perf_counter()
        _ = self.get_workforce_metrics()
        initial_ms = (time.perf_counter() - t0) * 1000.0

        # 2. Measure cached retrieval time over N iterations
        cached_times = []
        for _ in range(iterations):
            t_start = time.perf_counter()
            _ = self.get_workforce_metrics()
            cached_times.append((time.perf_counter() - t_start) * 1000.0)

        avg_cached_ms = sum(cached_times) / len(cached_times) if cached_times else 0.0

        return {
            "initial_ms": round(initial_ms, 2),
            "cached_ms": round(avg_cached_ms, 4),
        }


# Global singleton bridge instance
workforce_bridge = WorkforceIntelligenceBridge()
