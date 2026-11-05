#!/usr/bin/env python3
"""Report actual exported files, source-level failures and bytecode fallbacks."""
import collections,json
from pathlib import Path
from library import VAULT,save_json

def main():
    counts=collections.Counter();byte_counts=collections.Counter();warnings=[];empty_audio=[];fallbacks=[];embedded_swfs=[];errors=[];image_sources=set();binary_sources=set()
    for file in (VAULT/'extracted').rglob('*'):
        if not file.is_file():continue
        suffix=file.suffix.lower();length=file.stat().st_size;counts[suffix]+=1;byte_counts[suffix]+=length
        source,separator,export=file.relative_to(VAULT/'extracted').as_posix().partition('.swf/')
        if separator and length:
            if export.startswith('images/'):image_sources.add(source+'.swf')
            if export.startswith('binaryData/'):binary_sources.add(source+'.swf')
        if suffix in ('.as','.pcode'):
            text=file.read_text(errors='replace')
            if any(marker in text for marker in ['Error during decompilation','Decompilation error','Decompilation timeout']):warnings.append(str(file.relative_to(VAULT/'extracted')))
        if suffix in ('.wav','.mp3') and length<=44:empty_audio.append(str(file.relative_to(VAULT/'extracted')))
        if suffix=='.bin':
            with file.open('rb') as stream:signature=stream.read(3)
            if signature in (b'FWS',b'CWS',b'ZWS'):embedded_swfs.append(str(file.relative_to(VAULT/'extracted')))
        if file.name=='complete.txt' and 'fallback' in file.read_text():fallbacks.append(str(file.parent.relative_to(VAULT/'extracted')))
        if file.name=='error.txt':errors.append({'path':str(file.parent.relative_to(VAULT/'extracted')),'error':file.read_text(errors='replace')})
    jobs=[line for line in (VAULT/'export-jobs.tsv').read_text().splitlines() if line]
    missing=[line.split('\t')[0] for line in jobs if not (VAULT/'extracted'/line.split('\t')[0]/'complete.txt').exists()]
    missing_media=[]
    for line in jobs:
        relative,flags=line.split('\t')
        if relative in missing:continue
        if 'i' in flags and relative not in image_sources:missing_media.append({'path':relative,'type':'images'})
        if 'b' in flags and relative not in binary_sources:missing_media.append({'path':relative,'type':'binaryData'})
    warning_sources=sorted({name.split('.swf/')[0]+'.swf' for name in warnings})
    uncovered=[name for name in warning_sources if not (VAULT/'extracted'/name/'pcode/complete.txt').exists()]
    result={'source':json.loads((VAULT/'source-status.json').read_text()),'index':json.loads((VAULT/'index-status.json').read_text()),'exportSources':len(jobs),'exportedSources':len(jobs)-len(missing),'incompleteSources':missing,'missingDeclaredMedia':missing_media,'exportErrors':errors,'fileCounts':dict(counts),'bytesByType':dict(byte_counts),'highLevelScriptWarnings':warnings,'highLevelWarningSources':warning_sources,'warningsWithoutPcode':uncovered,'pcodeFallbackSources':fallbacks,'emptyAudioHeaders':empty_audio,'validEmbeddedAudioFiles':counts['.mp3']+counts['.wav']-len(empty_audio),'unexpandedEmbeddedSwfs':embedded_swfs,'complete':not missing and not missing_media and not uncovered and not errors}
    save_json(VAULT/'export-audit.json',result);print(json.dumps({key:value for key,value in result.items() if key not in ['source','index','highLevelScriptWarnings','emptyAudioHeaders','incompleteSources']},ensure_ascii=False,indent=2));print('Incomplete:',len(missing),'High-level warnings:',len(warnings),'Empty audio headers:',len(empty_audio))
    if not result['complete']:raise SystemExit(1)
if __name__=='__main__':main()
