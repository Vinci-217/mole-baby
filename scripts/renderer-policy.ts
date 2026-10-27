import type {Plugin} from 'vite'

/** Compatibility runtimes load only the shipped UI. Remote data, executables,
 * scripts, embeds and eval are not part of the renderer's product workflow. */
export function localRendererPolicy():Plugin {
 const policy=["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","media-src 'self' blob:","font-src 'self' data:","connect-src 'self'","object-src 'none'","frame-src 'none'","base-uri 'self'"].join('; ')
 return{name:'local-renderer-policy',apply:'build',transformIndexHtml(html){return html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`)}}
}
