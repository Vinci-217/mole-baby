import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import flight from '../public/assets/original/flight/runtime.json';
import clips from '../public/assets/original/element-skills/clips.json';
import slumber from '../public/assets/original/slumber/source.json';
import gentle from '../public/assets/original/gentle-care/source.json';
import sounds from '../public/assets/original/game-audio/sources.json';
import icons from '../public/assets/original/room-icons/sources.json';
import {GAME_SOUND_FILES} from './game-audio';

const hash=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
describe('public original art/audio provenance and full poses',()=>{
 it('ships every mapped original sound unchanged and identifies its exact SWF stream',()=>{
  const known=new Map(sounds.files.map(f=>[f.file,f]));
  for(const name of new Set(Object.values(GAME_SOUND_FILES))){const meta=known.get(name+'.mp3')!;expect(meta).toBeDefined();expect(meta.soundId).toBeGreaterThan(0);expect(meta.sourceSha256).toMatch(/^[a-f0-9]{64}$/);expect(hash('public/assets/original/game-audio/'+meta.file)).toBe(meta.sha256);expect(meta.duration).toBeGreaterThan(0)}
 });
 it('does not bring the original purple item placeholder back in basic or apex endings',async()=>{
  for(const name of ['fire-1','water-1','wood-1','fire-6','water-6','wood-6']as const){
   const clip=clips[name],index=clip.frameMap.at(-1)!,[page,x,y,width,height]=clip.rectangles[index];
   const {data,info}=await sharp('public/assets/original/element-skills/'+name+'/'+clip.pages[page]).extract({left:x,top:y,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let purple=0;for(let i=0;i<data.length;i+=info.channels){const[r,g,b,a]=data.subarray(i,i+4);if(a>180&&r>70&&b>90&&r>g*1.6&&b>g*1.5)purple++}
   expect(purple,name+' ending placeholder pixels').toBe(0);
  }
 });
 it('uses classic super own body/crown and mouth registration for sleep and care',()=>{
  expect(slumber.forms.classic.sourceSprite).toBe(2525);expect(gentle.forms.classic.sourceSprite).toBe(2525);
  expect(slumber.forms.classic.mouthPoint[1]).toBeGreaterThan(50);expect(gentle.forms.classic.mouthPoint[1]).toBeGreaterThan(50);
  for(const kind of ['slumber','gentle-care'])for(const layer of ['neutral','mask'])expect(fs.existsSync(`public/assets/original/${kind}/classic-${layer}.png`)).toBe(true);
 });
 it('keeps new navigation exports traceable to three distinct original symbols',()=>{
  expect(new Set(icons.files.map(i=>i.characterId)).size).toBe(3);
  for(const meta of icons.files)expect(hash('public/assets/original/room-icons/'+meta.file)).toBe(meta.sha256);
 });
 it('keeps complete visible original poses and original source frame identities within bounded atlases',async()=>{
  for(const [form,meta]of Object.entries(flight.forms)){
   const image=await sharp('public/assets/original/flight/'+form+'-neutral.png').metadata();expect(image.width).toBe(1536);expect(image.height).toBe(meta.rows*208);expect(Math.max(image.width!,image.height!)).toBeLessThanOrEqual(2048);
   for(const clip of Object.values(meta.clips)){
    expect(clip.frames.length).toBeGreaterThan(6);expect(clip.frames[0].sourceFrame).toBe(1);
    expect(new Set([...clip.frames.map(f=>f.sourceFrame),...clip.emptyControlFrames]).size).toBe(clip.sourceFrameCount);
    for(const pose of clip.frames)expect(pose.index).toBeLessThan(meta.rows*8);
   }
  }
  expect(flight.forms.senior.bladeCount).toBe(8);expect(flight.forms.senior.crownParts).toBe(8);
 });
});
