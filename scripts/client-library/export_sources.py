#!/usr/bin/env python3
"""Export all script/media-bearing SWFs once, with per-source checkpoints."""
import argparse, concurrent.futures, json, os, subprocess, time
from pathlib import Path
from library import VAULT, save_json

RUN=str(time.time_ns())
def run_batch(batch):
    number,lines=batch;jobfile=VAULT/'jobs'/RUN/f'{number:05d}.tsv';jobfile.parent.mkdir(parents=True,exist_ok=True)
    jobfile.write_text('\n'.join(lines)+'\n');log=jobfile.with_suffix('.log')
    command=['java','-Xmx450m','-Djava.awt.headless=true','-cp',f'{VAULT}/tools:/opt/jpexs/26.4.0/lib/*','SourceBatch',str(VAULT),str(jobfile)]
    try:
        with log.open('w') as output:result=subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,timeout=120)
        return {'batch':number,'code':result.returncode,'sources':len(lines),'log':str(log),'jobfile':str(jobfile)}
    except subprocess.TimeoutExpired:return {'batch':number,'code':'timeout','sources':len(lines),'log':str(log),'jobfile':str(jobfile)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int,default=512);parser.add_argument('--workers',type=int,default=2);parser.add_argument('--exclude-list',type=Path);args=parser.parse_args()
    all_jobs=[line for line in (VAULT/'export-jobs.tsv').read_text().splitlines() if line]
    # Decompile application modules first; the remaining raw assets are already
    # indexed and available even while their media/script caches are filling.
    all_jobs.sort(key=lambda line:(0 if line.startswith('root/dll/') else 1 if line.startswith('root/module/') else 2 if any(part in line for part in ['/petcloth/','/NPC/','/restaurant/']) else 3,line))
    pending=[line for line in all_jobs if not (VAULT/'extracted'/line.split('\t')[0]/'complete.txt').exists()]
    excluded=set(json.loads(args.exclude_list.read_text())) if args.exclude_list else set()
    selected=[line for line in pending if line.split('\t')[0] not in excluded]
    if args.limit:selected=selected[:args.limit]
    chunks=[(index,selected[offset:offset+32]) for index,offset in enumerate(range(0,len(selected),32))]
    started=time.time();results=[];complete=len(all_jobs)-len(pending)
    save_json(VAULT/'export-status.json',{'complete':complete==len(all_jobs),'expectedSources':len(all_jobs),'exportedSources':complete,'pendingSources':len(pending)})
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures={pool.submit(run_batch,batch):batch for batch in chunks}
        for future in concurrent.futures.as_completed(futures):
            result=future.result();results.append(result)
            complete=sum((VAULT/'extracted'/line.split('\t')[0]/'complete.txt').exists() for line in all_jobs)
            save_json(VAULT/'export-status.json',{'complete':complete==len(all_jobs),'expectedSources':len(all_jobs),'exportedSources':complete,'pendingSources':len(all_jobs)-complete,'elapsedSeconds':round(time.time()-started,1),'batchesFinished':len(results),'batches':results})
            print(f'Exported {complete}/{len(all_jobs)} script/media sources ({len(results)}/{len(chunks)} batches)',flush=True)
    incomplete=[line.split('\t')[0] for line in all_jobs if not (VAULT/'extracted'/line.split('\t')[0]/'complete.txt').exists()]
    save_json(VAULT/'export-incomplete.json',incomplete)
    print(json.dumps({'complete':not incomplete,'exported':len(all_jobs)-len(incomplete),'incomplete':len(incomplete)}),flush=True)
    failed=[line for line in selected if not (VAULT/'extracted'/line.split('\t')[0]/'complete.txt').exists()]
    if failed:raise SystemExit(1)

if __name__=='__main__':main()
