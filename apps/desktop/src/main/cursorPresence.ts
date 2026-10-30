import { BrowserWindow, powerSaveBlocker, screen } from 'electron';
import type { CaptureSourceType, CursorState } from '@mlab/types';
import {
  containsPoint,
  isCursorVisibleScreenMode,
  isCursorVisibleWindowMode,
  parseWindowHandle,
  toNormalizedCursorRect,
  type Point,
  type Rect,
} from '../shared/cursorVisibility';
import { createNativeWindowTracker, type NativeWindowTracker } from './nativeWindowTracker';

export interface CursorTrackingTarget {
  sourceId: string;
  type: CaptureSourceType;
  displayId?: string;
  allowedSourceIds?: string[];
}

export class CursorPresenceTracker {
  private timer: NodeJS.Timeout | null = null;
  private nativeTracker: NativeWindowTracker | null | undefined = undefined;
  private powerSaveId: number | null = null;
  private lastCursor: Point | null = null;
  private lastSentJson = '';
  private stateListener: ((state: CursorState) => void) | null = null;
  private allowedWindowMap: Map<bigint, string> = new Map();
  private currentActiveSourceId: string | null = null;
  private currentTargetWindowId: bigint | null = null;
  private lastUnauthorizedState = false;

  public setStateListener(cb: ((state: CursorState) => void) | null): void {
    this.stateListener = cb;
  }

  private getNativeTracker(): NativeWindowTracker | null {
    if (this.nativeTracker === undefined) {
      this.nativeTracker = createNativeWindowTracker();
    }
    return this.nativeTracker;
  }

  public start(win: BrowserWindow, target: CursorTrackingTarget): boolean {
    this.stopTimerOnly();

    // Impede que o SO aplique App Nap (macOS) ou throttling de energia durante a transmissão
    if (this.powerSaveId === null || !powerSaveBlocker.isStarted(this.powerSaveId)) {
      try {
        this.powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
      } catch {}
    }

    const tracker = this.getNativeTracker();
    this.allowedWindowMap.clear();
    this.currentActiveSourceId = target.sourceId;
    this.currentTargetWindowId = target.type === 'window' ? parseWindowHandle(target.sourceId) : null;
    this.lastUnauthorizedState = false;

    if (target.allowedSourceIds && target.allowedSourceIds.length > 0) {
      for (const sId of target.allowedSourceIds) {
        const h = parseWindowHandle(sId);
        if (h !== null) {
          this.allowedWindowMap.set(h, sId);
        }
      }
    }

    let mlabWindowId: bigint | null = null;
    try {
      if (!win.isDestroyed() && typeof win.getMediaSourceId === 'function') {
        mlabWindowId = parseWindowHandle(win.getMediaSourceId());
      }
    } catch {}

    if (target.type !== 'window') {
      tracker?.setBrowserOcclusionBypass(false);
    }

    const tick = () => {
      if (win.isDestroyed() || win.webContents.isDestroyed()) {
        this.stop();
        return;
      }

      try {
        // Rastreamento dinâmico de foco para múltiplas janelas autorizadas
        if (target.type === 'window' && this.allowedWindowMap.size > 1 && tracker) {
          const snap = tracker.queryWindow(this.currentTargetWindowId || 0n);
          const fg = snap.foregroundWindowId;
          if (fg !== null && fg > 0n) {
            if (this.allowedWindowMap.has(fg)) {
              if (this.lastUnauthorizedState) {
                this.lastUnauthorizedState = false;
                win.webContents.send('active-window-unauthorized', { isUnauthorized: false });
              }
              const matchedSourceId = this.allowedWindowMap.get(fg)!;
              if (matchedSourceId !== this.currentActiveSourceId) {
                this.currentActiveSourceId = matchedSourceId;
                this.currentTargetWindowId = fg;
                win.webContents.send('active-window-changed', { sourceId: matchedSourceId });
              }
            } else if (mlabWindowId === null || fg !== mlabWindowId) {
              if (!this.lastUnauthorizedState) {
                this.lastUnauthorizedState = true;
                win.webContents.send('active-window-unauthorized', { isUnauthorized: true });
              }
            }
          }
        }

        const state =
          target.type === 'window'
            ? this.computeWindowState(win, tracker, this.currentTargetWindowId, mlabWindowId)
            : this.computeScreenState(win, tracker, mlabWindowId, target.displayId);

        const serialized = JSON.stringify(state);
        if (serialized !== this.lastSentJson) {
          this.lastSentJson = serialized;
          win.webContents.send('cursor-state', state);
          if (this.stateListener) {
            try {
              this.stateListener(state);
            } catch {}
          }
        }
      } catch {
        // Nunca interrompe o loop por falha transitória de consulta ao SO
      }
    };

    tick();
    this.timer = setInterval(tick, 16);
    return true;
  }

  private computeWindowState(
    win: BrowserWindow,
    tracker: NativeWindowTracker | null,
    targetWindowId: bigint | null,
    mlabWindowId: bigint | null = null
  ): CursorState {
    const isWinFocused = !win.isDestroyed() && win.isFocused() && !win.isMinimized();
    let cursorInMlab = false;
    if (isWinFocused && win.isVisible()) {
      try {
        const cursorDip = screen.getCursorScreenPoint();
        const b = win.getBounds();
        cursorInMlab = containsPoint({ x: b.x, y: b.y, w: b.width, h: b.height }, cursorDip);
      } catch {}
    }

    if (tracker && targetWindowId !== null) {
      const snap = tracker.queryWindow(targetWindowId);
      const velocity = this.computeVelocity(snap.cursor);

      let scale = 1;
      try {
        const disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        if (disp && disp.scaleFactor > 0) {
          scale = process.platform === 'win32' ? disp.scaleFactor : 1;
        }
      } catch {}

      const visible = isCursorVisibleWindowMode({
        foreground: snap.foregroundWindowId,
        underCursor: snap.windowUnderCursorId,
        target: targetWindowId,
      });

      const isMlabUnder =
        mlabWindowId !== null && mlabWindowId > 0n
          ? snap.windowUnderCursorId === mlabWindowId
          : cursorInMlab;

      const rect = toNormalizedCursorRect(snap.cursor, snap.targetBounds, scale, velocity);
      const targetBounds = snap.targetBounds
        ? {
            x: Math.round(snap.targetBounds.x / scale),
            y: Math.round(snap.targetBounds.y / scale),
            w: Math.round(snap.targetBounds.w / scale),
            h: Math.round(snap.targetBounds.h / scale),
          }
        : null;

      return {
        visible,
        rect: rect ? this.roundRect(rect) : null,
        targetBounds,
        mlabFocused: isWinFocused && cursorInMlab && isMlabUnder && !visible,
      };
    }

    // Fallback seguro caso o tracker nativo não esteja disponível
    return {
      visible: !isWinFocused,
      rect: null,
      targetBounds: null,
      mlabFocused: isWinFocused && cursorInMlab,
    };
  }

  private computeScreenState(
    win: BrowserWindow,
    tracker: NativeWindowTracker | null,
    mlabWindowId: bigint | null,
    displayId?: string
  ): CursorState {
    const cursorDip = screen.getCursorScreenPoint();
    const velocity = this.computeVelocity(cursorDip);

    const displays = screen.getAllDisplays();
    const targetDisplay =
      (displayId ? displays.find((d) => String(d.id) === String(displayId)) : undefined) ||
      screen.getDisplayNearestPoint(cursorDip) ||
      screen.getPrimaryDisplay();

    const displayRect: Rect = {
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      w: targetDisplay.bounds.width,
      h: targetDisplay.bounds.height,
    };

    let visible = true;
    const isWinFocused = !win.isDestroyed() && win.isFocused() && !win.isMinimized();
    if (!win.isDestroyed() && win.isVisible() && !win.isMinimized()) {
      const b = win.getBounds();
      const mlabRect: Rect = { x: b.x, y: b.y, w: b.width, h: b.height };
      const cursorInMlabBounds = containsPoint(mlabRect, cursorDip);
      if (cursorInMlabBounds) {
        const isMlabUnderCursor = tracker
          ? tracker.queryTopWindowAtCursor(mlabWindowId).isMlabUnderCursor
          : true;
        visible = isCursorVisibleScreenMode({
          isMlabUnderCursor,
          cursorInMlabBounds,
        });
      }
    }

    const rect = toNormalizedCursorRect(cursorDip, displayRect, 1, velocity);
    return {
      visible,
      rect: rect ? this.roundRect(rect) : null,
      targetBounds: displayRect,
      mlabFocused: isWinFocused && !visible,
    };
  }

  private computeVelocity(curr: Point): { vx: number; vy: number } {
    if (!this.lastCursor) {
      this.lastCursor = curr;
      return { vx: 0, vy: 0 };
    }
    const vx = curr.x - this.lastCursor.x;
    const vy = curr.y - this.lastCursor.y;
    this.lastCursor = curr;
    return { vx, vy };
  }

  private roundRect(r: { x: number; y: number; w: number; h: number }) {
    return {
      x: Math.round(r.x * 10000) / 10000,
      y: Math.round(r.y * 10000) / 10000,
      w: Math.round(r.w * 10000) / 10000,
      h: Math.round(r.h * 10000) / 10000,
    };
  }

  private stopTimerOnly(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.lastCursor = null;
    this.lastSentJson = '';
    this.allowedWindowMap.clear();
    this.currentActiveSourceId = null;
    this.currentTargetWindowId = null;
    this.lastUnauthorizedState = false;
  }

  public stop(): void {
    this.stopTimerOnly();
    if (this.nativeTracker) {
      this.nativeTracker.setBrowserOcclusionBypass(false);
    }
    if (this.powerSaveId !== null && powerSaveBlocker.isStarted(this.powerSaveId)) {
      try {
        powerSaveBlocker.stop(this.powerSaveId);
      } catch {}
      this.powerSaveId = null;
    }
  }

  public dispose(): void {
    this.stop();
    if (this.nativeTracker) {
      this.nativeTracker.dispose();
      this.nativeTracker = null;
    }
  }
}
