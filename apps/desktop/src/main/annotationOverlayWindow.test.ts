import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    cursor: { x: 0, y: 0 },
    windows: [] as any[],
    registerResult: true as boolean | 'throw',
  };
  class FakeBrowserWindow {
    public ignoreCalls: Array<[boolean, unknown?]> = [];
    public destroyed = false;
    private handlers: Record<string, () => void> = {};
    public webContents = {
      id: 77,
      isDestroyed: () => false,
      send: () => {},
      on: () => {},
    };
    constructor(public opts: any) {
      state.windows.push(this);
    }
    setIgnoreMouseEvents(ignore: boolean, options?: unknown) {
      this.ignoreCalls.push(options === undefined ? [ignore] : [ignore, options]);
    }
    getBounds() {
      return { x: this.opts.x, y: this.opts.y, width: this.opts.width, height: this.opts.height };
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
      this.handlers['closed']?.();
    }
    once(ev: string, cb: () => void) {
      this.handlers[ev] = cb;
    }
    on(ev: string, cb: () => void) {
      this.handlers[ev] = cb;
    }
    setContentProtection() {}
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    showInactive() {}
    loadFile() {
      return Promise.resolve();
    }
    loadURL() {
      return Promise.resolve();
    }
  }
  return { state, FakeBrowserWindow };
});

vi.mock('electron', () => ({
  BrowserWindow: h.FakeBrowserWindow,
  globalShortcut: {
    register: vi.fn(() => {
      if (h.state.registerResult === 'throw') throw new Error('portal indisponível');
      return h.state.registerResult;
    }),
    unregister: vi.fn(),
  },
  screen: {
    getPrimaryDisplay: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
    getCursorScreenPoint: () => h.state.cursor,
    getDisplayNearestPoint: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }),
  },
  shell: { openExternal: vi.fn() },
}));

vi.mock('./doubleCtrlDetector', () => ({
  DoubleCtrlDetector: class {
    start() {}
    stop() {}
    dispose() {}
  },
}));

vi.mock('./navigationGuard', () => ({ hardenWebContents: vi.fn() }));

import { AnnotationOverlayManager, TOOLBAR_HIT_TEST_INTERVAL_MS } from './annotationOverlayWindow';

const originalPlatform = process.platform;
function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

const mainWin = { isDestroyed: () => false, webContents: { id: 1, isDestroyed: () => false, send: () => {} } } as any;
const RECT = { x: 100, y: 20, width: 440, height: 54 };

function startManager() {
  const mgr = new AnnotationOverlayManager();
  mgr.start(mainWin, 'preload.js');
  const win = h.state.windows[h.state.windows.length - 1];
  return { mgr, win };
}

beforeEach(() => {
  vi.useFakeTimers();
  h.state.cursor = { x: 0, y: 0 };
  h.state.windows = [];
  h.state.registerResult = true;
});

afterEach(() => {
  setPlatform(originalPlatform);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AnnotationOverlayManager — Linux (009/RF-901, RNF-902)', () => {
  beforeEach(() => setPlatform('linux'));

  it('sai do click-through com o ponteiro sobre a barra e volta ao sair', () => {
    const { mgr, win } = startManager();
    expect(win.ignoreCalls.at(-1)).toEqual([true, { forward: true }]);

    mgr.setToolbarRect(RECT);
    h.state.cursor = { x: 300, y: 40 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([false]);

    h.state.cursor = { x: 900, y: 600 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([true, { forward: true }]);
    mgr.stop();
  });

  it('só chama setIgnoreMouseEvents quando o valor efetivo muda', () => {
    const { mgr, win } = startManager();
    mgr.setToolbarRect(RECT);
    h.state.cursor = { x: 300, y: 40 };
    const before = win.ignoreCalls.length;
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS * 20);
    expect(win.ignoreCalls.length).toBe(before + 1);
    mgr.stop();
  });

  it('barra recolhida: o retângulo menor é o que vale', () => {
    const { mgr, win } = startManager();
    mgr.setToolbarRect({ x: 100, y: 20, width: 52, height: 52 });
    h.state.cursor = { x: 300, y: 40 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([true, { forward: true }]);
    h.state.cursor = { x: 120, y: 40 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([false]);
    mgr.stop();
  });

  it('ferramenta de desenho: o overlay captura em qualquer lugar', () => {
    const { mgr, win } = startManager();
    mgr.setToolbarRect(RECT);
    mgr.setIgnoreMouseEvents(false);
    h.state.cursor = { x: 900, y: 600 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([false]);
    mgr.stop();
  });

  it('retângulo nulo ou inválido desliga o hit-test e devolve o click-through', () => {
    const { mgr, win } = startManager();
    mgr.setToolbarRect(RECT);
    h.state.cursor = { x: 300, y: 40 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([false]);

    mgr.setToolbarRect(null);
    expect(win.ignoreCalls.at(-1)).toEqual([true, { forward: true }]);
    expect(vi.getTimerCount()).toBe(0);

    mgr.setToolbarRect({ x: 'a', y: 0, width: 10, height: 10 });
    expect(vi.getTimerCount()).toBe(0);
    mgr.stop();
  });

  it('para o temporizador no stop()', () => {
    const { mgr } = startManager();
    mgr.setToolbarRect(RECT);
    expect(vi.getTimerCount()).toBe(1);
    mgr.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aceita retângulo só do webContents do overlay', () => {
    const { mgr, win } = startManager();
    expect(mgr.isOverlayWebContents(win.webContents)).toBe(true);
    expect(mgr.isOverlayWebContents(mainWin.webContents)).toBe(false);
    mgr.stop();
  });
});

describe('AnnotationOverlayManager — Windows (009/RNF-901)', () => {
  beforeEach(() => setPlatform('win32'));

  it('não roda hit-test nem muda o click-through pedido pelo renderer', () => {
    const { mgr, win } = startManager();
    mgr.setToolbarRect(RECT);
    expect(vi.getTimerCount()).toBe(0);
    h.state.cursor = { x: 300, y: 40 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS * 5);
    expect(win.ignoreCalls).toEqual([[true, { forward: true }]]);

    mgr.setIgnoreMouseEvents(false);
    mgr.setIgnoreMouseEvents(true);
    expect(win.ignoreCalls).toEqual([[true, { forward: true }], [false], [true, { forward: true }]]);
    mgr.stop();
  });
});

describe('AnnotationOverlayManager — atalhos recusados (009/RF-903)', () => {
  it('registra em log cada atalho recusado', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.state.registerResult = false;
    const { mgr } = startManager();
    expect(warn).toHaveBeenCalledWith('[AnnotationOverlay] atalho recusado: Alt+H');
    expect(warn).toHaveBeenCalledWith('[AnnotationOverlay] atalho recusado: Alt+Shift+X');
    mgr.stop();
  });

  it('registra em log quando o registro lança exceção', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.state.registerResult = 'throw';
    const { mgr } = startManager();
    expect(warn).toHaveBeenCalledWith('[AnnotationOverlay] atalho recusado: Alt+V', expect.any(Error));
    mgr.stop();
  });

  it('não registra nada quando todos os atalhos são aceitos', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mgr } = startManager();
    expect(warn).not.toHaveBeenCalled();
    mgr.stop();
  });
});
