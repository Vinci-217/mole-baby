import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {findSharedFrameAtlases, shareFrameAtlasUrls} from '../scripts/frame-atlas-assets';
import {dailyFrameSpec} from './daily-frames';
import {frameClipFolder} from './frame-clip-spec';
import {loadFrameClip, type FrameClip} from './frame-clips';
import {frameAtTime} from './frame-timing';
import {roomFurnitureAction} from './room-furniture-actions';
import {uploadedSpec} from './uploaded-actions';

describe('frame clip library', () => {
  it('shares one lazy table between the menu and different frame players', async () => {
    for (const spec of [uploadedSpec('middle', '180058'), dailyFrameSpec('middle', 'sleep')!, roomFurnitureAction('original-160206')!]) {
      const preload = loadFrameClip(spec);
      expect(loadFrameClip(spec)).toBe(preload);
      const clip = await preload;
      expect(clip.assetKey).toBe(spec.assetKey);
      expect(clip.frameMap).toHaveLength(spec.frames);
      const folder = frameClipFolder(spec);
      const authored = JSON.parse(readFileSync(`public/${folder.slice(2)}/clip.json`, 'utf8')) as FrameClip;
      expect(clip.pages[0].neutral).toBe(`${folder}/${authored.pages[0].neutral}`);
    }
  });

  it('rewrites identical textures while keeping both care items and their own frame metadata', () => {
    const original = 'assets/original/uploaded-actions/middle-180058';
    const duplicate = 'assets/original/uploaded-actions/middle-180059';
    const sharing = new Map(findSharedFrameAtlases('public').map(atlas => [atlas.file, atlas]));
    const read = (folder: string) => JSON.parse(readFileSync(`public/${folder}/clip.json`, 'utf8')) as FrameClip;
    const authored = read(duplicate);
    const clip = shareFrameAtlasUrls(`${duplicate}/clip.json`, authored, sharing);
    expect(clip.pages[0].neutral).toBe(`./${original}/neutral-0.webp`);
    expect(clip.pages[0].mask).toBe(`./${original}/mask-0.webp`);
    expect(clip.id).toBe('180059');
    expect(read(original).id).toBe('180058');
    expect(clip.registration).toBe(authored.registration);
    expect(clip.frameMap).toBe(authored.frameMap);
    expect(clip.poses).toBe(authored.poses);
    expect(authored.pages[0].neutral).toBe('neutral-0.webp');
    expect(sharing.has(`${duplicate}/poster.png`)).toBe(false);
  });

  it('selects the first pose before playback and holds the final pose after a finite clip', () => {
    expect(frameAtTime(-20, 48, 24)).toBe(0);
    expect(frameAtTime(41, 48, 24)).toBe(0);
    expect(frameAtTime(42, 48, 24)).toBe(1);
    expect(frameAtTime(1000, 48, 24)).toBe(24);
    expect(frameAtTime(2000, 48, 24)).toBe(47);
  });
});
