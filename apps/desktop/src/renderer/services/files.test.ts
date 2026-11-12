import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadRoomFile, UPLOAD_ERROR_MSG, MAX_FILE_BYTES } from './files';

describe('uploadRoomFile', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia multipart com o campo file e o token do professor, e devolve o arquivo criado (RF-183)', async () => {
    const created = {
      id: 'f1',
      room_id: 'room-101',
      name: 'aula.pdf',
      size: 4,
      content_type: 'application/pdf',
      url: '/rooms/room-101/files/f1/download',
      uploaded_at: '2026-11-10T20:00:00Z',
    };
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve(created) });
    const file = new File(['%PDF'], 'aula.pdf', { type: 'application/pdf' });

    const result = await uploadRoomFile('room-101', file, 'jwt-professor');

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/rooms/room-101/files');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-professor');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(file);
  });

  it('propaga a mensagem do servidor no 413 e no 403 (RF-185)', async () => {
    const file = new File(['x'], 'x.txt');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: () => Promise.resolve({ error: 'limite de arquivos da sala atingido' }),
    });
    await expect(uploadRoomFile('room-101', file, 't')).rejects.toThrow('limite de arquivos da sala atingido');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'você não é o dono desta sala' }),
    });
    await expect(uploadRoomFile('room-101', file, 't')).rejects.toThrow('você não é o dono desta sala');
  });

  it('usa a mensagem padrão sem JSON de erro ou em falha de rede', async () => {
    const file = new File(['x'], 'x.txt');

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.reject(new Error('sem json')) });
    await expect(uploadRoomFile('room-101', file, 't')).rejects.toThrow(UPLOAD_ERROR_MSG);

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(uploadRoomFile('room-101', file, 't')).rejects.toThrow(UPLOAD_ERROR_MSG);
  });

  it('usa o mesmo limite por arquivo do servidor (50 MB)', () => {
    expect(MAX_FILE_BYTES).toBe(50 << 20);
  });
});
