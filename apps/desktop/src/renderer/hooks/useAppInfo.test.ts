import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useAppInfo } from './useAppInfo';

describe('useAppInfo', () => {
  afterEach(() => {
    vi.mocked(window.electronAPI.getAppInfo).mockReset().mockResolvedValue({
      name: 'MLab',
      version: '9.8.7',
      description: 'Plataforma de transmissão de tela e interação para aulas ao vivo',
      copyright: 'Copyright © 2026 MLab',
    });
  });

  it('devolve as informações recebidas do main (RF-2101)', async () => {
    const { result } = renderHook(() => useAppInfo());
    await waitFor(() => expect(result.current?.version).toBe('9.8.7'));
    expect(result.current?.name).toBe('MLab');
    expect(window.electronAPI.getAppInfo).toHaveBeenCalledTimes(1);
  });

  it('devolve null quando o IPC falha (RF-2107)', async () => {
    vi.mocked(window.electronAPI.getAppInfo).mockRejectedValueOnce(new Error('canal indisponível'));
    const { result } = renderHook(() => useAppInfo());
    await waitFor(() => expect(window.electronAPI.getAppInfo).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toBeNull();
  });

  it('devolve null quando o main responde sem versão (RF-2107)', async () => {
    vi.mocked(window.electronAPI.getAppInfo).mockResolvedValueOnce(undefined as any);
    const { result } = renderHook(() => useAppInfo());
    await waitFor(() => expect(window.electronAPI.getAppInfo).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toBeNull();
  });
});
