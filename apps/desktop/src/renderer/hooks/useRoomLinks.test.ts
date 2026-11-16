import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRoomLinks, ROOM_LINKS_POLL_MS } from './useRoomLinks';
import * as roomService from '../services/room';

vi.mock('../services/room', () => ({
  getRoomLink: vi.fn(),
}));

const getRoomLink = roomService.getRoomLink as unknown as ReturnType<typeof vi.fn>;

const room = {
  id: 'room-1',
  link: 'http://mlab.local:8080',
  ipLink: 'http://192.168.0.20:8080',
  mdnsLink: 'http://mlab.local:8080',
};

function resposta(mdns?: string) {
  return {
    room_id: 'room-1',
    link: mdns || 'http://192.168.0.20:8080',
    ip_link: 'http://192.168.0.20:8080',
    mdns_link: mdns,
    short_ip_link: 'http://192.168.0.20:8080',
    short_mdns_link: mdns,
  };
}

/** Deixa as promessas pendentes do hook resolverem. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('useRoomLinks (012, RF-127/RF-128)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getRoomLink.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa os links iniciais e não avisa quando o backend confirma o mesmo nome', async () => {
    getRoomLink.mockResolvedValue(resposta('http://mlab.local:8080'));
    const { result } = renderHook(() => useRoomLinks(room));
    await flush();

    expect(getRoomLink).toHaveBeenCalledWith('room-1');
    expect(result.current.links.mdnsLink).toBe('http://mlab.local:8080');
    expect(result.current.notice).toBeNull();
  });

  it('relê a cada 10 s e avisa quando o nome mDNS muda', async () => {
    getRoomLink.mockResolvedValue(resposta('http://mlab.local:8080'));
    const { result } = renderHook(() => useRoomLinks(room));
    await flush();

    getRoomLink.mockResolvedValue(resposta('http://mlab-2.local:8080'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ROOM_LINKS_POLL_MS);
    });

    expect(getRoomLink).toHaveBeenCalledTimes(2);
    expect(result.current.links.mdnsLink).toBe('http://mlab-2.local:8080');
    expect(result.current.notice).toBe('O link fixo da sala mudou para http://mlab-2.local:8080. Reenvie aos alunos.');

    act(() => result.current.dismissNotice());
    expect(result.current.notice).toBeNull();
  });

  it('avisa quando o link fixo deixa de existir e cai para o link por IP', async () => {
    getRoomLink.mockResolvedValue(resposta(undefined));
    const { result } = renderHook(() => useRoomLinks(room));
    await flush();

    expect(result.current.links.mdnsLink).toBe('');
    expect(result.current.links.ipLink).toBe('http://192.168.0.20:8080');
    expect(result.current.notice).toBe('O link fixo da sala não está mais disponível. Use o link por IP.');
  });

  it('mantém os links quando o backend não responde', async () => {
    getRoomLink.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useRoomLinks(room));
    await flush();

    expect(result.current.links.mdnsLink).toBe('http://mlab.local:8080');
    expect(result.current.notice).toBeNull();
  });

  it('para de reler ao desmontar e não lê sem sala', async () => {
    getRoomLink.mockResolvedValue(resposta('http://mlab.local:8080'));
    const { unmount } = renderHook(() => useRoomLinks(room));
    await flush();
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ROOM_LINKS_POLL_MS * 3);
    });
    expect(getRoomLink).toHaveBeenCalledTimes(1);

    getRoomLink.mockClear();
    renderHook(() => useRoomLinks(null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ROOM_LINKS_POLL_MS);
    });
    expect(getRoomLink).not.toHaveBeenCalled();
  });
});
