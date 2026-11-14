#!/usr/bin/env python3
"""Rebuild only the offline adapter; never change any original artwork SWF."""
import argparse,struct,subprocess,tempfile,zlib
from pathlib import Path

root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--ffdec',default='/opt/jpexs/26.4.0/ffdec-cli.jar')
args=parser.parse_args()
with tempfile.TemporaryDirectory(prefix='ram-controller-') as temporary:
    target=Path(temporary)/'controller.swf'
    subprocess.run(['java','-Xmx450m','-jar',args.ffdec,'-replace',str(root/'public/assets/original/official/files/resource/petcloth/swf2/1200026.swf'),str(target),'§1200026_fla§.lamu_mc_1',str(root/'scripts/art/EmbeddedRamHarness.as')],check=True)
    data=target.read_bytes()
    body=zlib.decompress(data[8:]) if data[:3]==b'CWS' else data[8:]
    body=body.replace(b'1200026_fla',b'preview_fla')
    rectangle=(5+4*(body[0]>>3)+7)//8
    bits=16
    encoded=f'{bits:05b}'+''.join(f'{value:0{bits}b}' for value in [0,25600,0,27648])
    encoded+='0'*((-len(encoded))%8)
    body=int(encoded,2).to_bytes(len(encoded)//8,'big')+body[rectangle:]
    assert b'previewTextCount' in body and b'cleanFrame' in body and b'EXIT_FRAME' in body
    destination=root/'public/assets/original/official/controller.swf'
    destination.write_bytes(b'CWS'+data[3:4]+struct.pack('<I',len(body)+8)+zlib.compress(body))
    print(f'Updated adapter: {destination.name} ({destination.stat().st_size} bytes); original sources unchanged')
