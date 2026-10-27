import {mergeConfig} from 'vite'
import modern from './vite.config'

// Electron 22 embeds Chromium 108. Make its supported syntax/CSS target
// explicit rather than inheriting a moving modern browser default.
export default mergeConfig(modern,{build:{target:'chrome108',cssTarget:'chrome108'}})
