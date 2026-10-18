"""
requests.py
───────────
Leave request reconstruction layer.
Aggregates daily workforce event records into logical, multi-day leave requests
with preserved source-row traceability and quantity duration calculations.
"""

from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from workforce_intelligence.policy_config import DEFAULT_POLICY_CONFIG, PolicyConfig


@dataclass
class LeaveRequest:
    """Reconstructed multi-day or single-day leave request."""
    request_id: str
    employee_number: str
    employee_name: Optional[str]
    reporting_manager: Optional[str]
    leave_name_normalized: Optional[str]
    is_pl: bool

    request_start_date: Optional[date]
    request_end_date: Optional[date]
    request_event_rows: int
    request_total_quantity: Optional[float]

    applied_on: Optional[datetime]
    approved_on: Optional[datetime]
    approval_status: Optional[str]
    approved_by: Optional[str]

    request_application_lag_days: Optional[int]
    approval_turnaround_days: Optional[int]
    applied_by: Optional[str] = None

    record_ids: List[str] = field(default_factory=list)
    source_row_numbers: List[int] = field(default_factory=list)
    has_data_quality_issue: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert request to dictionary."""
        d = asdict(self)
        if self.request_start_date:
            d["request_start_date"] = self.request_start_date.isoformat()
        if self.request_end_date:
            d["request_end_date"] = self.request_end_date.isoformat()
        if self.applied_on:
            d["applied_on"] = self.applied_on.isoformat()
        if self.approved_on:
            d["approved_on"] = self.approved_on.isoformat()
        return d


def build_leave_requests(
    df: pd.DataFrame,
    config: Optional[PolicyConfig] = None,
) -> Tuple[List[LeaveRequest], pd.DataFrame]:
    """
    Reconstruct leave requests from daily event records.

    Grouping strategy:
    - Filters rows where attendance_category == 'Leave' or Status represents Leave.
    - Groups rows sharing:
        (Employee Number, normalized Leave Name, Applied On, Approved On, Approved By, Approval Status).
    - If Applied On is missing/null, groups consecutive days with the same Employee Number and Leave Name.
    - Preserves exact source-row traceability (record_id and source_row_number).
    - Returns (list_of_leave_requests, updated_dataframe_with_request_id).
    """
    if config is None:
        config = DEFAULT_POLICY_CONFIG

    df = df.copy()
    if "request_id" not in df.columns:
        df["request_id"] = None

    if len(df) == 0:
        return [], df

    # Identify leave rows that are included in analysis
    is_leave = pd.Series(False, index=df.index)
    if "attendance_category" in df.columns:
        is_leave = is_leave | (df["attendance_category"] == "Leave")
    if "Attendance Type" in df.columns:
        is_leave = is_leave | df["Attendance Type"].astype(str).str.lower().str.contains("leave", na=False)

    # Exclude rows where include_in_analysis == False
    if "include_in_analysis" in df.columns:
        is_leave = is_leave & (df["include_in_analysis"] == True)

    leave_indices = df[is_leave].index
    if len(leave_indices) == 0:
        return [], df

    leave_df = df.loc[leave_indices].copy()

    # Normalize grouping columns
    if "Employee Number" not in leave_df.columns:
        for c in ["_emp_num", "Employee No", "Emp ID", "Emp No", "Employee Code"]:
            if c in leave_df.columns:
                leave_df["Employee Number"] = leave_df[c]
                break
        else:
            leave_df["Employee Number"] = pd.Series("UNKNOWN_EMP", index=leave_df.index)

    if "Employee Name" not in leave_df.columns:
        for c in ["_emp_name", "Employee Name", "Name", "Emp Name"]:
            if c in leave_df.columns:
                leave_df["Employee Name"] = leave_df[c]
                break

    emp_series = leave_df["Employee Number"].fillna("UNKNOWN_EMP")
    if "Leave Name" in leave_df.columns:
        leave_name_series = (
            leave_df["Leave Name"]
            .fillna(leave_df["Attendance Type"] if "Attendance Type" in leave_df.columns else "Leave")
            .astype(str)
            .str.strip()
        )
    elif "Attendance Type" in leave_df.columns:
        leave_name_series = leave_df["Attendance Type"].astype(str).str.strip()
    else:
        leave_name_series = pd.Series("Leave", index=leave_df.index)
    applied_series = leave_df["Applied On"] if "Applied On" in leave_df.columns else pd.Series(None, index=leave_df.index)
    approved_on_series = leave_df["Approved On"] if "Approved On" in leave_df.columns else pd.Series(None, index=leave_df.index)
    approved_by_series = leave_df["Approved By"] if "Approved By" in leave_df.columns else pd.Series(None, index=leave_df.index)
    approval_st_series = leave_df["Approval Status"] if "Approval Status" in leave_df.columns else pd.Series(None, index=leave_df.index)

    # Sort to ensure chronological continuity
    leave_df["_lname_clean"] = leave_name_series.str.lower()
    leave_df["_sort_date"] = pd.to_datetime(leave_df["Date"], errors="coerce") if "Date" in leave_df.columns else pd.NaT
    leave_df["_orig_idx"] = leave_df.index
    leave_df = leave_df.sort_values(by=["Employee Number", "_sort_date", "_orig_idx"])

    # Extract lists/arrays for C-speed sequential scanning
    emps = leave_df["Employee Number"].fillna("UNKNOWN_EMP").astype(str).values
    lnames = leave_df["_lname_clean"].values

    app_col = leave_df["Applied On"] if "Applied On" in leave_df.columns else pd.Series(None, index=leave_df.index)
    apr_on_col = leave_df["Approved On"] if "Approved On" in leave_df.columns else pd.Series(None, index=leave_df.index)
    apr_by_col = leave_df["Approved By"] if "Approved By" in leave_df.columns else pd.Series("", index=leave_df.index)
    apr_st_col = leave_df["Approval Status"] if "Approval Status" in leave_df.columns else pd.Series("", index=leave_df.index)

    app_ons = [a.isoformat() if pd.notna(a) and hasattr(a, "isoformat") else str(a) for a in app_col]
    apr_ons = [a.isoformat() if pd.notna(a) and hasattr(a, "isoformat") else str(a) for a in apr_on_col]
    apr_bys = apr_by_col.astype(str).str.strip().str.lower().values
    apr_sts = apr_st_col.astype(str).str.strip().str.lower().values
    sort_dates = leave_df["_sort_date"].values

    n_rows = len(leave_df)
    group_keys = [None] * n_rows
    curr_group_id = 0
    prev_emp = None
    prev_lname = None
    prev_app = None
    prev_apr_on = None
    prev_apr_by = None
    prev_apr_st = None
    prev_date = None

    for i in range(n_rows):
        emp = emps[i]
        lname = lnames[i]
        app_on_str = app_ons[i]
        apr_on_str = apr_ons[i]
        apr_by = apr_bys[i]
        apr_st = apr_sts[i]
        evt_date = sort_dates[i]

        if prev_emp is None:
            curr_group_id = 1
        else:
            same_emp_leave = (emp == prev_emp) and (lname == prev_lname)
            if app_on_str not in ("None", "nan", "NaT", "NA"):
                same_group = (
                    same_emp_leave
                    and (app_on_str == prev_app)
                    and (apr_on_str == prev_apr_on)
                    and (apr_by == prev_apr_by)
                    and (apr_st == prev_apr_st)
                )
            else:
                if same_emp_leave and prev_app in ("None", "nan", "NaT", "NA") and not np.isnat(evt_date) and not np.isnat(prev_date):
                    day_diff = (evt_date.astype('datetime64[D]') - prev_date.astype('datetime64[D]')).astype(int)
                    same_group = (day_diff <= 1)
                else:
                    same_group = False

            if not same_group:
                curr_group_id += 1

        group_keys[i] = f"req_{curr_group_id:06d}"
        prev_emp = emp
        prev_lname = lname
        prev_app = app_on_str
        prev_apr_on = apr_on_str
        prev_apr_by = apr_by
        prev_apr_st = apr_st
        prev_date = evt_date

    leave_df["request_id"] = group_keys
    df.loc[leave_df["_orig_idx"], "request_id"] = leave_df["request_id"]

    # Reconstruct LeaveRequest objects using high-performance pre-aggregations
    grouped = leave_df.groupby("request_id", sort=False)
    first_rows = leave_df.drop_duplicates(subset=["request_id"], keep="first").set_index("request_id")
    min_dates = grouped["_sort_date"].min()
    max_dates = grouped["_sort_date"].max()
    qty_sums = grouped["Quantity"].sum() if "Quantity" in leave_df.columns else None
    event_counts = grouped.size()

    dq_series = None
    if "dq_analytical_daily_quantity_exceeds_one" in leave_df.columns:
        dq_series = grouped["dq_analytical_daily_quantity_exceeds_one"].any()
    elif "dq_daily_quantity_exceeds_one" in leave_df.columns:
        dq_series = grouped["dq_daily_quantity_exceeds_one"].any()

    rec_ids = grouped["record_id"].agg(list) if "record_id" in leave_df.columns else None
    src_rows = grouped["source_row_number"].agg(list) if "source_row_number" in leave_df.columns else None

    requests: List[LeaveRequest] = []
    for req_id in first_rows.index:
        frow = first_rows.loc[req_id]
        emp_num = str(frow.get("Employee Number") or "UNKNOWN")
        emp_name = frow.get("Employee Name")
        emp_name = str(emp_name) if pd.notna(emp_name) else None
        manager = frow.get("Reporting Manager")
        manager = str(manager) if pd.notna(manager) else None
        leave_name = frow.get("Leave Name") or frow.get("Attendance Type")
        leave_name_norm = str(leave_name).strip() if pd.notna(leave_name) else None
        status_val = frow.get("Status") or ""
        is_pl = config.is_pl_leave(leave_name_norm or "", str(status_val))

        min_dt = min_dates.get(req_id)
        start_date = min_dt.date() if pd.notna(min_dt) else None
        max_dt = max_dates.get(req_id)
        end_date = max_dt.date() if pd.notna(max_dt) else None

        total_qty = round(float(qty_sums.get(req_id)), 4) if qty_sums is not None and pd.notna(qty_sums.get(req_id)) else None
        event_cnt = int(event_counts.get(req_id, 1))

        app_val = frow.get("Applied On")
        app_dt = pd.to_datetime(app_val, errors="coerce")
        applied_dt = app_dt.to_pydatetime() if pd.notna(app_dt) else None

        apr_val = frow.get("Approved On")
        apr_dt = pd.to_datetime(apr_val, errors="coerce")
        approved_dt = apr_dt.to_pydatetime() if pd.notna(apr_dt) else None

        apr_st = frow.get("Approval Status")
        approval_status_str = str(apr_st).strip() if pd.notna(apr_st) else None
        apr_by = frow.get("Approved By")
        approved_by_str = str(apr_by).strip() if pd.notna(apr_by) else None
        app_by_val = frow.get("Applied By") or frow.get("applied_by")
        applied_by_str = str(app_by_val).strip() if pd.notna(app_by_val) else None

        req_lag_days = (applied_dt.date() - start_date).days if applied_dt and start_date else None
        turnaround = (approved_dt.date() - applied_dt.date()).days if approved_dt and applied_dt else None

        r_ids = rec_ids.get(req_id, []) if rec_ids is not None else []
        s_rows = src_rows.get(req_id, []) if src_rows is not None else []
        has_dq = bool(dq_series.get(req_id, False)) if dq_series is not None else False

        requests.append(LeaveRequest(
            request_id=req_id,
            employee_number=emp_num,
            employee_name=emp_name,
            reporting_manager=manager,
            leave_name_normalized=leave_name_norm,
            is_pl=is_pl,
            request_start_date=start_date,
            request_end_date=end_date,
            request_event_rows=event_cnt,
            request_total_quantity=total_qty,
            applied_on=applied_dt,
            approved_on=approved_dt,
            approval_status=approval_status_str,
            approved_by=approved_by_str,
            applied_by=applied_by_str,
            request_application_lag_days=req_lag_days,
            approval_turnaround_days=turnaround,
            record_ids=r_ids,
            source_row_numbers=s_rows,
            has_data_quality_issue=has_dq,
        ))

    return requests, df
