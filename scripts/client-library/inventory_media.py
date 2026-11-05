#!/usr/bin/env python3
"""Compare exported image counts and binary payloads with original SWF tags."""
import collections,hashlib,json,struct
from library import VAULT,save_json,swf_body

def binary_payloads(source):
    body,start,_,_=swf_body(source.read_bytes());payloads={}
    def walk(position,end):
        while position<end:
            head=struct.unpack_from('<H',body,position)[0];position+=2;code=head>>6;length=head&63
            if length==63:length=struct.unpack_from('<I',body,position)[0];position+=4
            stop=position+length
            if code==87:payloads[struct.unpack_from('<H',body,position)[0]]=body[position+6:stop]
            if code==39:walk(position+4,stop)
            position=stop
            if not code:break
    walk(start,len(body));return payloads

def main():
    counts=collections.Counter();mismatches=[];duplicates=[]
    for line in (VAULT/'export-jobs.tsv').read_text().splitlines():
        relative,flags=line.split('\t');destination=VAULT/'extracted'/relative
        if 'i' in flags:
            tags=json.loads((VAULT/'timelines'/(relative+'.json')).read_text())['tagCounts']
            expected=sum(tags.get(str(code),0) for code in [6,20,21,35,36,90])
            actual=sum(file.is_file() for file in (destination/'images').rglob('*'))
            counts['expectedImages']+=expected;counts['exportedImages']+=actual
            if expected!=actual:mismatches.append({'path':relative,'type':'images','expected':expected,'actual':actual})
        if 'b' in flags:
            source=VAULT/'normalized'/relative
            if not source.exists():source=VAULT/'raw'/relative
            payloads=binary_payloads(source);digests={hashlib.sha256(data).hexdigest() for data in payloads.values()}
            counts['expectedBinaryPayloads']+=len(payloads);used=set()
            for cid,data in payloads.items():
                # Early JPEXS exports include the linkage after the numeric ID.
                # Match both naming schemes against the original tag bytes.
                candidates=[destination/'binaryData'/f'{cid}.bin',*sorted((destination/'binaryData').glob(f'{cid}_*.bin'))]
                matched=next((file for file in candidates if file.is_file() and file.read_bytes()==data),None)
                if matched:counts['verifiedBinaryPayloads']+=1;used.add(matched)
                else:mismatches.append({'path':relative,'type':'binaryData','character':cid})
            for file in (destination/'binaryData').glob('*'):
                if file in used:continue
                digest=hashlib.sha256(file.read_bytes()).hexdigest()
                if digest in digests:duplicates.append(str(file.relative_to(VAULT/'extracted')))
                else:mismatches.append({'path':relative,'type':'unexpectedBinaryExport','name':file.name})
    result={'counts':dict(counts),'mismatches':mismatches,'legacyBinaryCopies':duplicates,'complete':not mismatches}
    save_json(VAULT/'media-inventory.json',result);print(json.dumps(result,ensure_ascii=False,indent=2))
    if mismatches:raise SystemExit(1)

if __name__=='__main__':main()
