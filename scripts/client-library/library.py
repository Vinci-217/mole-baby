#!/usr/bin/env python3
"""Verified local mirror, lossless SWF timeline catalogue and resumable exports."""
import argparse, collections, hashlib, json, lzma, os, sqlite3, struct, tarfile, time, zlib
from pathlib import Path

REPO=Path(__file__).resolve().parents[2]
VAULT=REPO/'local-assets'
REVISION='7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff'

def save_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.part');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temporary.replace(path)

def inventory():
    value=json.loads((VAULT/'source-tree.json').read_text())
    if value.get('truncated'):raise ValueError('Source inventory is truncated')
    return {entry['path']:entry for entry in value['tree'] if entry['type']=='blob'}

def verified(data,entry):
    return len(data)==entry['size'] and hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==entry['sha']

def import_source():
    entries=inventory();seen=set();total=0;started=time.time()
    with tarfile.open(VAULT/'source.tar.gz','r|gz') as archive:
        for member in archive:
            if not member.isfile():continue
            relative=member.name.partition('/')[2]
            if relative not in entries:raise ValueError(f'Unexpected archive entry: {relative}')
            if relative in seen:raise ValueError(f'Duplicate archive entry: {relative}')
            destination=(VAULT/'raw'/relative).resolve()
            if not destination.is_relative_to((VAULT/'raw').resolve()):raise ValueError('Unsafe archive path')
            entry=entries[relative]
            if member.size!=entry['size']:raise ValueError(f'Wrong archive length: {relative}')
            stream=archive.extractfile(member);data=stream.read()
            if not verified(data,entry):raise ValueError(f'Git blob mismatch: {relative}')
            destination.parent.mkdir(parents=True,exist_ok=True)
            if not destination.exists() or not verified(destination.read_bytes(),entry):
                temporary=destination.with_name(destination.name+'.part');temporary.write_bytes(data);temporary.replace(destination)
            seen.add(relative);total+=len(data)
            if len(seen)%500==0:
                save_json(VAULT/'source-status.json',{'complete':False,'verifiedFiles':len(seen),'expectedFiles':len(entries),'bytes':total,'revision':REVISION})
                print(f'Verified {len(seen)}/{len(entries)} source files',flush=True)
    missing=sorted(set(entries)-seen)
    if missing:raise ValueError(f'Missing {len(missing)} source files: {missing[:5]}')
    result={'complete':True,'verifiedFiles':len(seen),'expectedFiles':len(entries),'bytes':total,'revision':REVISION,'elapsedSeconds':round(time.time()-started,2),'verification':'Every file size and Git blob SHA-1 matched the pinned GitHub tree'}
    save_json(VAULT/'source-status.json',result);print(json.dumps(result),flush=True)

def swf_body(data):
    if len(data)<12:raise ValueError('Truncated SWF header')
    signature=data[:3];length=struct.unpack_from('<I',data,4)[0]
    if signature==b'FWS':body=data[8:]
    elif signature==b'CWS':body=zlib.decompress(data[8:])
    elif signature==b'ZWS':
        properties=data[12:17];prop=properties[0];lc=prop%9;prop//=9;lp=prop%5;pb=prop//5
        body=lzma.decompress(data[17:],format=lzma.FORMAT_RAW,filters=[{'id':lzma.FILTER_LZMA1,'lc':lc,'lp':lp,'pb':pb,'dict_size':struct.unpack_from('<I',properties,1)[0]}])
    else:raise ValueError(f'Unexpected SWF signature: {signature!r}')
    if len(body)!=length-8:raise ValueError(f'SWF length mismatch: {len(body)} != {length-8}')
    bits=body[0]>>3;offset=(5+4*bits+7)//8
    fps=struct.unpack_from('<H',body,offset)[0]/256;frames=struct.unpack_from('<H',body,offset+2)[0]
    return body,offset+4,fps,frames

def decode_swf(data):
    body,offset,fps,frames=swf_body(data)
    timelines=[];symbols={};counts=collections.Counter();has_scripts=False
    def tags(start,end,sprite,frame_count):
        nonlocal has_scripts
        position=start;frame=0;labels=[];placements=[]
        while position<end:
            if position+2>end:raise ValueError('Truncated tag header')
            head=struct.unpack_from('<H',body,position)[0];position+=2;code=head>>6;size=head&63
            if size==63:
                if position+4>end:raise ValueError('Truncated long tag header')
                size=struct.unpack_from('<I',body,position)[0];position+=4
            stop=position+size
            if stop>end:raise ValueError(f'Tag {code} exceeds timeline boundary')
            payload=body[position:stop];counts[code]+=1
            if code in (12,59,72,82):has_scripts=True
            if code==39:
                child,child_frames=struct.unpack_from('<HH',payload)
                tags(position+4,stop,child,child_frames)
            elif code==43:labels.append({'name':payload.split(b'\0',1)[0].decode('utf-8','replace'),'frame':frame})
            elif code in (56,76):
                count=struct.unpack_from('<H',payload)[0];cursor=2
                for _ in range(count):
                    cid=struct.unpack_from('<H',payload,cursor)[0];cursor+=2;last=payload.index(0,cursor)
                    symbols[str(cid)]=payload[cursor:last].decode('utf-8','replace');cursor=last+1
            elif code==4 and len(payload)>=4:placements.append({'frame':frame,'character':struct.unpack_from('<H',payload)[0],'depth':struct.unpack_from('<H',payload,2)[0]})
            elif code==26 and len(payload)>=3 and payload[0]&2:
                placements.append({'frame':frame,'character':struct.unpack_from('<H',payload,3)[0],'depth':struct.unpack_from('<H',payload,1)[0]})
            elif code in (70,94) and len(payload)>=4 and payload[0]&2:
                cursor=4
                if payload[1]&8 and (payload[1]&16 or payload[0]&2):cursor=payload.index(0,cursor)+1
                placements.append({'frame':frame,'character':struct.unpack_from('<H',payload,cursor)[0],'depth':struct.unpack_from('<H',payload,2)[0]})
            if code==1:frame+=1
            position=stop
            if code==0:break
        timelines.append({'sprite':sprite,'frames':frame_count,'labels':labels,'placements':placements})
    tags(offset,len(body),0,frames)
    for timeline in timelines:timeline['symbol']=symbols.get(str(timeline['sprite']),'')
    return {'fps':fps,'frames':frames,'timelines':timelines,'symbols':symbols,'tagCounts':dict(counts),'hasScripts':has_scripts,'hasImages':any(counts[n] for n in (6,20,21,35,36,90)),'hasSound':any(counts[n] for n in (14,18,19,45)),'hasBinary':bool(counts[87])}

def index_source():
    status=json.loads((VAULT/'source-status.json').read_text())
    if not status['complete']:raise ValueError('Source import has not completed')
    database=sqlite3.connect(VAULT/'catalog.sqlite');database.execute('PRAGMA journal_mode=WAL')
    database.execute('CREATE TABLE IF NOT EXISTS assets(path TEXT PRIMARY KEY,kind TEXT,bytes INTEGER,sha TEXT,category TEXT,fps REAL,frames INTEGER,timelines INTEGER,scripts INTEGER,images INTEGER,sound INTEGER,binary INTEGER,status TEXT,error TEXT,search TEXT)')
    entries=inventory();summary=collections.Counter();jobs=[];started=time.time()
    for index,(relative,entry) in enumerate(entries.items()):
        source=VAULT/'raw'/relative;kind=source.suffix[1:].lower();category='/'.join(relative.split('/')[:3]);info={};error=''
        if kind=='swf':
            try:
                data=source.read_bytes()
                if relative.startswith('root/version/') and data[:3] not in (b'FWS',b'CWS',b'ZWS'):
                    payload=zlib.decompress(data[8:]);target=VAULT/'decoded'/(relative+'.bin');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(payload)
                    info={'format':'compressed-version-data, not a visual SWF','decompressedBytes':len(payload),'fps':0,'frames':0,'timelines':[],'symbols':{},'hasScripts':False,'hasImages':False,'hasSound':False,'hasBinary':False}
                    summary['versionContainers']+=1
                elif data[:3] not in (b'FWS',b'CWS',b'ZWS'):
                    # A public module has a custom prefix before its complete
                    # standard zlib SWF body. Keep the raw file untouched and
                    # record the exact recovery instead of silently skipping it.
                    recovered=None
                    for offset in range(8,min(64,len(data)-2)):
                        try:
                            body=zlib.decompress(data[offset:]);candidate=b'FWS\x09'+struct.pack('<I',len(body)+8)+body;decoded=decode_swf(candidate)
                            recovered=(offset,candidate,decoded);break
                        except (ValueError,zlib.error,struct.error,IndexError):pass
                    if recovered is None:raise ValueError('Unknown nonstandard SWF container')
                    offset,candidate,info=recovered;target=VAULT/'normalized'/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(candidate)
                    info['containerRecovery']={'zlibOffset':offset,'header':'FWS version 9 header constructed around the verified decompressed body','originalPreserved':True};summary['recoveredContainers']+=1
                else:info=decode_swf(data)
                save_json(VAULT/'timelines'/(relative+'.json'),info)
                animated=sum(t['frames']>1 for t in info['timelines']);summary['animatedTimelines']+=animated
                summary['labelledTimelines']+=sum(bool(t['labels']) for t in info['timelines'])
                flags=''.join(k for k,test in [('s',info['hasScripts']),('i',info['hasImages']),('a',info['hasSound']),('b',info['hasBinary'])] if test)
                if flags:jobs.append(f'{relative}\t{flags}')
            except Exception as exc:error=f'{type(exc).__name__}: {exc}';summary['indexErrors']+=1
        summary[kind]+=1;summary['files']+=1
        search=' '.join([relative]+[value for value in info.get('symbols',{}).values()]+[l['name'] for t in info.get('timelines',[]) for l in t['labels']])
        database.execute('INSERT OR REPLACE INTO assets VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(relative,kind,entry['size'],entry['sha'],category,info.get('fps'),info.get('frames'),len(info.get('timelines',[])),int(info.get('hasScripts',False)),int(info.get('hasImages',False)),int(info.get('hasSound',False)),int(info.get('hasBinary',False)),'error' if error else 'indexed',error,search))
        if index%500==0:
            database.commit();save_json(VAULT/'index-status.json',dict(summary,complete=False));print(f'Indexed {index+1}/{len(entries)}',flush=True)
    database.commit();database.close()
    (VAULT/'export-jobs.tsv').write_text('\n'.join(jobs)+'\n')
    result=dict(summary,complete=True,exportJobs=len(jobs),elapsedSeconds=round(time.time()-started,2));save_json(VAULT/'index-status.json',result);print(json.dumps(result),flush=True)

def verify_source():
    errors=[];entries=inventory()
    for relative,entry in entries.items():
        file=VAULT/'raw'/relative
        if not file.is_file() or not verified(file.read_bytes(),entry):errors.append(relative)
    result={'files':len(entries),'errors':errors,'complete':not errors};save_json(VAULT/'verification.json',result);print(json.dumps(result))
    if errors:raise ValueError(f'{len(errors)} source files failed verification')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['import','index','verify']);args=parser.parse_args()
    {'import':import_source,'index':index_source,'verify':verify_source}[args.command]()
