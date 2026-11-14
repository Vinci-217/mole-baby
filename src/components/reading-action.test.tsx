import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Ram from './Ram';
import type {Evolution,Stage} from '../game';

describe('reading is separate from the magic-book outfit',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  const forms:[Stage,Evolution?,string?][]=[[0,undefined,'seed'],[1,undefined,'junior'],[2,undefined,'middle'],[3,undefined,'senior'],[4,'classic','classic'],[4,'super','super'],[4,'water','water'],[4,'wood','wood'],[4,'fire','fire']];
  for(const [stage,evolution,form] of forms)it(`keeps reading separate from the saved book outfit on ${form}`,()=>{
    for(const action of ['focus','read-alone']){
      const html=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume="magic-book" action={action}/>);
      if(stage===0){expect(html).toContain('ram-reading');expect(html).toContain('data-daily-action="focus"');expect(html).not.toContain('ram-official');}
      else{expect(html).toContain('social-book');expect(html).toContain('data-social-action="focus"');expect(html).toContain(`data-growth-form="${form}"`);expect(html).toContain('resource/petcloth/swf2/1200026.swf');}
      expect(html).not.toContain('class="reading-book"');
    }
  });
  it('keeps the original outfit available outside reading',()=>{
    vi.stubGlobal('window',{});
    const html=renderToStaticMarkup(<Ram stage={3} color="blue" costume="magic-book" action="idle"/>);
    expect(html).toContain('ram-official');
    expect(html).not.toContain('ram-reading');
    expect(html).not.toContain('data-daily-action="focus"');
  });
});
