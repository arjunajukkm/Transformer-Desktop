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
):
    """
    Sub-millisecond retrieval of dependent filter options from pre-indexed OLAP catalog.
    Instantly returns matching departments, managers, and employee pairs.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        return CascadedFilterResponse()

    # Fast-path OLAP cascade
    casc = workforce_bridge.get_cascaded_filter_options(
        business_unit=business_unit,
        department=department,
        manager=manager,
    )

    all_bus = snap.filter_options.get("business_units", [])
    if not all_bus and snap.olap_engine:
        all_bus = getattr(snap.olap_engine, "_all_bus", [])

    if casc:
        return CascadedFilterResponse(
            business_units=["All Business Units"] + [b for b in all_bus if b != "All Business Units"],
            departments=casc.get("departments", ["All Departments"]),
            managers=casc.get("managers", ["All Reporting Managers"]),
            employees=casc.get("employees", ["All Employees"]),
            emp_pairs=casc.get("emp_pairs", []),
        )

    # Fallback to snapshot filter options
    return CascadedFilterResponse(
        business_units=["All Business Units"] + all_bus,
        departments=["All Departments"] + snap.filter_options.get("departments", []),
        managers=["All Reporting Managers"] + snap.filter_options.get("managers", []),
        employees=["All Employees"],
        emp_pairs=[],
    )


@router.post("/trends")
def query_trend_intelligence(req: TrendQueryRequest):
    """
    Execute high-speed time-series trend calculation with benchmark comparisons,
    MoM changes, volume confidence status, and deterministic observations.
    Sub-10ms response via multi-dimensional OLAP rollup hypercubes.
    """
    snap = snapshot_cache.get_active_snapshot()
    if not snap or not snap.is_valid():
        raise HTTPException(
            status_code=400,
            detail="No active workforce dataset loaded. Please upload a dataset or load demo data."
        )

    date_range = None
    if req.date_start and req.date_end:
        date_range = (req.date_start, req.date_end)

    t0 = time.perf_counter()
    bundle = workforce_bridge.get_trend_intelligence(
        metric_id=req.metric_id,
        benchmark_type=req.benchmark_type,
        business_unit=req.business_unit,
        department=req.department,
        manager=req.manager,
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
