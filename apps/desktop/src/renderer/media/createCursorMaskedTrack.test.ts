import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCursorMaskedTrack } from './createCursorMaskedTrack';

function makeMockTrack(): MediaStreamTrack {
  return {
    id: 'raw-video-1',
    kind: 'video',
    enabled: true,
    readyState: 'live',
    contentHint: 'detail',
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;
}

describe('createCursorMaskedTrack', () => {
  beforeEach(() => {
    window.localStorage.removeItem('mlab.cursorMask');
    delete (window as any).MediaStreamTrackProcessor;
    delete (window as any).MediaStreamTrackGenerator;
  });

  afterEach(() => {
    window.localStorage.removeItem('mlab.cursorMask');
    delete (window as any).MediaStreamTrackProcessor;
    delete (window as any).MediaStreamTrackGenerator;
  });

  it('deve retornar a track bruta em fallback quando MediaStreamTrackProcessor não estiver disponível (JSDOM)', () => {
    const raw = makeMockTrack();
    const res = createCursorMaskedTrack(raw);

    expect(res.active).toBe(false);
    expect(res.track).toBe(raw);

    res.setEnabled(false);
    expect(raw.enabled).toBe(false);
  });

  it('deve respeitar o kill-switch mlab.cursorMask=off mesmo quando Insertable Streams existir', () => {
    window.localStorage.setItem('mlab.cursorMask', 'off');
    (window as any).MediaStreamTrackProcessor = vi.fn();
    (window as any).MediaStreamTrackGenerator = vi.fn();

    const raw = makeMockTrack();
    const res = createCursorMaskedTrack(raw);

    expect(res.active).toBe(false);
    expect(res.track).toBe(raw);
    expect((window as any).MediaStreamTrackProcessor).not.toHaveBeenCalled();
  });

  it('deve ativar o pipeline, repassar cursor-state ao worker, sincronizar enabled e limpar recursos no dispose', () => {
    const fakeReadable = {};
    const fakeWritable = {};
    const generatorStop = vi.fn();
    const fakeGenerator: any = {
      id: 'gen-video-1',
      kind: 'video',
      enabled: true,
      readyState: 'live',
      contentHint: '',
      writable: fakeWritable,
      stop: generatorStop,
    };

    (window as any).MediaStreamTrackProcessor = vi.fn().mockImplementation(() => ({
      readable: fakeReadable,
    }));
    (window as any).MediaStreamTrackGenerator = vi.fn().mockImplementation(() => fakeGenerator);

    const postMessageSpy = vi.fn();
    const terminateSpy = vi.fn();
    const origWorker = window.Worker;
    (window as any).Worker = vi.fn().mockImplementation(() => ({
      postMessage: postMessageSpy,
      terminate: terminateSpy,
    }));

    let cursorCallback: ((s: any) => void) | null = null;
    const unsubscribeSpy = vi.fn();
    (window as any).electronAPI = {
      ...(window as any).electronAPI,
      onCursorState: vi.fn((cb) => {
        cursorCallback = cb;
        return unsubscribeSpy;
      }),
    };

    try {
      const raw = makeMockTrack();
      const res = createCursorMaskedTrack(raw);

      expect(res.active).toBe(true);
      expect(res.track).toBe(fakeGenerator);
      expect(fakeGenerator.contentHint).toBe('detail');
      expect(postMessageSpy).toHaveBeenCalledWith(
        { type: 'init', readable: fakeReadable, writable: fakeWritable },
        [fakeReadable, fakeWritable]
      );

      // Envia atualização de cursor e verifica repasse ao worker
      expect(cursorCallback).not.toBeNull();
      cursorCallback!({ visible: false, rect: { x: 0.1, y: 0.2, w: 0.05, h: 0.05 } });
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'cursor',
        state: { visible: false, rect: { x: 0.1, y: 0.2, w: 0.05, h: 0.05 } },
      });

      // Sincroniza pausa de vídeo (setEnabled)
      res.setEnabled(false);
      expect(fakeGenerator.enabled).toBe(false);
      expect(raw.enabled).toBe(false);

      // Ao chamar stop() na track gerada (como faz o changeStream), deve encerrar worker, unsubscribe e raw track
      res.track.stop();
      expect(generatorStop).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(terminateSpy).toHaveBeenCalled();
      expect(raw.stop).toHaveBeenCalled();
    } finally {
      window.Worker = origWorker;
    }
  });
});
