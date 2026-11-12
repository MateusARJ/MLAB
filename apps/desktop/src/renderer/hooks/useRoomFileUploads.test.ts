import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useRoomFileUploads,
  FOLDER_NOT_SUPPORTED_MSG,
  UPLOAD_SUCCESS_TTL_MS,
} from './useRoomFileUploads';
import { MAX_FILE_BYTES, FILE_TOO_LARGE_MSG } from '../services/files';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function created(name: string) {
  return {
    ok: true,
    status: 201,
    json: () =>
      Promise.resolve({
        id: `id-${name}`,
        room_id: 'room-101',
        name,
        size: 1,
        content_type: 'text/plain',
        url: `/rooms/room-101/files/id-${name}/download`,
        uploaded_at: '2026-11-10T20:00:00Z',
      }),
  };
}

function failed(status: number, error: string) {
  return { ok: false, status, json: () => Promise.resolve({ error }) };
}

function file(name: string, size?: number) {
  const f = new File(['x'], name, { type: 'text/plain' });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
}

function sentNames(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([, init]) => ((init as RequestInit).body as FormData).get('file') as File).map((f) => f.name);
}

describe('useRoomFileUploads', () => {
  const fetchMock = vi.fn();
  const onUploaded = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onUploaded.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setup() {
    return renderHook(() => useRoomFileUploads({ roomId: 'room-101', token: 'jwt', onUploaded }));
  }

  it('envia um arquivo por vez, na ordem, passando por "enviando" (RF-183, RF-184)', async () => {
    const calls = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()];
    fetchMock.mockImplementation(() => calls[fetchMock.mock.calls.length - 1].promise);
    const { result } = setup();

    act(() => result.current.enqueue([file('a.txt'), file('b.txt'), file('c.txt')]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.items.map((i) => i.status)).toEqual(['enviando', 'aguardando', 'aguardando']);
    expect(result.current.isUploading).toBe(true);

    await act(async () => calls[0].resolve(created('a.txt')));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.items.map((i) => i.status)).toEqual(['enviado', 'enviando', 'aguardando']);
    expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.txt' }));

    await act(async () => calls[1].resolve(created('b.txt')));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(async () => calls[2].resolve(created('c.txt')));

    await waitFor(() => expect(result.current.items.map((i) => i.status)).toEqual(['enviado', 'enviado', 'enviado']));
    expect(sentNames(fetchMock)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(onUploaded).toHaveBeenCalledTimes(3);
    expect(result.current.isUploading).toBe(false);
  });

  it('marca só o item com erro e continua a fila (RF-185, C-187)', async () => {
    fetchMock
      .mockResolvedValueOnce(created('a.txt'))
      .mockResolvedValueOnce(failed(413, 'limite de arquivos da sala atingido'))
      .mockResolvedValueOnce(created('c.txt'));
    const { result } = setup();

    act(() => result.current.enqueue([file('a.txt'), file('b.txt'), file('c.txt')]));

    await waitFor(() => expect(result.current.items.map((i) => i.status)).toEqual(['enviado', 'erro', 'enviado']));
    expect(result.current.items[1].error).toBe('limite de arquivos da sala atingido');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onUploaded).toHaveBeenCalledTimes(2);
  });

  it('recusa pasta e arquivo acima de 50 MB sem requisição (RF-186)', async () => {
    fetchMock.mockResolvedValue(created('ok.txt'));
    const { result } = setup();

    act(() =>
      result.current.enqueue([
        { name: 'fotos', isDirectory: true },
        file('video.mp4', MAX_FILE_BYTES + 1),
        file('ok.txt'),
      ])
    );

    await waitFor(() => expect(result.current.items[2].status).toBe('enviado'));
    expect(result.current.items[0]).toMatchObject({ name: 'fotos', status: 'erro', error: FOLDER_NOT_SUPPORTED_MSG });
    expect(result.current.items[1]).toMatchObject({ name: 'video.mp4', status: 'erro', error: FILE_TOO_LARGE_MSG });
    expect(sentNames(fetchMock)).toEqual(['ok.txt']);
  });

  it('aceita exatamente 50 MB', async () => {
    fetchMock.mockResolvedValue(created('limite.bin'));
    const { result } = setup();

    act(() => result.current.enqueue([file('limite.bin', MAX_FILE_BYTES)]));

    await waitFor(() => expect(result.current.items[0].status).toBe('enviado'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enfileira no fim os arquivos recebidos durante um envio (RF-187)', async () => {
    const first = deferred<unknown>();
    fetchMock.mockImplementationOnce(() => first.promise).mockResolvedValueOnce(created('b.txt'));
    const { result } = setup();

    act(() => result.current.enqueue([file('a.txt')]));
    act(() => result.current.enqueue([file('b.txt')]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.items.map((i) => [i.name, i.status])).toEqual([
      ['a.txt', 'enviando'],
      ['b.txt', 'aguardando'],
    ]);

    await act(async () => first.resolve(created('a.txt')));
    await waitFor(() => expect(result.current.items.map((i) => i.status)).toEqual(['enviado', 'enviado']));
    expect(sentNames(fetchMock)).toEqual(['a.txt', 'b.txt']);
  });

  it('remove o item enviado após 5 s (RF-184)', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(created('a.txt'));
    const { result } = setup();

    act(() => result.current.enqueue([file('a.txt')]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.items[0].status).toBe('enviado');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPLOAD_SUCCESS_TTL_MS - 1);
    });
    expect(result.current.items).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('mantém erros até dispensar ou até o próximo lote (RF-184, C-188)', async () => {
    const { result } = setup();

    act(() => result.current.enqueue([{ name: 'p1', isDirectory: true }, { name: 'p2', isDirectory: true }]));
    expect(result.current.items.map((i) => i.name)).toEqual(['p1', 'p2']);

    act(() => result.current.dismiss(result.current.items[0].id));
    expect(result.current.items.map((i) => i.name)).toEqual(['p2']);

    fetchMock.mockResolvedValue(created('novo.txt'));
    act(() => result.current.enqueue([file('novo.txt')]));
    expect(result.current.items.map((i) => i.name)).toEqual(['novo.txt']);
    await waitFor(() => expect(result.current.items[0].status).toBe('enviado'));
  });

  it('após desmontar, não continua a fila nem chama onUploaded', async () => {
    const first = deferred<unknown>();
    fetchMock.mockImplementationOnce(() => first.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = setup();

    act(() => result.current.enqueue([file('a.txt'), file('b.txt')]));
    unmount();
    await act(async () => first.resolve(created('a.txt')));

    expect(onUploaded).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('limpa o timer de remoção ao desmontar', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(created('a.txt'));
    const { result, unmount } = setup();

    act(() => result.current.enqueue([file('a.txt')]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
