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
/** `BadWindow` de X11/X.h: a janela não existe mais (ex.: overlay fechado). */
export const X_BAD_WINDOW = 3;

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
const ERROR_EVENT_STRUCT = 'XErrorEvent_MLAB_009';
const ERROR_HANDLER_PROTO = 'XErrorHandler_MLAB_009';

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
    getOrDefineType(koffi, ERROR_EVENT_STRUCT, () =>
      koffi.struct(ERROR_EVENT_STRUCT, {
        type: 'int',
        display: 'uintptr_t',
        resourceid: 'uintptr_t',
        serial: 'ulong',
        error_code: 'uint8_t',
        request_code: 'uint8_t',
        minor_code: 'uint8_t',
      })
    );
    const errorHandlerProto = getOrDefineType(koffi, ERROR_HANDLER_PROTO, () =>
      koffi.proto(`int ${ERROR_HANDLER_PROTO}(uintptr_t display, void *event)`)
    );

    const XOpenDisplay = x11.func('uintptr_t XOpenDisplay(str display_name)');
    const XCloseDisplay = x11.func('int XCloseDisplay(uintptr_t display)');
    const XSync = x11.func('int XSync(uintptr_t display, int discard)');
    const XSetErrorHandler = x11.func(
      `${ERROR_HANDLER_PROTO} *XSetErrorHandler(${ERROR_HANDLER_PROTO} *handler)`
    );
    const XShapeCombineRectangles = xext.func(
      `void XShapeCombineRectangles(uintptr_t display, uintptr_t dest, int dest_kind, int x_off, int y_off, ${RECT_STRUCT} *rectangles, int n_rects, int op, int ordering)`
    );

    const dpy = XOpenDisplay(null);
    if (!dpy) return null;
    let open = true;

    // T911: o handler padrão do Xlib chama exit() diante de qualquer erro (ex.: BadWindow com o overlay fechado) e
    // encerraria o processo principal. O handler próprio só guarda o primeiro erro; ele fica instalado apenas durante
    // a chamada, porque o handler do Xlib é global por processo.
    let pendingError: { code: number; request: number } | null = null;
    const onXError = koffi.register((_display: unknown, event: unknown) => {
      let code = 0;
      let request = 0;
      try {
        const decoded = koffi.decode(event, ERROR_EVENT_STRUCT);
        code = Number(decoded?.error_code ?? 0);
        request = Number(decoded?.request_code ?? 0);
      } catch {}
      if (!pendingError) pendingError = { code, request };
      return 0;
    }, koffi.pointer(errorHandlerProto));

    return {
      apply(handle, rects) {
        if (!open) return;
        const xid = readXid(handle);
        if (xid <= 0n) return;
        pendingError = null;
        const previous = XSetErrorHandler(onXError);
        try {
          XShapeCombineRectangles(dpy, xid, SHAPE_INPUT, 0, 0, rects, rects.length, SHAPE_SET, SHAPE_UNSORTED);
          // XSync (e não XFlush): o erro, se houver, chega agora, com o handler próprio ainda instalado.
          XSync(dpy, 0);
        } finally {
          XSetErrorHandler(previous);
        }
        const error = pendingError as { code: number; request: number } | null;
        pendingError = null;
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
        try {
          koffi.unregister(onXError);
        } catch {}
      },
    };
  } catch {
    return null;
  }
}
