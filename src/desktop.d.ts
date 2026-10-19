export {};
declare global {
  interface CompanionAISettings {
    configured: boolean;
    protection: 'os-encrypted' | 'local-file';
  }
  interface DesktopState {
    petMode: boolean;
    alwaysOnTop: boolean;
    wandering: boolean;
    motion?: 'idle' | 'left' | 'right';
    companionPanel: boolean;
    panelSide: 'left' | 'right';
    edgeSide: 'left' | 'right' | null;
    edgePose: 'visible' | 'hidden' | 'peek';
    edgeHiding: boolean;
    edgeNextPeekAt?: number | null;
  }
  interface Window {
    companionSpeech?: {
      getAvailability: () => Promise<{ available: boolean; language?: string; reason?: string; method?: 'system-dictation' }>;
      listen: () => Promise<string>;
      cancel: () => void;
    };
    companionAI?: {
      getSettings: () => Promise<CompanionAISettings>;
      setKey: (key: string) => Promise<CompanionAISettings>;
      clearKey: () => Promise<CompanionAISettings>;
      chat: (messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => Promise<string>;
      cancel: () => void;
    };
    desktop?: {
      isElectron: boolean;
      platform: string;
      openMacSettings: (kind:'security'|'dictation')=>Promise<boolean>;
      openMacGuide: ()=>Promise<boolean>;
      getState: () => Promise<DesktopState>;
      minimize: () => void;
      close: () => void;
      hideToTray: () => void;
      readyToShow: (hasPet: boolean) => void;
      toggleAlwaysOnTop: () => Promise<boolean>;
      setPetMode: (enabled: boolean) => Promise<boolean>;
      setCompanionPanel: (open: boolean) => Promise<DesktopState>;
      setPetCanMove: (enabled: boolean) => Promise<boolean>;
      setEdgeHiding: (enabled: boolean) => Promise<boolean>;
      revealPet: () => Promise<DesktopState>;
      setEdgeHovered: (hovered: boolean) => Promise<DesktopState>;
      setInteracting: (enabled: boolean) => Promise<boolean>;
      setMousePassthrough: (ignore: boolean) => void;
      onPetModeChanged: (callback: (enabled: boolean) => void) => () => void;
      onStateChanged: (callback: (state: DesktopState) => void) => () => void;
      startPetDrag: () => Promise<boolean>;
      endPetDrag: () => Promise<boolean>;
      movePet: (dx: number, dy: number) => Promise<boolean>;
      wander: (enabled: boolean) => Promise<boolean>;
      notify: (title: string, body: string) => void;
    };
  }
}
