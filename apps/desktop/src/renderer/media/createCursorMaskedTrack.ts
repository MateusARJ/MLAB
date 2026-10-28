import type { CursorState } from '@mlab/types';

export interface MaskedVideoTrackResult {
  track: MediaStreamTrack;
  active: boolean;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

/**
 * Envolve uma MediaStreamTrack de vídeo com um pipeline Insertable Streams (MediaStreamTrackProcessor +
 * MediaStreamTrackGenerator + Web Worker) que apaga o cursor quando o estado enviado pelo processo Main
 * indicar `visible: false`.
 *
 * Caso o ambiente não suporte Insertable Streams (ex: testes em JSDOM), o kill-switch esteja ativo
 * (`localStorage.getItem('mlab.cursorMask') === 'off'`) ou a inicialização falhe, retorna a própria
 * track bruta sem modificações (comportamento 100% idêntico ao original).
 */
export function createCursorMaskedTrack(rawVideoTrack: MediaStreamTrack): MaskedVideoTrackResult {
  try {
    if (typeof window === 'undefined') {
      return {
        track: rawVideoTrack,
        active: false,
        setEnabled: (en) => {
          rawVideoTrack.enabled = en;
        },
        dispose: () => {},
      };
    }

    try {
      if (window.localStorage && window.localStorage.getItem('mlab.cursorMask') === 'off') {
        return {
          track: rawVideoTrack,
          active: false,
          setEnabled: (en) => {
            rawVideoTrack.enabled = en;
          },
          dispose: () => {},
        };
      }
    } catch {}

    const ProcessorClass = (window as any).MediaStreamTrackProcessor;
    const GeneratorClass = (window as any).MediaStreamTrackGenerator;

    if (
      typeof ProcessorClass !== 'function' ||
      typeof GeneratorClass !== 'function' ||
      typeof Worker !== 'function'
    ) {
      return {
        track: rawVideoTrack,
        active: false,
        setEnabled: (en) => {
          rawVideoTrack.enabled = en;
        },
        dispose: () => {},
      };
    }

    const processor = new ProcessorClass({ track: rawVideoTrack });
    const generator: MediaStreamTrack & { writable: WritableStream } = new GeneratorClass({
      kind: 'video',
    });

    if (!processor?.readable || !generator?.writable) {
      return {
        track: rawVideoTrack,
        active: false,
        setEnabled: (en) => {
          rawVideoTrack.enabled = en;
        },
        dispose: () => {},
      };
    }

    // Preserva contentHint e estado enabled da track original
    try {
      // @ts-ignore
      if (rawVideoTrack.contentHint) {
        // @ts-ignore
        generator.contentHint = rawVideoTrack.contentHint;
      }
      generator.enabled = rawVideoTrack.enabled;
    } catch {}

    const worker = new Worker(new URL('./cursorMask.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.postMessage(
      {
        type: 'init',
        readable: processor.readable,
        writable: generator.writable,
      },
      [processor.readable, generator.writable]
    );

    let unsubscribeCursor: (() => void) | null = null;
    if (window.electronAPI && typeof window.electronAPI.onCursorState === 'function') {
      unsubscribeCursor = window.electronAPI.onCursorState((state: CursorState) => {
        try {
          worker.postMessage({ type: 'cursor', state });
        } catch {}
      });
    }

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      if (unsubscribeCursor) {
        try {
          unsubscribeCursor();
        } catch {}
        unsubscribeCursor = null;
      }
      try {
        worker.terminate();
      } catch {}
      try {
        if (rawVideoTrack.readyState !== 'ended') {
          rawVideoTrack.stop();
        }
      } catch {}
      try {
        if (generator.readyState !== 'ended') {
          generator.stop();
        }
      } catch {}
    };

    // Quando o publisher chama oldTrack.stop() na track gerada (ex: changeStream),
    // intercepta o stop() para encerrar também o worker e a rawVideoTrack.
    const origStop = generator.stop.bind(generator);
    generator.stop = () => {
      try {
        origStop();
      } catch {}
      dispose();
    };

    rawVideoTrack.addEventListener?.('ended', dispose);

    return {
      track: generator,
      active: true,
      setEnabled: (en: boolean) => {
        generator.enabled = en;
        rawVideoTrack.enabled = en;
      },
      dispose,
    };
  } catch (err) {
    console.warn('[CursorMask] Fallback para track de vídeo bruta:', err);
    return {
      track: rawVideoTrack,
      active: false,
      setEnabled: (en: boolean) => {
        rawVideoTrack.enabled = en;
      },
      dispose: () => {},
    };
  }
}
