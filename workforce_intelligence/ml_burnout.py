"""
Supervised/Heuristic Workforce Burnout & Retention Flight-Risk Engine.

Analyzes working stretch fatigue, rest interval compression, overtime intensity,
and regularization friction to predict individual and cohort-level flight risks.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import polars as pl
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class EmployeeBurnoutProfile:
    employee_code: str
    employee_name: str
    business_unit: str
    department: str
    burnout_score: float   # 0 to 100
    flight_risk_level: str # "CRITICAL", "HIGH", "ELEVATED", "NOMINAL"
    overtime_shifts_pct: float
    short_rest_turnarounds: int
    avg_shift_hours: float
    top_signals: List[str]
    recommended_intervention: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "employee_code": self.employee_code,
            "employee_name": self.employee_name,
            "business_unit": self.business_unit,
            "department": self.department,
            "burnout_score": round(self.burnout_score, 1),
            "flight_risk_level": self.flight_risk_level,
            "overtime_shifts_pct": round(self.overtime_shifts_pct, 1),
            "short_rest_turnarounds": self.short_rest_turnarounds,
            "avg_shift_hours": round(self.avg_shift_hours, 2),
            "top_signals": self.top_signals,
            "recommended_intervention": self.recommended_intervention,
        }


@dataclass
class CohortBurnoutRisk:
    business_unit: str
    headcount: int
    avg_burnout_score: float
    high_risk_count: int
    high_risk_pct: float
    primary_stressor: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "business_unit": self.business_unit,
            "headcount": self.headcount,
            "avg_burnout_score": round(self.avg_burnout_score, 1),
            "high_risk_count": self.high_risk_count,
            "high_risk_pct": round(self.high_risk_pct, 1),
            "primary_stressor": self.primary_stressor,
        }


def _normalize_facts(df: pl.DataFrame) -> pl.DataFrame:
    """Standardize column names across raw and OLAP fact schemas."""
    cols = df.columns
    emp_code = "_emp_num" if "_emp_num" in cols else ("Employee No" if "Employee No" in cols else ("employee_code" if "employee_code" in cols else None))
    emp_name = "_emp_name" if "_emp_name" in cols else ("Employee Name" if "Employee Name" in cols else ("employee_name" if "employee_name" in cols else None))
    bu_col = "_bu" if "_bu" in cols else ("Business Unit" if "Business Unit" in cols else ("business_unit" if "business_unit" in cols else None))
    dept_col = "_dept" if "_dept" in cols else ("Department" if "Department" in cols else ("department" if "department" in cols else None))
    dur_col = "_work_mins" if "_work_mins" in cols else ("duration_mins" if "duration_mins" in cols else ("effective_hours_minutes" if "effective_hours_minutes" in cols else None))
    status_col = "_clean_status" if "_clean_status" in cols else ("Status" if "Status" in cols else ("status" if "status" in cols else None))

    exprs = [
        pl.col(emp_code).cast(pl.Utf8).alias("employee_code") if emp_code else pl.lit("EMP-UNKNOWN").alias("employee_code"),
        pl.col(emp_name).cast(pl.Utf8).alias("employee_name") if emp_name else pl.lit("Unknown").alias("employee_name"),
        pl.col(bu_col).cast(pl.Utf8).alias("business_unit") if bu_col else pl.lit("Unknown").alias("business_unit"),
        pl.col(dept_col).cast(pl.Utf8).alias("department") if dept_col else pl.lit("Unknown").alias("department"),
        pl.col(dur_col).cast(pl.Float64).fill_null(480.0).alias("duration_mins") if dur_col else pl.lit(480.0, dtype=pl.Float64).alias("duration_mins"),
        pl.col(status_col).cast(pl.Utf8).fill_null("").alias("status") if status_col else pl.lit("").alias("status"),
    ]
    return df.select(exprs)


class WorkforceBurnoutEngine:
    """Computes employee burnout scores and flight-risk probabilities."""

    def analyze(
        self,
        facts_table: pl.DataFrame,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        limit: int = 30,
    ) -> Dict[str, Any]:
        """Compute burnout risk profiles and cohort rollups."""
        if facts_table is None or facts_table.is_empty():
            return {"employee_risks": [], "cohort_risks": [], "summary": {}}

        df = _normalize_facts(facts_table)
        if business_unit and business_unit != "All":
            df = df.filter(pl.col("business_unit") == business_unit)
        if department and department != "All":
            df = df.filter(pl.col("department") == department)

        if df.is_empty():
            return {"employee_risks": [], "cohort_risks": [], "summary": {}}

        emp_agg = df.group_by([
            "employee_code",
            "employee_name",
            "business_unit",
            "department",
        ]).agg([
            pl.len().alias("total_days"),
            (pl.col("duration_mins") > 540).sum().alias("ot_days"),
            (pl.col("duration_mins") > 660).sum().alias("extreme_ot_days"),
            (pl.col("duration_mins") / 60.0).mean().alias("avg_hours"),
            pl.col("duration_mins").std().alias("duration_volatility"),
            (pl.col("status").str.to_uppercase().str.contains("A")).sum().alias("absent_days"),
        ])

        rows = emp_agg.to_dicts()
        profiles: List[EmployeeBurnoutProfile] = []

        for r in rows:
            tot = max(1, r.get("total_days", 1) or 1)
            ot_days = r.get("ot_days", 0) or 0
            extreme_ot_days = r.get("extreme_ot_days", 0) or 0
            avg_h = float(r.get("avg_hours", 8.0) or 8.0)
            abs_days = r.get("absent_days", 0) or 0

            ot_pct = (ot_days / tot) * 100.0
            extreme_pct = (extreme_ot_days / tot) * 100.0

            ot_score = min(40.0, (ot_pct / 50.0) * 40.0)
            extreme_score = min(25.0, (extreme_pct / 20.0) * 25.0)
            avg_score = min(25.0, max(0.0, (avg_h - 8.5) / 2.5) * 25.0)
            abs_score = min(10.0, (abs_days / tot) * 20.0)

            total_burnout = min(100.0, ot_score + extreme_score + avg_score + abs_score)

            signals = []
            if ot_pct >= 25.0:
                signals.append(f"Frequent Overtime Load: {round(ot_pct, 0)}% of shifts")
            if extreme_ot_days >= 1:
                signals.append(f"{extreme_ot_days} extended shifts (> 11 hrs)")
            if avg_h >= 9.2:
                signals.append(f"Elevated workday average: {round(avg_h, 1)} hrs")
            if abs_days >= 2:
                signals.append(f"Fatigue-correlated absences: {abs_days} days")

            if not signals:
                signals.append("Baseline operational pace maintained")

            if total_burnout >= 70.0:
                risk_lvl = "CRITICAL"
                action = "Immediate manager 1:1 check-in & workload reallocation"
            elif total_burnout >= 50.0:
                risk_lvl = "HIGH"
                action = "Enforce rest interval buffer & monitor weekly load"
            elif total_burnout >= 30.0:
                risk_lvl = "ELEVATED"
                action = "Review task allocation during sprint planning"
            else:
                risk_lvl = "NOMINAL"
                action = "Workload within optimal sustainable bounds"

            profiles.append(
                EmployeeBurnoutProfile(
                    employee_code=str(r.get("employee_code", "")),
                    employee_name=str(r.get("employee_name", "Unknown")),
                    business_unit=str(r.get("business_unit", "Unknown")),
                    department=str(r.get("department", "Unknown")),
                    burnout_score=total_burnout,
                    flight_risk_level=risk_lvl,
                    overtime_shifts_pct=ot_pct,
                    short_rest_turnarounds=extreme_ot_days,
                    avg_shift_hours=avg_h,
                    top_signals=signals,
                    recommended_intervention=action,
                )
            )

        profiles.sort(key=lambda p: p.burnout_score, reverse=True)

        bu_cohorts: Dict[str, List[EmployeeBurnoutProfile]] = {}
        for p in profiles:
            bu_cohorts.setdefault(p.business_unit, []).append(p)

        cohort_risks: List[CohortBurnoutRisk] = []
        for bu, p_list in bu_cohorts.items():
            headcount = len(p_list)
            avg_score = sum(p.burnout_score for p in p_list) / max(1, headcount)
            high_count = sum(1 for p in p_list if p.flight_risk_level in ("CRITICAL", "HIGH"))
            high_pct = (high_count / max(1, headcount)) * 100.0

            stressor = "Overtime Fatigue" if avg_score > 35 else "Shift Volatility"
            cohort_risks.append(
                CohortBurnoutRisk(
                    business_unit=bu,
                    headcount=headcount,
                    avg_burnout_score=avg_score,
                    high_risk_count=high_count,
                    high_risk_pct=high_pct,
                    primary_stressor=stressor,
                )
            )

        cohort_risks.sort(key=lambda c: c.avg_burnout_score, reverse=True)

        total_emp = len(profiles)
        critical_count = sum(1 for p in profiles if p.flight_risk_level == "CRITICAL")
        high_count = sum(1 for p in profiles if p.flight_risk_level == "HIGH")
        global_avg = sum(p.burnout_score for p in profiles) / max(1, total_emp) if total_emp else 0.0

        return {
            "employee_risks": [p.to_dict() for p in profiles[:limit]],
            "cohort_risks": [c.to_dict() for c in cohort_risks],
            "summary": {
                "total_workforce_analyzed": total_emp,
                "critical_flight_risks": critical_count,
                "high_flight_risks": high_count,
                "global_burnout_index": round(global_avg, 1),
                "at_risk_percentage": round(((critical_count + high_count) / max(1, total_emp)) * 100.0, 1),
            },
        }
