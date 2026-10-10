"""Known legacy behavior, not approval. Stage 2B must explicitly replace these oracles."""
import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import pandas as pd
import pytest
from storage.snapshot_service import create_snapshot,normalize_dataset_dataframe
from workforce_intelligence.ingestion import load_workforce_data
from workforce_intelligence.policy import classify_policy_event,evaluate_policy
from workforce_intelligence.policy_config import DEFAULT_POLICY_CONFIG
from workforce_intelligence.requests import build_leave_requests
from workforce_intelligence.snapshot_bridge import WorkforceIntelligenceBridge
from workforce_intelligence.historical_sync import HistoricalSyncManager
import time_series_analysis as tsa

G=Path(__file__).parents[1]/'golden'
def data(name):return json.loads((G/(name+'.json')).read_text(encoding='utf-8'))

def test_mc02_legacy_wfh_counts_rows_across_months():
    out=tsa.compute_time_series_metrics(normalize_dataset_dataframe(pd.DataFrame(data('wfh')['rows'])))
    assert (out['total_wfh_days'],out['wfh_excess_days'])==(6,3)

def test_mc03_legacy_leave_lead_time_positive_means_advance():
    r=data('wfh')['rows'][0].copy();r.update({'Status':'CL','Attendance Type':'Leave','Date':'2026-10-10','Applied On':'2026-10-08'})
    assert tsa.compute_time_series_metrics(normalize_dataset_dataframe(pd.DataFrame([r])))['avg_leave_apply_days']==2.0

def test_mc12_scalar_and_vectorized_alias_classification_disagree():
    row={'Employee Number':'SYN_ALIAS','Date':date(2026,10,10),'Status':'EL','Attendance Type':'Leave','attendance_category':'Leave','Leave Name':'Earned Leave','Quantity':1,'include_in_analysis':False,'request_id':None}
    assert classify_policy_event(pd.Series(row),DEFAULT_POLICY_CONFIG)=='NON_PL_LEAVE'
    evaluated,_=evaluate_policy(pd.DataFrame([row]),leave_requests=[])
    assert evaluated.iloc[0].policy_event_type=='PL'

def test_known_defect_history_drops_legitimate_split_day(tmp_path):
    manager=HistoricalSyncManager(archive_dir=tmp_path)
    rows=data('attendance')['rows'][:2]
    pd.DataFrame(rows).to_parquet(tmp_path/'attendance_2026_10.parquet')
    manager.load_registry=lambda:{'months':{'2026-10':{'status':'SYNCED','file_name':'attendance_2026_10.parquet'}}}
    result,summary=manager.load_unified_history(['2026-10'])
    assert result.record_id.tolist()==['A2']
    assert result.Quantity.sum()==.5
    assert summary['total_records']==1

def test_known_defect_pagination_cap_returns_success(monkeypatch):
    import keka_data_fetcher as k
    fetcher=object.__new__(k.KekaDataFetcher)
    fetcher.base_url='https://synthetic.invalid'
    fetcher._get_headers=lambda:({},None)
    response=Mock(status_code=200);response.json.return_value={'data':[{'id':'SYN_EVENT'}],'totalPages':3}
    fetcher.session=SimpleNamespace(get=Mock(return_value=response))
    monkeypatch.setattr(k.time,'sleep',lambda *a:None)
    rows,error=fetcher._paginated_get('/synthetic',max_pages=1)
    assert rows==[{'id':'SYN_EVENT'}] and error is None

def test_duplicate_observations_preserve_raw_and_analytical_quantities(tmp_path):
    from workforce_intelligence.metrics import build_employee_day_facts
    row=data('attendance')['rows'][0].copy();row['Quantity']=1
    for internal in ['record_id','observation_id','attendance_category']:row.pop(internal,None)
    source=tmp_path/'synthetic_duplicate.csv';pd.DataFrame([row,row]).to_csv(source,index=False)
    cleaned,report=load_workforce_data(source)
    assert cleaned.include_in_analysis.tolist()==[True,False]
    assert report.exact_duplicate_rows==1
    evaluated,_=evaluate_policy(cleaned);f=build_employee_day_facts(evaluated).iloc[0]
    assert (f.raw_record_count,f.record_count,f.raw_daily_total_quantity,f.analytical_daily_total_quantity)==(2,1,2.0,1.0)

def test_mc09_request_reconstruction_preserves_two_row_lineage():
    rows=[]
    for i,day in enumerate(['2026-10-10','2026-10-11']):
        rows.append({'record_id':f'SYN_R{i}','source_row_number':i+2,'Employee Number':'SYN_REQ','Employee Name':'Synthetic Request','Date':date.fromisoformat(day),'Applied On':pd.Timestamp('2026-10-08'),'Approved On':pd.Timestamp('2026-10-09'),'Approved By':'SYN_MANAGER','Approval Status':'Approved','Leave Name':'Casual Leave','Attendance Type':'Leave','attendance_category':'Leave','Status':'CL','Quantity':.5,'include_in_analysis':True})
    requests,mapped=build_leave_requests(pd.DataFrame(rows))
    assert len(requests)==1
    req=requests[0]
    assert req.record_ids==['SYN_R0','SYN_R1']
    assert req.request_total_quantity==1.0 and req.request_event_rows==2
    assert req.request_start_date==date(2026,10,10)
    assert mapped.request_id.nunique()==1

def test_mc10_cached_pending_age_ignores_new_as_of():
    row=data('approvals')['rows'][3].copy();row['Approval Status']='Pending'
    snap=create_snapshot(pd.DataFrame([row]),dataset_id='SYN_CACHE')
    service=SimpleNamespace(get_active_snapshot=lambda:snap)
    bridge=WorkforceIntelligenceBridge(service)
    first=bridge.get_trend_intelligence(metric_id='average_pending_approval_age',analysis_as_of_date=date(2026,10,10))
    second=bridge.get_trend_intelligence(metric_id='average_pending_approval_age',analysis_as_of_date=date(2026,10,20))
    fresh=WorkforceIntelligenceBridge(service).get_trend_intelligence(metric_id='average_pending_approval_age',analysis_as_of_date=date(2026,10,20))
    assert first==second
    assert first!=fresh
    assert bridge.get_cached_trend_intelligence(metric_id='average_pending_approval_age') is None

def test_mc01_export_callback_omits_manager_employee_and_interval(monkeypatch,tmp_path):
    import workforce_intelligence.dashboard_shell as shell
    from tkinter import filedialog
    exported=Mock()
    monkeypatch.setattr(shell.snapshot_service,'get_active_snapshot',lambda:SimpleNamespace(is_valid=lambda:True))
    monkeypatch.setattr(shell.snapshot_service,'export_report',exported)
    monkeypatch.setattr(filedialog,'asksaveasfilename',lambda **k:str(tmp_path/'synthetic.xlsx'))
    monkeypatch.setattr(shell.threading,'Thread',lambda target,**k:SimpleNamespace(start=target))
    fake=SimpleNamespace(_filter_state={'business_unit':'SYN_BU_A','department':'SYN_DEPT','manager':'SYN_MANAGER_A','employee':'SYN001','date_preset':'Custom','date_range':(date(2026,10,10),date(2026,10,10))},after=lambda *a:None)
    shell.WorkforceDashboardView._on_export_excel(fake)
    assert set(exported.call_args.kwargs)=={'output_path','business_unit','department','month'}
    assert exported.call_args.kwargs['month']=='Custom'

def test_known_defect_formula_like_text_is_written_as_formula(tmp_path):
    import openpyxl
    # Same pandas/openpyxl writer path used by legacy exports; no formula is evaluated.
    path=tmp_path/'synthetic_formula.xlsx';pd.DataFrame({'Synthetic text':['=1+1']}).to_excel(path,index=False,engine='openpyxl')
    book=openpyxl.load_workbook(path,data_only=False)
    assert book.active['A2'].data_type=='f'
    book.close()

def test_future_design_cases_are_explicitly_not_runtime_approval():
    d=data('future_expectations')
    assert d['kind']=='DESIGN_EXPECTATION_NOT_IMPLEMENTED_NOT_BUSINESS_APPROVAL'
    assert len(d['scenarios'])==8
    assert all(s['status']!='APPROVED_CHANGE' for s in d['scenarios'])

@pytest.mark.parametrize('attendance_type',['Absent','Regularized'])
def test_mc14_legacy_regularized_ar_missing_from_present_quantity(attendance_type):
    """Historical node retained; MC14 v2 intentionally corrects the v1 defect."""
    from workforce_intelligence.kpi_engine import compute_workforce_intelligence_bundle
    correction=data('mc14_correction')
    assert correction['version']=='mc14-v2'
    assert correction['status']=='KNOWN_DEFECT_CORRECTED'
    assert correction['legacy']=={'version':'mc14-legacy-v1','present':0.0,'absent':0.0,'unclassified':1.0,'total':1.0}
    df=pd.DataFrame([{'Employee Number':'SYN_AR','Employee Name':'Synthetic AR','Date':'2026-10-01','Status':'A(R)','Attendance Type':attendance_type,'Quantity':1}])
    result=compute_workforce_intelligence_bundle(df)
    assert result['kpi_3_present_days']==correction['corrected']['present']==1.0
    assert result['kpi_absent_days']==correction['corrected']['absent']==0.0
    assert result['kpi_unclassified_days']==correction['corrected']['unclassified']==0.0
    assert result['attendance_composition_denominator']==correction['corrected']['total']==1.0
    # Original desired-behavior assertions are unchanged; historical evidence is preserved.

def test_scope_manager_employee_and_custom_interval_membership():
    from workforce_intelligence.kpi_engine import compute_workforce_intelligence_bundle
    rows=data('wfh')['rows'];other=dict(rows[1],record_id='SYN_OTHER',observation_id='SYN_OTHER',**{'Employee Number':'SYN_OTHER','Employee Name':'Synthetic Other','Reporting Manager':'SYN_MANAGER_B'})
    df=pd.DataFrame(rows+[other])
    result=compute_workforce_intelligence_bundle(df,manager='SYN_MANAGER_A',employee='SYN001',date_range=(date(2026,10,10),date(2026,10,10)))
    assert result['kpi_1_emp_hc']==1
    assert result['kpi_6_wfh_days']==1.0
    # This is analytical selection, not authorization enforcement.
