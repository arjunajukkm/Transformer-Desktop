"""Offline, source-only full-suite runner. Does not change application semantics.

Run with the locked venv Python and an external --work-dir. Each invocation creates
a fresh isolated source tree, fake home and temporary directory; production data
and dotenv files are never copied. Exit status is pytest's status.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import tempfile
import subprocess
import re

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--work-dir',type=Path,required=True)
    parser.add_argument('--collect-only',action='store_true')
    parser.add_argument('--test',action='append',default=[],help='Optional focused diagnostic node/file; omitted runs complete suite')
    parser.add_argument('--per-file',action='store_true',help='Run EVERY test module in a fresh process to isolate Tk global state')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    args.work_dir.mkdir(parents=True,exist_ok=True)
    run=Path(tempfile.mkdtemp(prefix='baseline-',dir=args.work_dir.resolve()))
    if args.per_file:
        combined={'mode':'per-file','timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'modules':[],'nodeids':[],'reports':[],'collection_errors':[],'source_sha256':{}}
        for test in sorted((root/'tests').rglob('test_*.py')):
            rel=test.relative_to(root).as_posix()
            cmd=[sys.executable,str(Path(__file__).resolve()),'--work-dir',str(run),'--test',rel]
            child=subprocess.run(cmd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,encoding='utf-8',errors='replace',timeout=600)
            (run/(test.stem+'.log')).write_text(child.stdout,encoding='utf-8')
            match=re.search(r'^Evidence: (.+)$',child.stdout,re.M)
            if not match:raise RuntimeError(f'No complete evidence for {rel}; inspect log in {run}')
            result=json.loads(Path(match.group(1).strip()).read_text(encoding='utf-8'))
            combined['modules'].append({'file':rel,'exit_code':child.returncode,'result':str(Path(match.group(1).strip()).relative_to(run))})
            for key in ['nodeids','reports','collection_errors']:combined[key].extend(result[key])
            combined['source_sha256'].update(result['source_sha256'])
            print(rel,child.returncode,flush=True)
        combined['exit_code']=int(any(m['exit_code'] for m in combined['modules']))
        (run/'results.json').write_text(json.dumps(combined,indent=2),encoding='utf-8')
        print('Evidence:',run/'results.json',flush=True)
        return combined['exit_code']
    source=run/'source';source.mkdir()
    paths=list(root.glob('*.py'))+list(root.glob('*.ini'))+list(root.glob('*.spec'))
    for folder in ['tests','workforce_intelligence','storage','ingestion','config']:
        paths += [p for p in (root/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix in {'.py','.json','.csv','.md'}]
    hashes={}
    for p in paths:
        rel=p.relative_to(root);dest=source/rel;dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,dest);hashes[rel.as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
    if (root/'assets').exists():shutil.copytree(root/'assets',source/'assets')
    for name in ['icon.ico','finbox_logo.png']:
        if (root/name).exists():shutil.copy2(root/name,source/name)
    home=run/'synthetic-home';home.mkdir()
    Path.home=classmethod(lambda cls:home)
    os.chdir(source)
    sys.path.insert(0,str(source))
    os.environ['PYTEST_DISABLE_PLUGIN_AUTOLOAD']='1'
    os.environ['PYTHON_DOTENV_DISABLED']='1'
    for key in list(os.environ):
        if key.startswith(('SLACK_','KEKA_')):os.environ.pop(key)
    import dotenv
    dotenv.load_dotenv=lambda *a,**k:False  # python-dotenv 1.0 lacks the env switch
    def offline(*a,**k):raise OSError('Stage2A offline baseline: network disabled')
    socket.socket.connect=offline;socket.socket.connect_ex=offline;socket.create_connection=offline
    import pytest
    class Evidence:
        def __init__(self):self.items=[];self.reports=[];self.collection_errors=[]
        def pytest_collection_modifyitems(self,items):self.items=[i.nodeid for i in items]
        def pytest_collectreport(self,report):
            if report.failed:self.collection_errors.append({'nodeid':report.nodeid,'exception':str(report.longrepr)})
        def pytest_runtest_logreport(self,report):
            self.reports.append({'nodeid':report.nodeid,'when':report.when,'outcome':report.outcome,'duration':report.duration,'exception':str(report.longrepr) if report.longrepr else None})
    evidence=Evidence()
    cmd=['-q','-p','no:cacheprovider','--basetemp',str(run/'tmp'),'--junitxml',str(run/'junit.xml'),'--tb=short']
    if args.collect_only:cmd.append('--collect-only')
    cmd.extend(args.test)
    print('Isolated evidence directory:',run,flush=True)
    status=pytest.main(cmd,plugins=[evidence])
    report={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':int(status),'python':sys.version,'command':cmd,'source_sha256':hashes,'nodeids':evidence.items,'reports':evidence.reports,'collection_errors':evidence.collection_errors,'isolation':{'dotenv':False,'network':False,'plugin_autoload':False,'synthetic_home':True}}
    (run/'results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Evidence:',run/'results.json',flush=True)
    return status

if __name__=='__main__':raise SystemExit(main())
