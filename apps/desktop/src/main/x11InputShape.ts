import type { AnnotationToolbarRect } from '@mlab/types';
import { createX11ErrorTrap, X_BAD_WINDOW, type X11ErrorTrap } from './x11ErrorTrap';

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
/** `BadWindow` de X11/X.h: a janela não existe mais (ex.: overlay fechado). Definido em `x11ErrorTrap.ts` (047). */
export { X_BAD_WINDOW };

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

/** Reaproveita um tipo já registrado no `koffi` (o módulo pode ser criado mais de uma vez) ou o define. */
function getOrDefineType(koffi: any, name: string, define: () => any): any {
  try {
    return typeof koffi.type === 'function' ? koffi.type(name) : koffi.resolve(name);
  } catch {
    return define();
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
    getOrDefineType(koffi, RECT_STRUCT, () =>
      koffi.struct(RECT_STRUCT, { x: 'int16_t', y: 'int16_t', width: 'uint16_t', height: 'uint16_t' })
    );

    const XOpenDisplay = x11.func('uintptr_t XOpenDisplay(str display_name)');
    const XCloseDisplay = x11.func('int XCloseDisplay(uintptr_t display)');
    const XShapeCombineRectangles = xext.func(
      `void XShapeCombineRectangles(uintptr_t display, uintptr_t dest, int dest_kind, int x_off, int y_off, ${RECT_STRUCT} *rectangles, int n_rects, int op, int ordering)`
    );

    const dpy = XOpenDisplay(null);
    if (!dpy) return null;
    let open = true;

    // T911: o handler padrão do Xlib chama exit() diante de qualquer erro (ex.: BadWindow com o overlay fechado) e
    // encerraria o processo principal. A captura de erro X (047) instala um handler próprio só durante a chamada.
    let trap: X11ErrorTrap;
    try {
      trap = createX11ErrorTrap(koffi, x11);
    } catch (err) {
      XCloseDisplay(dpy);
      throw err;
    }

    return {
      apply(handle, rects) {
        if (!open) return;
        const xid = readXid(handle);
        if (xid <= 0n) return;
        const { error } = trap.run(dpy, () =>
          XShapeCombineRectangles(dpy, xid, SHAPE_INPUT, 0, 0, rects, rects.length, SHAPE_SET, SHAPE_UNSORTED)
        );
        if (!error) return;
        if (error.code === X_BAD_WINDOW) {
          console.warn(`[X11InputShape] janela 0x${xid.toString(16)} não existe mais (BadWindow); região ignorada`);
          return;
        }
        // Outro erro: o manager desliga a região e volta ao hit-test por posição do ponteiro (RF-901).
        throw new Error(`[X11InputShape] erro X ${error.code} na requisição ${error.request}`);
      },
      dispose() {
        if (!open) return;
        open = false;
        try {
          XCloseDisplay(dpy);
        } catch {}
        trap.dispose();
      },
    };
  } catch {
    return null;
  }
}
