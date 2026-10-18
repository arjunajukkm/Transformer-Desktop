"""
FastAPI route definitions for Machine Learning, Predictive Intelligence, and What-If Simulations.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from workforce_intelligence.snapshot_bridge import workforce_bridge
from workforce_intelligence.ml_anomalies import PunchAnomalyDetector
from workforce_intelligence.ml_burnout import WorkforceBurnoutEngine
from workforce_intelligence.simulation import PolicySimulator, PolicySimulationParams

router = APIRouter(prefix="/ml", tags=["Machine Learning & Decision Intelligence"])

_anomaly_detector = PunchAnomalyDetector(contamination=0.08)
_burnout_engine = WorkforceBurnoutEngine()
_policy_simulator = PolicySimulator()


class SimulationRequest(BaseModel):
    grace_period_mins: int = Field(default=15, ge=0, le=60)
    ot_threshold_hours: float = Field(default=8.5, ge=6.0, le=14.0)
    regularization_sla_hours: int = Field(default=48, ge=12, le=120)
    wfh_weekly_allowance: int = Field(default=1, ge=0, le=5)
    business_unit: Optional[str] = "All"


@router.get("/anomalies")
def get_punch_anomalies(
    business_unit: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Detect unsupervised punch rhythm outliers using Isolation Forest.
    Identifies high-entropy shift deviations, erratic clock-in times, and suspicious durations.
    """
    t0 = time.perf_counter()
    engine = workforce_bridge.get_olap_engine()
    if engine is None or engine._df_pl.is_empty():
        return {
            "anomalies": [],
            "count": 0,
            "execution_time_ms": 0.0,
            "message": "No active dataset loaded.",
        }

    anomalies = _anomaly_detector.detect_anomalies(
        facts_table=engine._df_pl,
        business_unit=business_unit,
        department=department,
        limit=limit,
    )
    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "anomalies": [a.to_dict() for a in anomalies],
        "count": len(anomalies),
        "execution_time_ms": t_elapsed,
    }


@router.get("/burnout-risks")
def get_workforce_burnout_risks(
    business_unit: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    limit: int = Query(30, ge=1, le=100),
):
    """
    Predict employee burnout scores and retention flight risk levels
    based on working stretch fatigue, rest interval compression, and overtime frequency.
    """
    t0 = time.perf_counter()
    engine = workforce_bridge.get_olap_engine()
    if engine is None or engine._df_pl.is_empty():
        return {
            "employee_risks": [],
            "cohort_risks": [],
            "summary": {},
            "execution_time_ms": 0.0,
            "message": "No active dataset loaded.",
        }

    results = _burnout_engine.analyze(
        facts_table=engine._df_pl,
        business_unit=business_unit,
        department=department,
        limit=limit,
    )
    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)
    results["execution_time_ms"] = t_elapsed
    return results


@router.post("/simulate")
def run_policy_simulation(request: SimulationRequest):
    """
    Run vectorized What-If policy simulations in < 15ms.
    Calculates predicted shifts in compliance rate, late marks, overtime financial impact ($),
    and friction index.
    """
    t0 = time.perf_counter()
    engine = workforce_bridge.get_olap_engine()
    if engine is None or engine._df_pl.is_empty():
        raise HTTPException(status_code=400, detail="No active dataset loaded for policy simulation.")

    params = PolicySimulationParams(
        grace_period_mins=request.grace_period_mins,
        ot_threshold_hours=request.ot_threshold_hours,
        regularization_sla_hours=request.regularization_sla_hours,
        wfh_weekly_allowance=request.wfh_weekly_allowance,
    )

    bu_req = request.business_unit
    if not bu_req or str(bu_req).strip().lower() in ("all", "all business units", "all business unit", "none", ""):
        bu_req = "All"

    outcome = _policy_simulator.simulate(
        facts_table=engine._df_pl,
        params=params,
        business_unit=bu_req,
    )
    t_elapsed = round((time.perf_counter() - t0) * 1000, 2)

    data = outcome.to_dict()
    data["execution_time_ms"] = t_elapsed
    return data
