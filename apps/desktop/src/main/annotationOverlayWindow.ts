import { BrowserWindow, globalShortcut, screen, shell, type WebContents } from 'electron';
import { join } from 'path';
import type {
  AnnotationSessionState,
  AnnotationShortcutCommand,
  CursorState,
} from '@mlab/types';
import { DoubleCtrlDetector } from './doubleCtrlDetector';
import { hardenWebContents } from './navigationGuard';

const GLOBAL_SHORTCUT_MAP: Array<{ accelerator: string; command: AnnotationShortcutCommand }> = [
  // Atalhos diretos (Alt+...) para evitar conflito com alternância de idioma do Windows (Alt+Shift)
  { accelerator: 'Alt+H', command: 'toggle-collapse' },
  { accelerator: 'Alt+V', command: 'tool-cursor' },
  { accelerator: 'Alt+P', command: 'tool-pen' },
  { accelerator: 'Alt+M', command: 'tool-highlighter' },
  { accelerator: 'Alt+A', command: 'tool-arrow' },
  { accelerator: 'Alt+R', command: 'tool-rect' },
  { accelerator: 'Alt+E', command: 'tool-eraser' },
  { accelerator: 'Alt+L', command: 'toggle-spotlight' },
  { accelerator: 'Alt+Z', command: 'cycle-zoom' },
  // Atalhos legados/fallback com Alt+Shift+...
  { accelerator: 'Alt+Shift+H', command: 'toggle-collapse' },
  { accelerator: 'Alt+Shift+V', command: 'tool-cursor' },
  { accelerator: 'Alt+Shift+P', command: 'tool-pen' },
  { accelerator: 'Alt+Shift+M', command: 'tool-highlighter' },
  { accelerator: 'Alt+Shift+A', command: 'tool-arrow' },
  { accelerator: 'Alt+Shift+R', command: 'tool-rect' },
  { accelerator: 'Alt+Shift+E', command: 'tool-eraser' },
  { accelerator: 'Alt+Shift+L', command: 'toggle-spotlight' },
  { accelerator: 'Alt+Shift+Z', command: 'cycle-zoom' },
  { accelerator: 'Alt+Shift+U', command: 'undo' },
  { accelerator: 'Alt+Shift+Y', command: 'redo' },
  { accelerator: 'Alt+Shift+X', command: 'clear' },
];

export class AnnotationOverlayManager {
  private overlayWin: BrowserWindow | null = null;
  private mainWin: BrowserWindow | null = null;
  private lastState: AnnotationSessionState | null = null;
  private registeredAccelerators: string[] = [];
  private currentDisplayBounds: { x: number; y: number; width: number; height: number } | null = null;
  private lastTargetBoundsKey = '';
  private lastIgnoreMouse: boolean | null = null;
  private lastMlabFocused: boolean | null = null;
  private lastCursorState: CursorState | null = null;
  private doubleCtrlDetector: DoubleCtrlDetector | null = null;
  private lastSpotlightToggleTime = 0;

  public start(mainWin: BrowserWindow, preloadPath: string): boolean {
    this.mainWin = mainWin;
    this.registerGlobalShortcuts();

    if (!this.doubleCtrlDetector) {
      this.doubleCtrlDetector = new DoubleCtrlDetector(() => {
        this.dispatchShortcutCommand('toggle-spotlight');
      });
      this.doubleCtrlDetector.start();
    }

    if (this.overlayWin && !this.overlayWin.isDestroyed()) {
      try {
        this.overlayWin.setContentProtection(false);
        this.overlayWin.showInactive();
      } catch {}
      return true;
    }

    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const bounds = primaryDisplay.bounds;
      this.currentDisplayBounds = { ...bounds };
      this.lastIgnoreMouse = null;
      this.lastTargetBoundsKey = '';
      this.lastMlabFocused = null;

      const win = new BrowserWindow({
        title: 'MLab Annotation Overlay',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        focusable: true,
        resizable: false,
        movable: false,
        fullscreenable: false,
        show: false,
        webPreferences: {
          preload: preloadPath,
          // Sandbox do renderer (002/S7): o preload só usa contextBridge e ipcRenderer.
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });

      this.overlayWin = win;

      // Bloqueia navegação para fora do app e novas janelas (002/S7)
      hardenWebContents(win.webContents, (url) => shell.openExternal(url));

      // IMPORTANTE: setContentProtection(false) na janela de overlay permite que o WGC/DWM
      // capture as marcações, a Lupa e os botões diretamente pelo hardware da GPU a 60fps
      // sem penalidade de recomposição por software do DWM!
      try {
        win.setContentProtection(false);
      } catch {}

      try {
        win.setAlwaysOnTop(true, 'screen-saver');
      } catch {}

      try {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      } catch {}

      // Inicia em modo click-through para que os cliques passem para as janelas abaixo
      this.setIgnoreMouseEvents(true);

      win.once('ready-to-show', () => {
        if (!win.isDestroyed()) {
          try {
            win.setContentProtection(false);
            win.showInactive();
          } catch {}
          if (this.lastState && !win.webContents.isDestroyed()) {
            win.webContents.send('annotation-overlay:state', this.lastState);
          }
          if (this.lastCursorState && !win.webContents.isDestroyed()) {
            win.webContents.send('cursor-state', this.lastCursorState);
          }
        }
      });

      win.webContents.on('did-finish-load', () => {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          if (this.lastState) {
            win.webContents.send('annotation-overlay:state', this.lastState);
          }
          const initialMlabFocused =
            this.lastCursorState?.mlabFocused ??
            Boolean(this.mainWin && !this.mainWin.isDestroyed() && this.mainWin.isFocused() && !this.mainWin.isMinimized());
          win.webContents.send(
            'cursor-state',
            this.lastCursorState || {
              visible: !initialMlabFocused,
              x: 0.5,
              y: 0.5,
              mlabFocused: initialMlabFocused,
            }
          );
        }
      });

      win.on('closed', () => {
        if (this.overlayWin === win) {
          this.overlayWin = null;
          this.lastIgnoreMouse = null;
        }
      });

      if (process.env['ELECTRON_RENDERER_URL']) {
        const baseUrl = process.env['ELECTRON_RENDERER_URL'];
        const sep = baseUrl.includes('?') ? '&' : '?';
        win.loadURL(`${baseUrl}${sep}overlay=annotation`).catch(() => {});
      } else {
        const htmlPath = join(__dirname, '../renderer/index.html');
        win.loadFile(htmlPath, { search: 'overlay=annotation' }).catch(() => {});
      }

      return true;
    } catch {
      return false;
    }
  }

  public getMediaSourceId(): string | null {
    if (this.overlayWin && !this.overlayWin.isDestroyed()) {
      try {
        if (typeof this.overlayWin.getMediaSourceId === 'function') {
          return this.overlayWin.getMediaSourceId();
        }
      } catch {}
    }
    return null;
  }

  public syncState(sender: WebContents, state: AnnotationSessionState): void {
    const prevSpotlightEnabled = this.lastState?.spotlight?.enabled;
    const mergedState: AnnotationSessionState = {
      ...state,
      toolbarPos: state.toolbarPos !== undefined ? state.toolbarPos : this.lastState?.toolbarPos,
    };
    this.lastState = mergedState;

    if (prevSpotlightEnabled !== undefined && prevSpotlightEnabled !== mergedState.spotlight?.enabled) {
      this.lastSpotlightToggleTime = Date.now();
    }

    if (
      this.overlayWin &&
      !this.overlayWin.isDestroyed() &&
      !this.overlayWin.webContents.isDestroyed() &&
      sender.id !== this.overlayWin.webContents.id
    ) {
      this.overlayWin.webContents.send('annotation-overlay:state', mergedState);
    }

    if (
      this.mainWin &&
      !this.mainWin.isDestroyed() &&
      !this.mainWin.webContents.isDestroyed() &&
      sender.id !== this.mainWin.webContents.id
    ) {
      this.mainWin.webContents.send('annotation-overlay:state', mergedState);
    }
  }

  public setIgnoreMouseEvents(ignore: boolean): void {
    if (!this.overlayWin || this.overlayWin.isDestroyed()) return;
    if (this.lastIgnoreMouse === ignore) return;
    this.lastIgnoreMouse = ignore;
    try {
      if (ignore) {
        this.overlayWin.setIgnoreMouseEvents(true, { forward: true });
      } else {
        this.overlayWin.setIgnoreMouseEvents(false);
      }
    } catch {}
  }

  /** Verdadeiro se `wc` é o renderer da janela de overlay (único remetente aceito do retângulo da barra). */
  public isOverlayWebContents(wc: WebContents): boolean {
    return Boolean(
      this.overlayWin && !this.overlayWin.isDestroyed() && !this.overlayWin.webContents.isDestroyed() &&
        this.overlayWin.webContents.id === wc.id
    );
  }

  /** Recebe o retângulo da barra informado pelo overlay (009, RF-902). O hit-test do Linux entra na T903. */
  public setToolbarRect(_rect: unknown): void {}

  public forwardCursorState(state: CursorState): void {
    this.lastCursorState = state;
    if (!this.overlayWin || this.overlayWin.isDestroyed() || this.overlayWin.webContents.isDestroyed()) {
      return;
    }

    let boundsChanged = false;
    if (state.targetBounds && state.targetBounds.w > 0 && state.targetBounds.h > 0) {
      const tb = state.targetBounds;
      const key = `${tb.x},${tb.y},${tb.w},${tb.h}`;
      if (key !== this.lastTargetBoundsKey) {
        this.lastTargetBoundsKey = key;
        boundsChanged = true;
      }

      if (boundsChanged) {
        try {
          const centerPoint = {
            x: Math.round(tb.x + tb.w / 2),
            y: Math.round(tb.y + tb.h / 2),
          };
          const disp = screen.getDisplayNearestPoint(centerPoint);
          if (disp && disp.bounds) {
            const b = disp.bounds;
            if (
              !this.currentDisplayBounds ||
              this.currentDisplayBounds.x !== b.x ||
              this.currentDisplayBounds.y !== b.y ||
              this.currentDisplayBounds.width !== b.width ||
              this.currentDisplayBounds.height !== b.height
            ) {
              this.currentDisplayBounds = { ...b };
              this.overlayWin.setBounds(b);
            }
          }
        } catch {}
      }
    }

    let mlabFocusChanged = false;
    if (typeof state.mlabFocused === 'boolean' && state.mlabFocused !== this.lastMlabFocused) {
      this.lastMlabFocused = state.mlabFocused;
      mlabFocusChanged = true;
    }

    // Só encaminha cursor-state ao overlay quando a Lupa está ligada, quando targetBounds mudou
    // ou quando o estado mlabFocused mudou (sem tráfego IPC de 60Hz desnecessário)
    const spotlightEnabled = Boolean(this.lastState?.spotlight?.enabled);
    if (!spotlightEnabled && !boundsChanged && !mlabFocusChanged) {
      return;
    }

    try {
      this.overlayWin.webContents.send('cursor-state', state);
    } catch {}
  }

  private registerGlobalShortcuts(): void {
    this.unregisterGlobalShortcuts();
    for (const item of GLOBAL_SHORTCUT_MAP) {
      try {
        const ok = globalShortcut.register(item.accelerator, () => {
          this.dispatchShortcutCommand(item.command);
        });
        if (ok) {
          this.registeredAccelerators.push(item.accelerator);
        }
      } catch {}
    }
  }

  private unregisterGlobalShortcuts(): void {
    for (const acc of this.registeredAccelerators) {
      try {
        globalShortcut.unregister(acc);
      } catch {}
    }
    this.registeredAccelerators = [];
  }

  private dispatchShortcutCommand(command: AnnotationShortcutCommand): void {
    if (command === 'toggle-spotlight') {
      const now = Date.now();
      // Se a Lupa foi alternada recentemente (< 350ms) por sincronização do Renderer local,
      // ignora o evento para prevenir cancelamento mútuo instantâneo (double toggle).
      if (now - this.lastSpotlightToggleTime < 350) {
        return;
      }
      this.lastSpotlightToggleTime = now;

      // Para o toggle da Lupa, atualiza o estado canônico absoluto e transmite para evitar corrida de duplo toggle
      if (this.lastState) {
        const willEnable = !this.lastState.spotlight.enabled;
        const updatedState: AnnotationSessionState = {
          ...this.lastState,
          activeTool: willEnable ? 'cursor' : this.lastState.activeTool,
          spotlight: {
            ...this.lastState.spotlight,
            enabled: willEnable,
          },
        };
        this.lastState = updatedState;
        if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.webContents.isDestroyed()) {
          try {
            this.mainWin.webContents.send('annotation-overlay:state', updatedState);
          } catch {}
        }
        if (this.overlayWin && !this.overlayWin.isDestroyed() && !this.overlayWin.webContents.isDestroyed()) {
          try {
            this.overlayWin.webContents.send('annotation-overlay:state', updatedState);
          } catch {}
        }
        return;
      }
    }

    if (this.mainWin && !this.mainWin.isDestroyed() && !this.mainWin.webContents.isDestroyed()) {
      try {
        this.mainWin.webContents.send('annotation-overlay:shortcut', command);
      } catch {}
    }
    if (this.overlayWin && !this.overlayWin.isDestroyed() && !this.overlayWin.webContents.isDestroyed()) {
      try {
        this.overlayWin.webContents.send('annotation-overlay:shortcut', command);
      } catch {}
    }
  }

  public stop(): void {
    this.unregisterGlobalShortcuts();
    if (this.doubleCtrlDetector) {
      this.doubleCtrlDetector.stop();
      this.doubleCtrlDetector.dispose();
      this.doubleCtrlDetector = null;
    }
    this.lastState = null;
    this.lastSpotlightToggleTime = 0;
    this.lastIgnoreMouse = null;
    this.lastTargetBoundsKey = '';
    this.lastMlabFocused = null;
    if (this.overlayWin && !this.overlayWin.isDestroyed()) {
      try {
        this.overlayWin.destroy();
      } catch {}
    }
    this.overlayWin = null;
    this.currentDisplayBounds = null;
  }

  public dispose(): void {
    this.stop();
    this.mainWin = null;
  }
}
