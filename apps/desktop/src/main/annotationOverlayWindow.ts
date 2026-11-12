import { BrowserWindow, globalShortcut, screen, shell, type WebContents } from 'electron';
import { join } from 'path';
import type {
  AnnotationSessionState,
  AnnotationShortcutCommand,
  AnnotationToolbarRect,
  CursorState,
} from '@mlab/types';
import { DoubleCtrlDetector } from './doubleCtrlDetector';
import { hardenWebContents } from './navigationGuard';
import {
  isPointerOverToolbar,
  resolveIgnoreMouse,
  resolveInputRegion,
  sanitizeToolbarRect,
  toDevicePixels,
} from './toolbarHitTest';
import { createX11InputShaper, type X11InputShaper } from './x11InputShape';

/** Período do hit-test da barra no Linux (009, RNF-902). */
export const TOOLBAR_HIT_TEST_INTERVAL_MS = 16;

/**
 * No Linux, `setIgnoreMouseEvents(true, { forward: true })` não encaminha o mouse ao renderer; o main faz o
 * hit-test da barra (009, C-901). Lido a cada chamada para os testes poderem trocar a plataforma.
 */
function needsToolbarHitTest(): boolean {
  return process.platform === 'linux';
}

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
  /** Click-through pedido pelo renderer do overlay; o valor aplicado pode diferir no Linux (009). */
  private requestedIgnoreMouse = true;
  private toolbarRect: AnnotationToolbarRect | null = null;
  private pointerOverToolbar = false;
  private hitTestTimer: ReturnType<typeof setInterval> | null = null;
  /**
   * Linux: região de entrada X11 do overlay (009, C-904). `undefined` = ainda não tentou criar; `null` = indisponível,
   * usa o hit-test por posição do ponteiro (C-901) como alternativa.
   */
  private inputShaper: X11InputShaper | null | undefined = undefined;
  private lastInputRegionKey = '';
  private lastMlabFocused: boolean | null = null;
  private lastCursorState: CursorState | null = null;
  private doubleCtrlDetector: DoubleCtrlDetector | null = null;
  private lastSpotlightToggleTime = 0;
  /** Quantidade de mãos levantadas enviada pela janela do MLab (017, RF-179); reenviada quando o overlay carrega. */
  private lastRaisedHands = 0;

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
      this.reapplyInputRegion();
      return true;
    }

    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const bounds = primaryDisplay.bounds;
      this.currentDisplayBounds = { ...bounds };
      this.lastIgnoreMouse = null;
      this.requestedIgnoreMouse = true;
      this.toolbarRect = null;
      this.pointerOverToolbar = false;
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

      this.lastInputRegionKey = '';
      this.ensureInputShaper();

      // Inicia em modo click-through para que os cliques passem para as janelas abaixo
      this.setIgnoreMouseEvents(true);

      win.once('ready-to-show', () => {
        if (!win.isDestroyed()) {
          try {
            win.setContentProtection(false);
            win.showInactive();
          } catch {}
          this.reapplyInputRegion();
          if (this.lastState && !win.webContents.isDestroyed()) {
            win.webContents.send('annotation-overlay:state', this.lastState);
          }
          if (this.lastCursorState && !win.webContents.isDestroyed()) {
            win.webContents.send('cursor-state', this.lastCursorState);
          }
          if (!win.webContents.isDestroyed()) {
            win.webContents.send('annotation-overlay:raised-hands', this.lastRaisedHands);
          }
        }
      });

      win.webContents.on('did-finish-load', () => {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          if (this.lastState) {
            win.webContents.send('annotation-overlay:state', this.lastState);
          }
          win.webContents.send('annotation-overlay:raised-hands', this.lastRaisedHands);
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
          this.lastInputRegionKey = '';
          this.stopToolbarHitTest();
          this.toolbarRect = null;
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

  /**
   * Recebe da janela do MLab a quantidade de mãos levantadas e repassa só ao overlay (017, RF-179, RNF-172).
   * O overlay não altera a contagem, e valores que não são inteiros ≥ 0 são descartados. Aceita antes do `start()`:
   * o valor fica guardado e vai ao overlay quando ele carregar.
   */
  public setRaisedHands(sender: WebContents, value: unknown): void {
    if (this.isOverlayWebContents(sender)) return;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return;
    if (value === this.lastRaisedHands) return;
    this.lastRaisedHands = value;
    if (this.overlayWin && !this.overlayWin.isDestroyed() && !this.overlayWin.webContents.isDestroyed()) {
      this.overlayWin.webContents.send('annotation-overlay:raised-hands', value);
    }
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
    this.requestedIgnoreMouse = ignore;
    this.applyIgnoreMouse();
  }

  /**
   * Aplica o click-through efetivo. Windows/macOS: o pedido do renderer, como antes (RNF-901). Linux: o pedido,
   * exceto com o ponteiro sobre a barra (RF-901).
   */
  private applyIgnoreMouse(): void {
    if (!this.overlayWin || this.overlayWin.isDestroyed()) return;
    if (needsToolbarHitTest() && this.inputShaper && this.applyInputRegion()) return;
    const ignore = needsToolbarHitTest()
      ? resolveIgnoreMouse(this.requestedIgnoreMouse, this.pointerOverToolbar)
      : this.requestedIgnoreMouse;
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

  /**
   * Recebe o retângulo da barra informado pelo overlay (009, RF-902). Valores inválidos viram `null`. No Linux liga o
   * hit-test enquanto houver retângulo e o desliga com `null` (RNF-902).
   */
  public setToolbarRect(rect: unknown): void {
    const display = this.currentDisplayBounds;
    const maxW = display ? display.width * 2 : 16384;
    const maxH = display ? display.height * 2 : 16384;
    this.toolbarRect = sanitizeToolbarRect(rect, maxW, maxH);

    if (!needsToolbarHitTest()) return;

    // C-904: com a região de entrada X11 não há temporizador; só reaplica a região.
    if (this.inputShaper) {
      this.applyIgnoreMouse();
      if (this.inputShaper) return;
    }

    if (!this.toolbarRect) {
      const wasOver = this.pointerOverToolbar;
      this.stopToolbarHitTest();
      if (wasOver) this.applyIgnoreMouse();
      return;
    }
    this.runToolbarHitTest();
    if (!this.hitTestTimer && this.toolbarRect) {
      this.hitTestTimer = setInterval(() => this.runToolbarHitTest(), TOOLBAR_HIT_TEST_INTERVAL_MS);
    }
  }

  /** Linux: cria a região de entrada X11 uma vez por sessão; sem ela, avisa e fica no hit-test (C-901). */
  private ensureInputShaper(): void {
    if (!needsToolbarHitTest() || this.inputShaper !== undefined) return;
    this.inputShaper = createX11InputShaper();
    if (!this.inputShaper) {
      console.warn('[AnnotationOverlay] região de entrada X11 indisponível; usando hit-test por posição do ponteiro');
    }
  }

  /**
   * Linux (C-904): a janela aceita mouse (`setIgnoreMouseEvents(false)` uma vez) e a região de entrada X11 decide o
   * que atravessa — tela inteira com captura pedida, só a barra com click-through, vazia sem retângulo. Reaplica só
   * quando a região muda. Devolve `false` se a chamada nativa falhar; aí desliga a região e volta ao hit-test.
   */
  private applyInputRegion(): boolean {
    const win = this.overlayWin;
    const shaper = this.inputShaper;
    if (!win || win.isDestroyed() || !shaper) return false;
    try {
      const bounds = win.getBounds();
      const scale = screen.getDisplayMatching(bounds)?.scaleFactor ?? 1;
      const region = toDevicePixels(
        resolveInputRegion(this.requestedIgnoreMouse, this.toolbarRect, bounds),
        scale
      );
      if (this.lastIgnoreMouse !== false) {
        this.lastIgnoreMouse = false;
        this.lastInputRegionKey = '';
        win.setIgnoreMouseEvents(false);
      }
      const key = JSON.stringify(region);
      if (key === this.lastInputRegionKey) return true;
      shaper.apply(win.getNativeWindowHandle(), region);
      this.lastInputRegionKey = key;
      return true;
    } catch (err) {
      console.warn('[AnnotationOverlay] falha na região de entrada X11; usando hit-test por posição do ponteiro', err);
      try {
        shaper.dispose();
      } catch {}
      this.inputShaper = null;
      this.lastInputRegionKey = '';
      this.lastIgnoreMouse = null;
      if (this.toolbarRect && !this.hitTestTimer) {
        this.hitTestTimer = setInterval(() => this.runToolbarHitTest(), TOOLBAR_HIT_TEST_INTERVAL_MS);
      }
      return false;
    }
  }

  /** Reaplica a região de entrada mesmo sem mudança (janela exibida ou redimensionada pode perder a forma). */
  private reapplyInputRegion(): void {
    if (!needsToolbarHitTest() || !this.inputShaper) return;
    this.lastInputRegionKey = '';
    this.applyInputRegion();
  }

  private runToolbarHitTest(): void {
    if (!this.overlayWin || this.overlayWin.isDestroyed() || !this.toolbarRect) {
      this.stopToolbarHitTest();
      return;
    }
    let over = false;
    try {
      const cursor = screen.getCursorScreenPoint();
      const bounds = this.overlayWin.getBounds();
      over = isPointerOverToolbar(cursor, bounds, this.toolbarRect);
    } catch {
      over = false;
    }
    if (over !== this.pointerOverToolbar) {
      this.pointerOverToolbar = over;
      this.applyIgnoreMouse();
    }
  }

  private stopToolbarHitTest(): void {
    if (this.hitTestTimer) {
      clearInterval(this.hitTestTimer);
      this.hitTestTimer = null;
    }
    this.pointerOverToolbar = false;
  }

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
              this.reapplyInputRegion();
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
        } else {
          // 009/RF-903: o sistema (ex.: GNOME/Wayland) recusou a combinação; registra para diagnóstico.
          console.warn(`[AnnotationOverlay] atalho recusado: ${item.accelerator}`);
        }
      } catch (err) {
        console.warn(`[AnnotationOverlay] atalho recusado: ${item.accelerator}`, err);
      }
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
    this.lastRaisedHands = 0;
    this.lastSpotlightToggleTime = 0;
    this.lastIgnoreMouse = null;
    this.stopToolbarHitTest();
    this.toolbarRect = null;
    this.requestedIgnoreMouse = true;
    if (this.inputShaper) {
      try {
        this.inputShaper.dispose();
      } catch {}
    }
    this.inputShaper = undefined;
    this.lastInputRegionKey = '';
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
