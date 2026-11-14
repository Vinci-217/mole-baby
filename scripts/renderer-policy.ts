import type {Plugin} from 'vite'

/** Load shipped UI and isolated, bundled animation frames. The app renderer
 * still blocks remote scripts and eval; native frames use a read-only scheme. */
export function localRendererPolicy():Plugin {
 const policy=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","media-src 'self' blob:","font-src 'self' data:","connect-src 'self' ram-original:","object-src 'none'","frame-src 'self' ram-original:","base-uri 'self'"].join('; ')
 return{name:'local-renderer-policy',apply:'build',transformIndexHtml(html){
  const web=process.env.VITE_WEB_APP==='1'?'<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/ramu-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default">':'';
  return html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">${web}`);
 }}
}
