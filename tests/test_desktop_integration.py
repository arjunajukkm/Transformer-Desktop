"""
tests/test_desktop_integration.py
───────────────────────────────────
Desktop integration tests for Transformers 2.0 — Phase 2B.

Verifies:
 1. Successful upload and snapshot activation.
 2. Dashboard metrics matching the existing analytical engine.
 3. Correct Business Unit, Department, Manager and Employee breakdowns.
 4. Search filtering prepared rows without analytical recalculation.
 5. Repeated reporting-level selection reusing prepared results.
 6. Correct dataset replacement and UI state update.
 7. Failed upload preserving the existing dataset and UI state.
 8. Older processing jobs not overwriting newer completed results (stale job fencing).
 9. No Tkinter widget updates from background worker threads.
10. Excel export continuing to produce identical results and workbook structure.
"""

from datetime import date
from pathlib import Path
import threading
from unittest.mock import MagicMock, patch

import openpyxl
import pandas as pd
import pytest

from app import App
from storage import snapshot_service, TimeSeriesSnapshotService
import time_series_analysis as tsa


@pytest.fixture(scope="module")
def synthetic_excel(tmp_path_factory):
    """Generates a multi-entity synthetic dataset with distinct metrics (9 rows, 3 emps)."""
    tmp_dir = tmp_path_factory.mktemp("integration_data")
    rows = [
        # Emp 1: Alice (Engineering, Backend, RM: Bob Manager) - 3 rows
        {
            "Employee Number": "E001",
            "Employee Name": "Alice",
            "Business Unit": "Engineering",
            "Department": "Backend",
            "Reporting Manager": "Bob Manager",
            "Date": "2026-09-01",
            "Month": "Sep 2026",
            "Attendance Type": "Present",
            "Status": "P",
            "In Time": "09:00",
            "Out Time": "18:00",
            "Applied By": "NA",
            "Applied On": "NA",
            "Approved By": "NA",
            "Approved On": "NA",
        },
        {
            "Employee Number": "E001",
            "Employee Name": "Alice",
            "Business Unit": "Engineering",
            "Department": "Backend",
            "Reporting Manager": "Bob Manager",
            "Date": "2026-09-02",
            "Month": "Sep 2026",
            "Attendance Type": "Missing Swipes",
            "Status": "P(MS)",
            "In Time": "10:00",
            "Out Time": "18:30",
            "Applied By": "NA",
            "Applied On": "NA",
            "Approved By": "NA",
            "Approved On": "NA",
        },
        {
            "Employee Number": "E001",
            "Employee Name": "Alice",
            "Business Unit": "Engineering",
            "Department": "Backend",
            "Reporting Manager": "Bob Manager",
            "Date": "2026-09-03",
            "Month": "Sep 2026",
            "Attendance Type": "Leave",
            "Status": "CL",
            "Leave Name": "Casual Leave",
            "In Time": "NA",
            "Out Time": "NA",
            "Applied By": "Employee",
            "Applied On": "2026-09-01",  # 2 days in advance
            "Approved By": "Manager",
            "Approved On": "2026-09-02",  # 1 day turnaround
        },
        # Emp 2: Charlie (Sales, Direct Sales, RM: David RM) - 1 row
        {
            "Employee Number": "E002",
            "Employee Name": "Charlie",
            "Business Unit": "Sales",
            "Department": "Direct Sales",
            "Reporting Manager": "David RM",
            "Date": "2026-09-01",
            "Month": "Sep 2026",
            "Attendance Type": "Regularized",
            "Status": "AR",
            "In Time": "09:30",
            "Out Time": "18:30",
            "Applied By": "Employee",
            "Applied On": "2026-09-01",
            "Approved By": "Manager",
            "Approved On": "2026-09-02",
        },
        # Emp 2: Charlie WFH 4 days (>3 days threshold) - 4 rows
        *[
            {
                "Employee Number": "E002",
                "Employee Name": "Charlie",
                "Business Unit": "Sales",
                "Department": "Direct Sales",
                "Reporting Manager": "David RM",
                "Date": f"2026-09-0{d}",
                "Month": "Sep 2026",
                "Attendance Type": "Work From Home",
                "Status": "WFH",
                "In Time": "NA",
                "Out Time": "NA",
                "Applied By": "Employee",
                "Applied On": f"2026-09-0{d}",
                "Approved By": "Manager",
                "Approved On": f"2026-09-0{d}",
            }
            for d in range(2, 6)
        ],
        # Emp 3: Eve (Marketing, Growth, RM: Frank RM) - 1 row
        {
            "Employee Number": "E003",
            "Employee Name": "Eve",
            "Business Unit": "Marketing",
            "Department": "Growth",
            "Reporting Manager": "Frank RM",
            "Date": "2026-09-01",
            "Month": "Sep 2026",
            "Attendance Type": "Present",
            "Status": "P",
            "In Time": "08:30",
            "Out Time": "17:30",
            "Applied By": "NA",
            "Applied On": "NA",
            "Approved By": "NA",
            "Approved On": "NA",
        },
    ]
    df = pd.DataFrame(rows)
    p = tmp_dir / "synthetic_dataset.xlsx"
    df.to_excel(p, index=False)
    return p


@pytest.fixture(scope="module")
def replacement_excel(tmp_path_factory):
    """Independent second dataset to test dataset replacement."""
    tmp_dir = tmp_path_factory.mktemp("replacement_data")
    rows = [
        {
            "Employee Number": "E999",
            "Employee Name": "Zack",
            "Business Unit": "Executive",
            "Department": "Board",
            "Reporting Manager": "Chairperson",
            "Date": "2026-11-01",
            "Month": "Nov 2026",
            "Attendance Type": "Present",
            "Status": "P",
            "In Time": "10:00",
            "Out Time": "16:00",
            "Applied By": "NA",
            "Applied On": "NA",
            "Approved By": "NA",
            "Approved On": "NA",
        }
    ]
    df = pd.DataFrame(rows)
    p = tmp_dir / "replacement_dataset.xlsx"
    df.to_excel(p, index=False)
    return p


@pytest.fixture
def desktop_app(fresh_desktop_app, synthetic_excel, pump_ui):
    app = fresh_desktop_app
    snap = snapshot_service.prepare_dataset(str(synthetic_excel))
    app.ts_file_path.set(str(synthetic_excel))
    app._latest_ts_job_id = 1
    app._ts_load_success(snap, str(synthetic_excel), job_id=1)
    pump_ui(app)
    return app


# =========================================================================
# 1. Successful upload and snapshot activation
# =========================================================================
def test_successful_upload_and_snapshot_activation(desktop_app, synthetic_excel):
    """Verify that dataset ingestion prepares the snapshot and activates UI cleanly."""
    app = desktop_app

    assert snapshot_service.has_active_snapshot()
    assert app.is_ts_loading is False
    assert app.btn_ts_load.cget("state") == "normal"
    assert app.ts_dataset is not None
    assert len(app.ts_dataset) == 9
    assert "Active: 9 records • 3 employees" in app.ts_lbl.cget("text")

    # Check filter dropdown values populated
    bu_vals = app.workforce_dashboard_view.combo_bu.cget("values")
    assert "All Business Units" in bu_vals
    assert "Engineering" in bu_vals
    assert "Sales" in bu_vals
    assert "Marketing" in bu_vals


# =========================================================================
# 2. Dashboard metrics matching the existing analytical engine
# =========================================================================
def test_dashboard_metrics_matching_existing_analytical_engine(desktop_app, pump_ui):
    from workforce_intelligence.kpi_engine import compute_workforce_intelligence_bundle
    from workforce_intelligence.dashboard_shell import _fmt_days
    app = desktop_app
    view = app.workforce_dashboard_view
    snapshot = snapshot_service.get_active_snapshot()
    expected = compute_workforce_intelligence_bundle(app.ts_dataset, canonical_data=snapshot.workforce_foundation)
    assert view._last_metrics_bundle == expected
    # Legacy timing/repeat/excess semantics still belong to snapshot/export.
    assert snapshot_service.get_dashboard_metrics() == tsa.compute_time_series_metrics(app.ts_dataset)
    assert view.kpi_cards["kpi_1_emp_hc"].lbl_val.cget("text") == "3"
    assert view.kpi_cards["kpi_2_attendance_days"].lbl_val.cget("text") == f"{expected['kpi_2_attendance_days']:,} days"
    for card, key in [("kpi_3_present", "kpi_3_present_days"),
                      ("kpi_4_od", "kpi_4_od_days"),
                      ("kpi_5_leave", "kpi_5_leave_days"),
                      ("kpi_6_wfh", "kpi_6_wfh_days"),
                      ("kpi_7_holiday", "kpi_7_holiday_days"),
                      ("kpi_8_week_off", "kpi_8_week_off_days"),
                      ("kpi_absent", "kpi_absent_days")]:
        assert view.kpi_cards[card].lbl_val.cget("text") == _fmt_days(expected[key])
    for card, key in [("kpi_leave_compliance", "leave_avg_lead_time_days"),
                      ("kpi_approval_compliance", "leave_avg_approval_turnaround_days")]:
        value = expected[key]
        unit = "day" if abs(value) == 1 else "days"
        assert view.kpi_cards[card].lbl_val.cget("text") == f"{value:.1f} {unit}"
    for card, key in [("kpi_avg_in_time", "avg_in_time"),
                      ("kpi_avg_out_time", "avg_out_time"),
                      ("kpi_avg_working_hours", "avg_working_hours")]:
        assert view.kpi_cards[card].lbl_val.cget("text") == expected[key]
    with patch.object(view, "_load_overview_metrics", wraps=view._load_overview_metrics) as load:
        view.select_view("overview")
        pump_ui(app)
        load.assert_not_called()



# =========================================================================
# 3. Correct Business Unit, Department, Manager and Employee breakdowns
# =========================================================================
def test_breakdowns_matching_existing_analytical_engine(desktop_app, pump_ui):
    from workforce_intelligence.kpi_engine import compute_workforce_intelligence_bundle
    app = desktop_app
    view = app.workforce_dashboard_view
    # The live UI exposes cascading scopes; the legacy export still owns four
    # hierarchy breakdowns. Verify both contracts, without inventing a tree UI.
    for level in ("Business Unit", "Department", "Reporting Manager", "Employee"):
        assert snapshot_service.get_breakdown(level=level) == tsa.compute_level_breakdown(app.ts_dataset, level=level)
    for field, value, action in [
        ("business_unit", "Engineering", view._on_bu_selected),
        ("department", "Backend", view._on_dept_selected),
        ("manager", "Bob Manager", view._on_manager_selected),
        ("employee", "E001", view._on_employee_selected),
    ]:
        view._on_reset_filters_clicked()
        pump_ui(app)
        action(view._emp_disp_map[value] if field == "employee" else value)
        pump_ui(app)
        expected = compute_workforce_intelligence_bundle(app.ts_dataset, canonical_data=snapshot_service.get_active_snapshot().workforce_foundation, **{field: value})
        assert view._last_metrics_bundle == expected
        assert view.bu_table_widget._bu_total["observed_headcount"] == 1



# =========================================================================
# 4. Search filtering prepared rows without recalculation
# =========================================================================
def test_search_filtering_without_recalculation(desktop_app):
    from workforce_intelligence.snapshot_bridge import workforce_bridge
    view = desktop_app.workforce_dashboard_view
    dropdown = view.combo_employee
    before = view._last_metrics_bundle
    scope = dict(view._filter_state)
    dropdown.open_dropdown()
    try:
        with patch.object(workforce_bridge, "get_workforce_metrics", wraps=workforce_bridge.get_workforce_metrics) as calc, \
             patch.object(snapshot_service, "prepare_dataset", wraps=snapshot_service.prepare_dataset) as ingest:
            for query, employee in [("alice", "E001"), ("E002", "E002")]:
                dropdown._search_var.set(query)
                desktop_app.update()
                assert dropdown._filtered_values == [view._emp_disp_map[employee]]
            dropdown._search_var.set("")
            desktop_app.update()
            assert dropdown._filtered_values == ["All Employees"] + list(view._emp_key_map)
            calc.assert_not_called()
            ingest.assert_not_called()
            assert view._last_metrics_bundle is before
            assert view._filter_state == scope
    finally:
        dropdown.close_dropdown()



# =========================================================================
# 5. Repeated reporting-level selection reusing prepared results
# =========================================================================
def test_repeated_reporting_level_selection_reusing_prepared_results(desktop_app):
    # Four-level reporting remains supported by the snapshot/export service.
    expected = {level: snapshot_service.get_breakdown(level=level) for level in
                ("Business Unit", "Department", "Reporting Manager", "Employee")}
    with patch("time_series_analysis.compute_level_breakdown", wraps=tsa.compute_level_breakdown) as calc:
        for level in list(expected) * 2:
            assert snapshot_service.get_breakdown(level=level) == expected[level]
        calc.assert_not_called()



# =========================================================================
# 6. Correct dataset replacement
# =========================================================================
def test_correct_dataset_replacement(desktop_app, replacement_excel, pump_ui):
    app = desktop_app
    old = snapshot_service.get_active_snapshot()
    snap = snapshot_service.prepare_dataset(str(replacement_excel))
    app._latest_ts_job_id = 2
    app.ts_file_path.set(str(replacement_excel))
    app._ts_load_success(snap, str(replacement_excel), job_id=2)
    pump_ui(app)
    view = app.workforce_dashboard_view
    assert snapshot_service.get_active_snapshot() is snap
    assert snap is not old and app.ts_dataset is snap.fact_df
    assert "Active: 1 records • 1 employees" in app.ts_lbl.cget("text")
    assert view.combo_bu.cget("values") == ["All Business Units", "Executive"]
    assert view._current_dataset_id == snap.dataset_id
    assert view.kpi_cards["kpi_1_emp_hc"].lbl_val.cget("text") == "1"
    assert list(view._emp_disp_map) == ["E999"]



# =========================================================================
# 7. Failed upload preserving the existing dataset and UI state
# =========================================================================
def test_failed_upload_preserving_existing_dataset_and_ui_state(desktop_app, synthetic_excel, tmp_path):
    """Verify a failed upload preserves the previous active snapshot and UI status."""
    app = desktop_app

    initial_lbl_text = app.ts_lbl.cget("text")
    initial_bundle = app.workforce_dashboard_view._last_metrics_bundle
    initial_scope = dict(app.workforce_dashboard_view._filter_state)
    initial_df = app.ts_dataset
    active_snapshot = snapshot_service.get_active_snapshot()
    active_key = active_snapshot.key

    # Attempt to upload a corrupt / invalid file
    bad_file = tmp_path / "corrupt_data.xlsx"
    bad_file.write_bytes(b"not an excel file")
    app.ts_file_path.set(str(bad_file))
    app._latest_ts_job_id = 2
    app.is_ts_loading = True
    app.btn_ts_load.configure(state="disabled")

    with patch("tkinter.messagebox.showerror") as mock_err:
        try:
            snapshot_service.prepare_dataset(str(bad_file))
        except Exception as e:
            app._ts_load_error(str(e), job_id=2)
        app.update()

        assert mock_err.called
        # Previous active snapshot must remain intact
        assert snapshot_service.has_active_snapshot()
        assert snapshot_service.get_active_snapshot() is active_snapshot
        assert snapshot_service.get_active_snapshot().key == active_key
        assert app.is_ts_loading is False
        assert app.btn_ts_load.cget("state") == "normal"
        assert app.ts_lbl.cget("text") == initial_lbl_text
        assert app.ts_dataset is initial_df
        assert app.workforce_dashboard_view._last_metrics_bundle is initial_bundle
        assert app.workforce_dashboard_view._filter_state == initial_scope
        assert app.ts_file_path.get() == str(synthetic_excel)


# =========================================================================
# 8. Older processing jobs not overwriting newer results
# =========================================================================
def test_older_processing_jobs_not_overwriting_newer_results(desktop_app, synthetic_excel, replacement_excel, pump_ui):
    """Verify stale job fencing: Job 1 finishing after Job 2 does not overwrite Job 2."""
    app = desktop_app

    snap1 = snapshot_service.create_snapshot_for_testing(str(synthetic_excel)) if hasattr(snapshot_service, "create_snapshot_for_testing") else snapshot_service.prepare_dataset(str(synthetic_excel))
    snap2 = snapshot_service.prepare_dataset(str(replacement_excel))

    # Job 1 starts, Job 2 starts
    app._latest_ts_job_id = 50

    # Job 2 completes first with job_id=50
    app._ts_load_success(snap2, str(replacement_excel), job_id=50)
    app.update()
    assert "Active: 1 records • 1 employees" in app.ts_lbl.cget("text")

    pump_ui(app)
    latest_bundle = app.workforce_dashboard_view._last_metrics_bundle

    # Job 1 completes later (stale callback with job_id=49)
    app._ts_load_success(snap1, str(synthetic_excel), job_id=49)
    app.update()

    # Job 1 completion must be rejected
    assert "Active: 1 records • 1 employees" in app.ts_lbl.cget("text")
    assert "Executive" in app.workforce_dashboard_view.combo_bu.cget("values")

    assert snapshot_service.get_active_snapshot() is snap2
    assert app.ts_dataset is snap2.fact_df
    assert app.workforce_dashboard_view._last_metrics_bundle is latest_bundle

    # Stale error callback must also be ignored
    with patch("tkinter.messagebox.showerror") as mock_err:
        app._ts_load_error("Some error from job 49", job_id=49)
        assert not mock_err.called

# =========================================================================
# 9. No Tkinter widget updates from background worker threads
# =========================================================================
def test_no_tkinter_widget_updates_from_background_worker_threads(desktop_app, synthetic_excel):
    """Verify background worker only executes analytical calculation and schedules UI updates."""
    app = desktop_app

    worker_thread_id = None
    after_called = False
    after_target = None

    def mock_after(ms, func):
        nonlocal after_called, after_target
        after_called = True
        after_target = func

    with patch.object(app, "after", side_effect=mock_after):
        def worker_wrapper():
            nonlocal worker_thread_id
            worker_thread_id = threading.get_ident()
            app._run_ts_load_job(str(synthetic_excel), job_id=100)

        t = threading.Thread(target=worker_wrapper)
        t.start()
        t.join()

        # Confirm worker thread was separate from main thread
        assert worker_thread_id != threading.get_ident()
        # Confirm app.after was invoked to schedule UI work on main thread
        assert after_called is True
        assert callable(after_target)


# =========================================================================
# 10. Excel export continuing to produce the same results and workbook structure
# =========================================================================
def test_excel_export_structure_and_values(desktop_app, tmp_path):
    """Verify Excel export produces valid workbook with expected sheets, metrics and breakdowns."""
    app = desktop_app
    app._reset_ts_filters()
    app.update()

    out_file = tmp_path / "desktop_export_test.xlsx"

    with patch("tkinter.filedialog.asksaveasfilename", return_value=str(out_file)), \
         patch("tkinter.messagebox.showinfo"):
        app._export_ts_excel()

    assert out_file.exists()

    # Verify sheet names match existing exporter structure
    wb = openpyxl.load_workbook(out_file, data_only=True)
    expected_sheets = ["KPI Summary", "Business Unit", "Department", "Reporting Manager", "Employee Breakdown"]
    assert wb.sheetnames == expected_sheets

    # Verify KPI Summary sheet contains expected metrics
    summary_ws = wb["KPI Summary"]
    summary_metrics_in_sheet = [
        row[1] for row in summary_ws.iter_rows(values_only=True) if row and len(row) > 1 and row[1] is not None
    ]
    assert "Total Records Analyzed" in summary_metrics_in_sheet
    assert "Unique Employees" in summary_metrics_in_sheet
    assert "Avg Days to Apply Leave (From Availed Date)" in summary_metrics_in_sheet
    assert "AVG Working Hours" in summary_metrics_in_sheet

    # Verify Breakdown sheets contain rows
    for s_name in ("Business Unit", "Department", "Reporting Manager", "Employee Breakdown"):
        ws = wb[s_name]
        data_rows = list(ws.iter_rows(values_only=True))
        assert len(data_rows) >= 2  # At least header + 1 data row
