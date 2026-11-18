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

import { createLinuxX11Tracker, createNativeWindowTracker } from './nativeWindowTracker';
import { CursorPresenceTracker } from './cursorPresence';

type XErrorFake = { error_code: number; request_code: number };

/**
 * `koffi` falso para o rastreador X11. Um erro X é entregue ao handler instalado, como o Xlib faz; sem handler próprio,
 * o fake lança no lugar do `exit()` do handler padrão do Xlib. `errorOn` diz quais chamadas recebem o erro.
 */
function fakeLinuxKoffi(opts: { xError?: XErrorFake; errorOn?: string[]; withoutRegister?: boolean } = {}) {
  const PREVIOUS_HANDLER = { handler: 'padrao-do-xlib' };
  let installed: unknown = PREVIOUS_HANDLER;
  const registered: Array<(dpy: unknown, ev: unknown) => number> = [];
  const failsWithError = (name: string): boolean => {
    if (!opts.xError || !opts.errorOn?.includes(name)) return false;
    if (installed === PREVIOUS_HANDLER) throw new Error('handler padrão do Xlib: exit()');
    (installed as (d: unknown, e: unknown) => number)(4242, opts.xError);
    return true;
  };
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    XOpenDisplay: vi.fn(() => 4242),
    XCloseDisplay: vi.fn(() => 0),
    XDefaultRootWindow: vi.fn(() => 1n),
    XQueryPointer: vi.fn((_d, _w, rootRet: bigint[], childRet: bigint[], rootX: number[], rootY: number[]) => {
      rootRet[0] = 1n;
      childRet[0] = 99n;
      rootX[0] = 10;
      rootY[0] = 20;
      return 1;
    }),
    XGetInputFocus: vi.fn((_d, focusRet: bigint[]) => {
      focusRet[0] = 0n;
      return 1;
    }),
    XQueryTree: vi.fn((_d, _w, rootRet: bigint[], parentRet: bigint[]) => {
      if (failsWithError('XQueryTree')) return 0;
      rootRet[0] = 1n;
      parentRet[0] = 1n;
      return 1;
    }),
    XFree: vi.fn(() => 1),
    XGetWindowAttributes: vi.fn((_d, _w, attrs: Record<string, number>) => {
      if (failsWithError('XGetWindowAttributes')) return 0;
      attrs.width = 800;
      attrs.height = 600;
      return 1;
    }),
    XTranslateCoordinates: vi.fn((_d, _s, _t, _x, _y, dx: number[], dy: number[]) => {
      dx[0] = 5;
      dy[0] = 6;
      return 1;
    }),
    XSync: vi.fn(() => 1),
    XSetErrorHandler: vi.fn((h: unknown) => {
      const prev = installed;
      installed = h;
      return prev;
    }),
  };
  const koffi: Record<string, unknown> = {
    load: vi.fn(() => ({
      func: (sig: string) => {
        const name = /\s\*?(\w+)\(/.exec(sig)?.[1] ?? '';
        if (!fns[name]) throw new Error(`função inesperada ${name}`);
        return fns[name];
      },
    })),
    struct: vi.fn((name: string) => ({ name })),
    proto: vi.fn((sig: string) => ({ sig })),
    pointer: vi.fn((t: unknown) => ({ pointerTo: t })),
    type: vi.fn(() => {
      throw new Error('não registrado');
    }),
    unregister: vi.fn(),
    decode: vi.fn((ev: XErrorFake) => ev),
  };
  if (!opts.withoutRegister) {
    koffi.register = vi.fn((fn: (dpy: unknown, ev: unknown) => number) => {
      registered.push(fn);
      return fn;
    });
  }
  return { koffi, fns, PREVIOUS_HANDLER, current: () => installed, registered };
}

describe('erro X no rastreador de janelas Linux (047)', () => {
  it('BadWindow na consulta não encerra o processo: janela não encontrada, sem aviso e handler restaurado', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { koffi, current, PREVIOUS_HANDLER } = fakeLinuxKoffi({
      xError: { error_code: 3, request_code: 15 },
      errorOn: ['XQueryTree', 'XGetWindowAttributes'],
    });
    const tracker = createLinuxX11Tracker(koffi)!;
    expect(tracker).not.toBeNull();
    let snap: ReturnType<typeof tracker.queryWindow> | undefined;
    expect(() => {
      snap = tracker.queryWindow(7n);
    }).not.toThrow();
    expect(snap!.targetBounds).toBeNull();
    expect(snap!.windowUnderCursorId).toBe(99n);
    expect(() => tracker.queryTopWindowAtCursor(7n)).not.toThrow();
    expect(current()).toBe(PREVIOUS_HANDLER);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('outro erro X não lança e gera um único aviso por código', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { koffi, current, PREVIOUS_HANDLER } = fakeLinuxKoffi({
      xError: { error_code: 8, request_code: 3 },
      errorOn: ['XGetWindowAttributes'],
    });
    const tracker = createLinuxX11Tracker(koffi)!;
    expect(tracker.queryWindow(7n).targetBounds).toBeNull();
    expect(tracker.queryWindow(7n).targetBounds).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erro X 8'));
    expect(current()).toBe(PREVIOUS_HANDLER);
    warn.mockRestore();
  });

  it('consulta sem erro devolve os limites da janela e sincroniza com o servidor', () => {
    const { koffi, fns } = fakeLinuxKoffi();
    const tracker = createLinuxX11Tracker(koffi)!;
    expect(tracker.queryWindow(7n).targetBounds).toEqual({ x: 5, y: 6, w: 800, h: 600 });
    expect(fns.XSync).toHaveBeenCalledWith(4242, 0);
  });

  it('sem koffi.register o rastreador não é criado (fallback do Electron)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { koffi } = fakeLinuxKoffi({ withoutRegister: true });
    expect(createLinuxX11Tracker(koffi)).toBeNull();
    warn.mockRestore();
  });

  it('dispose fecha o display e libera o callback', () => {
    const { koffi, fns, registered } = fakeLinuxKoffi();
    const tracker = createLinuxX11Tracker(koffi)!;
    tracker.dispose();
    expect(fns.XCloseDisplay).toHaveBeenCalledWith(4242);
    expect(koffi.unregister).toHaveBeenCalledWith(registered[0]);
  });
});

describe('createNativeWindowTracker & CursorPresenceTracker', () => {
  it('inicializa o tracker nativo da plataforma atual e consulta janelas e bypass sem erros', () => {
    const tracker = createNativeWindowTracker();
    if (!tracker) {
      // Em ambientes Linux headless (ex: CI ubuntu-latest sem Xvfb/DISPLAY), o fallback seguro retorna null
      expect(tracker).toBeNull();
      return;
    }
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
