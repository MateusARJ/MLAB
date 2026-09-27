import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebRTCSubscriber } from './useWebRTCSubscriber';

describe('useWebRTCSubscriber Hook', () => {
  let mockWsInstance: any;
  let mockPcInstances: any[] = [];

  beforeEach(() => {
    mockPcInstances = [];

    // Mock do WebSocket
    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      url: string;
      readyState = 1; // WebSocket.OPEN
      send = vi.fn();
      close = vi.fn();
      onopen: any = null;
      onmessage: any = null;
      onclose: any = null;
      onerror: any = null;

      constructor(url: string) {
        this.url = url;
        mockWsInstance = this;
      }
    }
    // @ts-ignore
    globalThis.WebSocket = MockWebSocket;

    // Mock do RTCPeerConnection
    class MockRTCPeerConnection {
      iceServers: any;
      signalingState = 'stable';
      iceConnectionState = 'new';
      ontrack: any = null;
      onicecandidate: any = null;
      oniceconnectionstatechange: any = null;
      close = vi.fn();
      restartIce = vi.fn();
      setRemoteDescription = vi.fn().mockResolvedValue(undefined);
      createAnswer = vi.fn().mockResolvedValue({ sdp: 'dummy-answer-sdp' });
      setLocalDescription = vi.fn().mockResolvedValue(undefined);
      addIceCandidate = vi.fn().mockResolvedValue(undefined);
      setConfiguration = vi.fn();

      constructor(config: any) {
        this.iceServers = config?.iceServers;
        mockPcInstances.push(this);
      }
    }
    // @ts-ignore
    globalThis.RTCPeerConnection = MockRTCPeerConnection;

    // Mock de fetch para rota de arquivos
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dummyToken = 'jwt-token-123';
  const dummyRoomInfo = {
    room_id: 'room-abc',
    ws_url: 'ws://localhost:8080/ws/rooms/room-abc/signal',
    ice_servers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  it('deve enviar subscribe-request ao abrir conexão WebSocket', async () => {
    renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo));

    expect(mockWsInstance).toBeDefined();

    await act(async () => {
      if (mockWsInstance.onopen) {
        mockWsInstance.onopen();
      }
    });

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe-request',
        payload: {},
      })
    );
  });

  it('deve armazenar mensagens anteriores ao receber evento chat-history', async () => {
    const { result } = renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo));

    const historicalMessages = [
      { message_id: 'm1', name: 'Professor', content: 'Boa tarde!', is_private: false },
      { message_id: 'm2', name: 'Aluno 1', content: 'Boa tarde professor!', is_private: false },
    ];

    await act(async () => {
      if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage({
          data: JSON.stringify({
            type: 'chat-history',
            payload: { messages: historicalMessages },
          }),
        });
      }
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Boa tarde!');
    expect(result.current.messages[1].content).toBe('Boa tarde professor!');
  });

  it('deve armazenar arquivos compartilhados ao receber evento files-history', async () => {
    const { result } = renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo));

    const historicalFiles = [
      { id: 'f1', name: 'ementa.pdf', size: 2048, url: '/rooms/room-abc/files/f1/download' },
    ];

    await act(async () => {
      if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage({
          data: JSON.stringify({
            type: 'files-history',
            payload: { files: historicalFiles },
          }),
        });
      }
    });

    expect(result.current.sharedFiles).toHaveLength(1);
    expect(result.current.sharedFiles[0].name).toBe('ementa.pdf');
  });

  it('deve recriar PeerConnection e reenviar subscribe-request ao receber stream-started (sem F5)', async () => {
    const { result } = renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo));

    const initialPCCount = mockPcInstances.length;
    mockWsInstance.send.mockClear();

    await act(async () => {
      if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage({
          data: JSON.stringify({
            type: 'stream-started',
            payload: { publisher_id: 'prof-01' },
          }),
        });
      }
    });

    expect(result.current.connectionStatus).toBe('publishing');
    // Deve ter criado uma nova instância de PeerConnection limpa
    expect(mockPcInstances.length).toBeGreaterThan(initialPCCount);
    // Deve ter enviado subscribe-request para obter o vídeo recém-iniciado
    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe-request',
        payload: {},
      })
    );
  });
});
