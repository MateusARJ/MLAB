/**
 * Captura de erro X para as conexões X próprias do main no Linux (047, C-4701; origem: 009/T911).
 *
 * O handler padrão do Xlib imprime o erro e chama `exit()` diante de qualquer erro X (ex.: `BadWindow` com um XID que
 * não existe mais), o que encerraria o processo principal do Electron. `run` instala um handler próprio só durante a
 * chamada, sincroniza com o servidor (`XSync`) para o erro chegar ainda com ele instalado e devolve o anterior em
 * seguida. O handler do Xlib é global por processo; como cada captura dura uma chamada síncrona no thread principal e
 * é desfeita no fim, duas capturas nunca se sobrepõem.
 */

/** `BadWindow` de X11/X.h: a janela não existe mais. */
export const X_BAD_WINDOW = 3;

export interface XErrorInfo {
  /** `error_code` do `XErrorEvent` (ex.: `X_BAD_WINDOW`). */
  code: number;
  /** `request_code` do `XErrorEvent` (opcode da requisição que falhou). */
  request: number;
}

export interface X11ErrorTrap {
  /**
   * Executa `fn` com o handler próprio instalado, chama `XSync(dpy, 0)` e restaura o handler anterior, também quando
   * `fn` lança (a exceção segue depois da restauração). Devolve o resultado de `fn` e o primeiro erro X da chamada.
   */
  run<T>(dpy: unknown, fn: () => T): { result: T; error: XErrorInfo | null };
  /** Libera o callback registrado no `koffi`. */
  dispose(): void;
}

const ERROR_EVENT_STRUCT = 'XErrorEvent_MLAB';
const ERROR_HANDLER_PROTO = 'XErrorHandler_MLAB';

/** Reaproveita um tipo já registrado no `koffi` (pode haver mais de um trap no processo) ou o define. */
function getOrDefineType(koffi: any, name: string, define: () => any): any {
  try {
    return typeof koffi.type === 'function' ? koffi.type(name) : koffi.resolve(name);
  } catch {
    return define();
  }
}

/**
 * Prepara a captura sobre a `libX11.so.6` já carregada (`x11`). Lança se o `koffi` não permitir registrar o callback;
 * o chamador trata isso como módulo X11 indisponível.
 */
export function createX11ErrorTrap(koffi: any, x11: any): X11ErrorTrap {
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
  const XSync = x11.func('int XSync(uintptr_t display, int discard)');
  const XSetErrorHandler = x11.func(`${ERROR_HANDLER_PROTO} *XSetErrorHandler(${ERROR_HANDLER_PROTO} *handler)`);

  // O handler só guarda o primeiro erro e devolve 0: o Xlib segue, e a chamada que falhou devolve seu status de erro.
  let pendingError: XErrorInfo | null = null;
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
  let disposed = false;

  return {
    run<T>(dpy: unknown, fn: () => T) {
      // Um erro entregue fora de uma captura não vaza para esta.
      pendingError = null;
      const previous = XSetErrorHandler(onXError);
      let result: T;
      try {
        result = fn();
        // XSync (e não XFlush): o erro de uma requisição assíncrona chega agora, com o handler próprio instalado.
        XSync(dpy, 0);
      } finally {
        XSetErrorHandler(previous);
      }
      const error = pendingError as XErrorInfo | null;
      pendingError = null;
      return { result, error };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        koffi.unregister(onXError);
      } catch {}
    },
  };
}
