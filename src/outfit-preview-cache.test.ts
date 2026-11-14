import {expect,it} from 'vitest';
import {outfitPreview,outfitPreviewKey,rememberOutfitPreview,subscribeOutfitPreview} from './outfit-preview-cache';
const png='data:image/png;base64,'+'a'.repeat(200);
it('never shows a cached frame for another colour, form, source or registration',()=>{
 const key=outfitPreviewKey('hat:junior:super',[0,-21,-255]);
 expect(rememberOutfitPreview(key,png)).toBe(true);expect(outfitPreview(key)).toBe(png);
 expect(outfitPreview(outfitPreviewKey('hat:junior:super',[0,0,0]))).toBeUndefined();
 expect(outfitPreview(outfitPreviewKey('hat:junior:middle',[0,-21,-255]))).toBeUndefined();
 expect(rememberOutfitPreview('bad','data:image/svg+xml,<svg/>')).toBe(false);
 expect(rememberOutfitPreview('huge',png+'a'.repeat(5*1024*1024))).toBe(false);
});
it('evicts old frames and keeps recently used frames inside a fixed budget',()=>{
 for(let n=0;n<32;n++)rememberOutfitPreview('qa-'+n,png);
 expect(outfitPreview('qa-0')).toBe(png);rememberOutfitPreview('qa-new',png);
 expect(outfitPreview('qa-0')).toBe(png);expect(outfitPreview('qa-1')).toBeUndefined();
});
it('shares a newly painted appearance with waiting surfaces without repeated notifications',()=>{
 let calls=0;const stop=subscribeOutfitPreview('shared-state',()=>calls++);
 rememberOutfitPreview('other-state',png);expect(calls).toBe(0);
 rememberOutfitPreview('shared-state',png);expect(calls).toBe(1);
 rememberOutfitPreview('shared-state',png);expect(calls).toBe(1);
 stop();rememberOutfitPreview('shared-state',png+'b');expect(calls).toBe(1);
});
