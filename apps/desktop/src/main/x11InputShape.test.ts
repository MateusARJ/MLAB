import { describe, it, expect, vi } from 'vitest';
import { createX11InputShaper, readXid, SHAPE_INPUT, SHAPE_SET, SHAPE_UNSORTED } from './x11InputShape';

/** koffi falso: registra as funções declaradas e devolve mocks controláveis. */
function fakeKoffi(opts: { failLib?: string; display?: number } = {}) {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    XOpenDisplay: vi.fn(() => opts.display ?? 4242),
    XCloseDisplay: vi.fn(() => 0),
    XFlush: vi.fn(() => 1),
    XShapeCombineRectangles: vi.fn(),
  };
  const load = vi.fn((lib: string) => {
    if (opts.failLib && lib === opts.failLib) throw new Error(`não achou ${lib}`);
    return {
      func: (sig: string) => {
        const name = /\s(\w+)\(/.exec(sig)?.[1] ?? '';
        if (!fns[name]) throw new Error(`função inesperada ${name}`);
        return fns[name];
      },
    };
  });
  const koffi = {
    load,
    struct: vi.fn((name: string) => ({ name })),
    type: vi.fn(() => {
      throw new Error('não registrado');
    }),
  };
  return { koffi, fns, load };
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

  it('aplica a região de entrada com ShapeInput/ShapeSet e faz flush', () => {
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
    expect(fns.XFlush).toHaveBeenCalledWith(4242);
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
