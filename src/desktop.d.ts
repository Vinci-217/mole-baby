export {};
declare global {
  interface UpdateState {status:'disabled'|'idle'|'checking'|'available'|'downloading'|'ready'|'installing'|'current'|'error';currentVersion:string;version:string|null;percent:number;enabled:boolean;automaticInstall:boolean;checkedAt:number|null;message:string;downloadMode?:'differential'|'full'|'cached'|null;transferredBytes?:number;totalBytes?:number;fullSize?:number;reusedBytes?:number;fallbackReason?:string|null}
  interface DesktopState {
    petMode: boolean;
    roomFullscreen?:boolean;
    effectExpanded?:boolean;
    trayTooltip?:string;
    windowVisible?: boolean;
    dragPoint?:{x:number;y:number;at:number};
    petOffset?:{x:number;y:number};
    mouseThrough?:boolean;
    mousePassthrough?:boolean;
    alwaysOnTop: boolean;
    wandering: boolean;
    motion?: 'idle' | 'left' | 'right';
    companionPanel: boolean;
    panelSide: 'left' | 'right';
    panelLayout?: 'compact' | 'classic' | 'profile';
    panelGeometry?: {petX:number;petY:number;panelX:number;panelY:number;panelWidth:number;panelHeight:number;scale:number}|null;
    edgeSide: 'left' | 'right' | 'top' | 'bottom' | null;
    edgePose: 'visible' | 'tucking' | 'hidden' | 'peek';
    edgeOffset?: { x: number; y: number };
    edgeHiding: boolean;
    edgeNextPeekAt?: number | null;
  }
  interface Window {
    desktop?: {
      isElectron: boolean;
      updates:{openRelease:()=>Promise<void>;getState:()=>Promise<UpdateState|null>;check:()=>Promise<boolean>;download:()=>Promise<boolean>;install:()=>Promise<boolean>;setEnabled:(enabled:boolean)=>Promise<UpdateState>;setBusy:(busy:boolean)=>void;onStateChanged:(callback:(state:UpdateState)=>void)=>()=>void;onPrepare:(callback:()=>boolean|Promise<boolean>)=>()=>void};
      platform: string;
      setMusicState:(state:{playing:boolean;enabled:boolean;background:boolean})=>Promise<void>;
      onMusicToggle:(callback:(enabled:boolean)=>void)=>()=>void;
      openMacSettings: (kind:'security')=>Promise<boolean>;
      openMacGuide: ()=>Promise<boolean>;
      getState: () => Promise<DesktopState>;
      minimize: () => void;
      close: () => void;
      hideToTray: () => void;
      readyToShow: (hasPet: boolean) => void;
      preparePetDrag:()=>Promise<boolean>;
      dragPetToCursor:()=>Promise<boolean>;
      setMouseThrough:(enabled:boolean)=>Promise<boolean>;
      toggleAlwaysOnTop: () => Promise<boolean>;
      setPetMode: (enabled: boolean) => Promise<boolean>;
      setRoomFullscreen:(enabled:boolean)=>Promise<boolean>;
      openManorSite:()=>Promise<void>;
      setCompanionPanel: (open: boolean, layout?: 'compact' | 'classic' | 'profile') => Promise<DesktopState>;
      setPetStatus:(status:{name:string;stage:number;sleeping:boolean;stats:Record<string,number>;activity?:'course'|'restaurant'|'outing'}|null)=>Promise<void>;
      setPetEffectBounds:(bounds:{x:number;y:number;width:number;height:number}|null)=>Promise<DesktopState>;
      setPetAppearance:(form:string)=>Promise<DesktopState>;
      setPetCanMove: (enabled: boolean) => Promise<boolean>;
      setEdgeHiding: (enabled: boolean) => Promise<boolean>;
      revealPet: () => Promise<DesktopState>;
      setEdgeHovered: (hovered: boolean) => Promise<DesktopState>;
      setInteracting: (enabled: boolean) => Promise<boolean>;
      setMousePassthrough: (ignore: boolean) => void;
      onPetModeChanged: (callback: (enabled: boolean) => void) => () => void;
      onStateChanged: (callback: (state: DesktopState) => void) => () => void;
      startPetDrag: (paintedOffset?: { x: number; y: number }) => Promise<boolean>;
      endPetDrag: () => Promise<boolean>;
      movePet: (dx: number, dy: number) => Promise<boolean>;
      wander: (enabled: boolean) => Promise<boolean>;
      notify: (title: string, body: string) => void;
    };
  }
}
