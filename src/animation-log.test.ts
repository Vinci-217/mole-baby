import {afterEach,expect,it,vi} from 'vitest';
import {animationLoadLog,recordAnimationLoad,exportAnimationLoadLog} from './animation-log';
afterEach(()=>vi.unstubAllGlobals());
it('bounds diagnostic history without overwriting unrelated session data',()=>{
 const entries=new Map([['ramu-local-debug-v1','on']]);
 vi.stubGlobal('sessionStorage',{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value)});
 for(let n=0;n<100;n++)recordAnimationLoad({event:'error',clip:String(n),name:'紫色魔法帽',form:'junior',action:'idle',attempt:1,reason:'x'.repeat(1000)});
 expect(animationLoadLog()).toHaveLength(80);expect(animationLoadLog()[0].clip).toBe('20');expect(animationLoadLog()[0].reason).toHaveLength(500);expect(entries.get('ramu-local-debug-v1')).toBe('on');expect(entries.size).toBe(2);
});
it('does not interrupt playback when browser diagnostic storage is unavailable',()=>{
 vi.stubGlobal('sessionStorage',{getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('quota')}});
 expect(()=>recordAnimationLoad({event:'load',clip:'cap',name:'帽子',form:'junior',action:'idle',attempt:0})).not.toThrow();expect(animationLoadLog()).toEqual([]);
});
it('exports dated diagnostics through the Android file picker without exposing the pet save',()=>{
 const exportSave=vi.fn().mockResolvedValue(true);
 vi.stubGlobal('window',{mobile:{exportSave}});vi.stubGlobal('navigator',{userAgent:'test'});
 vi.stubGlobal('sessionStorage',{getItem:()=>null});
 exportAnimationLoadLog();
 const [text,name]=exportSave.mock.calls[0];
 expect(name).toMatch(/^拉姆动画日志-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.json$/);
 expect(JSON.parse(text)).toEqual({version:2,animationBuild:'2026-11-13-reused-runtime-and-local-save',exportedAt:expect.any(String),browser:'test',players:[],events:[]});
});
