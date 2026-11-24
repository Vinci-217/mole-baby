import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {compactAssets} from './scripts/compact-assets';
import {localRendererPolicy} from './scripts/renderer-policy';
import {runtimeAssetData} from './scripts/runtime-asset-data';
export default defineConfig({
 plugins:[localRendererPolicy(),runtimeAssetData(),compactAssets(),react()],base:'./',build:{target:'chrome80',cssTarget:'chrome80'},
 // The original client archive has hundreds of thousands of extracted files.
 // Neither dependency discovery nor HMR should crawl those research outputs.
 optimizeDeps:{entries:['index.html']},
 server:{port:5173,strictPort:true,hmr:process.env.MOLE_REVIEW_FREEZE==='1'?false:undefined,
  watch:{ignored:['**/local-assets/**','**/artifacts/**','**/research/**','**/release/**','**/dist/**']},
 },
});
