"""
workforce_intelligence/historical_sync.py
──────────────────────────────────────────
Historical Data Sync & Archive Manager for Transformers Workforce Intelligence.

Handles Keka's 1-month API/export restriction by:
  1. Partitioning multi-month requests into individual calendar-month sync tasks.
  2. Persisting each monthly dataset locally into `local_data/historical_archive/`.
  3. Maintaining a JSON sync registry tracking record counts, sync timestamps, and DQ status.
  4. Allowing one-click individual month re-sync or batch historical sync.
  5. Assembling all archived historical months into a single unified analytical dataset.
"""

import os
import io
import time
import json
import logging
from pathlib import Path
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple, Callable
import pandas as pd

logger = logging.getLogger(__name__)

DEFAULT_ARCHIVE_DIR = Path("local_data") / "historical_archive"
REGISTRY_FILENAME = "sync_registry.json"


class HistoricalSyncManager:
    """
    Manages historical multi-month time series synchronization and local archival.
    """

    def __init__(self, archive_dir: Optional[Path] = None):
        self.archive_dir = Path(archive_dir) if archive_dir else DEFAULT_ARCHIVE_DIR
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        self.diffs_dir = self.archive_dir / "diffs"
        self.diffs_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = self.archive_dir / REGISTRY_FILENAME
        self._ensure_registry()

    def _ensure_registry(self):
        """Initialize registry file if not present."""
        if not self.registry_path.exists():
            initial_data = {
                "version": "1.0",
                "months": {},
                "last_updated": None,
                "active_selection": []
            }
            try:
                with open(self.registry_path, "w", encoding="utf-8") as f:
                    json.dump(initial_data, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to create sync registry: {e}")

    def load_registry(self) -> Dict[str, Any]:
        """Load the sync registry JSON."""
        self._ensure_registry()
        try:
            with open(self.registry_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read sync registry: {e}")
            return {"version": "1.0", "months": {}, "last_updated": None, "active_selection": []}

    def save_registry(self, registry_data: Dict[str, Any]):
        """Persist the sync registry JSON."""
        registry_data["last_updated"] = datetime.now().isoformat()
        try:
            with open(self.registry_path, "w", encoding="utf-8") as f:
                json.dump(registry_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sync registry: {e}")

    # ──────────────────────────────────────────────────────────────────────────
    # Month Utilities
    # ──────────────────────────────────────────────────────────────────────────
    @staticmethod
    def get_month_boundaries(year: int, month: int) -> Tuple[date, date]:
        """Return (first_day, last_day) of a given calendar month."""
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
        return first_day, last_day

    @staticmethod
    def parse_month_key(month_key: str) -> Tuple[int, int]:
        """Parse 'YYYY-MM' into (year, month)."""
        parts = month_key.strip().split("-")
        return int(parts[0]), int(parts[1])

    @staticmethod
    def format_month_key(dt: date) -> str:
        """Format a date into 'YYYY-MM'."""
        return dt.strftime("%Y-%m-%d")[:7]

    @staticmethod
    def get_previous_month_key(month_key: str) -> str:
        """
        Return the 'YYYY-MM' key for the calendar month immediately preceding month_key.
        Example: '2026-10' -> '2026-09', '2026-01' -> '2025-12'.
        """
        y, m = HistoricalSyncManager.parse_month_key(month_key)
        if m == 1:
            return f"{y - 1:04d}-12"
        else:
            return f"{y:04d}-{m - 1:02d}"

    def resolve_sync_target_months(self, month: str = "all") -> List[str]:
        """
        Determine target months to sync.
        Rule: For any month at any point of time, sync for the past month also happens.
        - If 'all': sync all registry months, guaranteeing the current month and its past month are included.
        - If a specific month (e.g. '2026-10'): returns [past_month, target_month] (e.g. ['2026-09', '2026-10']).
        - Respects Keka's API rolling window (e.g. minimum July 2026): months older than the window are excluded from API sync.
        """
        cur_date = datetime.now().date()
        cur_month_key = self.format_month_key(cur_date)
        min_api_date = self.get_keka_api_window_start(cur_date)
        min_api_month_key = self.format_month_key(min_api_date)

        if not month or month == "all":
            reg = self.load_registry()
            reg_months = set(reg.get("months", {}).keys())
            past_cur_month = self.get_previous_month_key(cur_month_key)
            reg_months.add(cur_month_key)
            if past_cur_month >= min_api_month_key:
                reg_months.add(past_cur_month)
            eligible = [m for m in reg_months if m >= min_api_month_key]
            return sorted(eligible)
        else:
            m_clean = month.strip()
            target_months = {m_clean}
            past_m = self.get_previous_month_key(m_clean)
            if past_m >= min_api_month_key:
                target_months.add(past_m)
            return sorted(list(target_months))

    @staticmethod
    def get_month_display_name(month_key: str) -> str:
        """Convert '2026-10' to 'October 2026'."""
        try:
            dt = datetime.strptime(month_key.strip() + "-01", "%Y-%m-%d")
            return dt.strftime("%B %Y")
        except Exception:
            return month_key

    @staticmethod
    def get_keka_api_window_start(ref_date: Optional[date] = None) -> date:
        """
        Keka Attendance API enforces a strict rolling 3-month window.
        Returns the earliest 1st of month accessible via Keka API.
        e.g., in Oct 2026 -> 2026-07-01.
        """
        if not ref_date:
            ref_date = datetime.now().date()
        m = ref_date.month - 3
        y = ref_date.year
        if m < 1:
            m += 12
            y -= 1
        return date(y, m, 1)

    def get_available_months_grid(self, past_n_months: int = 12) -> List[Dict[str, Any]]:
        """
        Generate list of past N months including current month with their sync status
        and Keka API eligibility (3-month rolling window check).
        """
        registry = self.load_registry()
        synced_months = registry.get("months", {})

        now = datetime.now().date()
        min_api_date = self.get_keka_api_window_start(now)
        result = []
        cur_year = now.year
        cur_month = now.month

        for _ in range(past_n_months):
            m_key = f"{cur_year:04d}-{cur_month:02d}"
            f_day, l_day = self.get_month_boundaries(cur_year, cur_month)
            display_name = f_day.strftime("%B %Y")

            info = synced_months.get(m_key, {})
            is_synced = bool(info.get("status") == "SYNCED")
            file_exists = False
            if is_synced and info.get("file_name"):
                file_exists = (self.archive_dir / info["file_name"]).exists()
                if not file_exists:
                    is_synced = False

            is_api_eligible = (l_day >= min_api_date)

            result.append({
                "month_key": m_key,
                "display_name": display_name,
                "from_date": f_day.strftime("%Y-%m-%d"),
                "to_date": l_day.strftime("%Y-%m-%d"),
                "is_synced": is_synced,
                "is_api_eligible": is_api_eligible,
                "source": info.get("source", "API" if is_api_eligible else "FILE_IMPORT"),
                "record_count": info.get("record_count", 0) if is_synced else 0,
                "headcount": info.get("headcount", 0) if is_synced else 0,
                "last_synced": info.get("last_synced", "Never") if is_synced else "Not Synced",
                "status_label": "Synced" if is_synced else ("API Ready (Last 3M)" if is_api_eligible else "File Import Needed (>3M)"),
                "file_name": info.get("file_name", f"attendance_{m_key.replace('-', '_')}.parquet"),
            })

            # Move back 1 month
            cur_month -= 1
            if cur_month < 1:
                cur_month = 12
                cur_year -= 1

        return result

    # ──────────────────────────────────────────────────────────────────────────
    # File Import into Archive
    # ──────────────────────────────────────────────────────────────────────────
    def import_attendance_file(
        self,
        file_path: Any,
        target_month_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Import an exported Keka Daily Performance Report or Attendance Excel/CSV file
        directly into the local historical archive.
        Supports single-month or multi-month files.
        """
        fp = Path(file_path)
        if not fp.exists():
            return {"success": False, "error": f"File does not exist: {file_path}", "imported_months": [], "total_records": 0}

        try:
            if fp.suffix.lower() in [".xlsx", ".xls"]:
                df = pd.read_excel(fp)
            elif fp.suffix.lower() == ".csv":
                df = pd.read_csv(fp)
            elif fp.suffix.lower() == ".parquet":
                df = pd.read_parquet(fp)
            else:
                return {"success": False, "error": f"Unsupported file type: {fp.suffix}", "imported_months": [], "total_records": 0}
        except Exception as e:
            return {"success": False, "error": f"Could not read file: {e}", "imported_months": [], "total_records": 0}

        if df.empty:
            return {"success": False, "error": "Imported file is empty.", "imported_months": [], "total_records": 0}

        # Locate Date column
        date_col = None
        for col in df.columns:
            c_clean = str(col).strip().lower()
            if c_clean in ["date", "attendancedate", "log date", "attendance date", "event date"]:
                date_col = col
                break
        if not date_col:
            for col in df.columns:
                if "date" in str(col).lower():
                    date_col = col
                    break

        if not date_col:
            return {"success": False, "error": "Could not find a 'Date' column in the imported file.", "imported_months": [], "total_records": 0}

        # Parse dates to month keys (handle ISO YYYY-MM-DD vs DD-MM-YYYY)
        sample_str = df[date_col].dropna().astype(str).str.strip().tolist()
        use_dayfirst = True
        if sample_str and len(sample_str[0]) >= 4 and sample_str[0][:4].isdigit():
            use_dayfirst = False

        df["_parsed_dt"] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=use_dayfirst)
        valid_mask = df["_parsed_dt"].notna()
        df_valid = df[valid_mask].copy()

        if df_valid.empty:
            return {"success": False, "error": "No valid dates found in the file's Date column.", "imported_months": [], "total_records": 0}

        df_valid["_month_key"] = df_valid["_parsed_dt"].dt.strftime("%Y-%m")
        unique_months = sorted(df_valid["_month_key"].unique())

        if target_month_key and target_month_key not in unique_months:
            return {
                "success": False,
                "error": f"Selected file does not contain records for {self.get_month_display_name(target_month_key)}. Found months: {', '.join(unique_months)}",
                "imported_months": [],
                "total_records": 0
            }

        months_to_save = [target_month_key] if target_month_key else unique_months
        imported_keys = []
        total_recs = 0

        registry = self.load_registry()

        for m_key in months_to_save:
            m_df = df_valid[df_valid["_month_key"] == m_key].copy()
            if m_df.empty:
                continue

            # Cleanup helper columns
            m_df = m_df.drop(columns=["_parsed_dt", "_month_key"], errors="ignore")

            # Run normalization to ensure canonical attendance codes (GL, WL, CL/SL, etc.)
            try:
                from keka_data_fetcher import KekaDataFetcher
                m_df = KekaDataFetcher._normalize_attendance_df(m_df)
            except Exception as e:
                logger.warning(f"Could not run _normalize_attendance_df on imported file: {e}")

            file_base = f"attendance_{m_key.replace('-', '_')}"
            parquet_file = self.archive_dir / f"{file_base}.parquet"
            excel_file = self.archive_dir / f"{file_base}.xlsx"

            # Load existing archive to compute differential delta before overwrite
            old_df = None
            if parquet_file.exists():
                try:
                    old_df = pd.read_parquet(parquet_file)
                except Exception:
                    old_df = None
            elif excel_file.exists():
                try:
                    old_df = pd.read_excel(excel_file)
                except Exception:
                    old_df = None

            diff_payload = self.compute_differential_delta(old_df, m_df, m_key)

            try:
                m_df.to_parquet(parquet_file, index=False)
            except Exception:
                pass

            try:
                with pd.ExcelWriter(excel_file, engine="openpyxl") as writer:
                    m_df.to_excel(writer, sheet_name="Daily Performance Report", index=False)
            except Exception as e:
                logger.warning(f"Could not write Excel backup during file import for {m_key}: {e}")

            # Calculate metrics
            emp_c = None
            for c in ["Employee Number", "Employee No", "Emp No", "employeeNumber", "EmployeeCode"]:
                if c in m_df.columns:
                    emp_c = c
                    break
            hc = int(m_df[emp_c].nunique()) if emp_c else len(m_df)
            y, m = self.parse_month_key(m_key)
            f_day, l_day = self.get_month_boundaries(y, m)

            registry.setdefault("months", {})[m_key] = {
                "month_key": m_key,
                "display_name": self.get_month_display_name(m_key),
                "from_date": f_day.strftime("%Y-%m-%d"),
                "to_date": l_day.strftime("%Y-%m-%d"),
                "record_count": len(m_df),
                "headcount": hc,
                "last_synced": f"{datetime.now().strftime('%d-%b-%Y %H:%M')} (File Import)",
                "status": "SYNCED",
                "source": "FILE_IMPORT",
                "file_name": f"{file_base}.parquet" if parquet_file.exists() else f"{file_base}.xlsx",
            }

            imported_keys.append(m_key)
            total_recs += len(m_df)

        self.save_registry(registry)
        return {
            "success": True,
            "error": None,
            "imported_months": imported_keys,
            "total_records": total_recs,
            "latest_diff": diff_payload if "diff_payload" in locals() else None,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Single & Multi-Month Syncing
    # ──────────────────────────────────────────────────────────────────────────
    def sync_single_month_keka(
        self,
        month_key: str,
        keka_fetcher: Any,
        cached_emp_df: Optional[pd.DataFrame] = None,
        progress_callback: Optional[Callable[[float, str, str], None]] = None
    ) -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame], Optional[str]]:
        """
        Fetch a single calendar month from Keka REST API.
        Respects Keka's 1-month API limit and 3-month rolling window policy.
        Returns: (monthly_attendance_df, emp_df, error_message)
        """
        def _notify(pct: float, step: str, detail: str = ""):
            if progress_callback:
                progress_callback(pct, step, detail)

        y, m = self.parse_month_key(month_key)
        f_day, l_day = self.get_month_boundaries(y, m)
        from_iso = f_day.strftime("%Y-%m-%d")
        to_iso = l_day.strftime("%Y-%m-%d")
        disp_name = self.get_month_display_name(month_key)
        file_base = f"attendance_{month_key.replace('-', '_')}"
        parquet_file = self.archive_dir / f"{file_base}.parquet"

        # Note: All historical months can be refreshed with live Keka API data,
        # with verified Garden Leave (GL) preserved from existing archives.

        _notify(0.10, f"Syncing {disp_name}...", "Fetching Employee Master...")
        emp_df = cached_emp_df
        if emp_df is None or emp_df.empty:
            emp_df, emp_err = keka_fetcher.fetch_employee_master()
            if emp_err and (emp_df is None or emp_df.empty):
                return None, None, f"Failed to fetch Employee Master: {emp_err}"

        if emp_df is not None and not emp_df.empty:
            try:
                master_file = self.archive_dir.parent / "employee_master.parquet"
                emp_df.to_parquet(master_file, index=False)
            except Exception as e:
                logger.warning(f"Notice saving employee master: {e}")

        _notify(0.35, f"Syncing {disp_name}...", f"Fetching OD/WFH Requests ({from_iso} to {to_iso})...")
        wfh_df, wfh_err = keka_fetcher.fetch_od_wfh_requests(from_date=from_iso, to_date=to_iso)

        _notify(0.60, f"Syncing {disp_name}...", f"Pulling Attendance Records ({from_iso} to {to_iso})...")
        att_df, att_err = keka_fetcher.fetch_attendance_report(
            from_date=from_iso,
            to_date=to_iso,
            emp_df=emp_df,
            wfh_df=wfh_df,
            progress_callback=lambda p, m: _notify(0.60 + p * 0.30, f"Syncing {disp_name}...", m)
        )

        if att_err and (att_df is None or att_df.empty):
            return None, emp_df, f"Keka attendance sync failed for {disp_name}: {att_err}"

        if att_df is None or att_df.empty:
            return None, emp_df, f"No attendance records returned for {disp_name}."

        # Save to local archive (both Parquet for fast loading and Excel for export inspection)
        file_base = f"attendance_{month_key.replace('-', '_')}"
        parquet_file = self.archive_dir / f"{file_base}.parquet"
        excel_file = self.archive_dir / f"{file_base}.xlsx"

        # Load existing archive to compute differential delta before overwrite
        old_df = None
        if parquet_file.exists():
            try:
                old_df = pd.read_parquet(parquet_file)
            except Exception:
                old_df = None
        elif excel_file.exists():
            try:
                old_df = pd.read_excel(excel_file)
            except Exception:
                old_df = None

        # Rule 1: Preserve verified Garden Leave (GL) from existing archive:
        if old_df is not None and not old_df.empty and "Status" in old_df.columns:
            emp_c = "Employee Number" if "Employee Number" in att_df.columns else "Employee No"
            old_emp_c = "Employee Number" if "Employee Number" in old_df.columns else "Employee No"
            gl_old = old_df[old_df["Status"] == "GL"]
            if not gl_old.empty and old_emp_c in gl_old.columns and "Date" in gl_old.columns:
                gl_set = set(zip(gl_old[old_emp_c].astype(str).str.strip(), gl_old["Date"].astype(str).str.strip()))
                def _is_old_gl(r):
                    k = (str(r.get(emp_c, "")).strip(), str(r.get("Date", "")).strip())
                    return k in gl_set
                gl_match_mask = att_df.apply(_is_old_gl, axis=1) & (att_df["Status"].isin(["A", "P(MS)"]))
                if gl_match_mask.any():
                    logger.info(f"Preserving {gl_match_mask.sum()} verified Garden Leave records from prior archive for {month_key}.")
                    att_df.loc[gl_match_mask, "Status"] = "GL"
                    att_df.loc[gl_match_mask, "Attendance Type"] = "Leave"
                    att_df.loc[gl_match_mask, "Leave Name"] = "Garden Leave"
                    att_df.loc[gl_match_mask, "Approval Status"] = "Approved"
                    att_df.loc[gl_match_mask, "Approved By"] = "Management"

        # Rule 2: Continuity Rule for Exiting & Garden Leave Employees:
        # Keka REST API lacks custom portal leave types like Garden Leave (GL), synthesizing zero-punch days as 'A'.
        # If an employee was on Garden Leave in the preceding month, preserve their GL status for days prior to LWD.
        try:
            prior_month_key = self.get_previous_month_key(month_key)
            prior_pq = self.archive_dir / f"attendance_{prior_month_key.replace('-', '_')}.parquet"
            if prior_pq.exists() and "Status" in att_df.columns:
                df_prior = pd.read_parquet(prior_pq)
                emp_c = "Employee Number" if "Employee Number" in att_df.columns else "Employee No"
                if "Status" in df_prior.columns and emp_c in df_prior.columns:
                    prior_gl_emps = set(df_prior[df_prior["Status"] == "GL"][emp_c].dropna().unique())
                    if prior_gl_emps:
                        gl_fix_mask = (att_df[emp_c].isin(prior_gl_emps)) & (att_df["Status"] == "A")
                        if gl_fix_mask.any():
                            logger.info(f"Applying Garden Leave continuity for {month_key}: converting {gl_fix_mask.sum()} raw API absences to 'GL'.")
                            att_df.loc[gl_fix_mask, "Status"] = "GL"
                            att_df.loc[gl_fix_mask, "Attendance Type"] = "Leave"
                            att_df.loc[gl_fix_mask, "Leave Name"] = "Garden Leave"
                            att_df.loc[gl_fix_mask, "Approval Status"] = "Approved"
                            att_df.loc[gl_fix_mask, "Approved By"] = "Management"
        except Exception as gl_err:
            logger.warning(f"Notice during Garden Leave continuity check for {month_key}: {gl_err}")

        diff_payload = self.compute_differential_delta(old_df, att_df, month_key)

        if emp_df is not None and not emp_df.empty:
            emp_c = "Employee Number" if "Employee Number" in att_df.columns else "Employee No"
            m_emp_c = "Employee Number" if "Employee Number" in emp_df.columns else "Employee No"
            if "Date of Joining" not in att_df.columns and "DOJ" in emp_df.columns and m_emp_c in emp_df.columns:
                doj_map = emp_df.set_index(m_emp_c)["DOJ"].to_dict()
                att_df["Date of Joining"] = att_df[emp_c].map(doj_map).fillna("")
                att_df["DOJ"] = att_df["Date of Joining"]

        _notify(0.92, f"Saving {disp_name} Archive...", "Writing dataset & updating diffs...")
        try:
            att_df.to_parquet(parquet_file, index=False)
        except Exception:
            pass  # Fallback to excel if pyarrow not available

        try:
            with pd.ExcelWriter(excel_file, engine="openpyxl") as writer:
                att_df.to_excel(writer, sheet_name="Daily Performance Report", index=False)
        except Exception as e:
            logger.warning(f"Could not write Excel backup for {month_key}: {e}")

        # Update registry
        emp_col = "Employee Number" if "Employee Number" in att_df.columns else "Employee No"
        hc = int(att_df[emp_col].nunique()) if emp_col in att_df.columns else len(emp_df)

        registry = self.load_registry()
        registry.setdefault("months", {})[month_key] = {
            "month_key": month_key,
            "display_name": disp_name,
            "from_date": from_iso,
            "to_date": to_iso,
            "record_count": len(att_df),
            "headcount": hc,
            "last_synced": datetime.now().strftime("%d-%b-%Y %H:%M:%S"),
            "status": "SYNCED",
            "file_name": f"{file_base}.parquet" if parquet_file.exists() else f"{file_base}.xlsx",
        }
        self.save_registry(registry)

        _notify(1.0, f"Synced {disp_name}!", f"Successfully saved {len(att_df):,} records ({hc} employees)")
        return att_df, emp_df, None

    def sync_multiple_months_keka(
        self,
        month_keys: List[str],
        keka_fetcher: Any,
        batch_progress_callback: Optional[Callable[[int, int, str, float, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Sequentially synchronize a list of months from Keka.
        Handles rate limits gracefully and shares cached Employee Master across iterations.
        """
        month_keys = sorted(list(set(month_keys)))
        total_months = len(month_keys)
        synced_dfs = []
        errors = []
        cached_emp_df = None

        for idx, m_key in enumerate(month_keys, start=1):
            disp_name = self.get_month_display_name(m_key)

            def _step_prog(pct, step, detail):
                if batch_progress_callback:
                    batch_progress_callback(idx, total_months, disp_name, pct, f"{step} {detail}".strip())

            _step_prog(0.05, f"Starting {disp_name}", f"({idx}/{total_months})")
            df_m, emp_df, err = self.sync_single_month_keka(
                month_key=m_key,
                keka_fetcher=keka_fetcher,
                cached_emp_df=cached_emp_df,
                progress_callback=_step_prog
            )

            if emp_df is not None and not emp_df.empty:
                cached_emp_df = emp_df

            if err:
                errors.append(f"{disp_name}: {err}")
            elif df_m is not None and not df_m.empty:
                synced_dfs.append(df_m)

            # Small cooldown between months to allow Keka rate-limit window to refresh
            time.sleep(0.4)

        # Assemble unified dataset
        unified_df = pd.DataFrame()
        if synced_dfs:
            unified_df = pd.concat(synced_dfs, ignore_index=True)
            emp_c = "Employee Number" if "Employee Number" in unified_df.columns else "Employee No"
            dt_c = "Date" if "Date" in unified_df.columns else "attendanceDate"
            st_c = "Status" if "Status" in unified_df.columns else "status"
            subset = [c for c in [emp_c, dt_c, st_c] if c in unified_df.columns]
            if len(subset) >= 2:
                unified_df = unified_df.drop_duplicates(subset=subset, keep="last")

        return {
            "success": len(errors) == 0,
            "total_requested": total_months,
            "total_synced": len(synced_dfs),
            "total_records": len(unified_df),
            "errors": errors,
            "unified_df": unified_df,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Unified History Loading & Snapshot Generation
    # ──────────────────────────────────────────────────────────────────────────
    def load_unified_history(
        self,
        month_keys: Optional[List[str]] = None
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Load all or selected synced historical monthly datasets from local archive
        into a consolidated time-series DataFrame.
        """
        registry = self.load_registry()
        synced_months = registry.get("months", {})

        target_keys = sorted(month_keys) if month_keys else sorted(synced_months.keys())
        loaded_dfs = []
        loaded_months_info = []

        for m_key in target_keys:
            info = synced_months.get(m_key)
            if not info or info.get("status") != "SYNCED":
                continue

            f_name = info.get("file_name", f"attendance_{m_key.replace('-', '_')}.parquet")
            file_path = self.archive_dir / f_name
            excel_path = self.archive_dir / f"attendance_{m_key.replace('-', '_')}.xlsx"

            df_m = None
            if file_path.exists() and str(file_path).endswith(".parquet"):
                try:
                    df_m = pd.read_parquet(file_path)
                except Exception:
                    df_m = None

            if (df_m is None or df_m.empty) and excel_path.exists():
                try:
                    df_m = pd.read_excel(excel_path)
                except Exception:
                    df_m = None

            if df_m is not None and not df_m.empty:
                loaded_dfs.append(df_m)
                loaded_months_info.append(m_key)

        if not loaded_dfs:
            return pd.DataFrame(), {"total_records": 0, "months_count": 0, "months": []}

        unified = pd.concat(loaded_dfs, ignore_index=True)
        emp_c = "Employee Number" if "Employee Number" in unified.columns else "Employee No"
        dt_c = "Date" if "Date" in unified.columns else "attendanceDate"
        st_c = "Status" if "Status" in unified.columns else "status"
        subset = [c for c in [emp_c, dt_c, st_c] if c in unified.columns]
        if len(subset) >= 2:
            unified = unified.drop_duplicates(subset=subset, keep="last")

        # Safeguard: For employees with verified Garden Leave (GL) in their exit sequence,
        # ensure any unexcused 'A' rows prior to Last Working Day remain classified as 'GL'.
        if "Status" in unified.columns and emp_c in unified.columns:
            gl_emps_all = set(unified[unified["Status"] == "GL"][emp_c].dropna().unique())
            if gl_emps_all:
                gl_reinforce_mask = (unified[emp_c].isin(gl_emps_all)) & (unified["Status"] == "A")
                if gl_reinforce_mask.any():
                    unified.loc[gl_reinforce_mask, "Status"] = "GL"
                    unified.loc[gl_reinforce_mask, "Attendance Type"] = "Leave"
                    unified.loc[gl_reinforce_mask, "Leave Name"] = "Garden Leave"
        # Guarantee Date of Joining and Last Working Day exist in unified DataFrame
        master_file = self.archive_dir.parent / "employee_master.parquet"
        if master_file.exists() and "Date of Joining" not in unified.columns:
            try:
                emp_m = pd.read_parquet(master_file)
                m_emp_c = "Employee Number" if "Employee Number" in emp_m.columns else "Employee No"
                if m_emp_c in emp_m.columns and "DOJ" in emp_m.columns:
                    doj_map = emp_m.set_index(m_emp_c)["DOJ"].to_dict()
                    unified["Date of Joining"] = unified[emp_c].map(doj_map).fillna("")
                    unified["DOJ"] = unified["Date of Joining"]
            except Exception as e:
                logger.warning(f"Notice mapping DOJ in unified history: {e}")

        summary = {
            "total_records": len(unified),
            "months_count": len(loaded_months_info),
            "months": loaded_months_info,
            "min_date": str(unified[dt_c].min()) if dt_c in unified.columns and not unified.empty else None,
            "max_date": str(unified[dt_c].max()) if dt_c in unified.columns and not unified.empty else None,
        }
        return unified, summary

    def delete_month(self, month_key: str) -> bool:
        """Remove a single month from local archive and update registry."""
        registry = self.load_registry()
        if month_key in registry.get("months", {}):
            del registry["months"][month_key]
            self.save_registry(registry)

        file_base = f"attendance_{month_key.replace('-', '_')}"
        for ext in [".parquet", ".xlsx", ".csv"]:
            fp = self.archive_dir / f"{file_base}{ext}"
            if fp.exists():
                try:
                    fp.unlink()
                except Exception:
                    pass
        return True

    # ──────────────────────────────────────────────────────────────────────────
    # Differential Delta & Change Detection
    # ──────────────────────────────────────────────────────────────────────────
    def save_diff(self, month_key: str, diff_data: Dict[str, Any]):
        """Persist structured differential report to local disk."""
        fp = self.diffs_dir / f"latest_diff_{month_key.replace('-', '_')}.json"
        try:
            with open(fp, "w", encoding="utf-8") as f:
                json.dump(diff_data, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not persist diff for {month_key}: {e}")

    def get_latest_diff(self, month_key: str) -> Optional[Dict[str, Any]]:
        """Retrieve most recent differential report for a month."""
        fp = self.diffs_dir / f"latest_diff_{month_key.replace('-', '_')}.json"
        if fp.exists():
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def compute_differential_delta(
        self,
        old_df: Optional[pd.DataFrame],
        new_df: pd.DataFrame,
        month_key: str
    ) -> Dict[str, Any]:
        """
        Compare an incoming monthly dataset against the previously archived dataset.
        Detects:
        - Status conversions (e.g. Absent -> Present/Regularized/Leave/WFH)
        - Attendance type modifications
        - In/Out punch additions/updates
        - New employee records added
        - Unchanged records
        """
        disp_name = self.get_month_display_name(month_key)
        now_str = datetime.now().strftime("%d-%b-%Y %H:%M:%S")

        if new_df is None or new_df.empty:
            return {
                "month_key": month_key,
                "display_name": disp_name,
                "synced_at": now_str,
                "summary": {
                    "total_previous_records": len(old_df) if old_df is not None else 0,
                    "total_new_records": 0,
                    "records_modified": 0,
                    "records_added": 0,
                    "records_unchanged": 0,
                    "absences_resolved": 0,
                    "leaves_updated": 0,
                    "wfh_updated": 0,
                    "regularizations_applied": 0,
                    "headcount_delta": 0,
                },
                "records": []
            }

        emp_col = "Employee Number" if "Employee Number" in new_df.columns else "Employee No"
        name_col = "Employee Name" if "Employee Name" in new_df.columns else "Employee"
        dept_col = "Department" if "Department" in new_df.columns else "_dept"
        bu_col = "Business Unit" if "Business Unit" in new_df.columns else "_bu"
        dt_col = "Date" if "Date" in new_df.columns else "attendanceDate"
        st_col = "Status" if "Status" in new_df.columns else "_status"
        at_col = "Attendance Type" if "Attendance Type" in new_df.columns else "_att_type"
        in_col = "In Time" if "In Time" in new_df.columns else "inTime"
        out_col = "Out Time" if "Out Time" in new_df.columns else "outTime"
        hrs_col = "Effective Hours" if "Effective Hours" in new_df.columns else "Total Hours"
        qty_col = "Quantity" if "Quantity" in new_df.columns else "_clean_qty"

        new_hc = int(new_df[emp_col].nunique()) if emp_col in new_df.columns else len(new_df)
        old_hc = int(old_df[emp_col].nunique()) if old_df is not None and not old_df.empty and emp_col in old_df.columns else 0

        def _clean_date(val):
            s = str(val).strip()
            return s[:10] if len(s) >= 10 else s

        def _parse_qty(val):
            try:
                q = float(val)
                return 0.5 if 0 < q <= 0.5 else (1.0 if q > 0.5 else 1.0)
            except Exception:
                return 1.0

        if old_df is None or old_df.empty:
            diff_payload = {
                "month_key": month_key,
                "display_name": disp_name,
                "synced_at": now_str,
                "summary": {
                    "total_previous_records": 0,
                    "total_new_records": len(new_df),
                    "records_modified": 0,
                    "records_added": len(new_df),
                    "records_unchanged": 0,
                    "absences_resolved": 0,
                    "leaves_updated": 0,
                    "wfh_updated": 0,
                    "half_days_updated": int((new_df[qty_col] == 0.5).sum()) if qty_col in new_df.columns else 0,
                    "regularizations_applied": 0,
                    "headcount_delta": new_hc,
                },
                "records": []
            }
            self.save_diff(month_key, diff_payload)
            return diff_payload

        # Group previous records by (employee_id, date) into lists to preserve half-day pairs
        old_map: Dict[Tuple[str, str], List[Any]] = {}
        for _, row in old_df.iterrows():
            k = (str(row.get(emp_col, "")).strip().lower(), _clean_date(row.get(dt_col, "")))
            if k[0] and k[1]:
                if k not in old_map:
                    old_map[k] = []
                old_map[k].append(row)

        # Group new records by (employee_id, date) into lists
        new_map: Dict[Tuple[str, str], List[Any]] = {}
        for _, row in new_df.iterrows():
            k = (str(row.get(emp_col, "")).strip().lower(), _clean_date(row.get(dt_col, "")))
            if k[0] and k[1]:
                if k not in new_map:
                    new_map[k] = []
                new_map[k].append(row)

        absent_statuses = {"a", "ab", "absent", "lop"}
        present_statuses = {"p", "present", "ms", "p(ms)", "a(r)", "p(r)", "ar", "pr", "wow", "woh", "wo-w", "h-w"}
        leave_statuses = {"clsl", "cl/sl", "pl", "ul", "fl", "spl", "ml", "pt", "bl", "cl", "hpl", "wl", "vl", "mcl", "cml", "adl", "adlm", "adm", "gl", "hl", "el", "l", "co", "leave"}

        modified_items = []
        modified_count = 0
        added_count = 0
        unchanged_count = 0
        absences_resolved = 0
        leaves_updated = 0
        wfh_updated = 0
        half_days_count = 0
        reg_applied = 0

        for k, new_rows in new_map.items():
            emp_id_val = str(new_rows[0].get(emp_col, "")).strip()
            dt_val = _clean_date(new_rows[0].get(dt_col, ""))
            dept_val = str(new_rows[0].get(dept_col, ""))
            bu_val = str(new_rows[0].get(bu_col, ""))
            emp_name_val = str(new_rows[0].get(name_col, emp_id_val))

            if k not in old_map:
                added_count += len(new_rows)
                for nr in new_rows:
                    n_qty = _parse_qty(nr.get(qty_col, 1.0))
                    if n_qty == 0.5:
                        half_days_count += 1
                    if len(modified_items) < 300:
                        modified_items.append({
                            "employee_id": emp_id_val,
                            "employee_name": emp_name_val,
                            "department": dept_val,
                            "business_unit": bu_val,
                            "date": dt_val,
                            "change_type": "HALF_DAY" if n_qty == 0.5 else "NEW_RECORD",
                            "quantity": n_qty,
                            "old_quantity": 0.0,
                            "new_quantity": n_qty,
                            "old_status": "--",
                            "new_status": str(nr.get(st_col, "")),
                            "old_att_type": "--",
                            "new_att_type": str(nr.get(at_col, "")),
                            "old_hours": "--:--",
                            "new_hours": str(nr.get(hrs_col, "")),
                            "in_time": str(nr.get(in_col, "")),
                            "out_time": str(nr.get(out_col, "")),
                            "summary_badge": "Newly Synced Half-Day (0.5d)" if n_qty == 0.5 else "Newly Synced Record",
                            "badge_color": "amber" if n_qty == 0.5 else "blue",
                        })
                continue

            old_rows = old_map[k]

            # Pair up new rows with old rows
            # Strategy: if sizes match, try matching by attendance type/status; otherwise align by index or replicate baseline
            max_len = max(len(new_rows), len(old_rows))
            for i in range(max_len):
                if i < len(new_rows) and i < len(old_rows):
                    new_row = new_rows[i]
                    old_row = old_rows[i]
                elif i < len(new_rows):
                    new_row = new_rows[i]
                    old_row = old_rows[0]  # compare against baseline day record
                else:
                    break

                o_st = str(old_row.get(st_col, "")).strip()
                n_st = str(new_row.get(st_col, "")).strip()
                o_at = str(old_row.get(at_col, "")).strip()
                n_at = str(new_row.get(at_col, "")).strip()
                o_hrs = str(old_row.get(hrs_col, "")).strip()
                n_hrs = str(new_row.get(hrs_col, "")).strip()
                o_in = str(old_row.get(in_col, "")).strip()
                n_in = str(new_row.get(in_col, "")).strip()
                o_out = str(old_row.get(out_col, "")).strip()
                n_out = str(new_row.get(out_col, "")).strip()
                o_qty = _parse_qty(old_row.get(qty_col, 1.0))
                n_qty = _parse_qty(new_row.get(qty_col, 1.0))

                is_half = (n_qty == 0.5) or (o_qty == 0.5) or (len(new_rows) > 1) or (len(old_rows) > 1)
                if is_half:
                    half_days_count += 1

                is_status_diff = (o_st.lower() != n_st.lower()) or (o_at.lower() != n_at.lower())
                is_qty_diff = (o_qty != n_qty)
                is_punch_diff = (o_in != n_in) or (o_out != n_out) or (
                    o_hrs != n_hrs and o_hrs not in ["", "nan", "None"] and n_hrs not in ["", "nan", "None"]
                )

                if is_status_diff or is_punch_diff or is_qty_diff:
                    modified_count += 1
                    summary_badge = "Record Adjusted"
                    badge_color = "cyan"

                    if o_st.lower() in absent_statuses and n_st.lower() in present_statuses:
                        absences_resolved += 1
                        summary_badge = "Absence Resolved (0.5d Present)" if n_qty == 0.5 else "Absence Resolved (Present)"
                        badge_color = "emerald"
                    elif o_st.lower() in absent_statuses and (n_st.lower() in leave_statuses or "leave" in n_at.lower()):
                        absences_resolved += 1
                        leaves_updated += 1
                        summary_badge = "Absence Converted to Half-Day Leave (0.5d)" if n_qty == 0.5 else "Absence Converted to Leave"
                        badge_color = "purple"
                    elif o_st.lower() in absent_statuses and ("wfh" in n_st.lower() or "wfh" in n_at.lower()):
                        absences_resolved += 1
                        wfh_updated += 1
                        summary_badge = "Absence Converted to Half-Day WFH (0.5d)" if n_qty == 0.5 else "Absence Converted to WFH"
                        badge_color = "blue"
                    elif "regulariz" in n_at.lower() or "(r)" in n_st.lower():
                        reg_applied += 1
                        summary_badge = "Regularization Applied (0.5d)" if n_qty == 0.5 else "Regularization Applied"
                        badge_color = "emerald"
                    elif "leave" in n_at.lower() or n_st.lower() in leave_statuses:
                        leaves_updated += 1
                        summary_badge = "Half-Day Leave (0.5d)" if n_qty == 0.5 else "Leave Updated"
                        badge_color = "purple"
                    elif "wfh" in n_at.lower() or "wfh" in n_st.lower():
                        wfh_updated += 1
                        summary_badge = "Half-Day WFH (0.5d)" if n_qty == 0.5 else "WFH Updated"
                        badge_color = "blue"
                    elif is_qty_diff:
                        summary_badge = f"Half-Day Adjusted ({o_qty}d → {n_qty}d)"
                        badge_color = "amber"

                    ch_type = "HALF_DAY" if is_half else ("STATUS_CONVERTED" if is_status_diff else "PUNCH_UPDATED")

                    if len(modified_items) < 300:
                        modified_items.append({
                            "employee_id": emp_id_val,
                            "employee_name": emp_name_val,
                            "department": dept_val,
                            "business_unit": bu_val,
                            "date": dt_val,
                            "change_type": ch_type,
                            "quantity": n_qty,
                            "old_quantity": o_qty,
                            "new_quantity": n_qty,
                            "old_status": o_st or "--",
                            "new_status": n_st or "--",
                            "old_att_type": o_at or "--",
                            "new_att_type": n_at or "--",
                            "old_hours": o_hrs or "--:--",
                            "new_hours": n_hrs or "--:--",
                            "in_time": n_in or "--:--",
                            "out_time": n_out or "--:--",
                            "summary_badge": summary_badge,
                            "badge_color": badge_color,
                        })
                else:
                    unchanged_count += 1

        total_modified = modified_count
        diff_payload = {
            "month_key": month_key,
            "display_name": disp_name,
            "synced_at": now_str,
            "summary": {
                "total_previous_records": len(old_df),
                "total_new_records": len(new_df),
                "records_modified": total_modified,
                "records_added": added_count,
                "records_unchanged": unchanged_count,
                "absences_resolved": absences_resolved,
                "leaves_updated": leaves_updated,
                "wfh_updated": wfh_updated,
                "half_days_updated": half_days_count,
                "regularizations_applied": reg_applied,
                "headcount_delta": new_hc - old_hc,
            },
            "records": modified_items
        }
        self.save_diff(month_key, diff_payload)
        return diff_payload


# Global singleton instance
historical_sync_manager = HistoricalSyncManager()
