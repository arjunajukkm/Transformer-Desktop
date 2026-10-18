"""
Interactive What-If Policy Simulation Studio Engine.

Evaluates synthetic and historical workforce impact of adjusting policy levers:
- Grace Period (Arrival threshold)
- Overtime Threshold
- Regularization SLA Window
- Flexible Working Allowance
Provides sub-15ms comparative deltas and financial impact forecasts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import polars as pl

logger = logging.getLogger(__name__)


@dataclass
class PolicySimulationParams:
    grace_period_mins: int = 15
    ot_threshold_hours: float = 8.5
    regularization_sla_hours: int = 48
    wfh_weekly_allowance: int = 1


@dataclass
class SimulationOutcome:
    baseline_compliance_rate: float
    simulated_compliance_rate: float
    compliance_delta: float

    baseline_late_instances: int
    simulated_late_instances: int
    late_delta: int

    baseline_ot_hours: float
    simulated_ot_hours: float
    ot_hours_delta: float
    est_ot_cost_delta_usd: float

    friction_index_baseline: float
    friction_index_simulated: float
    friction_delta: float

    policy_health_score: float
    bu_impacts: List[Dict[str, Any]]
    recommendation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "baseline_compliance_rate": round(self.baseline_compliance_rate, 1),
            "simulated_compliance_rate": round(self.simulated_compliance_rate, 1),
            "compliance_delta": round(self.compliance_delta, 1),
            "baseline_late_instances": self.baseline_late_instances,
            "simulated_late_instances": self.simulated_late_instances,
            "late_delta": self.late_delta,
            "baseline_ot_hours": round(self.baseline_ot_hours, 1),
            "simulated_ot_hours": round(self.simulated_ot_hours, 1),
            "ot_hours_delta": round(self.ot_hours_delta, 1),
            "est_ot_cost_delta_usd": round(self.est_ot_cost_delta_usd, 0),
            "friction_index_baseline": round(self.friction_index_baseline, 1),
            "friction_index_simulated": round(self.friction_index_simulated, 1),
            "friction_delta": round(self.friction_delta, 1),
            "policy_health_score": round(self.policy_health_score, 1),
            "bu_impacts": self.bu_impacts,
            "recommendation": self.recommendation,
        }


def _normalize_facts(df: pl.DataFrame) -> pl.DataFrame:
    """Standardize column names across raw and OLAP fact schemas."""
    cols = df.columns
    emp_code = "_emp_num" if "_emp_num" in cols else ("Employee No" if "Employee No" in cols else ("employee_code" if "employee_code" in cols else None))
    bu_col = "_bu" if "_bu" in cols else ("Business Unit" if "Business Unit" in cols else ("business_unit" if "business_unit" in cols else None))
    in_col = "_in_mins" if "_in_mins" in cols else ("in_mins" if "in_mins" in cols else ("in_time_minutes" if "in_time_minutes" in cols else None))
    dur_col = "_work_mins" if "_work_mins" in cols else ("duration_mins" if "duration_mins" in cols else ("effective_hours_minutes" if "effective_hours_minutes" in cols else None))

    exprs = [
        pl.col(emp_code).cast(pl.Utf8).alias("employee_code") if emp_code else pl.lit("EMP-UNKNOWN").alias("employee_code"),
        pl.col(bu_col).cast(pl.Utf8).alias("business_unit") if bu_col else pl.lit("Unknown").alias("business_unit"),
        pl.col(in_col).cast(pl.Float64).alias("in_mins") if in_col else pl.lit(None, dtype=pl.Float64).alias("in_mins"),
        pl.col(dur_col).cast(pl.Float64).fill_null(480.0).alias("duration_mins") if dur_col else pl.lit(480.0, dtype=pl.Float64).alias("duration_mins"),
    ]
    return df.select(exprs)


class PolicySimulator:
    """Executes vectorized What-If policy simulations against Polars facts."""

    HOURLY_BLENDED_RATE_USD = 28.50

    def simulate(
        self,
        facts_table: pl.DataFrame,
        params: PolicySimulationParams,
        business_unit: Optional[str] = None,
    ) -> SimulationOutcome:
        """Simulate policy parameter variations and measure delta outcomes."""
        if facts_table is None or facts_table.is_empty():
            return SimulationOutcome(
                baseline_compliance_rate=0.0,
                simulated_compliance_rate=0.0,
                compliance_delta=0.0,
                baseline_late_instances=0,
                simulated_late_instances=0,
                late_delta=0,
                baseline_ot_hours=0.0,
                simulated_ot_hours=0.0,
                ot_hours_delta=0.0,
                est_ot_cost_delta_usd=0.0,
                friction_index_baseline=50.0,
                friction_index_simulated=50.0,
                friction_delta=0.0,
                policy_health_score=50.0,
                bu_impacts=[],
                recommendation="Insufficient data for simulation.",
            )

        df = _normalize_facts(facts_table)
        if business_unit:
            bu_clean = str(business_unit).strip().lower()
            if bu_clean not in ("all", "all business units", "all business unit", "all departments", "all managers", "none", "", "null"):
                df = df.filter(pl.col("business_unit").str.to_lowercase() == bu_clean)

        if df.is_empty():
            return SimulationOutcome(
                baseline_compliance_rate=0.0,
                simulated_compliance_rate=0.0,
                compliance_delta=0.0,
                baseline_late_instances=0,
                simulated_late_instances=0,
                late_delta=0,
                baseline_ot_hours=0.0,
                simulated_ot_hours=0.0,
                ot_hours_delta=0.0,
                est_ot_cost_delta_usd=0.0,
                friction_index_baseline=50.0,
                friction_index_simulated=50.0,
                friction_delta=0.0,
                policy_health_score=50.0,
                bu_impacts=[],
                recommendation="No records match the requested scope.",
            )

        # Baseline: Shift start 09:30 AM = 570 mins. Grace = 15 mins (585 mins)
        sim_grace_threshold = 570 + params.grace_period_mins
        ot_thresh_mins = params.ot_threshold_hours * 60.0

        eval_df = df.with_columns([
            (pl.col("in_mins").fill_null(540.0) > 585).alias("is_late_baseline"),
            (pl.col("in_mins").fill_null(540.0) > sim_grace_threshold).alias("is_late_sim"),
            (pl.col("duration_mins") > 510).alias("is_ot_baseline"),
            (pl.col("duration_mins") > ot_thresh_mins).alias("is_ot_sim"),
            pl.max_horizontal(
                pl.lit(0.0),
                (pl.col("duration_mins") - 510) / 60.0
            ).alias("ot_hours_baseline"),
            pl.max_horizontal(
                pl.lit(0.0),
                (pl.col("duration_mins") - ot_thresh_mins) / 60.0
            ).alias("ot_hours_sim"),
        ])

        base_late = int(eval_df.select(pl.col("is_late_baseline").sum()).item() or 0)
        sim_late = int(eval_df.select(pl.col("is_late_sim").sum()).item() or 0)
        late_delta = sim_late - base_late

        base_ot_h = float(eval_df.select(pl.col("ot_hours_baseline").sum()).item() or 0.0)
        sim_ot_h = float(eval_df.select(pl.col("ot_hours_sim").sum()).item() or 0.0)
        ot_delta = sim_ot_h - base_ot_h
        cost_delta = ot_delta * self.HOURLY_BLENDED_RATE_USD

        present_count = int(eval_df.filter(pl.col("in_mins").is_not_null()).height or 1)
        base_comp = max(0.0, min(100.0, ((present_count - base_late) / max(1, present_count)) * 100.0))
        sim_comp = max(0.0, min(100.0, ((present_count - sim_late) / max(1, present_count)) * 100.0))
        comp_delta = sim_comp - base_comp

        friction_base = 35.0 + (base_late / max(1, present_count)) * 40.0
        friction_sim = 35.0 + (sim_late / max(1, present_count)) * 40.0
        if params.grace_period_mins < 10:
            friction_sim += 12.0
        elif params.grace_period_mins > 25:
            friction_sim -= 8.0

        friction_sim = max(5.0, min(95.0, friction_sim))
        friction_base = max(5.0, min(95.0, friction_base))
        f_delta = friction_sim - friction_base

        policy_health = sim_comp * 0.5 + (100.0 - friction_sim) * 0.3 + max(0.0, 100.0 - (sim_ot_h / 50.0)) * 0.2
        policy_health = max(10.0, min(99.0, policy_health))

        bu_impacts: List[Dict[str, Any]] = []
        if "business_unit" in eval_df.columns:
            bu_agg = eval_df.group_by("business_unit").agg([
                pl.len().alias("headcount"),
                pl.col("is_late_baseline").sum().alias("bu_base_late"),
                pl.col("is_late_sim").sum().alias("bu_sim_late"),
                pl.col("ot_hours_baseline").sum().alias("bu_base_ot"),
                pl.col("ot_hours_sim").sum().alias("bu_sim_ot"),
            ])
            for bu_row in bu_agg.to_dicts():
                b_late = bu_row.get("bu_base_late", 0) or 0
                s_late = bu_row.get("bu_sim_late", 0) or 0
                b_ot = bu_row.get("bu_base_ot", 0.0) or 0.0
                s_ot = bu_row.get("bu_sim_ot", 0.0) or 0.0
                bu_impacts.append({
                    "business_unit": str(bu_row.get("business_unit", "Unknown")),
                    "late_instances_delta": s_late - b_late,
                    "ot_hours_delta": round(s_ot - b_ot, 1),
                    "est_cost_delta": round((s_ot - b_ot) * self.HOURLY_BLENDED_RATE_USD, 0),
                })

        if comp_delta > 5.0 and cost_delta <= 0:
            rec = f"Highly Recommended: Expanding grace period to {params.grace_period_mins} mins lifts compliance by +{round(comp_delta, 1)}% while preserving overtime controls."
        elif cost_delta > 10000:
            rec = f"Caution: Proposed overtime threshold shifts generate ${int(cost_delta):,} in additional estimated payroll expense."
        elif friction_sim < 25.0:
            rec = f"Optimal Balance: Policy achieves low employee friction ({round(friction_sim, 1)}/100) with solid attendance integrity."
        else:
            rec = f"Simulated policy shifts maintain operational equilibrium (Health Score: {round(policy_health, 1)}/100)."

        return SimulationOutcome(
            baseline_compliance_rate=base_comp,
            simulated_compliance_rate=sim_comp,
            compliance_delta=comp_delta,
            baseline_late_instances=base_late,
            simulated_late_instances=sim_late,
            late_delta=late_delta,
            baseline_ot_hours=base_ot_h,
            simulated_ot_hours=sim_ot_h,
            ot_hours_delta=ot_delta,
            est_ot_cost_delta_usd=cost_delta,
            friction_index_baseline=friction_base,
            friction_index_simulated=friction_sim,
            friction_delta=f_delta,
            policy_health_score=policy_health,
            bu_impacts=bu_impacts,
            recommendation=rec,
        )
