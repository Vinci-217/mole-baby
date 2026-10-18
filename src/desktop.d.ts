export {};
declare global {
  interface DesktopState {
    petMode: boolean;
    alwaysOnTop: boolean;
    wandering: boolean;
    motion?: 'idle' | 'left' | 'right';
  }
  interface Window {
    desktop?: {
      isElectron: boolean;
      getState: () => Promise<DesktopState>;
      minimize: () => void;
      close: () => void;
      toggleAlwaysOnTop: () => Promise<boolean>;
      setPetMode: (enabled: boolean) => Promise<boolean>;
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
