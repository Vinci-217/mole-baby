#!/usr/bin/env python3
"""Local, read-only source browser with a bounded cached frame renderer."""
import argparse,concurrent.futures,hashlib,json,mimetypes,shutil,sqlite3,subprocess,threading,time
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
ROOT=Path(__file__).resolve().parent
if ROOT.name=='client-library':ROOT=ROOT.parents[1]/'local-assets'
POOL=concurrent.futures.ThreadPoolExecutor(max_workers=1);JOBS={};LOCK=threading.Lock()
def read_json(path,default=None):
    try:return json.loads(Path(path).read_text())
    except (FileNotFoundError,json.JSONDecodeError):return default
def database():
    connection=sqlite3.connect(f'file:{ROOT}/catalog.sqlite?mode=ro',uri=True);connection.row_factory=sqlite3.Row;return connection
def asset(relative):
    with database() as connection:return connection.execute('SELECT * FROM assets WHERE path=?',(relative,)).fetchone()
def contained(relative):
    path=(ROOT/relative).resolve()
    if not path.is_relative_to(ROOT.resolve()):raise ValueError('Invalid path')
    return path
def render(key,relative,sprite,frame):
    destination=ROOT/'previews'/key;destination.mkdir(parents=True,exist_ok=True)
    try:
        source=ROOT/'normalized'/relative
        if not source.exists():source=ROOT/'raw'/relative
        info=read_json(ROOT/'timelines'/(relative+'.json'));timeline=next(t for t in info['timelines'] if t['sprite']==sprite)
        fps=info['fps'] or 24;count=min(120,max(1,timeline['frames']))
        if frame is not None:
            # A label is one state on the outer timeline. Advance its nested
            # timelines, rather than accidentally playing the next direction.
            active={}
            for place in timeline['placements']:
                if place['frame']<=frame:active[place['depth']]=place['character']
            lengths={t['sprite']:t['frames'] for t in info['timelines']}
            count=min(120,max([15]+[lengths.get(cid,1) for cid in active.values()]))
            command=['java','-Xmx450m','-Djava.awt.headless=true','-cp',f'{ROOT}/tools:/opt/jpexs/26.4.0/lib/*','SourceExporter','nested',str(source),str(destination/'frames'),str(sprite),str(frame),str(count),'2']
        else:
            command=['java','-Xmx450m','-Djava.awt.headless=true','-jar','/opt/jpexs/26.4.0/ffdec-cli.jar']
            if sprite:command+=['-selectid',str(sprite)]
            command+=['-select',f'{sprite}:1-{count}' if sprite else f'1-{count}','-zoom','2','-ignorebackground','-export','sprite' if sprite else 'frame',str(destination/'frames'),str(source)]
        with (destination/'render.log').open('w') as log:subprocess.run(command,stdout=log,stderr=log,check=True,timeout=90)
        files=sorted((destination/'frames').rglob('*.png'),key=lambda p:(int(p.parent.name) if p.parent.name.isdigit() else 0,int(p.stem)))
        if not files:raise ValueError('The selected timeline did not produce frames')
        sequence=destination/'sequence';sequence.mkdir(exist_ok=True)
        for index,path in enumerate(files):shutil.copyfile(path,sequence/f'{index:04d}.png')
        subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(min(60,max(1,fps))),'-i',str(sequence/'%04d.png'),'-frames:v',str(len(files)),'-filter_complex','split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',str(destination/'preview.gif')],check=True,capture_output=True,timeout=90)
        result={'state':'ready','url':f'/previews/{key}/preview.gif','frames':len(files),'limited':frame is None and timeline['frames']>count,'note':'原时间轴栅格预览；原客户端交互、分层和配色需按脚本组合。'}
        (destination/'result.json').write_text(json.dumps(result,ensure_ascii=False));JOBS[key]=result
    except Exception as error:JOBS[key]={'state':'error','error':str(error),'note':'原文件与时间轴仍已完整保存；该片段需按客户端脚本组合。'}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,format,*args):pass
    def json(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        url=urlsplit(self.path);query=parse_qs(url.query)
        try:
            if url.path=='/api/status':return self.json({'source':read_json(ROOT/'source-status.json',{}),'index':read_json(ROOT/'index-status.json',{}),'export':read_json(ROOT/'export-status.json',{}),'audit':read_json(ROOT/'export-audit.json',{}),'demo':(ROOT/'demo/restaurant-loop.mp4').exists()})
            if url.path=='/api/search':
                text=query.get('q',[''])[0][:200];kind=query.get('kind',[''])[0];page=max(0,int(query.get('page',['0'])[0]));where='search LIKE ?';arguments=['%'+text+'%']
                if kind:where+=' AND kind=?';arguments.append(kind)
                with database() as connection:
                    total=connection.execute('SELECT count(*) FROM assets WHERE '+where,arguments).fetchone()[0]
                    rows=connection.execute('SELECT path,kind,bytes,category,fps,frames,timelines,scripts,images,sound,status,error FROM assets WHERE '+where+' ORDER BY path LIMIT 30 OFFSET ?',arguments+[page*30]).fetchall()
                return self.json({'total':total,'page':page,'items':[dict(row) for row in rows]})
            if url.path=='/api/asset':
                relative=query.get('path',[''])[0];row=asset(relative)
                if row is None:return self.json({'error':'File not found'},404)
                target=ROOT/'extracted'/relative;exports=[]
                if target.exists():
                    for path in target.rglob('*'):
                        if path.is_file() and path.suffix in ['.png','.jpg','.jpeg','.gif','.mp3','.wav','.as','.pcode','.bin']:
                            exports.append({'name':str(path.relative_to(target)),'url':'/'+str(path.relative_to(ROOT))})
                            if len(exports)>=200:break
                marker=target/'complete.txt'
                return self.json({'asset':dict(row),'timeline':read_json(ROOT/'timelines'/(relative+'.json'),{}),'exports':exports,'exportComplete':marker.exists(),'pcodeComplete':(target/'pcode/complete.txt').exists(),'sourceFallback':marker.exists() and 'fallback' in marker.read_text()})
            if url.path=='/api/job':return self.json(JOBS.get(query.get('key',[''])[0],{'state':'missing'}))
            if url.path.startswith('/api/'):return self.json({'error':'Unknown endpoint'},404)
            contained(url.path.lstrip('/'));return super().do_GET()
        except (ValueError,sqlite3.Error) as error:return self.json({'error':str(error)},400)
    def do_POST(self):
        if self.path!='/api/preview':return self.json({'error':'Unknown endpoint'},404)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<4096:raise ValueError('Invalid request length')
            value=json.loads(self.rfile.read(length));relative=value['path'];sprite=int(value['sprite']);frame=None if value.get('frame') is None else int(value['frame']);row=asset(relative)
            if row is None or row['kind']!='swf':raise ValueError('Choose an indexed SWF')
            info=read_json(ROOT/'timelines'/(relative+'.json'),{});timeline=next((t for t in info.get('timelines',[]) if t['sprite']==sprite),None)
            if timeline is None or frame is not None and not 0<=frame<timeline['frames']:raise ValueError('Unknown timeline or frame')
            key=hashlib.sha256(json.dumps([relative,row['sha'],sprite,frame]).encode()).hexdigest()[:24]
            cached=read_json(ROOT/'previews'/key/'result.json')
            with LOCK:
                if cached:JOBS[key]=cached
                if key not in JOBS:
                    if sum(job.get('state')=='rendering' for job in JOBS.values())>=3:raise ValueError('请等待当前预览导出完成。')
                    JOBS[key]={'state':'rendering'};POOL.submit(render,key,relative,sprite,frame)
            return self.json({'key':key,**JOBS[key]})
        except (KeyError,ValueError,TypeError,json.JSONDecodeError) as error:return self.json({'error':str(error)},400)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,required=True);args=parser.parse_args()
    server=ThreadingHTTPServer(('0.0.0.0',args.port),Handler);print(f'Local asset library listening at http://0.0.0.0:{args.port}',flush=True);server.serve_forever()
