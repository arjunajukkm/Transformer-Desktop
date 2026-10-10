"""Structural contract checks, not runtime formula tests or business approval."""
import ast
import json
from pathlib import Path

def test_contracts_have_required_fields_and_real_test_references():
    root=Path(__file__).parents[2]
    data=json.loads((root/'tests/golden/metric_contracts.json').read_text(encoding='utf-8'))
    required={'metric_id','legacy_current_name','grain','unit','numerator','denominator','eligibility','date_attribution','aggregation_behavior','policy_dependency','dq_behavior','unknown_null_behavior','formatting','comparison_direction','allowed_existing_dimensions','source_implementation','known_limitations','golden_fixture_references','test_reference','business_approval'}
    assert len(data['metrics'])==20
    assert len({m['metric_id'] for m in data['metrics']})==20
    for metric in data['metrics']:
        assert required<=metric.keys()
        path,name=metric['test_reference'].split('::')
        tree=ast.parse((root/path).read_text(encoding='utf-8'))
        assert name in {n.name for n in ast.walk(tree) if isinstance(n,ast.FunctionDef)}
        assert metric['business_approval']=='NOT_ASSERTED'

def test_all_golden_artifacts_are_declared_synthetic_or_test_only():
    golden=Path(__file__).parents[1]/'golden'
    for path in golden.glob('*.json'):
        data=json.loads(path.read_text(encoding='utf-8'))
        assert data.get('synthetic') is True or data.get('kind')=='TEST_ONLY_NOT_RUNTIME_SEMANTIC_ENGINE'
