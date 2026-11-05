#!/usr/bin/env python3
"""Recover completed timed-out batches individually, retaining bytecode if needed."""
import argparse,concurrent.futures,subprocess,time,json
from pathlib import Path
from library import VAULT,save_json

def recover(line,pcode_only=False):
    relative,flags=line.split('\t');destination=VAULT/'extracted'/relative;marker=destination/'complete.txt'
    if marker.exists() and (not pcode_only or (destination/'pcode/complete.txt').exists()):return {'path':relative,'state':'cached'}
    key=__import__('hashlib').sha1(relative.encode()).hexdigest()[:16];jobs=VAULT/'retries';jobs.mkdir(exist_ok=True)
    for fallback in ([True] if pcode_only else [False,True]):
        export_flags='sp' if marker.exists() and fallback else flags+('p' if fallback else '')
        job=jobs/(key+('-pcode' if fallback else '')+'.tsv');job.write_text(relative+'\t'+export_flags+'\n')
        try:
            with job.with_suffix('.log').open('w') as log:subprocess.run(['java','-Xmx650m','-Djava.awt.headless=true','-cp',f'{VAULT}/tools:/opt/jpexs/26.4.0/lib/*','SourceBatch',str(VAULT),str(job)],stdout=log,stderr=log,timeout=90 if not fallback else 120)
            if marker.exists() and (not fallback or (destination/'pcode/complete.txt').exists()):return {'path':relative,'state':'pcode' if fallback else 'source'}
        except subprocess.TimeoutExpired:pass
    return {'path':relative,'state':'incomplete'}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--finished-batches-only',action='store_true');parser.add_argument('--pcode-only',action='store_true');parser.add_argument('--path',action='append',default=[]);parser.add_argument('--limit',type=int,default=0);args=parser.parse_args()
    lines=(VAULT/'export-jobs.tsv').read_text().splitlines();eligible=None
    if args.finished_batches_only:
        status=json.loads((VAULT/'export-status.json').read_text());eligible=set()
        for batch in status.get('batches',[]):
            if batch['code']!='timeout':continue
            for line in Path(batch.get('jobfile',VAULT/'jobs'/f"{batch['batch']:05d}.tsv")).read_text().splitlines():eligible.add(line.split('\t')[0])
    pending=[]
    for line in lines:
        if not line:continue
        relative=line.split('\t')[0];destination=VAULT/'extracted'/relative
        if eligible is not None and relative not in eligible:continue
        if args.path and relative not in args.path:continue
        if (destination/'complete.txt').exists() and not (args.pcode_only and args.path and not (destination/'pcode/complete.txt').exists()):continue
        pending.append(line)
    if args.limit:pending=pending[:args.limit]
    print('Recovering',len(pending),'sources independently',flush=True);results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=1 if args.finished_batches_only else 2) as pool:
        for result in pool.map(lambda line:recover(line,args.pcode_only),pending):
            results.append(result);save_json(VAULT/'retry-status.json',{'results':results,'expected':len(pending)});print(result,flush=True)
    if any(result['state']=='incomplete' for result in results):raise SystemExit(1)
if __name__=='__main__':main()
