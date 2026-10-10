"""Implementation characterization only; passing is NOT HR/business approval.

Expected arithmetic is hand-authored in tests/golden. No snapshots regenerated
from production outputs. Source observations use synthetic stable test IDs.
"""
import json
from datetime import date,datetime,timedelta
from pathlib import Path
import pandas as pd
import pytest
from workforce_intelligence.metrics import build_employee_day_facts,calculate_core_metrics
from workforce_intelligence.policy import evaluate_leave_request,evaluate_policy
from workforce_intelligence.policy_config import DEFAULT_POLICY_CONFIG
from workforce_intelligence.requests import LeaveRequest
from workforce_intelligence.trends import calculate_monthly_attendance,calculate_monthly_approvals,calculate_monthly_compliance,calculate_monthly_working_time
from workforce_intelligence.kpi_engine import compute_wfh_allowance_monthly,compute_punch_deviations_bu

G=Path(__file__).parents[1]/'golden'
def golden(name):return json.loads((G/(name+'.json')).read_text(encoding='utf-8'))
def frame(rows):
    result=pd.DataFrame(rows)
    if 'Date' in result:result['Date']=pd.to_datetime(result['Date']).dt.date
    return result

@pytest.mark.parametrize('metric',['missing_swipe_rate','absence_rate','regularization_rate'])
def test_legacy_attendance_components_and_membership(metric):
    data=golden('attendance');expected=data['expected'];df=frame(data['rows'])
    assert df.record_id.tolist()==expected['included_observation_ids']
    facts=build_employee_day_facts(df)
    def ids(mask):return sorted(facts.loc[mask].apply(lambda r:f"{r['Employee Number']}|{r['Date']}",axis=1))
    assert ids(facts.is_eligible_attendance_day)==expected['eligible_day_ids']
    assert ids(facts.is_eligible_attendance_day & facts.is_metric_evaluable)==expected['evaluable_day_ids']
    point=calculate_monthly_attendance(facts,metric)[0]
    assert (point.numerator,point.denominator,point.excluded_data_quality,point.value,point.period)==(expected['numerators'][metric],5,1,20.0,'2026-10-01')
    split=facts[facts['Employee Number']=='SYN001'].iloc[0]
    assert split.daily_total_quantity==1.0
    assert split.record_count==2

@pytest.mark.parametrize('metric',['missing_swipe_rate','absence_rate','regularization_rate'])
@pytest.mark.parametrize('status,category,expected',[('P','Present',0.0),('WO','Week Off',None)])
def test_legacy_zero_is_distinct_from_null(metric,status,category,expected):
    row=golden('attendance')['rows'][0].copy();row.update({'Status':status,'attendance_category':category,'Attendance Type':category,'Quantity':1})
    point=calculate_monthly_attendance(build_employee_day_facts(frame([row])),metric)[0]
    assert point.value==expected
    assert point.numerator==0
    assert point.denominator==(1 if expected==0 else 0)

@pytest.mark.parametrize('metric,field,count',[('average_approval_turnaround','mean',3),('median_approval_turnaround','median',3),('pending_approval_count','pending_count',3),('average_pending_approval_age','age_mean',2)])
def test_legacy_approval_row_weighting_and_pinned_age(metric,field,count):
    d=golden('approvals');df=frame(d['rows']);e=d['expected']
    assert df[df.approval_state=='APPROVED'].record_id.tolist()==e['approved_ids']
    assert df[df.approval_state=='APPROVED'].approval_turnaround_days.tolist()==e['turnaround_inputs']
    point=calculate_monthly_approvals(df,metric,date.fromisoformat(d['analysis_as_of']))[0]
    assert point.value==e[field]
    assert point.valid_observation_count==count
    assert point.period==e['period']
    assert sum(e['turnaround_inputs'])==e['sum']
    pending=df[df.record_id.isin(e['valid_age_ids'])]
    ages=[(date.fromisoformat(d['analysis_as_of'])-date.fromisoformat(a)).days for a in pending['Applied On']]
    assert ages==e['age_inputs'] and sum(ages)==6

def test_legacy_leave_timing_components_not_compliance_rate():
    d=golden('timing');e=d['expected']
    selected=[r for r in d['requests'] if r['compliance_status']!='DATA_QUALITY_UNCERTAIN' and r['applied_on']]
    assert [r['request_id'] for r in selected]==e['included_request_ids']
    assert [(date.fromisoformat(r['applied_on'])-date.fromisoformat(r['request_start_date'])).days for r in selected]==e['mean_inputs']
    p=calculate_monthly_compliance(pd.DataFrame(),d['requests'],'leave_application_compliance')[0]
    assert (p.value,p.valid_observation_count,p.excluded_data_quality,p.total_applicable)==(.7,3,1,5)
    # Legacy TrendPoint numerator is before+same, NOT the sum for the mean.
    assert (p.numerator,p.denominator,p.rate)==(2,3,66.7)
    assert p.period==e['period']

def test_legacy_wfh_timing_row_components():
    rows=[]
    for i,lag in enumerate([-2,0,4]):
        rows.append({'record_id':f'SYN_WT{i}','Date':date(2026,10,10),'Applied On':date(2026,10,10)+timedelta(days=lag),'policy_event_type':'WFH','compliance_status':'COMPLIANT','application_lag_days':lag})
    p=calculate_monthly_compliance(pd.DataFrame(rows),[],'wfh_application_compliance')[0]
    assert (p.value,p.valid_observation_count,p.numerator,p.denominator)==(.7,3,2,3)

@pytest.mark.parametrize('metric,kind',[('average_effective_hours','duration'),('median_effective_hours','duration'),('average_arrival_time','arrival'),('median_arrival_time','arrival'),('average_exit_time','exit'),('median_exit_time','exit')])
def test_legacy_working_time_units_membership_and_components(metric,kind):
    d=golden('working_time');e=d['expected'];df=frame(d['rows'])
    included=df[df.Status.isin(['P','P(MS)']) & df['In Time'].notna()]
    assert included.record_id.tolist()==e['included_ids']
    p=calculate_monthly_working_time(df,metric)[0]
    assert p.value==e[kind+('_median' if metric.startswith('median') else '_value')] and p.valid_observation_count==3
    assert sum(e[kind+'_inputs'])==e[kind+'_sum']
    assert p.period==e['period']

def make_request(c):
    start=date.fromisoformat(c['start']);applied=None if c['missing_application'] else datetime.combine(start+timedelta(days=c['lag']),datetime.min.time())
    return LeaveRequest(c['id'],'SYN_POLICY','Synthetic Policy','SYN_MANAGER','Privilege Leave' if c['is_pl'] else 'Casual Leave',c['is_pl'],start,start,1,c['quantity'],applied,None,'Pending',None,None if applied is None else c['lag'],None,record_ids=['OBS_'+c['id']],has_data_quality_issue=c['dq'])

@pytest.mark.parametrize('case',golden('policy')['cases'],ids=lambda c:c['id'])
def test_legacy_policy_boundary_and_notice_tiers(case):
    out=evaluate_leave_request(make_request(case),DEFAULT_POLICY_CONFIG)
    assert out['request_id']==case['id']
    assert out['compliance_status']==case['expected_status']
    assert out['policy_rule_code']==case['expected_rule']
    assert out['policy_period']==case['expected_period']

def test_legacy_post_policy_compliance_components():
    d=golden('policy');requests=[]
    for c in d['cases']:
        req=make_request(c);r=req.to_dict();r.update(evaluate_leave_request(req,DEFAULT_POLICY_CONFIG));requests.append(r)
    df,_=evaluate_policy(frame([golden('attendance')['rows'][0]]))
    out=calculate_core_metrics(df,requests,employee_day_facts=build_employee_day_facts(df),analysis_as_of_date=date(2026,10,31))
    e=d['post_policy_aggregate_expected'];p=out['overall_leave_application_compliance']
    assert [r['request_id'] for r in requests if r['policy_compliant'] is True]==e['compliant_request_ids']
    assert (p['total_applicable'],p['excluded_data_quality'],p['numerator'],p['denominator'],p['rate'])==(e['total'],e['excluded_dq'],e['numerator'],e['denominator'],e['rate'])

@pytest.mark.parametrize('lag,expected',[(3,'COMPLIANT'),(4,'NON_COMPLIANT')])
def test_legacy_wfh_policy_lag_boundary(lag,expected):
    row=golden('wfh')['rows'][0].copy()
    row.update({'Date':date(2026,10,10),'Applied On':date(2026,10,10)+timedelta(days=lag),'application_lag_days':lag})
    evaluated,_=evaluate_policy(pd.DataFrame([row]))
    assert evaluated.iloc[0].compliance_status==expected
    assert evaluated.iloc[0].policy_rule_code=='WFH_APPLY_WITHIN_3D'

def test_legacy_wfh_month_quantity_scope_and_transfer_order():
    d=golden('wfh');df=frame(d['rows']);e=d['expected']
    out=compute_wfh_allowance_monthly(df)
    assert out['total_wfh_days']==5.5 and out['total_additional_wfh_days']==.5
    assert {r['calendar_month']:r['eligible_wfh_days'] for r in out['employee_month_breakdown']}==e['monthly_quantities']
    scope=df[df.record_id=='W2']
    scoped=compute_wfh_allowance_monthly(scope,scope_date_range=(date(2026,10,10),date(2026,10,10)),full_dataset_df=df)
    r=scoped['employee_month_breakdown'][0]
    assert (r['wfh_days_in_scope'],r['excess_days'],r['record_ids'],r['business_unit'])==(1.0,.5,['W2'],'SYN_BU_B')
    reverse=compute_wfh_allowance_monthly(df.iloc[::-1])
    assert reverse['employee_month_breakdown'][0]['business_unit']=='SYN_BU_A'

@pytest.mark.parametrize('quantity',[None,0,-1])
def test_legacy_wfh_unknown_or_nonpositive_quantity_becomes_one(quantity):
    r=golden('wfh')['rows'][0].copy();r['Quantity']=quantity
    assert compute_wfh_allowance_monthly(frame([r]))['total_wfh_days']==1.0

@pytest.mark.parametrize('late_minutes,expected_count,expected_deviation',[(660,0,60.0),(662,1,61.0),(1142,0,None)])
def test_legacy_late_arrival_count_is_descriptive_not_rate(late_minutes,expected_count,expected_deviation):
    rows=[]
    for emp,minute in [('SYN_EARLY',540),('SYN_LATE',late_minutes)]:
        rows.append({'Employee Number':emp,'Employee Name':'Synthetic '+emp,'Date':'2026-10-01','Business Unit':'SYN_BU','Attendance Type':'Present','Status':'P','Quantity':1,'In Time':f'{minute//60:02}:{minute%60:02}','Out Time':'23:00'})
    out=compute_punch_deviations_bu(frame(rows))
    late=next(r for r in out['employee_deviations'] if r['employee_id']=='SYN_LATE')
    assert out['late_arrival_employees_count']==expected_count
    assert late['in_deviation_mins']==expected_deviation
    assert late['is_late_arrival']==bool(expected_count)
