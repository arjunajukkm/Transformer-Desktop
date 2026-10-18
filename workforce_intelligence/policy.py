"""
policy.py
─────────
Deterministic workforce policy and compliance evaluation engine.
Evaluates leave requests and WFH events against organizational policies,
maintains pre-policy benchmark vs post-policy enforceable distinctions,
and provides transparent, explainable reason codes for every evaluation.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from workforce_intelligence.policy_config import (
    DEFAULT_POLICY_CONFIG,
    POLICY_RULES,
    PolicyConfig,
)
from workforce_intelligence.requests import LeaveRequest, build_leave_requests


def classify_policy_event(row: pd.Series, config: PolicyConfig) -> str:
    """
    Classify a workforce event row into a policy event type:
    - PL: Privilege Leave
    - NON_PL_LEAVE: All other leave types
    - WFH: Work From Home
    - ATTENDANCE: Absent, Missing Swipes, Regularization
    - OTHER: Present, Week Off, Holiday, On Duty, etc.
    """
    cat = str(row.get("attendance_category") or "").strip()
    status = str(row.get("Status") or "").strip()
    atype = str(row.get("Attendance Type") or "").strip()
    lname = str(row.get("Leave Name") or "").strip()

    if cat == "Leave" or "leave" in atype.lower() or status.lower() in ("cl", "sl", "pl", "el", "ml", "clsl"):
        if config.is_pl_leave(lname, status):
            return "PL"
        return "NON_PL_LEAVE"

    if cat == "Work From Home" or "wfh" in atype.lower() or status.lower() == "wfh":
        return "WFH"

    if cat in ("Absent", "Missing Swipes", "Attendance Regularized") or status.lower() in ("a", "ab", "ms", "p(ms)", "a(r)", "ar"):
        return "ATTENDANCE"

    return "OTHER"


def evaluate_leave_request(
    req: LeaveRequest, config: PolicyConfig
) -> Dict[str, Any]:
    """
    Evaluate compliance for a reconstructed leave request.
    Distinguishes PRE_POLICY benchmark from POST_POLICY enforceable status.
    """
    # 1. Determine policy period
    is_post_policy = False
    if req.request_start_date:
        is_post_policy = req.request_start_date >= config.policy_effective_date
    policy_period = "POST_POLICY" if is_post_policy else "PRE_POLICY"

    # 2. Handle Critical Data Quality
    if req.has_data_quality_issue:
        rule_code = "PL_NOTICE_2D" if req.is_pl else "NON_PL_APPLY_WITHIN_3D"
        return {
            "request_id": req.request_id,
            "policy_event_type": "PL" if req.is_pl else "NON_PL_LEAVE",
            "policy_rule_code": rule_code,
            "policy_rule_description": POLICY_RULES.get(rule_code, ""),
            "required_notice_days": 2 if req.is_pl else None,
            "allowed_post_days": None if req.is_pl else 3,
            "policy_period": policy_period,
            "benchmark_compliant": None,
            "policy_compliant": None,
            "compliance_status": "DATA_QUALITY_UNCERTAIN",
            "non_compliance_reason": "SOURCE_DATA_QUALITY_CRITICAL",
        }

    # 3. Handle Missing Application Date
    if req.applied_on is None:
        rule_code = "PL_NOTICE_2D" if req.is_pl else "NON_PL_APPLY_WITHIN_3D"
        return {
            "request_id": req.request_id,
            "policy_event_type": "PL" if req.is_pl else "NON_PL_LEAVE",
            "policy_rule_code": rule_code,
            "policy_rule_description": POLICY_RULES.get(rule_code, ""),
            "required_notice_days": 2 if req.is_pl else None,
            "allowed_post_days": None if req.is_pl else 3,
            "policy_period": policy_period,
            "benchmark_compliant": False,
            "policy_compliant": False if is_post_policy else None,
            "compliance_status": "NON_COMPLIANT" if is_post_policy else "PRE_POLICY_BENCHMARK_FAIL",
            "non_compliance_reason": "MISSING_APPLICATION_DATE",
        }

    # 4. Evaluate Timing / Advance Notice
    lag = req.request_application_lag_days or 0
    qty = req.request_total_quantity if req.request_total_quantity is not None else 1.0

    if req.is_pl:
        if qty <= config.pl_short_max_units:
            rule_code = "PL_NOTICE_2D"
            req_notice = config.pl_short_advance_days
        elif qty <= config.pl_medium_max_units:
            rule_code = "PL_NOTICE_15D"
            req_notice = config.pl_medium_advance_days
        else:
            rule_code = "PL_NOTICE_30D"
            req_notice = config.pl_long_advance_days

        # Advance notice: lag must be <= -req_notice
        is_compliant = (lag <= -req_notice)
        reason = None if is_compliant else "INSUFFICIENT_ADVANCE_NOTICE"
        allowed_post = None
    else:
        rule_code = "NON_PL_APPLY_WITHIN_3D"
        req_notice = None
        allowed_post = config.non_pl_max_post_days
        # Within post days: lag must be <= allowed_post_days
        is_compliant = (lag <= allowed_post)
        reason = None if is_compliant else "LATE_APPLICATION"

    if is_compliant:
        comp_status = "COMPLIANT" if is_post_policy else "PRE_POLICY_BENCHMARK_PASS"
        policy_comp = True if is_post_policy else None
        bench_comp = True
    else:
        comp_status = "NON_COMPLIANT" if is_post_policy else "PRE_POLICY_BENCHMARK_FAIL"
        policy_comp = False if is_post_policy else None
        bench_comp = False

    return {
        "request_id": req.request_id,
        "policy_event_type": "PL" if req.is_pl else "NON_PL_LEAVE",
        "policy_rule_code": rule_code,
        "policy_rule_description": POLICY_RULES.get(rule_code, ""),
        "required_notice_days": req_notice,
        "allowed_post_days": allowed_post,
        "policy_period": policy_period,
        "benchmark_compliant": bench_comp,
        "policy_compliant": policy_comp,
        "compliance_status": comp_status,
        "non_compliance_reason": reason or "NONE",
    }


def evaluate_policy(
    df: pd.DataFrame,
    leave_requests: Optional[List[LeaveRequest]] = None,
    config: Optional[PolicyConfig] = None,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
    """
    Evaluate policy compliance across all rows and leave requests.

    Returns:
        (evaluated_df, evaluated_leave_requests)
    """
    if config is None:
        config = DEFAULT_POLICY_CONFIG

    df = df.copy()

    # 1. Build leave requests if not already provided
    if leave_requests is None:
        leave_requests, df = build_leave_requests(df, config=config)

    # 2. Evaluate all leave requests
    req_eval_map: Dict[str, Dict[str, Any]] = {}
    evaluated_req_list: List[Dict[str, Any]] = []
    for req in leave_requests:
        res = evaluate_leave_request(req, config)
        req_eval_map[req.request_id] = res
        # Combine request metadata with evaluation results
        full_dict = req.to_dict()
        full_dict.update(res)
        evaluated_req_list.append(full_dict)

    # 3. Classify event types for all rows (Vectorized ultra-fast)
    cat = df["attendance_category"].astype(str).str.strip() if "attendance_category" in df.columns else pd.Series("", index=df.index)
    status = df["Status"].astype(str).str.strip() if "Status" in df.columns else pd.Series("", index=df.index)
    st_lower = status.str.lower()
    atype = df["Attendance Type"].astype(str).str.strip() if "Attendance Type" in df.columns else pd.Series("", index=df.index)
    atype_lower = atype.str.lower()
    lname = df["Leave Name"].astype(str).str.strip() if "Leave Name" in df.columns else pd.Series("", index=df.index)

    is_leave = (cat == "Leave") | atype_lower.str.contains("leave", na=False) | st_lower.isin(["cl", "sl", "pl", "el", "ml", "clsl"])
    is_wfh = (cat == "Work From Home") | atype_lower.str.contains("wfh", na=False) | (st_lower == "wfh")
    is_att = cat.isin(["Absent", "Missing Swipes", "Attendance Regularized"]) | st_lower.isin(["a", "ab", "ms", "p(ms)", "a(r)", "ar"])
    is_pl = is_leave & (lname.str.lower().str.contains(r"privilege|earned|\bpl\b|annual", regex=True, na=False) | st_lower.isin(["pl", "el"]))

    ev_series = pd.Series("OTHER", index=df.index)
    ev_series[is_att] = "ATTENDANCE"
    ev_series[is_wfh] = "WFH"
    ev_series[is_leave] = "NON_PL_LEAVE"
    ev_series[is_pl] = "PL"
    df["policy_event_type"] = ev_series

    # 4. Map request quantity back to rows
    req_qty_map = {r.request_id: r.request_total_quantity for r in leave_requests}
    df["request_total_quantity"] = df["request_id"].map(req_qty_map)

    # 5. Populate row-level policy columns (Vectorized baseline)
    evt_ts = pd.to_datetime(df["Date"], errors="coerce")
    is_post_policy = (evt_ts.dt.date >= config.policy_effective_date).fillna(False)
    periods = np.where(is_post_policy, "POST_POLICY", "PRE_POLICY")

    rule_codes = pd.Series("NOT_APPLICABLE", index=df.index)
    rule_descs = pd.Series(POLICY_RULES["NOT_APPLICABLE"], index=df.index)
    req_notices = pd.Series(None, index=df.index, dtype="object")
    allowed_posts = pd.Series(None, index=df.index, dtype="object")
    bench_compliants = pd.Series(None, index=df.index, dtype="boolean")
    policy_compliants = pd.Series(None, index=df.index, dtype="boolean")
    statuses = pd.Series("NOT_APPLICABLE", index=df.index)
    reasons = pd.Series("NOT_APPLICABLE", index=df.index)

    # Case A: Leave Rows linked to LeaveRequests (Vectorized dictionary lookup)
    has_req = df["request_id"].notna() & df["request_id"].isin(req_eval_map)
    if has_req.any():
        req_df = pd.DataFrame.from_dict(req_eval_map, orient="index")
        m_req = df.loc[has_req, "request_id"]
        rule_codes.loc[has_req] = m_req.map(req_df["policy_rule_code"])
        rule_descs.loc[has_req] = m_req.map(req_df["policy_rule_description"])
        req_notices.loc[has_req] = m_req.map(req_df["required_notice_days"])
        allowed_posts.loc[has_req] = m_req.map(req_df["allowed_post_days"])
        bench_compliants.loc[has_req] = m_req.map(req_df["benchmark_compliant"]).astype("boolean")
        policy_compliants.loc[has_req] = m_req.map(req_df["policy_compliant"]).astype("boolean")
        statuses.loc[has_req] = m_req.map(req_df["compliance_status"])
        reasons.loc[has_req] = m_req.map(req_df["non_compliance_reason"])

    # Case B: WFH Rows (Fully Vectorized)
    wfh_mask = (df["policy_event_type"] == "WFH")
    if wfh_mask.any():
        rule_code = "WFH_APPLY_WITHIN_3D"
        rule_desc = POLICY_RULES[rule_code]
        allowed_post = config.wfh_max_post_days

        rule_codes[wfh_mask] = rule_code
        rule_descs[wfh_mask] = rule_desc
        allowed_posts[wfh_mask] = allowed_post

        wfh_post = is_post_policy & wfh_mask

        # Data quality check
        dq_flag = pd.Series(False, index=df.index)
        if "dq_analytical_daily_quantity_exceeds_one" in df.columns:
            dq_flag = df["dq_analytical_daily_quantity_exceeds_one"].fillna(False).astype(bool)
        elif "dq_daily_quantity_exceeds_one" in df.columns:
            dq_flag = df["dq_daily_quantity_exceeds_one"].fillna(False).astype(bool)

        wfh_dq = wfh_mask & dq_flag
        statuses[wfh_dq] = "DATA_QUALITY_UNCERTAIN"
        reasons[wfh_dq] = "SOURCE_DATA_QUALITY_CRITICAL"

        # Missing Applied On
        applied_on_series = df["Applied On"] if "Applied On" in df.columns else pd.Series(None, index=df.index)
        wfh_no_app = wfh_mask & (~wfh_dq) & applied_on_series.isna()

        bench_compliants[wfh_no_app] = False
        policy_compliants[wfh_no_app & wfh_post] = False
        statuses[wfh_no_app & wfh_post] = "NON_COMPLIANT"
        statuses[wfh_no_app & (~wfh_post)] = "PRE_POLICY_BENCHMARK_FAIL"
        reasons[wfh_no_app] = "MISSING_APPLICATION_DATE"

        # Valid Applied On
        wfh_valid = wfh_mask & (~wfh_dq) & (~wfh_no_app)
        if wfh_valid.any():
            app_dt = pd.to_datetime(applied_on_series[wfh_valid], format="mixed", errors="coerce").dt.floor("D")
            ev_dt = evt_ts[wfh_valid].dt.floor("D")
            lag_s = (app_dt - ev_dt).dt.days.fillna(0)

            wfh_comp = pd.Series(False, index=df.index)
            wfh_comp[wfh_valid] = (lag_s <= allowed_post).values
            wfh_fail = pd.Series(False, index=df.index)
            wfh_fail[wfh_valid] = (lag_s > allowed_post).values

            bench_compliants[wfh_comp] = True
            policy_compliants[wfh_comp & wfh_post] = True
            statuses[wfh_comp & wfh_post] = "COMPLIANT"
            statuses[wfh_comp & (~wfh_post)] = "PRE_POLICY_BENCHMARK_PASS"
            reasons[wfh_comp] = "NONE"

            bench_compliants[wfh_fail] = False
            policy_compliants[wfh_fail & wfh_post] = False
            statuses[wfh_fail & wfh_post] = "NON_COMPLIANT"
            statuses[wfh_fail & (~wfh_post)] = "PRE_POLICY_BENCHMARK_FAIL"
            reasons[wfh_fail] = "LATE_APPLICATION"

    df["policy_rule_code"] = rule_codes
    df["policy_rule_description"] = rule_descs
    df["required_notice_days"] = req_notices
    df["allowed_post_days"] = allowed_posts
    df["policy_period"] = periods
    df["benchmark_compliant"] = bench_compliants
    df["policy_compliant"] = policy_compliants
    df["compliance_status"] = statuses
    df["non_compliance_reason"] = reasons

    return df, evaluated_req_list
