import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import type {FrameAtlasPage} from '../src/frame-clip-spec';

const groups = ['uploaded-actions', 'daily-frames', 'furniture-actions', 'study-frames'];
const atlasName = /^(?:neutral|mask|frame)-\d+\.webp$/;
export const isFrameClipManifest = (name: string) => /^assets\/original\/(uploaded-actions|daily-frames|furniture-actions|study-frames)\/[^/]+\/clip\.json$/.test(name);

export interface SharedFrameAtlas {
  file: string;
  sharedWith: string;
  sha256: string;
  bytes: number;
}

/** Only texture URLs owned by the frame-clip player may be shared. */
export function findSharedFrameAtlases(publicRoot: string): SharedFrameAtlas[] {
  const sourceFiles = new Set<string>();
  for (const group of groups) {
    const directory = `assets/original/${group}`;
    const root = path.join(publicRoot, directory);
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const folder = `${directory}/${entry.name}`;
      const manifest = path.join(publicRoot, folder, 'clip.json');
      if (!existsSync(manifest)) continue;
      const {pages} = JSON.parse(readFileSync(manifest, 'utf8')) as {pages: FrameAtlasPage[]};
      for (const {neutral, mask} of pages) {
        for (const name of [neutral, mask]) if (atlasName.test(name)) sourceFiles.add(`${folder}/${name}`);
      }
    }
  }

  const bySize = new Map<number, string[]>();
  for (const file of [...sourceFiles].sort()) {
    const {size} = statSync(path.join(publicRoot, file));
    const group = bySize.get(size);
    if (group) group.push(file);
    else bySize.set(size, [file]);
  }

  const shared: SharedFrameAtlas[] = [];
  for (const [bytes, files] of bySize) {
    if (files.length < 2) continue;
    const byHash = new Map<string, string>();
    for (const file of files) {
      const sha256 = createHash('sha256').update(readFileSync(path.join(publicRoot, file))).digest('hex');
      const canonical = byHash.get(sha256);
      if (canonical) shared.push({file, sharedWith: canonical, bytes, sha256});
      else byHash.set(sha256, file);
    }
  }
  return shared;
}

export function shareFrameAtlasUrls<T extends {pages: FrameAtlasPage[]}>(file: string, clip: T, shared: ReadonlyMap<string, SharedFrameAtlas>): T {
  const folder = path.posix.dirname(file);
  const source = (name: string) => {
    const atlas = shared.get(`${folder}/${name}`);
    return atlas ? `./${atlas.sharedWith}` : name;
  };
  return {...clip, pages: clip.pages.map(page => ({...page, neutral: source(page.neutral), mask: source(page.mask)}))};
}
