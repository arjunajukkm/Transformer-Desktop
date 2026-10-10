"""MC14 v2: regularized absence quantity, with unrelated semantics preserved."""
import json
from pathlib import Path

import pandas as pd
import pytest
from pandas.testing import assert_frame_equal

from storage.snapshot_service import create_snapshot, normalize_dataset_dataframe, snapshot_service
from workforce_intelligence.data_foundation import CanonicalWorkforceData
from workforce_intelligence.kpi_engine import compute_workforce_intelligence_bundle
from workforce_intelligence.metrics import build_employee_day_facts
from workforce_intelligence.normalization import normalize_workforce_dataframe
from workforce_intelligence.trends import calculate_monthly_attendance
from workforce_intelligence.validation import apply_quality_flags


GOLDEN = json.loads((Path(__file__).parent / 'golden/mc14_correction.json').read_text())


def ar_frame(quantity=1.0):
    row = dict(GOLDEN['cases'][0]['row'], Quantity=quantity)
    return pd.DataFrame([row])


def governed_facts(frame):
    normalized, _ = normalize_workforce_dataframe(frame, source_file_name='synthetic_mc14.xlsx')
    governed = apply_quality_flags(normalized, source_columns=list(frame))
    return governed, build_employee_day_facts(governed)


@pytest.mark.parametrize('case', GOLDEN['cases'], ids=lambda c: c['id'])
def test_mc14_quantity_matrix(case):
    frame = pd.DataFrame([case['row']])
    original = frame.copy(deep=True)
    bundle = compute_workforce_intelligence_bundle(frame)
    expected = case['expected']
    assert bundle['kpi_3_present_days'] == expected['present']
    assert bundle['kpi_absent_days'] == expected['absent']
    assert bundle['kpi_unclassified_days'] == expected['unclassified']
    assert bundle['kpi_5_leave_days'] == expected['leave']
    assert bundle['kpi_6_wfh_days'] == expected['wfh']
    assert bundle['kpi_9_attendance_exceptions_days'] == expected['regularized_days']
    assert bundle['attendance_composition_denominator'] == expected['total']
    # Regularization is an overlapping indicator, not another quantity bucket.
    assert sum(item['days'] for item in bundle['attendance_composition']) == expected['total']
    assert bundle['daily_attendance_trend'][0]['present_days'] == expected['present']
    assert bundle['daily_attendance_trend'][0]['absent_days'] == expected['absent']
    assert bundle['bu_comparison_total']['present_days'] == expected['present']
    assert bundle['bu_comparison_total']['absent_days'] == expected['absent']
    assert bundle['bu_attendance_comparison'][0]['present_days'] == expected['present']
    assert_frame_equal(frame, original)


@pytest.mark.parametrize('reverse', [False, True])
def test_mc14_split_day_conserves_quantity_and_rate_flags(reverse):
    ar = ar_frame(.5).iloc[0].to_dict()
    present = dict(ar, Status='P', **{'Attendance Type': 'Present', 'record_id': 'SYN_PRESENT'})
    frame = pd.DataFrame([ar, present] if reverse else [present, ar])
    bundle = compute_workforce_intelligence_bundle(frame)
    assert bundle['kpi_3_present_days'] == 1.0
    assert bundle['kpi_absent_days'] == 0.0
    assert bundle['kpi_unclassified_days'] == 0.0
    assert bundle['attendance_composition_denominator'] == 1.0
    assert bundle['recorded_employee_days'] == 1
    assert bundle['kpi_9_attendance_exceptions_days'] == 1
    _, facts = governed_facts(frame)
    assert facts.iloc[0].daily_total_quantity == 1.0
    assert facts.iloc[0].record_count == 2
    assert facts.iloc[0].has_present and facts.iloc[0].has_regularization
    assert not facts.iloc[0].has_absent
    for metric, numerator, value in [('absence_rate', 0, 0.0), ('regularization_rate', 1, 100.0)]:
        point = calculate_monthly_attendance(facts, metric)[0]
        assert (point.numerator, point.denominator, point.value) == (numerator, 1, value)


@pytest.mark.parametrize('quantity', [1.0, .5])
def test_mc14_raw_lineage_and_independent_rate_facts_preserved(quantity):
    frame = ar_frame(quantity)
    original = frame.copy(deep=True)
    snapshot = create_snapshot(frame, dataset_id='SYN_MC14')
    bundle = compute_workforce_intelligence_bundle(snapshot.fact_df, canonical_data=snapshot.workforce_foundation)
    assert bundle['kpi_3_present_days'] == quantity
    assert snapshot.fact_df.iloc[0]['Attendance Type'] == 'Absent'
    assert snapshot.fact_df.iloc[0]['Status'] == 'A(R)'
    record = snapshot.workforce_foundation.attendance_records[0]
    fact = snapshot.workforce_foundation.employee_day_facts[0]
    assert record.attendance_type == 'Absent'
    assert record.attendance_status == 'A(R)'
    assert record.attendance_category == 'Attendance Regularized'
    assert record.quantity == quantity
    assert fact.record_ids == [record.record_id]
    assert record.source_row_number == 2
    assert fact.daily_total_quantity == quantity
    assert fact.has_regularization and not fact.has_absent
    # This older flag model tracks regularization separately from physical presence.
    assert not fact.has_present
    governed, facts = governed_facts(frame)
    assert governed.iloc[0]['Attendance Type'] == 'Absent'
    assert facts.iloc[0].daily_total_quantity == quantity
    assert facts.iloc[0].has_regularization and not facts.iloc[0].has_absent
    for metric, value in [('absence_rate', 0.0), ('regularization_rate', 100.0)]:
        point = calculate_monthly_attendance(facts, metric)[0]
        assert (point.denominator, point.value) == (1, value)
    assert_frame_equal(frame, original)


@pytest.mark.parametrize('quantity', [None, 'invalid', 0, -1])
def test_mc14_preserves_existing_overview_quantity_fallback(quantity):
    frame = ar_frame(quantity)
    approved = frame.assign(**{'Approval Status': 'Approved'})
    # The existing Overview fallback is one; this slice does not approve/change it.
    before_contract = compute_workforce_intelligence_bundle(approved)
    corrected = compute_workforce_intelligence_bundle(frame)
    assert before_contract['kpi_3_present_days'] == 1.0
    assert corrected['kpi_3_present_days'] == 1.0
    assert corrected['attendance_composition_denominator'] == 1.0
    assert corrected['kpi_absent_days'] == 0.0
    canonical = CanonicalWorkforceData.from_dataframe(frame)
    assert canonical.attendance_records[0].quantity == (None if quantity in (None, 'invalid') else quantity)
    if quantity in (None, 'invalid'):
        governed, _ = governed_facts(frame)
        assert governed.iloc[0].dq_missing_quantity


def test_mc14_critical_overlap_stays_unclassified_and_rate_excluded():
    row = ar_frame(.75).iloc[0].to_dict()
    frame = pd.DataFrame([row, dict(row, record_id='SYN_SECOND', **{'Attendance Type': 'Regularized'})])
    bundle = compute_workforce_intelligence_bundle(frame)
    assert bundle['kpi_3_present_days'] == 0.0
    assert bundle['kpi_absent_days'] == 0.0
    assert bundle['kpi_unclassified_days'] == 1.0
    assert bundle['conflicting_employee_days_count'] == 1
    _, facts = governed_facts(frame)
    assert facts.iloc[0].daily_total_quantity == 1.5
    assert not facts.iloc[0].is_metric_evaluable
    assert facts.iloc[0].employee_day_quality_status == 'CRITICAL'
    for metric in ('absence_rate', 'regularization_rate'):
        point = calculate_monthly_attendance(facts, metric)[0]
        assert (point.denominator, point.excluded_data_quality, point.value) == (0, 1, None)


def test_mc14_pre_normalized_input_classifies_before_day_aggregation():
    frame = normalize_dataset_dataframe(ar_frame(.5))
    # A supported caller can supply existing helper columns; do not rely on renormalization.
    frame['_att_type'] = 'Absent'
    original = frame.copy(deep=True)
    bundle = compute_workforce_intelligence_bundle(frame)
    assert (bundle['kpi_3_present_days'], bundle['kpi_absent_days']) == (.5, 0.0)
    assert bundle['unclassified_record_ids'] == []
    assert_frame_equal(frame, original)


def test_mc14_corrected_snapshot_renders_present_card(desktop_app, pump_ui):
    app = desktop_app
    snapshot = snapshot_service.prepare_dataset(ar_frame(), dataset_id='SYN_MC14_UI')
    app._latest_ts_job_id = 1
    app._ts_load_success(snapshot, 'synthetic_mc14.xlsx', job_id=1)
    pump_ui(app)
    view = app.workforce_dashboard_view
    assert view.kpi_cards['kpi_3_present'].lbl_val.cget('text') == '1 day'
    assert view.kpi_cards['kpi_absent'].lbl_val.cget('text') == '0 days'
    assert view._last_metrics_bundle['kpi_9_attendance_exceptions_days'] == 1
