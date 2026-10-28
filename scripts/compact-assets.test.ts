import {it,expect} from 'vitest';
import {compactUrl} from './compact-assets';
it('keeps application icons as PNG but rewrites nested course icons with the compressed payload',()=>{
 expect(compactUrl('./icons/ramu.png')).toBe('./icons/ramu.png');
 expect(compactUrl('./assets/generated/school/icons/magic.png')).toBe('./assets/generated/school/icons/magic.webp');
 expect(compactUrl('./assets/generated/school/icons/restaurant.png')).toBe('./assets/generated/school/icons/restaurant.webp');
 expect(compactUrl('https://example.com/icons/magic.png')).toBe('https://example.com/icons/magic.png');
});
