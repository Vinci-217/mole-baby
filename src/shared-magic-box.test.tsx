import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it, vi} from 'vitest';
import SharedMagicBox from './components/SharedMagicBox';
import {magicBoxFrame, TRANSFORMATION_TARGET_START, transformationTimeline} from './magic-box';

it('mounts a live source while it is hidden so it can resolve preparation', () => {
  const prepare = new Promise<void>(() => {});
  const markup = renderToStaticMarkup(<SharedMagicBox startedAt={0} prepare={prepare} target={<span>原版播放器</span>}>
    <span>拉姆</span>
  </SharedMagicBox>);
  expect(markup).toContain('data-ready="false"');
  expect(markup).toContain('class="magic-box-target" aria-hidden="true" style="opacity:0"><span>原版播放器</span>');

  const target = vi.fn(() => <span>帧图集</span>);
  renderToStaticMarkup(<SharedMagicBox startedAt={0} prepare={prepare} target={target}>{null}</SharedMagicBox>);
  expect(target).not.toHaveBeenCalled();
});

it('plays the target between the two smoke sequences for its full duration', () => {
  const duration = 2000;
  const timeline = transformationTimeline(duration);
  const frame = (at: number) => timeline[magicBoxFrame(at, timeline)];
  expect(frame(TRANSFORMATION_TARGET_START - 1).smoke).toBe(15);
  expect(frame(TRANSFORMATION_TARGET_START)).toMatchObject({subject: 'box', smoke: null, ms: duration});
  expect(frame(TRANSFORMATION_TARGET_START + duration - 1).smoke).toBeNull();
  expect(frame(TRANSFORMATION_TARGET_START + duration).smoke).toBe(0);
  expect(timeline.at(-1)?.subject).toBe('original');
});
