import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const BOUNDS: Record<string, { x: number; y: number; w: number; h: number }> = {
    '101': { x: 0, y: 0, w: 800, h: 600 },
    '202': { x: 1000, y: 0, w: 400, h: 300 },
    '303': { x: 0, y: 700, w: 300, h: 200 },
  };
  const state = {
    foreground: 101n as bigint | null,
    underCursor: 101n as bigint | null,
    cursor: { x: 100, y: 100 },
    queried: [] as bigint[],
  };
  const tracker = {
    queryWindow: (target: bigint) => {
      state.queried.push(target);
      return {
        cursor: state.cursor,
        foregroundWindowId: state.foreground,
        windowUnderCursorId: state.underCursor,
        targetBounds: BOUNDS[String(target)] ?? null,
      };
    },
    queryTopWindowAtCursor: () => ({ cursor: state.cursor, isMlabUnderCursor: false }),
    setBrowserOcclusionBypass: () => {},
    dispose: () => {},
  };
  return { state, tracker, BOUNDS };
});

vi.mock('electron', () => ({
  powerSaveBlocker: { start: vi.fn(() => 1), isStarted: vi.fn(() => false), stop: vi.fn() },
  screen: {
    getCursorScreenPoint: () => h.state.cursor,
    getDisplayNearestPoint: () => ({ scaleFactor: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
    getAllDisplays: () => [],
    getPrimaryDisplay: () => ({ scaleFactor: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
  },
  BrowserWindow: class {},
}));

vi.mock('./nativeWindowTracker', () => ({ createNativeWindowTracker: () => h.tracker }));

import { CursorPresenceTracker } from './cursorPresence';

const A = 'window:101:0';
const B = 'window:202:0';
const C = 'window:303:0';

function fakeWin() {
  const sent: Array<[string, any]> = [];
  const win = {
    isDestroyed: () => false,
    isFocused: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    getBounds: () => ({ x: 5000, y: 5000, width: 10, height: 10 }),
    getMediaSourceId: () => 'window:999:0',
    webContents: {
      isDestroyed: () => false,
      send: (channel: string, payload: any) => sent.push([channel, payload]),
    },
  };
  return { win: win as any, sent };
}

const changed = (sent: Array<[string, any]>) => sent.filter(([c]) => c === 'active-window-changed').map(([, p]) => p.sourceId);
const lastCursorState = (sent: Array<[string, any]>) => [...sent].reverse().find(([c]) => c === 'cursor-state')?.[1];

describe('CursorPresenceTracker — janela fixada (032)', () => {
  let tracker: CursorPresenceTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    h.state.foreground = 101n;
    h.state.underCursor = 101n;
    h.state.cursor = { x: 100, y: 100 };
    h.state.queried = [];
    tracker = new CursorPresenceTracker();
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
  });

  it('com a janela fixada, o foco em outra autorizada emite o evento e o cursor continua calculado sobre a fixada (RF-3203, RF-3208)', () => {
    const { win, sent } = fakeWin();
    tracker.start(win, { sourceId: A, type: 'window', allowedSourceIds: [A, B], pinnedSourceId: A });

    h.state.foreground = 202n;
    h.state.underCursor = 202n;
    h.state.cursor = { x: 1100, y: 100 };
    h.state.queried = [];
    vi.advanceTimersByTime(16);

    expect(changed(sent)).toEqual([B]);
    expect(h.state.queried.every((id) => id === 101n)).toBe(true);
    const state = lastCursorState(sent);
    expect(state.visible).toBe(false); // foco e ponteiro em B, alvo A
    expect(state.targetBounds).toEqual(h.BOUNDS['101']);

    // O evento sai uma vez por mudança de foco, também ao voltar para a fixada.
    vi.advanceTimersByTime(16);
    expect(changed(sent)).toEqual([B]);
    h.state.foreground = 101n;
    h.state.underCursor = 101n;
    h.state.cursor = { x: 100, y: 100 };
    vi.advanceTimersByTime(16);
    expect(changed(sent)).toEqual([B, A]);
    expect(lastCursorState(sent).visible).toBe(true);
  });

  it('sem janela fixada, o alvo do cursor segue o foco como antes (RF-3210)', () => {
    const { win, sent } = fakeWin();
    tracker.start(win, { sourceId: A, type: 'window', allowedSourceIds: [A, B] });

    h.state.foreground = 202n;
    h.state.underCursor = 202n;
    h.state.cursor = { x: 1100, y: 100 };
    vi.advanceTimersByTime(16);

    expect(changed(sent)).toEqual([B]);
    const state = lastCursorState(sent);
    expect(state.visible).toBe(true);
    expect(state.targetBounds).toEqual(h.BOUNDS['202']);
  });

  it('ignora pinnedSourceId fora das janelas autorizadas (RF-3211)', () => {
    const { win, sent } = fakeWin();
    tracker.start(win, { sourceId: A, type: 'window', allowedSourceIds: [A, B], pinnedSourceId: C });

    h.state.foreground = 202n;
    h.state.underCursor = 202n;
    h.state.cursor = { x: 1100, y: 100 };
    vi.advanceTimersByTime(16);

    expect(changed(sent)).toEqual([B]);
    expect(lastCursorState(sent).targetBounds).toEqual(h.BOUNDS['202']);
  });

  it('um novo start sem pinnedSourceId desfaz a fixação anterior', () => {
    const { win, sent } = fakeWin();
    tracker.start(win, { sourceId: A, type: 'window', allowedSourceIds: [A, B], pinnedSourceId: A });
    tracker.start(win, { sourceId: A, type: 'window', allowedSourceIds: [A, B] });

    h.state.foreground = 202n;
    h.state.underCursor = 202n;
    h.state.cursor = { x: 1100, y: 100 };
    vi.advanceTimersByTime(16);

    expect(lastCursorState(sent).targetBounds).toEqual(h.BOUNDS['202']);
  });
});
