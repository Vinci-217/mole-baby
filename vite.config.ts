import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {compactAssets} from './scripts/compact-assets';
import {localRendererPolicy} from './scripts/renderer-policy';
export default defineConfig({ plugins: [localRendererPolicy(),compactAssets(),react()], base: './', server: { port: 5173, strictPort: true,hmr:process.env.MOLE_REVIEW_FREEZE==='1'?false:undefined } });
