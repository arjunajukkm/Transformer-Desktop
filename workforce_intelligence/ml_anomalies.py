"""
Unsupervised Punch Rhythm Anomaly Detection Engine.

Leverages Scikit-Learn IsolationForest alongside vectorized Polars fact tables
to identify high-entropy shift deviations, erratic clocking rhythms, and micro-discrepancies.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import polars as pl
import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class PunchAnomaly:
    employee_code: str
    employee_name: str
    business_unit: str
    department: str
    date: str
    anomaly_score: float  # 0 to 100
    severity: str         # "CRITICAL", "HIGH", "MODERATE"
    in_time: str
    out_time: str
    duration_hours: float
    reasons: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "employee_code": self.employee_code,
            "employee_name": self.employee_name,
            "business_unit": self.business_unit,
            "department": self.department,
            "date": self.date,
            "anomaly_score": round(self.anomaly_score, 1),
            "severity": self.severity,
            "in_time": self.in_time,
            "out_time": self.out_time,
            "duration_hours": round(self.duration_hours, 2),
            "reasons": self.reasons,
        }


def _normalize_facts(df: pl.DataFrame) -> pl.DataFrame:
    """Standardize column names across raw and OLAP fact schemas."""
    cols = df.columns
    emp_code = "_emp_num" if "_emp_num" in cols else ("Employee No" if "Employee No" in cols else ("employee_code" if "employee_code" in cols else None))
    emp_name = "_emp_name" if "_emp_name" in cols else ("Employee Name" if "Employee Name" in cols else ("employee_name" if "employee_name" in cols else None))
    bu_col = "_bu" if "_bu" in cols else ("Business Unit" if "Business Unit" in cols else ("business_unit" if "business_unit" in cols else None))
    dept_col = "_dept" if "_dept" in cols else ("Department" if "Department" in cols else ("department" if "department" in cols else None))
    date_col = "_event_date" if "_event_date" in cols else ("Date" if "Date" in cols else ("date" if "date" in cols else None))
    in_col = "_in_mins" if "_in_mins" in cols else ("in_mins" if "in_mins" in cols else ("in_time_minutes" if "in_time_minutes" in cols else None))
    out_col = "_out_mins" if "_out_mins" in cols else ("out_mins" if "out_mins" in cols else ("out_time_minutes" if "out_time_minutes" in cols else None))
    dur_col = "_work_mins" if "_work_mins" in cols else ("duration_mins" if "duration_mins" in cols else ("effective_hours_minutes" if "effective_hours_minutes" in cols else None))

    exprs = [
        pl.col(emp_code).cast(pl.Utf8).alias("employee_code") if emp_code else pl.lit("EMP-UNKNOWN").alias("employee_code"),
        pl.col(emp_name).cast(pl.Utf8).alias("employee_name") if emp_name else pl.lit("Unknown").alias("employee_name"),
        pl.col(bu_col).cast(pl.Utf8).alias("business_unit") if bu_col else pl.lit("Unknown").alias("business_unit"),
        pl.col(dept_col).cast(pl.Utf8).alias("department") if dept_col else pl.lit("Unknown").alias("department"),
        pl.col(date_col).cast(pl.Utf8).alias("date") if date_col else pl.lit("").alias("date"),
        pl.col(in_col).cast(pl.Float64).alias("in_mins") if in_col else pl.lit(None, dtype=pl.Float64).alias("in_mins"),
        pl.col(out_col).cast(pl.Float64).alias("out_mins") if out_col else pl.lit(None, dtype=pl.Float64).alias("out_mins"),
        pl.col(dur_col).cast(pl.Float64).alias("duration_mins") if dur_col else pl.lit(None, dtype=pl.Float64).alias("duration_mins"),
    ]
    return df.select(exprs)


class PunchAnomalyDetector:
    """Detects unsupervised punch rhythm anomalies from employee-day records."""

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state

    def detect_anomalies(
        self,
        facts_table: pl.DataFrame,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        limit: int = 50,
    ) -> List[PunchAnomaly]:
        """Run Isolation Forest on punch features and return ranked anomaly cases."""
        if facts_table is None or facts_table.is_empty():
            return []

        df = _normalize_facts(facts_table)
        if business_unit and business_unit != "All":
            df = df.filter(pl.col("business_unit") == business_unit)
        if department and department != "All":
            df = df.filter(pl.col("department") == department)

        if df.is_empty():
            return []

        # Filter to records where at least in_mins or duration_mins is present
        punch_df = df.filter(
            pl.col("in_mins").is_not_null() & pl.col("in_mins").is_not_nan()
        )

        if punch_df.height < 5:
            return []

        # Fill missing out_mins or duration_mins with reasonable estimations
        punch_df = punch_df.with_columns([
            pl.col("out_mins").fill_null(pl.col("in_mins") + 480.0),
            pl.col("duration_mins").fill_null(480.0),
        ])

        # Feature Engineering:
        # Compute personal median per employee
        stats_df = punch_df.group_by("employee_code").agg([
            pl.col("in_mins").median().alias("emp_median_in"),
            pl.col("out_mins").median().alias("emp_median_out"),
            pl.col("duration_mins").median().alias("emp_median_dur"),
        ])

        joined = punch_df.join(stats_df, on="employee_code", how="left")
        
        # Calculate deviations
        feat_df = joined.with_columns([
            (pl.col("in_mins") - pl.col("emp_median_in")).abs().alias("in_dev"),
            (pl.col("out_mins") - pl.col("emp_median_out")).abs().alias("out_dev"),
            (pl.col("duration_mins") - pl.col("emp_median_dur")).abs().alias("dur_dev"),
            (pl.col("duration_mins") / 60.0).alias("dur_hours"),
        ])

        features = feat_df.select([
            "in_mins",
            "out_mins",
            "duration_mins",
            "in_dev",
            "out_dev",
            "dur_dev",
        ]).to_numpy()

        features = np.nan_to_num(features, nan=0.0)

        # Train Isolation Forest
        if SKLEARN_AVAILABLE and features.shape[0] >= 5:
            contam = min(0.4, max(0.01, self.contamination))
            iso = IsolationForest(
                n_estimators=100,
                contamination=contam,
                random_state=self.random_state,
                n_jobs=-1,
            )
            iso.fit(features)
            raw_scores = iso.score_samples(features)
            min_s, max_s = raw_scores.min(), raw_scores.max()
            if max_s > min_s:
                norm_scores = (1.0 - (raw_scores - min_s) / (max_s - min_s)) * 100.0
            else:
                norm_scores = np.full_like(raw_scores, 50.0)
        else:
            in_dev = features[:, 3]
            out_dev = features[:, 4]
            dur_dev = features[:, 5]
            total_dev = in_dev + out_dev + dur_dev
            max_dev = total_dev.max() or 1.0
            norm_scores = np.clip((total_dev / max_dev) * 100.0, 0, 100)

        feat_df = feat_df.with_columns(pl.Series("anomaly_score", norm_scores))

        # Filter to elevated anomaly scores
        sorted_df = feat_df.filter(pl.col("anomaly_score") >= 55.0).sort(
            "anomaly_score", descending=True
        ).head(limit)

        anomalies: List[PunchAnomaly] = []
        rows = sorted_df.to_dicts()

        for r in rows:
            score = float(r.get("anomaly_score", 0.0))
            if score >= 85.0:
                severity = "CRITICAL"
            elif score >= 70.0:
                severity = "HIGH"
            else:
                severity = "MODERATE"

            reasons = []
            in_dev = r.get("in_dev", 0.0) or 0.0
            out_dev = r.get("out_dev", 0.0) or 0.0
            dur_h = float(r.get("dur_hours", 0.0) or 0.0)

            if in_dev >= 45:
                reasons.append(f"Clock-in deviated by {int(in_dev)} mins vs typical arrival")
            if out_dev >= 60:
                reasons.append(f"Clock-out deviated by {int(out_dev)} mins vs typical departure")
            if dur_h >= 11.5:
                reasons.append(f"Excessive duration logged ({round(dur_h, 1)} hrs)")
            elif dur_h <= 4.0:
                reasons.append(f"Micro-shift anomaly ({round(dur_h, 1)} hrs)")
            
            if not reasons:
                reasons.append(f"Outlier rhythm variance detected (Score: {round(score, 1)})")

            in_m = int(r.get("in_mins") or 0)
            out_m = int(r.get("out_mins") or 0)
            in_str = f"{in_m // 60:02d}:{in_m % 60:02d}"
            out_str = f"{out_m // 60:02d}:{out_m % 60:02d}"

            anomalies.append(
                PunchAnomaly(
                    employee_code=str(r.get("employee_code", "")),
                    employee_name=str(r.get("employee_name", "Unknown")),
                    business_unit=str(r.get("business_unit", "Unknown")),
                    department=str(r.get("department", "Unknown")),
                    date=str(r.get("date", "")),
                    anomaly_score=score,
                    severity=severity,
                    in_time=in_str,
                    out_time=out_str,
                    duration_hours=dur_h,
                    reasons=reasons,
                )
            )

        return anomalies
