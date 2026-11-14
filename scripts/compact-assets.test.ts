import {it,expect} from 'vitest';
import {bundledCssUrls,compactUrl} from './compact-assets';
it('keeps application icons as PNG but rewrites nested course icons with the compressed payload',()=>{
 expect(compactUrl('./icons/ramu.png')).toBe('./icons/ramu.png');
 expect(compactUrl('./assets/generated/school/icons/magic.png')).toBe('./assets/generated/school/icons/magic.webp');
 expect(compactUrl('./assets/generated/school/icons/restaurant.png')).toBe('./assets/generated/school/icons/restaurant.webp');
 expect(compactUrl('https://example.com/icons/magic.png')).toBe('https://example.com/icons/magic.png');
});
it('resolves native file and subpath CSS art without a website-root request',()=>{
 const css=bundledCssUrls('.compose{background:url("/assets/original/message-board/compose.png")} .tab{background:url(/assets/original/ui/tab-yellow.png)}','assets/index.css');
 expect(css).toContain('url("./original/message-board/compose.webp")');
 expect(css).toContain('url(./original/ui/tab-yellow.webp)');
 for(const base of ['file:///Applications/拉姆.app/Contents/Resources/app.asar/dist/','https://example.com/mole-baby/']){
  const sheet=new URL('assets/index.css',base);
  expect(new URL('./original/message-board/compose.webp',sheet).href).toBe(new URL('assets/original/message-board/compose.webp',base).href);
 }
 expect(bundledCssUrls('x{mask:url(data:image/png;base64,abc);background:url(https://example.com/a.png)}','assets/x.css')).toContain('https://example.com/a.png');
 expect(bundledCssUrls('x{background:url(/assets/original/ui/tab-yellow.webp)}','assets/nested/x.css')).toContain('url(../original/ui/tab-yellow.webp)');
});
