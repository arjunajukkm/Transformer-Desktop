"""
storage/materialized_store.py
──────────────────────────────
High-performance materialized analytical cache for Transformers 2.0.
Precalculates and persists all primary organization and BU-level views to disk
so dashboard navigation and initial loads execute instantaneously (<5ms)
without repetitive dataframe scans or formula recalculations.

Supports:
- Daily persistent disk cache (JSON/Apache Arrow friendly)
- Sub-5ms instant in-memory lookup for standard scopes
- User-triggered on-demand sync & recalculation
"""

from datetime import date, datetime
import json
import logging
from pathlib import Path
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("materialized_store")

CACHE_DIR = Path(__file__).resolve().parent.parent / "local_data"
CACHE_FILE = CACHE_DIR / "daily_materialized_cache.json"


CURRENT_CACHE_VERSION = "v8_approval_breakdowns"


class MaterializedAnalyticsStore:
    def __init__(self):
        self._lock = threading.RLock()
        self._overview_cache: Dict[str, Dict[str, Any]] = {}
        self._trends_cache: Dict[str, Dict[str, Any]] = {}
        self._filters_cache: Optional[Dict[str, Any]] = None
        self._attendance_summary_cache: Optional[Dict[str, Any]] = None
        self._last_calculated_at: Optional[str] = None
        self._dataset_id: Optional[str] = None
        self._is_ready: bool = False

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    @property
    def last_calculated_at(self) -> Optional[str]:
        return self._last_calculated_at

    def clear(self):
        """Purge all in-memory materialized views and reset state."""
        with self._lock:
            self._overview_cache.clear()
            self._trends_cache.clear()
            self._filters_cache = None
            self._attendance_summary_cache = None
            self._is_ready = False
            logger.info("Materialized analytical cache purged.")

    def get_metadata(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "is_materialized": self._is_ready,
                "last_calculated_at": self._last_calculated_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "dataset_id": self._dataset_id,
                "cached_overviews_count": len(self._overview_cache),
                "cached_trends_count": len(self._trends_cache),
            }

    def _scope_key(
        self,
        month: Optional[str] = None,
        bu: Optional[str] = None,
        dept: Optional[str] = None,
        mgr: Optional[str] = None,
        emp: Optional[str] = None,
    ) -> str:
        mo = str(month).strip().lower() if month and str(month).strip().lower() not in ("all", "all months", "none", "", "nan") else ""
        b = str(bu).strip().lower() if bu and str(bu).strip().lower() not in ("all", "all business units", "none", "") else ""
        d = str(dept).strip().lower() if dept and str(dept).strip().lower() not in ("all", "all departments", "none", "") else ""
        m = str(mgr).strip().lower() if mgr and str(mgr).strip().lower() not in ("all", "all reporting managers", "none", "") else ""
        e = str(emp).strip().lower() if emp and str(emp).strip().lower() not in ("all", "all employees", "none", "") else ""
        return f"m:{mo}|bu:{b}|dept:{d}|mgr:{m}|emp:{e}"

    def get_overview(
        self,
        month: Optional[str] = None,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            if not self._is_ready:
                return None
            key = self._scope_key(month, business_unit, department, manager, employee)
            return self._overview_cache.get(key)

    def set_overview(
        self,
        data: Dict[str, Any],
        month: Optional[str] = None,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
    ):
        with self._lock:
            key = self._scope_key(month, business_unit, department, manager, employee)
            self._overview_cache[key] = data

    def get_trends(
        self,
        metric_id: str,
        benchmark_type: str = "ORGANIZATION",
        month: Optional[str] = None,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            if not self._is_ready:
                return None
            scope = self._scope_key(month, business_unit, department, manager, employee)
            key = f"{metric_id}|{benchmark_type}|{scope}"
            return self._trends_cache.get(key)

    def set_trends(
        self,
        data: Dict[str, Any],
        metric_id: str,
        benchmark_type: str = "ORGANIZATION",
        month: Optional[str] = None,
        business_unit: Optional[str] = None,
        department: Optional[str] = None,
        manager: Optional[str] = None,
        employee: Optional[str] = None,
    ):
        with self._lock:
            scope = self._scope_key(month, business_unit, department, manager, employee)
            key = f"{metric_id}|{benchmark_type}|{scope}"
            self._trends_cache[key] = data

    def get_filters(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._filters_cache

    def set_filters(self, data: Dict[str, Any]):
        with self._lock:
            self._filters_cache = data

    def get_attendance_summary(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._attendance_summary_cache

    def set_attendance_summary(self, data: Dict[str, Any]):
        with self._lock:
            self._attendance_summary_cache = data

    def load_from_disk(self) -> bool:
        """Attempt loading precalculated cache from disk."""
        with self._lock:
            if not CACHE_FILE.exists():
                return False
            try:
                t0 = time.perf_counter()
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    payload = json.load(f)

                if payload.get("version") != CURRENT_CACHE_VERSION:
                    logger.info(f"Materialized cache version mismatch (expected {CURRENT_CACHE_VERSION}, found {payload.get('version')}). Re-running calculation.")
                    return False

                self._overview_cache = payload.get("overview_cache", {})
                self._trends_cache = payload.get("trends_cache", {})
                self._filters_cache = payload.get("filters_cache")
                self._attendance_summary_cache = payload.get("attendance_summary_cache")
                self._last_calculated_at = payload.get("last_calculated_at")
                self._dataset_id = payload.get("dataset_id")
                self._is_ready = True
                elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
                logger.info(f"Loaded materialized daily cache from disk in {elapsed_ms}ms ({len(self._overview_cache)} overviews, {len(self._trends_cache)} trends).")
                return True
            except Exception as e:
                logger.warning(f"Failed to load materialized cache from disk: {e}")
                return False

    def save_to_disk(self) -> bool:
        """Persist in-memory materialized views to disk."""
        with self._lock:
            try:
                CACHE_DIR.mkdir(parents=True, exist_ok=True)
                payload = {
                    "version": CURRENT_CACHE_VERSION,
                    "last_calculated_at": self._last_calculated_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "dataset_id": self._dataset_id,
                    "overview_cache": self._overview_cache,
                    "trends_cache": self._trends_cache,
                    "filters_cache": self._filters_cache,
                    "attendance_summary_cache": self._attendance_summary_cache,
                }
                with open(CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(payload, f, default=str)
                logger.info("Successfully persisted daily materialized cache to disk.")
                return True
            except Exception as e:
                logger.warning(f"Failed to save materialized cache to disk: {e}")
                return False

    def precalculate_all(self, snap: Optional[Any] = None, force: bool = False) -> Dict[str, Any]:
        """
        Execute full unified precalculation across all primary views.
        Runs once daily or on user-triggered ad-hoc resync.
        """
        from storage.cache_manager import snapshot_cache
        from workforce_intelligence.snapshot_bridge import workforce_bridge
        from workforce_intelligence.trends import TREND_METRICS

        if snap is None:
            snap = snapshot_cache.get_active_snapshot()

        if not snap or not snap.is_valid():
            logger.warning("Cannot precalculate: No valid active snapshot available.")
            return {"status": "NO_SNAPSHOT", "duration_ms": 0}

        t0 = time.perf_counter()
        logger.info("Starting comprehensive analytical precalculation...")

        with self._lock:
            if force:
                self._overview_cache.clear()
                self._trends_cache.clear()
            self._dataset_id = snap.dataset_id
            self._last_calculated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 1. Warm global overview across all months and each specific month
        from api.routes.analytics import get_executive_overview
        from api.auth import ENTERPRISE_PERSONAS
        system_user = ENTERPRISE_PERSONAS["admin"]

        from workforce_intelligence.historical_sync import HistoricalSyncManager
        h_sync_m = HistoricalSyncManager()
        reg_m = set(h_sync_m.load_registry().get("months", {}).keys())
        fact_m = set()
        if snap.fact_df is not None:
            for mc in ["_month", "Month"]:
                if mc in snap.fact_df.columns:
                    fact_m.update(snap.fact_df[mc].dropna().astype(str).unique().tolist())
        months_to_warm = ["all"] + sorted(list(reg_m | fact_m))
        for mo in months_to_warm:
            try:
                mo_overview = get_executive_overview(
                    business_unit=None,
                    department=None,
                    manager=None,
                    employee=None,
                    month=mo,
                    user=system_user,
                )
                self.set_overview(mo_overview, month=mo)
            except Exception as e:
                logger.warning(f"Error precalculating overview for month '{mo}': {e}")

        # 2. Extract Business Units and precalculate each BU's overview
        all_bus = snap.filter_options.get("business_units", [])
        for bu in all_bus:
            if not bu or bu in ("All", "All Business Units"):
                continue
            try:
                bu_overview = get_executive_overview(
                    business_unit=bu,
                    department=None,
                    manager=None,
                    employee=None,
                    month="all",
                    user=system_user,
                )
                self.set_overview(bu_overview, month="all", business_unit=bu)
            except Exception as e:
                logger.warning(f"Error precalculating overview for BU '{bu}': {e}")

        # 3. Precalculate trends for all 15 core metrics
        from api.schemas import TrendQueryRequest
        from api.routes.analytics import query_trend_intelligence
        for metric_id in list(TREND_METRICS.keys()):
            try:
                req_global = TrendQueryRequest(metric_id=metric_id, benchmark_type="ORGANIZATION")
                global_trend = query_trend_intelligence(req_global, user=system_user)
                self.set_trends(global_trend, metric_id=metric_id, benchmark_type="ORGANIZATION")

                # Also precalculate top BUs for the primary metric
                if metric_id == "missing_swipe_rate":
                    for bu in all_bus[:5]:
                        if not bu or bu in ("All", "All Business Units"):
                            continue
                        req_bu = TrendQueryRequest(metric_id=metric_id, benchmark_type="ORGANIZATION", business_unit=bu)
                        bu_trend = query_trend_intelligence(req_bu, user=system_user)
                        self.set_trends(bu_trend, metric_id=metric_id, benchmark_type="ORGANIZATION", business_unit=bu)
            except Exception as e:
                logger.warning(f"Error precalculating trend for metric '{metric_id}': {e}")

        # 4. Precalculate cascaded filters
        from api.routes.analytics import get_cascaded_filters
        try:
            filters_res = get_cascaded_filters(user=system_user)
            self.set_filters(filters_res.model_dump() if hasattr(filters_res, "model_dump") else dict(filters_res))
        except Exception as e:
            logger.warning(f"Error precalculating cascaded filters: {e}")

        # 5. Precalculate attendance status distribution summary
        if snap.fact_df is not None and not snap.fact_df.empty:
            df = snap.fact_df
            total_records = len(df)
            total_days = float(df["_qty"].sum()) if "_qty" in df.columns else float(total_records)

            if "_is_p" in df.columns and "_is_l" in df.columns:
                p_cnt = round(float(df["_is_p"].sum()), 1)
                wfh_cnt = round(float(df["_is_w"].sum()), 1)
                l_cnt = round(float(df["_is_l"].sum()), 1)
                a_cnt = round(float(df["_is_a"].sum()), 1)
                r_cnt = int(df["_is_r"].sum()) if "_is_r" in df.columns else 0

                at_s = df["_att_type"].astype(str).str.lower() if "_att_type" in df.columns else None
                ms_cnt = int((at_s.str.contains("missing") | at_s.isin(["p(ms)", "ms"])).sum()) if at_s is not None else 0
                wo_cnt = int((at_s.str.contains("week off") | at_s.isin(["wo", "week off", "weekly off"])).sum()) if at_s is not None else 0
                h_cnt = int((at_s.str.contains("holiday") | at_s.isin(["holiday", "h"])).sum()) if at_s is not None else 0
            else:
                at_s = df["_att_type"].astype(str).str.lower() if "_att_type" in df.columns else None
                p_cnt = int((at_s.str.contains("present") | at_s.isin(["p", "present"])).sum()) if at_s is not None else 0
                ms_cnt = int((at_s.str.contains("missing") | at_s.isin(["p(ms)", "ms"])).sum()) if at_s is not None else 0
                wfh_cnt = int((at_s.str.contains("wfh") | at_s.isin(["wfh", "work from home"])).sum()) if at_s is not None else 0
                l_cnt = int((at_s.str.contains("leave") | at_s.isin(["leave", "l"])).sum()) if at_s is not None else 0
                a_cnt = int((at_s.str.contains("absent") | at_s.isin(["absent", "a"])).sum()) if at_s is not None else 0
                wo_cnt = int((at_s.str.contains("week off") | at_s.isin(["wo", "week off", "weekly off"])).sum()) if at_s is not None else 0
                h_cnt = int((at_s.str.contains("holiday") | at_s.isin(["holiday", "h"])).sum()) if at_s is not None else 0
                r_cnt = int(at_s.str.contains("regulariz").sum()) if at_s is not None else 0

            denom = max(1.0, total_days)
            self.set_attendance_summary({
                "total_records": total_records,
                "total_days": total_days,
                "unique_employees": int(df["_emp_num"].nunique()) if "_emp_num" in df.columns else 0,
                "present_pct": round((p_cnt / denom) * 100, 1),
                "missing_swipe_pct": round((ms_cnt / denom) * 100, 1),
                "wfh_pct": round((wfh_cnt / denom) * 100, 1),
                "leave_pct": round((l_cnt / denom) * 100, 1),
                "absent_pct": round((a_cnt / denom) * 100, 1),
                "week_off_pct": round((wo_cnt / denom) * 100, 1),
                "holiday_pct": round((h_cnt / denom) * 100, 1),
                "regularized_pct": round((r_cnt / denom) * 100, 1),
                "counts": {
                    "present": p_cnt,
                    "missing_swipe": ms_cnt,
                    "wfh": wfh_cnt,
                    "leave": l_cnt,
                    "absent": a_cnt,
                    "week_off": wo_cnt,
                    "holiday": h_cnt,
                    "regularized": r_cnt,
                }
            })

        with self._lock:
            self._is_ready = True
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        logger.info(f"Precalculation complete in {duration_ms}ms ({len(self._overview_cache)} overviews, {len(self._trends_cache)} trends).")
        self.save_to_disk()
        return {
            "status": "SUCCESS",
            "duration_ms": duration_ms,
            "last_calculated_at": self._last_calculated_at,
            "cached_overviews": len(self._overview_cache),
            "cached_trends": len(self._trends_cache),
        }


# Global singleton instance
materialized_store = MaterializedAnalyticsStore()
