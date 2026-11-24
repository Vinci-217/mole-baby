import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Ram from './Ram';
import type {Evolution,Stage} from '../game';
import {ramForm} from '../original-actions';
import {nextStudyActivity,originalStudyClip} from '../ram-study';

describe('reading is separate from the magic-book outfit',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  const forms:[Stage,Evolution|undefined,number][]=[[0,undefined,101],[1,undefined,2],[2,undefined,3],[3,undefined,4],[4,'classic',101],[4,'super',101],[4,'water',101],[4,'wood',101],[4,'fire',101]];
  for(const [stage,evolution,source] of forms)it(`plays an original reading timeline on ${evolution??stage}`,()=>{
    for(const action of ['focus','read-alone']){
      const html=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume="magic-book" action={action}/>);
      expect(html).toContain(`data-source="resource/lahmClassRoom/lahmMovie/pet${source}Movie/14.swf"`);
      if(stage>0)expect(html).toContain('original-ambient');
      expect(html).not.toContain('social-book');
      expect(html).not.toContain('data-daily-action="focus"');
      expect(html).not.toContain('class="reading-book"');
    }
    const form=ramForm(stage,evolution);
    expect(nextStudyActivity(form,'read')).toBe('write');
    expect(originalStudyClip(form,'write')?.path).toBe(`resource/lahmClassRoom/lahmMovie/pet${source}Movie/13.swf`);
    expect(nextStudyActivity(form,'write')).toBe('read');
  });
  it('keeps the original outfit available outside reading',()=>{
    vi.stubGlobal('window',{});
    const html=renderToStaticMarkup(<Ram stage={3} color="blue" costume="magic-book" action="idle"/>);
    expect(html).toContain('ram-official');
    expect(html).not.toContain('ram-reading');
    expect(html).not.toContain('data-daily-action="focus"');
  });
});
