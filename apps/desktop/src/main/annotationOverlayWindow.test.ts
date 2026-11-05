import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    cursor: { x: 0, y: 0 },
    windows: [] as any[],
    registerResult: true as boolean | 'throw',
    /** Região de entrada X11 falsa (C-904); `null` = indisponível, usa o hit-test alternativo. */
    shaper: null as null | { apply: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> },
    scaleFactor: 1,
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
    setBounds(b: { x: number; y: number; width: number; height: number }) {
      Object.assign(this.opts, b);
    }
    getNativeWindowHandle() {
      const b = Buffer.alloc(8);
      b.writeBigUInt64LE(0x600004n);
      return b;
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
    getDisplayMatching: () => ({ scaleFactor: h.state.scaleFactor }),
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

vi.mock('./x11InputShape', () => ({ createX11InputShaper: vi.fn(() => h.state.shaper) }));

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
  h.state.shaper = null;
  h.state.scaleFactor = 1;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setPlatform(originalPlatform);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AnnotationOverlayManager — Linux, hit-test alternativo sem região X11 (009/RF-901, RNF-902)', () => {
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

describe('AnnotationOverlayManager — Linux, região de entrada X11 (009/RF-901, RNF-902, C-904)', () => {
  const FULL = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  const XID = 0x600004n;

  beforeEach(() => {
    setPlatform('linux');
    h.state.shaper = { apply: vi.fn(), dispose: vi.fn() };
  });

  const regions = () => h.state.shaper!.apply.mock.calls.map((c) => c[1]);
  const lastRegion = () => regions().at(-1);

  it('aceita mouse uma vez e recorta a entrada na barra com click-through', () => {
    const { mgr, win } = startManager();
    expect(win.ignoreCalls).toEqual([[false]]);
    expect(lastRegion()).toEqual([]);
    expect(h.state.shaper!.apply.mock.calls[0][0].readBigUInt64LE(0)).toBe(XID);

    mgr.setToolbarRect(RECT);
    expect(lastRegion()).toEqual([RECT]);
    expect(vi.getTimerCount()).toBe(0);
    expect(win.ignoreCalls).toEqual([[false]]);
    mgr.stop();
  });

  it('tela inteira com captura pedida e de volta à barra com click-through', () => {
    const { mgr } = startManager();
    mgr.setToolbarRect(RECT);
    mgr.setIgnoreMouseEvents(false);
    expect(lastRegion()).toEqual(FULL);
    mgr.setIgnoreMouseEvents(true);
    expect(lastRegion()).toEqual([RECT]);
    mgr.stop();
  });

  it('retângulo nulo (MLab em foco, C-903) deixa a região vazia', () => {
    const { mgr } = startManager();
    mgr.setToolbarRect(RECT);
    mgr.setToolbarRect(null);
    expect(lastRegion()).toEqual([]);
    mgr.stop();
  });

  it('não reaplica a mesma região', () => {
    const { mgr } = startManager();
    mgr.setToolbarRect(RECT);
    const n = regions().length;
    mgr.setToolbarRect({ ...RECT });
    mgr.setIgnoreMouseEvents(true);
    expect(regions().length).toBe(n);
    mgr.stop();
  });

  it('converte para pixels físicos pela escala do display', () => {
    h.state.scaleFactor = 2;
    const { mgr } = startManager();
    mgr.setToolbarRect(RECT);
    expect(lastRegion()).toEqual([{ x: 200, y: 40, width: 880, height: 108 }]);
    mgr.stop();
  });

  it('reaplica ao exibir a janela e ao mudar os limites do overlay', () => {
    const { mgr, win } = startManager();
    mgr.setToolbarRect(RECT);
    const n = regions().length;
    (win as any).handlers['ready-to-show']?.();
    expect(regions().length).toBe(n + 1);

    mgr.setIgnoreMouseEvents(false);
    mgr.forwardCursorState({ visible: true, x: 0.5, y: 0.5, targetBounds: { x: 10, y: 10, w: 800, h: 600 } } as any);
    expect(regions().length).toBeGreaterThan(n + 1);
    mgr.stop();
  });

  it('falha na chamada nativa volta ao hit-test alternativo, com aviso', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mgr, win } = startManager();
    h.state.shaper!.apply.mockImplementation(() => {
      throw new Error('BadMatch');
    });
    mgr.setToolbarRect(RECT);
    expect(warn).toHaveBeenCalledWith(
      '[AnnotationOverlay] falha na região de entrada X11; usando hit-test por posição do ponteiro',
      expect.any(Error)
    );
    expect(h.state.shaper!.dispose).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    h.state.cursor = { x: 300, y: 40 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([false]);
    h.state.cursor = { x: 900, y: 600 };
    vi.advanceTimersByTime(TOOLBAR_HIT_TEST_INTERVAL_MS);
    expect(win.ignoreCalls.at(-1)).toEqual([true, { forward: true }]);
    mgr.stop();
  });

  it('avisa uma vez quando a região X11 não existe', () => {
    h.state.shaper = null;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mgr } = startManager();
    mgr.setToolbarRect(RECT);
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes('região de entrada X11 indisponível'))
    ).toHaveLength(1);
    mgr.stop();
  });

  it('libera a região no stop()', () => {
    const shaper = h.state.shaper!;
    const { mgr } = startManager();
    mgr.stop();
    expect(shaper.dispose).toHaveBeenCalledTimes(1);
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
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('atalho recusado'))).toEqual([]);
    mgr.stop();
  });
});
