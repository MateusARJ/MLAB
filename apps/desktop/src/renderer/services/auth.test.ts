import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startProfessorSession, HOST_KEY_HEADER } from './auth';

describe('startProfessorSession', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia a chave de host obtida pelo IPC no header da sessão', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'jwt-professor', expires_at: '2026-11-01T20:00:00Z', name: 'Ana' }),
    });

    await startProfessorSession('  Ana  ');

    expect(window.electronAPI.getHostKey).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8080/auth/session');
    expect(init.headers[HOST_KEY_HEADER]).toBe('chave-de-host-de-teste');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ana' });
    expect(sessionStorage.getItem('professor_token')).toBe('jwt-professor');
    expect(sessionStorage.getItem('professor_name')).toBe('Ana');
  });

  it('propaga o erro do backend quando a chave é recusada (403)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'sessão de professor permitida apenas pelo app MLab desta máquina' }),
    });

    await expect(startProfessorSession('Ana')).rejects.toThrow('sessão de professor permitida apenas pelo app MLab desta máquina');
    expect(sessionStorage.getItem('professor_token')).toBeNull();
  });
});
