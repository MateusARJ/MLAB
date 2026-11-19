import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  RECOVERED_NOTICE_MS,
  roomFromCreateResponse,
  useBackendRecovery,
  type RecoverableRoom,
} from './useBackendRecovery';

// Retomada da aula depois do reinício do backend (053/T5303: RF-5305, RF-5307, US-5303).

vi.mock('../services/auth', () => ({
  startProfessorSession: vi.fn(),
}));
vi.mock('../services/room', () => ({
  createRoom: vi.fn(),
}));

import { startProfessorSession } from '../services/auth';
import { createRoom } from '../services/room';

type Status = 'down' | 'restarting' | 'up' | 'failed';
let emitStatus: (status: Status) => void = () => {};

const sala: RecoverableRoom = {
  id: 'sala-antiga',
  slug: 'matematica',
  link: 'http://mlab.local:8080/matematica/ana',
  title: 'Matemática',
};

const respostaNova = {
  room_id: 'sala-nova',
  slug: 'matematica',
  link: 'http://mlab.local:8080/matematica/ana',
  ip_link: 'http://192.168.0.10:8080/matematica/ana',
  mdns_link: 'http://mlab.local:8080/matematica/ana',
  status: 'waiting',
  created_at: '2026-11-19T00:00:00Z',
};

beforeEach(() => {
  vi.mocked(startProfessorSession).mockReset().mockResolvedValue({ token: 'token-novo', name: 'Ana' } as any);
  vi.mocked(createRoom).mockReset().mockResolvedValue(respostaNova as any);
  sessionStorage.setItem('professor_name', 'Ana');
  window.electronAPI.onBackendStatus = vi.fn((cb: (s: Status) => void) => {
    emitStatus = cb;
    return () => {
      emitStatus = () => {};
    };
  }) as any;
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe('useBackendRecovery', () => {
  it('em sala: down → reconnecting; up → renova a sessão, recria a sala com o mesmo título e avisa (RF-5305)', async () => {
    const onRoomRecreated = vi.fn();
    const { result } = renderHook(() => useBackendRecovery({ room: sala, onRoomRecreated }));
    expect(result.current).toBe('idle');

    act(() => emitStatus('down'));
    expect(result.current).toBe('reconnecting');
    act(() => emitStatus('restarting'));
    expect(result.current).toBe('reconnecting');

    act(() => emitStatus('up'));
    await waitFor(() => expect(result.current).toBe('recovered'));

    expect(startProfessorSession).toHaveBeenCalledWith('Ana');
    expect(createRoom).toHaveBeenCalledWith('Matemática', 'Ana');
    expect(onRoomRecreated).toHaveBeenCalledWith({
      id: 'sala-nova',
      slug: 'matematica',
      link: 'http://mlab.local:8080/matematica/ana',
      title: 'Matemática',
      ipLink: 'http://192.168.0.10:8080/matematica/ana',
      mdnsLink: 'http://mlab.local:8080/matematica/ana',
      shortIpLink: undefined,
      shortMdnsLink: undefined,
    });
  });

  it('o aviso "recovered" volta a idle depois de 10 s (RF-5307)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useBackendRecovery({ room: sala, onRoomRecreated: vi.fn() }));
    act(() => emitStatus('down'));
    act(() => emitStatus('up'));
    await waitFor(() => expect(result.current).toBe('recovered'));

    act(() => {
      vi.advanceTimersByTime(RECOVERED_NOTICE_MS);
    });
    expect(result.current).toBe('idle');
  });

  it('no dashboard: só renova a sessão, sem recriar sala (US-5303)', async () => {
    const onRoomRecreated = vi.fn();
    const { result } = renderHook(() => useBackendRecovery({ room: null, onRoomRecreated }));
    act(() => emitStatus('down'));
    act(() => emitStatus('up'));

    await waitFor(() => expect(startProfessorSession).toHaveBeenCalledWith('Ana'));
    await waitFor(() => expect(result.current).toBe('idle'));
    expect(createRoom).not.toHaveBeenCalled();
    expect(onRoomRecreated).not.toHaveBeenCalled();
  });

  it('up sem down antes não faz nada', () => {
    renderHook(() => useBackendRecovery({ room: sala, onRoomRecreated: vi.fn() }));
    act(() => emitStatus('up'));
    expect(startProfessorSession).not.toHaveBeenCalled();
  });

  it('failed do main → failed (RF-5307)', () => {
    const { result } = renderHook(() => useBackendRecovery({ room: sala, onRoomRecreated: vi.fn() }));
    act(() => emitStatus('down'));
    act(() => emitStatus('failed'));
    expect(result.current).toBe('failed');
  });

  it('erro ao recriar a sala → failed, sem trocar a sala (RF-5307)', async () => {
    vi.mocked(createRoom).mockRejectedValue(new Error('Failed to fetch'));
    const onRoomRecreated = vi.fn();
    const { result } = renderHook(() => useBackendRecovery({ room: sala, onRoomRecreated }));
    act(() => emitStatus('down'));
    act(() => emitStatus('up'));

    await waitFor(() => expect(result.current).toBe('failed'));
    expect(onRoomRecreated).not.toHaveBeenCalled();
  });

  it('remove a inscrição ao desmontar', () => {
    const { unmount } = renderHook(() => useBackendRecovery({ room: sala, onRoomRecreated: vi.fn() }));
    unmount();
    expect(() => emitStatus('down')).not.toThrow();
  });
});

describe('roomFromCreateResponse', () => {
  it('aceita os nomes alternativos id e join_url', () => {
    const r = roomFromCreateResponse({ id: 'x', join_url: 'http://l', slug: 's' } as any, 'T');
    expect(r).toMatchObject({ id: 'x', link: 'http://l', slug: 's', title: 'T' });
  });
});
