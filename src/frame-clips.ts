import {frameClipFolder,type FrameClipSpec,type FrameAtlasPage} from './frame-clip-spec';

export interface FrameClip extends FrameClipSpec {
  fps: number;
  frameMap: number[];
  poses: [tile: number, x: number, y: number][][];
  rectangles: [page: number, x: number, y: number, width: number, height: number][];
  pages: FrameAtlasPage[];
}

let loaders: Record<string,()=>Promise<unknown>>|undefined;
const clips = new Map<string, Promise<FrameClip>>();

/** Menu preloads and players share one table. Texture decoding remains on demand. */
export function loadFrameClip(spec: FrameClipSpec): Promise<FrameClip> {
  const folder = frameClipFolder(spec);
  const existing = clips.get(folder);
  if (existing) return existing;

  loaders??={
    ...import.meta.glob('../public/assets/original/uploaded-actions/*/clip.json', {import: 'default'}),
    ...import.meta.glob('../public/assets/original/daily-frames/*/clip.json', {import: 'default'}),
    ...import.meta.glob('../public/assets/original/study-frames/*/clip.json', {import: 'default'}),
    ...import.meta.glob('../public/assets/original/furniture-actions/*/clip.json', {import: 'default'}),
  };
  const loader = loaders[`../public/${folder.slice(2)}/clip.json`];
  if (!loader) return Promise.reject(new Error('这段原版动作还没有准备好。'));
  const resolveSource = (name: string) => name.startsWith('./assets/') ? name : `${folder}/${name}`;
  const pending = loader().then(value => {
    const table = value as FrameClip;
    const pages = table.pages.map(page => ({...page, neutral: resolveSource(page.neutral), mask: resolveSource(page.mask)}));
    return {...table, assetKey: spec.assetKey, pages};
  }).catch(error => {
    clips.delete(folder);
    throw error;
  });
  clips.set(folder, pending);
  return pending;
}
