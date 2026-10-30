/** Review harness only; not imported by the application. */
import {createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Ram from '../src/components/Ram';
import {uploadedSpec,uploadedEffectRect} from '../src/uploaded-actions';
import type {Stage,Evolution} from '../src/game';
export function mountTuyaReview(){
 document.getElementById('root')!.style.display='none';
 const mount=document.createElement('div');document.body.append(mount);
 const root=createRoot(mount);let sequence=0;
 return{show(form:string,id:string,scale=1){
  const stage=({junior:1,middle:2,senior:3,classic:4}as const)[form as 'junior'];
  flushSync(()=>root.render(h('div',{className:'tuya-review',style:{position:'absolute',left:500,top:900,width:100*scale,height:108*scale}},h(Ram,{stage:stage as Stage,evolution:stage===4?'classic'as Evolution:undefined,color:'#123456',action:'uploaded-'+id,actionId:++sequence,sound:false}))));
  const spec=uploadedSpec(form,id)!;return{spec,rect:uploadedEffectRect(spec,form as 'middle')};
 }};
}
