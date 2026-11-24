#!/usr/bin/env python3
"""Keep original page registration and button geometry without changing artwork."""
import json
import shutil
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
VAULT=ROOT/'local-assets'
OUT=ROOT/'public/assets/original/reading-books'
EVIDENCE=ROOT/'artifacts/bookshelf-integration-20261117'
EVIDENCE.mkdir(exist_ok=True,parents=True)
CP=str(VAULT/'tools')+':/opt/jpexs/26.4.0/lib/*'
subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-cp','/opt/jpexs/26.4.0/lib/ffdec_lib.jar','-d',str(VAULT/'tools'),str(ROOT/'scripts/client-library/BookLayoutProbe.java')],check=True)
layouts={}
for book in json.loads((OUT/'catalog.json').read_text()):
    key=book['id']
    if key not in ['life','study','supplies','food','classroom','secret']:
        # Extended books have their own selected reading frames and registration.
        # Reusing those avoids looking for a nonexistent six-book export receipt.
        layout=json.loads((VAULT/'reading-library'/key/'layout.json').read_text())
        if len(layout['frames'])!=len(book['pages']):
            raise ValueError('Incomplete extended book geometry: '+key)
        layouts[key]=layout
        continue
    receipt=json.loads((VAULT/'ram-inventory/books'/key/'render-source.json').read_text())
    source=VAULT/receipt['source'].lstrip('/')
    work=EVIDENCE/'layout-work'/key
    work.mkdir(exist_ok=True,parents=True)
    files=sorted(work.rglob('*.png'),key=lambda p:int(p.stem))
    if len(files)!=len(book['pages']):
        subprocess.run(['java','-Xmx300m','-Djava.awt.headless=true','-cp',CP,'SourceExporter','frame',str(source),str(work),str(receipt['sprite']),'-1','1'],check=True,timeout=90,stdout=subprocess.DEVNULL)
        files=sorted(work.rglob('*.png'),key=lambda p:int(p.stem))
    probe=json.loads(subprocess.check_output(['java','-Xmx300m','-Djava.awt.headless=true','-cp',CP,'BookLayoutProbe',str(source),str(receipt['sprite'])],text=True,timeout=40))
    output=EVIDENCE/(key+'-layout.json')
    subprocess.run(['node',str(ROOT/'scripts/client-library/measure_reading_layout.cjs')],input=json.dumps(dict(files=[str(p)for p in files],saved=str(OUT/key),probe=probe,output=str(output))),text=True,check=True,timeout=90)
    layouts[key]=json.loads(output.read_text())
    print(json.dumps(dict(id=key,viewport=layouts[key]['viewport'],controls=sorted({c['name']for f in layouts[key]['frames']for c in f['controls']}))),flush=True)
    shutil.rmtree(work)
(OUT/'layout.json').write_text(json.dumps(layouts,ensure_ascii=False,indent=2)+'\n')
