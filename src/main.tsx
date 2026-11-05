// OEM WebView app versions do not identify Chromium; ship required APIs.
import 'core-js/stable';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RestaurantPreview from './components/RestaurantPreview';
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
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.hash==='#message-board'?<StandaloneMessageBoard/>:!window.desktop&&!window.mobile&&new URLSearchParams(location.search).get('preview')==='restaurant'?<RestaurantPreview/>:<App />}</React.StrictMode>);
