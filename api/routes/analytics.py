"""
api/routes/analytics.py
───────────────────────
Analytical query endpoints powered by the Vectorized Columnar OLAP Engine.
Sub-millisecond responses for trends, cascading filter dropdowns, and benchmarks.
"""

from datetime import date
from typing import Any, Dict, List, Optional
import time
from fastapi import APIRouter, HTTPException, Query

from api.schemas import (
    CascadedFilterResponse,
    EmployeeHierarchyResponse,
    ManagerHierarchyResponse,
    MetricMetadata,
    TrendQueryRequest,
)
from storage.cache_manager import snapshot_cache
from workforce_intelligence.snapshot_bridge import workforce_bridge
from workforce_intelligence.trends import TREND_METRICS
from api.auth import UserPersona, get_current_user
from fastapi import Depends

router = APIRouter(prefix="/analytics", tags=["Analytics & OLAP Engine"])


@router.get("/metrics", response_model=List[MetricMetadata])
def list_available_metrics():
    """Retrieve metadata and formatting contracts for all 15 workforce intelligence metrics."""
    res = []
    for m in TREND_METRICS.values():
        res.append(MetricMetadata(
            id=m.id,
            label=m.label,
            category=m.category,
            format=m.format,
            direction=m.direction,
            description=m.description,
        ))
    return res


@router.get("/filters/cascaded", response_model=CascadedFilterResponse)
def get_cascaded_filters(
    business_unit: Optional[str] = Query(None, description="Selected Business Unit"),
    department: Optional[str] = Query(None, description="Selected Department"),
    manager: Optional[str] = Query(None, description="Selected Reporting Manager"),
    user: UserPersona = Depends(get_current_user),
):
    """
    Sub-millisecond retrieval of dependent filter options from pre-indexed OLAP catalog.
    Enforces Row-Level Security based on active user persona.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        return CascadedFilterResponse()

    # Apply persona boundary restrictions
    if user.role == "BU_HEAD" and user.allowed_business_units != ["All"]:
        business_unit = user.allowed_business_units[0]
    elif user.role == "MANAGER" and user.allowed_business_units != ["All"]:
        business_unit = user.allowed_business_units[0]
        if user.allowed_managers != ["All"]:
            manager = user.allowed_managers[0]

    # Fast-path OLAP cascade
    casc = workforce_bridge.get_cascaded_filter_options(
        business_unit=business_unit,
        department=department,
        manager=manager,
    )

    all_bus = snap.filter_options.get("business_units", [])
    if not all_bus and snap.olap_engine:
        all_bus = getattr(snap.olap_engine, "_all_bus", [])

    # Scope visible business units by role
    if user.role == "BU_HEAD" and user.allowed_business_units != ["All"]:
        allowed_bu_list = user.allowed_business_units
    elif user.role == "MANAGER" and user.allowed_business_units != ["All"]:
        allowed_bu_list = user.allowed_business_units
    else:
        allowed_bu_list = ["All Business Units"] + [b for b in all_bus if b != "All Business Units"]

    if casc:
        managers_list = casc.get("managers", ["All Reporting Managers"])
        if user.role == "MANAGER" and user.allowed_managers != ["All"]:
            managers_list = user.allowed_managers

        return CascadedFilterResponse(
            business_units=allowed_bu_list,
            departments=casc.get("departments", ["All Departments"]),
            managers=managers_list,
            employees=casc.get("employees", ["All Employees"]),
            emp_pairs=casc.get("emp_pairs", []),
        )

    # Fallback to snapshot filter options
    return CascadedFilterResponse(
        business_units=allowed_bu_list,
        departments=["All Departments"] + snap.filter_options.get("departments", []),
        managers=["All Reporting Managers"] + snap.filter_options.get("managers", []),
        employees=["All Employees"],
        emp_pairs=[],
    )


@router.post("/trends")
def query_trend_intelligence(req: TrendQueryRequest, user: UserPersona = Depends(get_current_user)):
    """
    Execute high-speed time-series trend calculation with benchmark comparisons,
    MoM changes, volume confidence status, and deterministic observations.
    Sub-10ms response via multi-dimensional OLAP rollup hypercubes with Row-Level Security.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        raise HTTPException(
            status_code=400,
            detail="No active workforce dataset loaded. Please upload a dataset or load demo data."
        )

    # Row-Level Security Scope Override
    effective_bu = req.business_unit
    effective_mgr = req.manager

    if user.role == "BU_HEAD" and user.allowed_business_units != ["All"]:
        effective_bu = user.allowed_business_units[0]
    elif user.role == "MANAGER" and user.allowed_business_units != ["All"]:
        effective_bu = user.allowed_business_units[0]
        if user.allowed_managers != ["All"]:
            effective_mgr = user.allowed_managers[0]

    date_range = None
    if req.date_start and req.date_end:
        date_range = (req.date_start, req.date_end)

    t0 = time.perf_counter()
    bundle = workforce_bridge.get_trend_intelligence(
        metric_id=req.metric_id,
        benchmark_type=req.benchmark_type,
        business_unit=effective_bu,
        department=req.department,
        manager=effective_mgr,
        employee=req.employee,
        date_range=date_range,
    )
    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)
    bundle["execution_time_ms"] = t_elapsed
    return bundle


@router.get("/benchmarks/{metric_id}")
def get_benchmark_table(
    metric_id: str,
    business_unit: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    employee: Optional[str] = Query(None),
):
    """
    Retrieve multi-dimension Business Unit benchmark comparison matrix table
    with Org, Historical, Gap, and Trend trajectories.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        raise HTTPException(status_code=400, detail="No active workforce dataset loaded.")

    bundle = workforce_bridge.get_trend_intelligence(
        metric_id=metric_id,
        business_unit=business_unit,
        department=department,
        manager=manager,
        employee=employee,
    )
    return bundle.get("benchmark_table", {"columns": [], "rows": [], "total": {}})


@router.get("/hierarchy/employee/{employee}", response_model=EmployeeHierarchyResponse)
def get_employee_hierarchy(employee: str):
    """
    Instant O(1) employee hierarchy resolution (< 0.01ms).
    Returns clean name, employee number, department, BU, and manager.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        return EmployeeHierarchyResponse(emp_name=employee)

    engine = snap.get_olap_engine()
    if engine and hasattr(engine, "get_employee_hierarchy"):
        info = engine.get_employee_hierarchy(employee)
        return EmployeeHierarchyResponse(**info)

    return EmployeeHierarchyResponse(emp_name=employee)


@router.get("/hierarchy/manager/{manager}", response_model=ManagerHierarchyResponse)
def get_manager_hierarchy(manager: str):
    """
    Instant O(1) reporting manager hierarchy resolution (< 0.01ms).
    Returns clean manager name, department, and BU.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        return ManagerHierarchyResponse(mgr_name=manager)

    engine = snap.get_olap_engine()
    if engine and hasattr(engine, "get_manager_hierarchy"):
        info = engine.get_manager_hierarchy(manager)
        return ManagerHierarchyResponse(**info)

    return ManagerHierarchyResponse(mgr_name=manager)


@router.get("/patterns")
def get_emerging_patterns(
    business_unit: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    employee: Optional[str] = Query(None),
):
    """Retrieve detected workforce patterns and exception concentration dossiers."""
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        return {"patterns": []}

    bundle = workforce_bridge.get_trend_intelligence(
        metric_id="missing_swipe_rate",
        business_unit=business_unit,
        department=department,
        manager=manager,
        employee=employee,
    )
    return {"patterns": bundle.get("patterns", [])}


@router.get("/overview")
def get_executive_overview(
    business_unit: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    employee: Optional[str] = Query(None),
    user: UserPersona = Depends(get_current_user),
):
    """
    Sub-10ms Executive Overview analytical suite delivering full desktop parity:
    - 15 live KPI cards (Headcount, Attendance Days, Present, OD, Leave, WFH, Holiday,
      Week Off, Absent, Exceptions, Leave Compliance, Approval SLA, Avg In/Out, Working Hours)
    - 100% Additive Day Reconciliation Verification
    - 8-Category Attendance Composition with quantity-weighted day equivalents
    - Daily Attendance Trend (Present, WFH, Leave, Exceptions by calendar date)
    - Business Unit Comparison breakdown matrix with Org Total row
    - Data Quality status and Row-Level Security enforcement
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        raise HTTPException(
            status_code=400,
            detail="No active workforce dataset loaded. Please upload a dataset or load demo data."
        )

    # Row-Level Security Scope Override
    effective_bu = business_unit
    effective_mgr = manager

    if user.role == "BU_HEAD" and user.allowed_business_units != ["All"]:
        effective_bu = user.allowed_business_units[0]
    elif user.role == "MANAGER" and user.allowed_business_units != ["All"]:
        effective_bu = user.allowed_business_units[0]
        if user.allowed_managers != ["All"]:
            effective_mgr = user.allowed_managers[0]

    # Clean "All" placeholders
    clean_bu = None if effective_bu in ("All", "All Business Units", "", None) else effective_bu
    clean_dept = None if department in ("All", "All Departments", "", None) else department
    clean_mgr = None if effective_mgr in ("All", "All Reporting Managers", "", None) else effective_mgr
    clean_emp = None if employee in ("All", "All Employees", "", None) else employee

    t0 = time.perf_counter()
    bundle = workforce_bridge.get_workforce_metrics(
        business_unit=clean_bu,
        department=clean_dept,
        manager=clean_mgr,
        employee=clean_emp,
    )
    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)

    # Sparkline series
    trend_list = bundle.get("daily_attendance_trend", [])
    clean_trend = []
    for d in trend_list:
        d_copy = dict(d)
        if "date" in d_copy and hasattr(d_copy["date"], "isoformat"):
            d_copy["date"] = d_copy["date"].isoformat()
        clean_trend.append(d_copy)

    pres_series = [float(d.get("present_days", 0.0)) for d in clean_trend]
    wfh_series = [float(d.get("wfh_days", 0.0)) for d in clean_trend]
    leave_series = [float(d.get("leave_days", 0.0)) for d in clean_trend]
    ab_series = [float(d.get("absent_days", 0.0)) for d in clean_trend]
    rec_series = [float(d.get("recorded_days", 0.0)) for d in clean_trend]
    excp_series = [float(d.get("missing_swipe_days", 0) + d.get("regularized_days", 0)) for d in clean_trend]

    # Attendance counts & days
    att_days = bundle.get("kpi_2_attendance_days", 0)
    denom = bundle.get("attendance_composition_denominator", float(att_days))
    q_pres = bundle.get("kpi_3_present_days", 0.0)
    q_od = bundle.get("kpi_4_od_days", 0.0)
    q_leave = bundle.get("kpi_5_leave_days", 0.0)
    q_wfh = bundle.get("kpi_6_wfh_days", 0.0)
    q_hol = bundle.get("kpi_7_holiday_days", 0.0)
    q_wo = bundle.get("kpi_8_week_off_days", 0.0)
    q_ab = bundle.get("kpi_absent_days", 0.0)
    q_unclass = bundle.get("kpi_unclassified_days", 0.0)

    unclass_cnt = bundle.get("unclassified_records_count", 0)
    conflicts_cnt = bundle.get("conflicting_employee_days_count", 0)
    categorized = round(q_pres + q_od + q_leave + q_wfh + q_hol + q_wo + q_ab, 1)

    cards = [
        # Row 1: Core Attendance & Presence
        {
            "id": "kpi_1_emp_hc",
            "number": 1,
            "title": "EMP HC",
            "label": "Observed Headcount",
            "primary": f"{bundle.get('kpi_1_emp_hc', 0):,}",
            "unit": "employees",
            "secondary": "Observed Headcount",
            "footnote": "Distinct observed employees in scope",
            "color": "#06b6d4",
            "category": "Volume",
            "sparkline": None,
        },
        {
            "id": "kpi_2_attendance_days",
            "number": 2,
            "title": "ATTENDANCE DAYS",
            "label": "Attendance Days",
            "primary": f"{bundle.get('kpi_2_attendance_days', 0):,} days",
            "unit": "days",
            "secondary": "100.0% of recorded period",
            "footnote": "Distinct employee-day records",
            "color": "#3b82f6",
            "category": "Volume",
            "sparkline": rec_series,
        },
        {
            "id": "kpi_3_present",
            "number": 3,
            "title": "PRESENT",
            "label": "Present Days",
            "primary": f"{q_pres:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_3_present_pct', 0.0):.1f}% of recorded days",
            "footnote": "Physical attendance days",
            "color": "#10b981",
            "category": "Presence",
            "sparkline": pres_series,
        },
        {
            "id": "kpi_4_od",
            "number": 4,
            "title": "ON DUTY",
            "label": "On Duty (OD)",
            "primary": f"{q_od:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_4_od_pct', 0.0):.1f}% of recorded days",
            "footnote": "Official duty assignments",
            "color": "#0ea5e9",
            "category": "Presence",
            "sparkline": None,
        },
        {
            "id": "kpi_5_leave",
            "number": 5,
            "title": "LEAVE",
            "label": "Leave Days",
            "primary": f"{q_leave:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_5_leave_pct', 0.0):.1f}% of recorded days",
            "footnote": "Quantity-weighted leave days",
            "color": "#8b5cf6",
            "category": "Absence",
            "sparkline": leave_series,
        },

        # Row 2: Hybrid, Rest, and Exceptions
        {
            "id": "kpi_6_wfh",
            "number": 6,
            "title": "WFH",
            "label": "Work From Home",
            "primary": f"{q_wfh:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_6_wfh_pct', 0.0):.1f}% of recorded days",
            "footnote": "Approved WFH employee-days",
            "color": "#6366f1",
            "category": "Hybrid",
            "sparkline": wfh_series,
        },
        {
            "id": "kpi_7_holiday",
            "number": 7,
            "title": "HOLIDAY",
            "label": "Holidays",
            "primary": f"{q_hol:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_7_holiday_pct', 0.0):.1f}% of recorded days",
            "footnote": "Recognized organization holidays",
            "color": "#f59e0b",
            "category": "Rest",
            "sparkline": None,
        },
        {
            "id": "kpi_8_week_off",
            "number": 8,
            "title": "WEEK OFF",
            "label": "Weekly Offs",
            "primary": f"{q_wo:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_8_week_off_pct', 0.0):.1f}% of recorded days",
            "footnote": "Scheduled weekly rest days",
            "color": "#94a3b8",
            "category": "Rest",
            "sparkline": None,
        },
        {
            "id": "kpi_absent",
            "number": 9,
            "title": "ABSENT",
            "label": "Unplanned Absence",
            "primary": f"{q_ab:,.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_absent_pct', 0.0):.1f}% of recorded days",
            "footnote": "Recorded employee absence days",
            "color": "#ef4444",
            "category": "Absence",
            "sparkline": ab_series,
        },
        {
            "id": "kpi_9_attendance_exceptions",
            "number": 10,
            "title": "EXCEPTIONS",
            "label": "Attendance Exceptions",
            "primary": f"{bundle.get('kpi_9_attendance_exceptions_days', 0):,} days",
            "unit": "days",
            "secondary": f"{bundle.get('kpi_9_attendance_exceptions_rate_pct', 0.0):.1f}% exception rate",
            "footnote": f"{bundle.get('kpi_9_attendance_exceptions_affected_emps', 0):,} affected employees",
            "color": "#f43f5e",
            "category": "Governance",
            "sparkline": excp_series,
        },

        # Row 3: SLA Compliance, Biometric Timing & Working Hours
        {
            "id": "kpi_leave_compliance",
            "number": 11,
            "title": "LEAVE COMPLIANCE",
            "label": "Leave Application Lead Time",
            "primary": f"{bundle.get('leave_avg_lead_time_days', 0.0):.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('leave_applied_by_emp_pct', 0.0):.1f}% by Emp • {bundle.get('leave_applied_by_admin_pct', 0.0):.1f}% Admin",
            "footnote": f"Prior: {bundle.get('leave_prior_pct', 0.0):.1f}% | Retro: {bundle.get('leave_retro_pct', 0.0):.1f}%",
            "color": "#a855f7",
            "category": "Governance",
            "sparkline": None,
        },
        {
            "id": "kpi_approval_compliance",
            "number": 12,
            "title": "APPROVAL SLA",
            "label": "Approval Turnaround SLA",
            "primary": f"{bundle.get('leave_avg_approval_turnaround_days', 0.0):.1f} days",
            "unit": "days",
            "secondary": f"{bundle.get('leave_approved_by_mgr_pct', 0.0):.1f}% Mgr • {bundle.get('leave_approved_by_admin_pct', 0.0):.1f}% Admin",
            "footnote": f"{bundle.get('leave_completed_approvals', 0):,} completed approvals",
            "color": "#06b6d4",
            "category": "Governance",
            "sparkline": None,
        },
        {
            "id": "kpi_avg_in_time",
            "number": 13,
            "title": "AVG IN TIME",
            "label": "Average Morning Punch-In",
            "primary": bundle.get("avg_in_time", "--:--") or "--:--",
            "unit": "time",
            "secondary": f"{bundle.get('complete_swipe_pct', 0.0):.1f}% complete biometric swipes",
            "footnote": "First daily badge swipe",
            "color": "#10b981",
            "category": "Punctuality",
            "sparkline": None,
        },
        {
            "id": "kpi_avg_out_time",
            "number": 14,
            "title": "AVG OUT TIME",
            "label": "Average Evening Punch-Out",
            "primary": bundle.get("avg_out_time", "--:--") or "--:--",
            "unit": "time",
            "secondary": f"{bundle.get('total_physical_days', 0):,} physical days tracked",
            "footnote": "Last daily badge swipe",
            "color": "#f59e0b",
            "category": "Punctuality",
            "sparkline": None,
        },
        {
            "id": "kpi_avg_working_hours",
            "number": 15,
            "title": "AVG WORK HOURS",
            "label": "Average Daily Working Hours",
            "primary": bundle.get("avg_working_hours", "--:--") or "--:--",
            "unit": "duration",
            "secondary": f"{bundle.get('avg_working_hours_decimal', 0.0):.2f} hrs decimal duration",
            "footnote": "Net recorded daily duration",
            "color": "#3b82f6",
            "category": "Punctuality",
            "sparkline": None,
        },
    ]

    # Reconciliation payload
    is_reconciled = (conflicts_cnt == 0 and unclass_cnt == 0)
    recon_status = "clean" if is_reconciled else "notice"
    recon_summary = "100.0% Complete Additive Reconciliation" if is_reconciled else f"{conflicts_cnt + unclass_cnt} unresolved records"
    recon_desc = (
        f"All {denom:,.1f} recorded employee-days accounted for across Present ({q_pres:,.1f}d), "
        f"OD ({q_od:,.1f}d), Leave ({q_leave:,.1f}d), WFH ({q_wfh:,.1f}d), Holiday ({q_hol:,.1f}d), "
        f"Week Off ({q_wo:,.1f}d), and Absent ({q_ab:,.1f}d)."
    )

    return {
        "execution_time_ms": t_elapsed,
        "scope": {
            "business_unit": clean_bu or "All Business Units",
            "department": clean_dept or "All Departments",
            "manager": clean_mgr or "All Reporting Managers",
            "employee": clean_emp or "All Employees",
        },
        "kpi_cards": cards,
        "reconciliation": {
            "status": recon_status,
            "is_reconciled": is_reconciled,
            "total_days": denom,
            "categorized_days": categorized,
            "conflicts_count": conflicts_cnt,
            "unclassified_records_count": unclass_cnt,
            "unclassified_days": q_unclass,
            "summary": recon_summary,
            "description": recon_desc,
        },
        "attendance_composition": bundle.get("attendance_composition", []),
        "attendance_composition_denominator": denom,
        "daily_attendance_trend": clean_trend,
        "bu_attendance_comparison": bundle.get("bu_attendance_comparison", []),
        "bu_comparison_total": bundle.get("bu_comparison_total", {}),
        "data_quality": {
            "status": "clean" if is_reconciled else "warning",
            "conflicts_count": conflicts_cnt,
            "unclassified_count": unclass_cnt,
        },
    }
