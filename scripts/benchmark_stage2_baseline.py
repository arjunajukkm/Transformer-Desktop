"""Small synthetic comparison harness only; does not establish G08/G11.

Run separately from tests, once per scale in a fresh process. No input workbooks,
UI, network or export. Memory is sampled Windows working set, NOT peak memory.
"""
import argparse
import gc
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--rows',type=int,choices=[10000,100000],required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    from scripts.benchmark_snapshot_engine import generate_synthetic_dataset
    from scripts.benchmark_data_foundation_memory import get_process_working_set_mb
    from storage import create_snapshot,TimeSeriesSnapshotService,CacheManager
    from workforce_intelligence.snapshot_bridge import WorkforceIntelligenceBridge
    df=generate_synthetic_dataset(args.rows//20,20)
    gc.collect();start_rss=get_process_working_set_mb();start=time.perf_counter()
    snap=create_snapshot(df);prep=time.perf_counter()-start
    service=TimeSeriesSnapshotService(CacheManager());service.cache_manager.set_active_snapshot(snap)
    bridge=WorkforceIntelligenceBridge(service)
    report={'kind':'SMALL_BASELINE_NOT_ENTERPRISE_SLO','python':sys.version,'platform':platform.platform(),'logical_cpus':os.cpu_count(),'packages':{n:importlib.metadata.version(n) for n in ['numpy','pandas','pytest','pyarrow']},'seed':42,'rows':len(df),'employees':args.rows//20,'days':20,'business_units':5,'departments':5,'managers':9,'generator_sha256':hashlib.sha256((ROOT/'scripts/benchmark_snapshot_engine.py').read_bytes()).hexdigest(),'cold_definition':'fresh application process/bridge; OS cache not flushed','warm_definition':'repeat identical bridge request immediately','memory_method':'Windows sampled WorkingSetSize MiB, not peak','snapshot_seconds':prep,'rss_before_MiB':start_rss,'rss_after_snapshot_MiB':get_process_working_set_mb(),'input_frame_MiB':df.memory_usage(deep=True).sum()/2**20,'snapshot_frame_MiB':snap.fact_df.memory_usage(deep=True).sum()/2**20,'steps':[]}
    for label,call in [('cold_overview',lambda:bridge.get_workforce_metrics()),('warm_overview',lambda:bridge.get_workforce_metrics()),('cold_bu',lambda:bridge.get_workforce_metrics(business_unit='Engineering')),('warm_bu',lambda:bridge.get_workforce_metrics(business_unit='Engineering')),('cold_trend',lambda:bridge.get_trend_intelligence()),('warm_trend',lambda:bridge.get_trend_intelligence())]:
        start=time.perf_counter();call()
        report['steps'].append({'step':label,'seconds':time.perf_counter()-start,'sampled_rss_MiB':get_process_working_set_mb()})
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(args.output)

if __name__=='__main__':main()
