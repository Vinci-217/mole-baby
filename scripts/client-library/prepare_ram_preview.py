#!/usr/bin/env python3
"""Prepare the local Ruffle viewer without modifying any source SWF."""
import hashlib,json,shutil,struct,subprocess,zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'local-assets/ram-official-sweep/2026-11-06'

def main():
    source=OUT/'files/resource/petcloth/swf2/1200026.swf'
    destination=OUT/'preview-harness.swf'
    subprocess.run(['java','-Xmx450m','-jar','/opt/jpexs/26.4.0/ffdec-cli.jar',
        '-replace',str(source),str(destination),'§1200026_fla§.lamu_mc_1',
        str(ROOT/'scripts/client-library/RamPreviewHarness.as')],check=True)
    data=destination.read_bytes()
    body=zlib.decompress(data[8:]) if data[:3]==b'CWS' else data[8:]
    # Same-length namespace rename in the derived viewer only. The loaded
    # original Ebook must not resolve its main class to the viewer adapter.
    body=body.replace(b'1200026_fla',b'preview_fla')
    old_rect=(5+4*(body[0]>>3)+7)//8
    # A stable 960 x 560 stage; the source library stage isn't a useful viewport.
    bits=16
    encoded=f'{bits:05b}'+''.join(f'{v:0{bits}b}' for v in [0,960*20,0,560*20])
    encoded+='0'*((-len(encoded))%8)
    rect=int(encoded,2).to_bytes(len(encoded)//8,'big')
    body=rect+body[old_rect:]
    destination.write_bytes(b'CWS'+data[3:4]+struct.pack('<I',len(body)+8)+zlib.compress(body))
    dependency=ROOT/'artifacts/original-reading-runtime/ruffle'
    target=OUT/'ruffle';target.mkdir(exist_ok=True)
    for path in dependency.iterdir():
        if path.is_file() and (path.suffix in ['.js','.wasm'] or path.name.startswith('LICENSE') or path.name in ['package.json','README.md']):
            shutil.copyfile(path,target/path.name)
    for name in ['ram-preview.html','ram-catalog.html']:
        shutil.copyfile(ROOT/'scripts/client-library'/name,OUT/('preview.html' if name=='ram-preview.html' else 'index.html'))
    shutil.copyfile(ROOT/'scripts/client-library/RamPreviewHarness.as',OUT/'preview-harness.as')
    record={'engine':'@ruffle-rs/ruffle@'+json.loads((dependency/'package.json').read_text())['version'],
        'source':'resource/petcloth/swf2/1200026.swf','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'harnessSha256':hashlib.sha256(destination.read_bytes()).hexdigest(),
        'adaptation':'Separate generic stage adapter compiled from RamPreviewHarness.as. Displayed assets are loaded from unchanged files/. LamuUIManage direction and petBone events select and synchronize the original timelines; no artwork or interpolated frames are generated.'}
    (OUT/'preview-source.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    print('Prepared offline animation preview:',destination)

if __name__=='__main__':main()
