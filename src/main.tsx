import OfficialAnimationPreview from './components/OfficialAnimationPreview';
import AnimationSizePreview from './components/AnimationSizePreview';
// OEM WebView app versions do not identify Chromium; ship required APIs.
import 'core-js/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LocalDebugSwitch from './components/LocalDebugSwitch';
import {installLocalDebug} from './local-debug';
import RestaurantPreview from './components/RestaurantPreview';
import ReadingPreview from './components/ReadingPreview';
import WardrobePreview from './components/WardrobePreview';
import WardrobeMotionPreview from './components/WardrobeMotionPreview';
import StandaloneMessageBoard from './components/StandaloneMessageBoard';
import './styles.css';
import './original-theme.css';
import './components/DesktopCompanion.css';
import './android.css';
import './improvements.css';
// Older OEM WebViews predate dynamic viewport units. Resize with the host.
const viewport=()=>document.documentElement.style.setProperty('--app-height',`${window.innerHeight}px`);
viewport();window.addEventListener('resize',viewport);
import {installAndroidHost} from './android-host';
installAndroidHost();
installLocalDebug();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LocalDebugSwitch/>{location.hash==='#message-board'?<StandaloneMessageBoard/>:!window.desktop&&!window.mobile&&new URLSearchParams(location.search).get('preview')==='size-review'?<AnimationSizePreview/>:!window.desktop&&!window.mobile&&new URLSearchParams(location.search).get('preview')==='official'?<OfficialAnimationPreview/>:!window.desktop&&!window.mobile&&new URLSearchParams(location.search).get('preview')==='reading'?<ReadingPreview/>:!window.desktop&&!window.mobile&&new URLSearchParams(location.search).get('preview')==='wardrobe-motion'?<WardrobeMotionPreview/>:!window.desktop&&!window.mobile&&new URLSearchParams(location.search).get('preview')==='wardrobe'?<WardrobePreview/>:!window.desktop&&!window.mobile&&['restaurant','desktop-work'].includes(new URLSearchParams(location.search).get('preview')??'')?<RestaurantPreview/>:<App />}</React.StrictMode>);
