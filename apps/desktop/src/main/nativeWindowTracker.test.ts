import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  screen: {
    getCursorScreenPoint: () => ({ x: 250, y: 250 }),
    getDisplayNearestPoint: () => ({
      id: 1,
      scaleFactor: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
    getAllDisplays: () => [
      {
        id: 1,
        scaleFactor: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ],
    getPrimaryDisplay: () => ({
      id: 1,
      scaleFactor: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  },
  powerSaveBlocker: {
    start: vi.fn(() => 1),
    stop: vi.fn(),
    isStarted: vi.fn(() => false),
  },
  BrowserWindow: vi.fn(),
}));

import { createNativeWindowTracker } from './nativeWindowTracker';
import { CursorPresenceTracker } from './cursorPresence';

describe('createNativeWindowTracker & CursorPresenceTracker', () => {
  it('inicializa o tracker nativo da plataforma atual e consulta janelas e bypass sem erros', () => {
    const tracker = createNativeWindowTracker();
    const topAtCursor = tracker.queryTopWindowAtCursor(12345n);
    expect(typeof topAtCursor.cursor.x).toBe('number');
    expect(typeof topAtCursor.cursor.y).toBe('number');
    expect(typeof topAtCursor.isMlabUnderCursor).toBe('boolean');

    const winSnap = tracker.queryWindow(12345n);
    expect(typeof winSnap.cursor.x).toBe('number');
    expect(typeof winSnap.cursor.y).toBe('number');

    expect(() => tracker.setBrowserOcclusionBypass(true)).not.toThrow();
    expect(() => tracker.setBrowserOcclusionBypass(false)).not.toThrow();
    expect(() => tracker.dispose()).not.toThrow();
  });

  it('emite cursor-state via IPC ao iniciar CursorPresenceTracker em modo janela e modo tela', () => {
    const sentMessages: Array<{ channel: string; payload: any }> = [];
    const mockWin: any = {
      isDestroyed: () => false,
      isVisible: () => true,
      isMinimized: () => false,
      isFocused: () => false,
      getMediaSourceId: () => 'window:99999:0',
      getBounds: () => ({ x: 100, y: 100, width: 400, height: 400 }),
      webContents: {
        isDestroyed: () => false,
        send: (channel: string, payload: any) => {
          sentMessages.push({ channel, payload });
        },
      },
    };

    const presence = new CursorPresenceTracker();
    expect(presence.start(mockWin, { sourceId: 'window:12345:0', type: 'window' })).toBe(true);
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);
    expect(sentMessages[0].channel).toBe('cursor-state');
    expect(typeof sentMessages[0].payload.visible).toBe('boolean');

    sentMessages.length = 0;
    expect(presence.start(mockWin, { sourceId: 'screen:0:0', type: 'screen', displayId: '1' })).toBe(true);
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);
    expect(sentMessages[0].channel).toBe('cursor-state');
    expect(typeof sentMessages[0].payload.visible).toBe('boolean');

    presence.stop();
  });
});
