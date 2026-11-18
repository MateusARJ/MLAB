import { describe, it, expect, vi } from 'vitest';
import {
  createX11InputShaper,
  readXid,
  SHAPE_INPUT,
  SHAPE_SET,
  SHAPE_UNSORTED,
  X_BAD_WINDOW,
} from './x11InputShape';

type XErrorFake = { error_code: number; request_code: number };

/**
 * koffi falso: registra as funções declaradas e devolve mocks controláveis. `xError` simula um erro X entregue ao
 * handler instalado durante o `XSync`, como o Xlib faz.
 */
function fakeKoffi(opts: { failLib?: string; display?: number; xError?: XErrorFake } = {}) {
  const PREVIOUS_HANDLER = { handler: 'anterior' };
  let installed: unknown = PREVIOUS_HANDLER;
  const registered: Array<(dpy: unknown, ev: unknown) => number> = [];
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    XOpenDisplay: vi.fn(() => opts.display ?? 4242),
    XCloseDisplay: vi.fn(() => 0),
    XSync: vi.fn((dpy: unknown) => {
      if (opts.xError && installed !== PREVIOUS_HANDLER) {
        (installed as (d: unknown, e: unknown) => number)(dpy, opts.xError);
      }
      return 1;
    }),
    XSetErrorHandler: vi.fn((h: unknown) => {
      const prev = installed;
      installed = h;
      return prev;
    }),
    XShapeCombineRectangles: vi.fn(),
  };
  const load = vi.fn((lib: string) => {
    if (opts.failLib && lib === opts.failLib) throw new Error(`não achou ${lib}`);
    return {
      func: (sig: string) => {
        const name = /\s\*?(\w+)\(/.exec(sig)?.[1] ?? '';
        if (!fns[name]) throw new Error(`função inesperada ${name}`);
        return fns[name];
      },
    };
  });
  const koffi = {
    load,
    struct: vi.fn((name: string) => ({ name })),
    proto: vi.fn((sig: string) => ({ sig })),
    pointer: vi.fn((t: unknown) => ({ pointerTo: t })),
    type: vi.fn(() => {
      throw new Error('não registrado');
    }),
    register: vi.fn((fn: (dpy: unknown, ev: unknown) => number) => {
      registered.push(fn);
      return fn;
    }),
    unregister: vi.fn(),
    decode: vi.fn((ev: XErrorFake) => ev),
  };
  return { koffi, fns, load, PREVIOUS_HANDLER, current: () => installed, registered };
}

function handle64(xid: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(xid);
  return b;
}

describe('readXid (009/C-904)', () => {
  it('lê XID de 64 e de 32 bits', () => {
    expect(readXid(handle64(0x600004n))).toBe(0x600004n);
    const b = Buffer.alloc(4);
    b.writeUInt32LE(0x1234);
    expect(readXid(b)).toBe(0x1234n);
  });

  it('devolve 0 para handle vazio ou inválido', () => {
    expect(readXid(Buffer.alloc(0))).toBe(0n);
    expect(readXid(null as unknown as Buffer)).toBe(0n);
  });
});

describe('createX11InputShaper (009/C-904)', () => {
  it('carrega libX11 e libXext e abre o display padrão', () => {
    const { koffi, fns, load } = fakeKoffi();
    const shaper = createX11InputShaper(() => koffi);
    expect(shaper).not.toBeNull();
    expect(load).toHaveBeenCalledWith('libX11.so.6');
    expect(load).toHaveBeenCalledWith('libXext.so.6');
    expect(fns.XOpenDisplay).toHaveBeenCalledWith(null);
  });

  it('devolve null sem koffi, sem libXext ou sem display', () => {
    expect(
      createX11InputShaper(() => {
        throw new Error('sem koffi');
      })
    ).toBeNull();
    expect(createX11InputShaper(() => fakeKoffi({ failLib: 'libXext.so.6' }).koffi)).toBeNull();
    expect(createX11InputShaper(() => fakeKoffi({ display: 0 }).koffi)).toBeNull();
  });

  it('aplica a região de entrada com ShapeInput/ShapeSet e sincroniza com o servidor', () => {
    const { koffi, fns } = fakeKoffi();
    const shaper = createX11InputShaper(() => koffi)!;
    const rects = [{ x: 24, y: 140, width: 496, height: 46 }];
    shaper.apply(handle64(0x600004n), rects);
    expect(fns.XShapeCombineRectangles).toHaveBeenCalledWith(
      4242,
      0x600004n,
      SHAPE_INPUT,
      0,
      0,
      rects,
      1,
      SHAPE_SET,
      SHAPE_UNSORTED
    );
    expect(fns.XSync).toHaveBeenCalledWith(4242, 0);
  });

  it('aplica região vazia (tudo atravessa)', () => {
    const { koffi, fns } = fakeKoffi();
    const shaper = createX11InputShaper(() => koffi)!;
    shaper.apply(handle64(7n), []);
    expect(fns.XShapeCombineRectangles).toHaveBeenCalledWith(4242, 7n, SHAPE_INPUT, 0, 0, [], 0, SHAPE_SET, SHAPE_UNSORTED);
  });

  it('não chama o X com XID 0 nem depois do dispose', () => {
    const { koffi, fns } = fakeKoffi();
    const shaper = createX11InputShaper(() => koffi)!;
    shaper.apply(Buffer.alloc(8), []);
    expect(fns.XShapeCombineRectangles).not.toHaveBeenCalled();

    shaper.dispose();
    expect(fns.XCloseDisplay).toHaveBeenCalledWith(4242);
    shaper.apply(handle64(7n), []);
    expect(fns.XShapeCombineRectangles).not.toHaveBeenCalled();
    shaper.dispose();
    expect(fns.XCloseDisplay).toHaveBeenCalledTimes(1);
  });
});

describe('erro X na região de entrada (009/T911)', () => {
  it('instala o handler próprio só durante a chamada e devolve o anterior', () => {
    const { koffi, fns, PREVIOUS_HANDLER, current, registered } = fakeKoffi();
    const shaper = createX11InputShaper(() => koffi)!;
    shaper.apply(handle64(7n), []);
    expect(fns.XSetErrorHandler).toHaveBeenNthCalledWith(1, registered[0]);
    expect(fns.XSetErrorHandler).toHaveBeenNthCalledWith(2, PREVIOUS_HANDLER);
    expect(current()).toBe(PREVIOUS_HANDLER);
    const order = [
      fns.XSetErrorHandler.mock.invocationCallOrder[0],
      fns.XShapeCombineRectangles.mock.invocationCallOrder[0],
      fns.XSync.mock.invocationCallOrder[0],
      fns.XSetErrorHandler.mock.invocationCallOrder[1],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('ignora BadWindow com aviso no log, sem lançar', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { koffi, current, PREVIOUS_HANDLER } = fakeKoffi({
      xError: { error_code: X_BAD_WINDOW, request_code: 129 },
    });
    const shaper = createX11InputShaper(() => koffi)!;
    expect(() => shaper.apply(handle64(7n), [])).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('BadWindow'));
    expect(current()).toBe(PREVIOUS_HANDLER);
    warn.mockRestore();
  });

  it('lança em outro erro X (o manager volta ao hit-test) e restaura o handler', () => {
    const { koffi, current, PREVIOUS_HANDLER } = fakeKoffi({ xError: { error_code: 1, request_code: 129 } });
    const shaper = createX11InputShaper(() => koffi)!;
    expect(() => shaper.apply(handle64(7n), [])).toThrow(/erro X 1/);
    expect(current()).toBe(PREVIOUS_HANDLER);
  });

  it('restaura o handler anterior mesmo se a chamada nativa lançar', () => {
    const { koffi, fns, current, PREVIOUS_HANDLER } = fakeKoffi();
    fns.XShapeCombineRectangles.mockImplementation(() => {
      throw new Error('falha nativa');
    });
    const shaper = createX11InputShaper(() => koffi)!;
    expect(() => shaper.apply(handle64(7n), [])).toThrow('falha nativa');
    expect(current()).toBe(PREVIOUS_HANDLER);
  });

  it('não herda erro de uma chamada anterior e libera o callback no dispose', () => {
    const { koffi, fns, registered } = fakeKoffi();
    const shaper = createX11InputShaper(() => koffi)!;
    // Erro entregue fora de uma chamada (handler ainda instalado por outra razão) não vaza para a próxima.
    registered[0](4242, { error_code: 1, request_code: 129 });
    expect(() => shaper.apply(handle64(7n), [])).not.toThrow();
    expect(fns.XSync).toHaveBeenCalledTimes(1);
    shaper.dispose();
    expect(koffi.unregister).toHaveBeenCalledWith(registered[0]);
  });
});
