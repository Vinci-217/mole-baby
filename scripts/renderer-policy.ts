import type {Plugin} from 'vite'

/** Load shipped UI and isolated, bundled animation frames. The app renderer
 * still blocks remote scripts and eval; native frames use a read-only scheme. */
export function localRendererPolicy():Plugin {
 const policy=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","media-src 'self' blob:","font-src 'self' data:","connect-src 'self'","object-src 'none'","frame-src 'self' ram-original:","base-uri 'self'"].join('; ')
 return{name:'local-renderer-policy',apply:'build',transformIndexHtml(html){return html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`)}}
}
