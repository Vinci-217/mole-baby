// OEM WebView app versions do not identify Chromium; ship required APIs.
import 'core-js/stable';
import {lazy,StrictMode,Suspense} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LocalDebugSwitch from './components/LocalDebugSwitch';
import {installLocalDebug} from './local-debug';
import {recoverLocalPet} from './pet-backup';
import './styles.css';
import './original-theme.css';
import './components/DesktopCompanion.css';
import './android.css';
import './improvements.css';
// Older OEM WebViews predate dynamic viewport units. Resize with the host.
const viewport=()=>document.documentElement.style.setProperty('--app-height',`${window.innerHeight}px`);
viewport();window.addEventListener('resize',viewport);
import {installAndroidHost} from './android-host';
import {installWebApp} from './web-app';
installAndroidHost();
const nativeHost=Boolean(window.desktop||window.mobile);
const preview=nativeHost?null:new URLSearchParams(location.search).get('preview');
const bookshelfPreview=preview==='bookshelf';
const messageBoard=location.hash==='#message-board';
const restaurantPreview=lazy(()=>import('./components/RestaurantPreview'));
const previewRoutes=new Map([
 ['all-animations',lazy(()=>import('./components/AllAnimationsPreview'))],
 ['size-review',lazy(()=>import('./components/AnimationSizePreview'))],
 ['official',lazy(()=>import('./components/OfficialAnimationPreview'))],
 ['reading',lazy(()=>import('./components/ReadingPreview'))],
 ['wardrobe-motion',lazy(()=>import('./components/WardrobeMotionPreview'))],
 ['wardrobe',lazy(()=>import('./components/WardrobePreview'))],
 ['restaurant',restaurantPreview],
 ['desktop-work',restaurantPreview],
]);
const Preview=messageBoard?lazy(()=>import('./components/StandaloneMessageBoard')):previewRoutes.get(preview??'');
if(!bookshelfPreview)installLocalDebug();
installWebApp();
async function mount(){
 if(!messageBoard)try{await recoverLocalPet(localStorage,window.desktop?.localSaves)}catch{/* An unreadable backup stays available for manual inspection. */}
 ReactDOM.createRoot(document.getElementById('root')!).render(<StrictMode>
  {!bookshelfPreview&&<LocalDebugSwitch/>}
  {Preview?<Suspense fallback={<p role="status">正在打开预览…</p>}><Preview/></Suspense>:<App startInRoom={bookshelfPreview}/>}
 </StrictMode>);
}
void mount();
