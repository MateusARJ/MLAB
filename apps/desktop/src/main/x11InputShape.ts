import type { AnnotationToolbarRect } from '@mlab/types';

/**
 * Região de entrada X11 do overlay de marcação no Linux (009, RF-901 / C-904).
 *
 * Sob XWayland, `screen.getCursorScreenPoint()` congela fora de janelas X11, então o hit-test por posição do ponteiro
 * não serve. Em vez disso, o main recorta a região de entrada (`ShapeInput`) do overlay com `XShapeCombineRectangles`:
 * o que estiver fora dela atravessa para as janelas de baixo. É o mesmo mecanismo que o Electron usa no X11 para o
 * click-through, e o XWayland repassa a região ao compositor.
 */

/** `ShapeInput` de X11/extensions/shape.h. */
export const SHAPE_INPUT = 2;
/** `ShapeSet`: substitui a região atual. */
export const SHAPE_SET = 0;
/** `Unsorted`: sem ordem garantida entre os retângulos. */
export const SHAPE_UNSORTED = 0;

export interface X11InputShaper {
  /** Define a região de entrada da janela `handle` (de `getNativeWindowHandle()`), em pixels físicos. */
  apply(handle: Buffer, rects: AnnotationToolbarRect[]): void;
  /** Fecha a conexão com o display. Depois disso `apply` não faz nada. */
  dispose(): void;
}

/** XID da janela a partir do handle nativo do Electron (64 bits LE, ou 32 bits). 0 se inválido. */
export function readXid(handle: Buffer): bigint {
  if (!handle || typeof handle.length !== 'number') return 0n;
  try {
    if (handle.length >= 8) return handle.readBigUInt64LE(0);
    if (handle.length >= 4) return BigInt(handle.readUInt32LE(0));
  } catch {}
  return 0n;
}

const RECT_STRUCT = 'XRectangle_MLAB_009';

function getRectStruct(koffi: any): any {
  try {
    return typeof koffi.type === 'function' ? koffi.type(RECT_STRUCT) : koffi.resolve(RECT_STRUCT);
  } catch {
    return koffi.struct(RECT_STRUCT, { x: 'int16_t', y: 'int16_t', width: 'uint16_t', height: 'uint16_t' });
  }
}

function defaultLoadKoffi(): any {
  // Carregamento dinâmico, como em nativeWindowTracker.ts: falha isolada e testes sem binário nativo.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('koffi');
}

/**
 * Abre o display X padrão e prepara `XShapeCombineRectangles`. Devolve `null` se `koffi`, `libX11.so.6`,
 * `libXext.so.6` ou o display não estiverem disponíveis (ex.: Wayland nativo, sem `DISPLAY`); o chamador usa então
 * o hit-test por posição do ponteiro.
 */
export function createX11InputShaper(loadKoffi: () => any = defaultLoadKoffi): X11InputShaper | null {
  try {
    const koffi = loadKoffi();
    const x11 = koffi.load('libX11.so.6');
    const xext = koffi.load('libXext.so.6');
    getRectStruct(koffi);

    const XOpenDisplay = x11.func('uintptr_t XOpenDisplay(str display_name)');
    const XCloseDisplay = x11.func('int XCloseDisplay(uintptr_t display)');
    const XFlush = x11.func('int XFlush(uintptr_t display)');
    const XShapeCombineRectangles = xext.func(
      `void XShapeCombineRectangles(uintptr_t display, uintptr_t dest, int dest_kind, int x_off, int y_off, ${RECT_STRUCT} *rectangles, int n_rects, int op, int ordering)`
    );

    const dpy = XOpenDisplay(null);
    if (!dpy) return null;
    let open = true;

    return {
      apply(handle, rects) {
        if (!open) return;
        const xid = readXid(handle);
        if (xid <= 0n) return;
        XShapeCombineRectangles(dpy, xid, SHAPE_INPUT, 0, 0, rects, rects.length, SHAPE_SET, SHAPE_UNSORTED);
        XFlush(dpy);
      },
      dispose() {
        if (!open) return;
        open = false;
        try {
          XCloseDisplay(dpy);
        } catch {}
      },
    };
  } catch {
    return null;
  }
}
