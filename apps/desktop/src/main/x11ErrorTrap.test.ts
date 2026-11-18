import { describe, it, expect, vi } from 'vitest';
import { createX11ErrorTrap, X_BAD_WINDOW } from './x11ErrorTrap';

type XErrorFake = { error_code: number; request_code: number };

/** `koffi` falso com `XSync` e `XSetErrorHandler`; `deliver` entrega um erro ao handler instalado, como o Xlib faz. */
function fakeKoffi() {
  const PREVIOUS_HANDLER = { handler: 'anterior' };
  let installed: unknown = PREVIOUS_HANDLER;
  const registered: Array<(dpy: unknown, ev: unknown) => number> = [];
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    XSync: vi.fn(() => 1),
    XSetErrorHandler: vi.fn((h: unknown) => {
      const prev = installed;
      installed = h;
      return prev;
    }),
  };
  const x11 = {
    func: (sig: string) => {
      const name = /\s\*?(\w+)\(/.exec(sig)?.[1] ?? '';
      if (!fns[name]) throw new Error(`função inesperada ${name}`);
      return fns[name];
    },
  };
  const koffi = {
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
  const deliver = (ev: XErrorFake) => {
    if (installed === PREVIOUS_HANDLER) throw new Error('handler padrão do Xlib: exit()');
    return (installed as (d: unknown, e: unknown) => number)(4242, ev);
  };
  return { koffi, x11, fns, PREVIOUS_HANDLER, current: () => installed, registered, deliver };
}

describe('createX11ErrorTrap (047/C-4701)', () => {
  it('instala o handler só durante run, sincroniza e devolve o anterior', () => {
    const { koffi, x11, fns, PREVIOUS_HANDLER, current, registered } = fakeKoffi();
    const trap = createX11ErrorTrap(koffi, x11);
    const fn = vi.fn(() => {
      expect(current()).toBe(registered[0]);
      return 'ok';
    });
    expect(trap.run(4242, fn)).toEqual({ result: 'ok', error: null });
    expect(fns.XSync).toHaveBeenCalledWith(4242, 0);
    expect(fns.XSetErrorHandler).toHaveBeenNthCalledWith(1, registered[0]);
    expect(fns.XSetErrorHandler).toHaveBeenNthCalledWith(2, PREVIOUS_HANDLER);
    expect(current()).toBe(PREVIOUS_HANDLER);
    const order = [
      fns.XSetErrorHandler.mock.invocationCallOrder[0],
      fn.mock.invocationCallOrder[0],
      fns.XSync.mock.invocationCallOrder[0],
      fns.XSetErrorHandler.mock.invocationCallOrder[1],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('devolve só o primeiro erro da chamada, e o handler devolve 0', () => {
    const { koffi, x11, deliver } = fakeKoffi();
    const trap = createX11ErrorTrap(koffi, x11);
    const { error } = trap.run(4242, () => {
      expect(deliver({ error_code: X_BAD_WINDOW, request_code: 15 })).toBe(0);
      deliver({ error_code: 8, request_code: 3 });
    });
    expect(error).toEqual({ code: X_BAD_WINDOW, request: 15 });
  });

  it('erro entregue pelo XSync também é capturado', () => {
    const { koffi, x11, fns, deliver } = fakeKoffi();
    fns.XSync.mockImplementation(() => {
      deliver({ error_code: X_BAD_WINDOW, request_code: 129 });
      return 1;
    });
    const trap = createX11ErrorTrap(koffi, x11);
    expect(trap.run(4242, () => undefined).error).toEqual({ code: X_BAD_WINDOW, request: 129 });
  });

  it('restaura o handler anterior quando fn lança e repassa a exceção', () => {
    const { koffi, x11, fns, PREVIOUS_HANDLER, current } = fakeKoffi();
    const trap = createX11ErrorTrap(koffi, x11);
    expect(() =>
      trap.run(4242, () => {
        throw new Error('falha nativa');
      })
    ).toThrow('falha nativa');
    expect(current()).toBe(PREVIOUS_HANDLER);
    expect(fns.XSync).not.toHaveBeenCalled();
  });

  it('não herda erro entregue fora de uma captura', () => {
    const { koffi, x11, registered } = fakeKoffi();
    const trap = createX11ErrorTrap(koffi, x11);
    registered[0](4242, { error_code: 8, request_code: 3 });
    expect(trap.run(4242, () => 1).error).toBeNull();
  });

  it('dispose libera o callback uma única vez', () => {
    const { koffi, x11, registered } = fakeKoffi();
    const trap = createX11ErrorTrap(koffi, x11);
    trap.dispose();
    trap.dispose();
    expect(koffi.unregister).toHaveBeenCalledTimes(1);
    expect(koffi.unregister).toHaveBeenCalledWith(registered[0]);
  });

  it('lança se o koffi não permite registrar o callback', () => {
    const { koffi, x11 } = fakeKoffi();
    const semRegister = { ...koffi, register: undefined };
    expect(() => createX11ErrorTrap(semRegister, x11)).toThrow();
  });
});
