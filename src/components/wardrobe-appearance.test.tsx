import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Ram from './Ram';
import type {Stage,Evolution} from '../game';

describe('the original junior costume is a complete appearance',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 const forms:[Stage,Evolution?][]=[[2],[3],[4,'classic'],[4,'super'],[4,'water'],[4,'wood'],[4,'fire']];
 for(const [stage,evolution] of forms)it(`uses the junior cat rig throughout contact and movement on ${evolution??stage}`,()=>{
  vi.stubGlobal('window',{});
  for(const action of ['idle','walk-left','walk-right','pet','drag']){
   const html=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume="warm-scarf" action={action} dragging={action==='drag'}/>);
   expect(html).toContain('data-stage="1"');expect(html).toContain(`data-growth-stage="${stage}"`);
   expect(html).toContain('data-form="junior"');expect(html).toContain('resource/petcloth/swf2/1200052.swf');
  }
  const plain=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" action="still"/>);
  expect(plain).toContain(`data-stage="${stage}"`);expect(plain).not.toContain('ram-official');
 });
});
