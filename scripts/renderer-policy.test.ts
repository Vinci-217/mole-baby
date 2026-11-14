import {it,expect} from 'vitest';
import {localRendererPolicy} from './renderer-policy';

it('lets local original preloads use their read-only protocol while retaining closed network/script policies',()=>{
 const transform=localRendererPolicy().transformIndexHtml as (html:string)=>string;
 const html=transform('<html><head></head><body></body></html>');
 expect(html).toContain("connect-src 'self' ram-original:;");
 expect(html).toContain("script-src 'self';");
 expect(html).toContain("frame-src 'self' ram-original:;");
 expect(html).not.toContain('https:');expect(html).not.toContain("'unsafe-eval'");
});
