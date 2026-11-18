import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebRTCSubscriber } from './useWebRTCSubscriber';

describe('useWebRTCSubscriber Hook', () => {
  let mockWsInstance: any;
  let mockWsInstances: any[] = [];
  let mockPcInstances: any[] = [];

  beforeEach(() => {
    mockWsInstances = [];
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
        mockWsInstances.push(this);
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
      getReceivers = vi.fn().mockReturnValue([]);

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

  // Deixa passar o tick em que o hook abre o WebSocket (044/RF-4401).
  const flushConnect = async () => {
    await act(async () => {
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(0);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
  };

  const renderSubscriber = async () => {
    const view = renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo));
    await flushConnect();
    return view;
  };

  describe('conexão única por montagem (044)', () => {
    it('deve abrir um único WebSocket na montagem dupla do StrictMode (RF-4401)', async () => {
      renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo), { wrapper: React.StrictMode });
      await flushConnect();

      expect(mockWsInstances).toHaveLength(1);
      expect(mockWsInstances[0].close).not.toHaveBeenCalled();
    });

    it('não deve abrir WebSocket quando desmonta antes de conectar (044, spec §9)', async () => {
      const { unmount } = renderHook(() => useWebRTCSubscriber(dummyToken, dummyRoomInfo));
      unmount();
      await flushConnect();

      expect(mockWsInstances).toHaveLength(0);
    });
  });

  it('deve enviar o token do aluno ao listar os arquivos da sala', async () => {
    await renderSubscriber();
    await act(async () => {
      await Promise.resolve();
    });
    const filesCall = (globalThis.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/files'));
    expect(filesCall).toBeTruthy();
    expect(filesCall[1].headers.Authorization).toBe(`Bearer ${dummyToken}`);
  });

  it('deve enviar subscribe-request ao abrir conexão WebSocket', async () => {
    await renderSubscriber();

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

  it('deve configurar playoutDelayHint=0 e jitterBufferTarget=0 no receptor ao receber faixa de vídeo/áudio para ultra-baixa latência', async () => {
    const { result } = await renderSubscriber();

    await act(async () => {
      if (mockWsInstance.onopen) {
        mockWsInstance.onopen();
      }
    });

    const activePc = mockPcInstances[mockPcInstances.length - 1];
    expect(activePc).toBeDefined();

    const mockReceiver: any = {
      playoutDelayHint: 1.5,
      jitterBufferTarget: 1000,
    };
    const mockTrack = {
      id: 'video-track-1',
      kind: 'video',
      readyState: 'live',
    };

    await act(async () => {
      if (activePc.ontrack) {
        activePc.ontrack({
          receiver: mockReceiver,
          track: mockTrack,
        });
      }
    });

    expect(mockReceiver.playoutDelayHint).toBe(0);
    expect(mockReceiver.jitterBufferTarget).toBe(0);
    expect(result.current.stream).toBeDefined();
  });

  it('deve armazenar mensagens anteriores ao receber evento chat-history', async () => {
    const { result } = await renderSubscriber();

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
    const { result } = await renderSubscriber();

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
    const { result } = await renderSubscriber();

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

  it('deve exibir aviso temporário ao receber CHAT_RATE_LIMITED sem fechar a conexão', async () => {
    vi.useFakeTimers();
    try {
      const { result } = await renderSubscriber();

      await act(async () => {
        mockWsInstance.onmessage({
          data: JSON.stringify({ type: 'error', payload: { code: 'CHAT_RATE_LIMITED', message: 'muitas mensagens, aguarde' } }),
        });
      });
      expect(result.current.chatNotice).toBe('muitas mensagens, aguarde');
      expect(mockWsInstance.close).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.chatNotice).toBeNull();

      // Sem mensagem do servidor, usa o texto padrão; dismissChatNotice limpa na hora.
      await act(async () => {
        mockWsInstance.onmessage({ data: JSON.stringify({ type: 'error', payload: { code: 'CHAT_RATE_LIMITED', message: '' } }) });
      });
      expect(result.current.chatNotice).toMatch(/Aguarde alguns segundos/);
      await act(async () => {
        result.current.dismissChatNotice();
      });
      expect(result.current.chatNotice).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('não deve exibir aviso de chat para outros códigos de erro', async () => {
    const { result } = await renderSubscriber();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => {
      mockWsInstance.onmessage({ data: JSON.stringify({ type: 'error', payload: { code: 'FORBIDDEN', message: 'x' } }) });
    });
    expect(result.current.chatNotice).toBeNull();
    warn.mockRestore();
  });

  it('deve ir para duplicate sem reconectar ao receber close 4001 (RN-04)', async () => {
    vi.useFakeTimers();
    try {
      const { result } = await renderSubscriber();
      const firstWs = mockWsInstance;

      await act(async () => {
        firstWs.onclose({ code: 4001, reason: 'Duplicate Session' });
      });
      await act(async () => {
        vi.advanceTimersByTime(35000);
      });

      expect(result.current.connectionStatus).toBe('duplicate');
      expect(mockWsInstance).toBe(firstWs); // nenhuma nova conexão aberta
    } finally {
      vi.useRealTimers();
    }
  });

  it('deve ir para student-id-in-use sem reconectar ao receber close 4002 (027/RF-2706)', async () => {
    vi.useFakeTimers();
    try {
      const { result } = await renderSubscriber();
      const firstWs = mockWsInstance;

      await act(async () => {
        firstWs.onclose({ code: 4002, reason: 'Student ID In Use' });
      });
      await act(async () => {
        vi.advanceTimersByTime(35000);
      });

      expect(result.current.connectionStatus).toBe('student-id-in-use');
      expect(mockWsInstance).toBe(firstWs); // nenhuma nova conexão aberta
    } finally {
      vi.useRealTimers();
    }
  });

  describe('fila de sinalização e negociação obsoleta (023)', () => {
    beforeEach(() => {
      class FakeInit {
        constructor(init: any) {
          Object.assign(this, init);
        }
      }
      vi.stubGlobal('RTCSessionDescription', FakeInit);
      vi.stubGlobal('RTCIceCandidate', FakeInit);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const offerMsg = (sdp: string) => ({ data: JSON.stringify({ type: 'offer', payload: { sdp } }) });
    const sentTypes = () => mockWsInstance.send.mock.calls.map((c: any[]) => JSON.parse(c[0]).type);

    function deferred() {
      let resolve!: () => void;
      let reject!: (err: Error) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('deve tratar stream-started só depois da answer da offer em andamento e responder a oferta seguinte com a PC nova (RF-2305)', async () => {
      await renderSubscriber();
      await act(async () => {
        mockWsInstance.onopen();
      });
      const pc1 = mockPcInstances[mockPcInstances.length - 1];
      const remote = deferred();
      pc1.setRemoteDescription = vi.fn(() => remote.promise);
      const pcCount = mockPcInstances.length;
      mockWsInstance.send.mockClear();

      let pending!: Promise<void>;
      await act(async () => {
        mockWsInstance.onmessage(offerMsg('oferta-video'));
        pending = mockWsInstance.onmessage({
          data: JSON.stringify({ type: 'stream-started', payload: { publisher_id: 'prof-01' } }),
        });
        await Promise.resolve();
      });

      // A offer ainda aguarda o setRemoteDescription: o stream-started não pode ter fechado a PC.
      expect(mockPcInstances.length).toBe(pcCount);
      expect(pc1.close).not.toHaveBeenCalled();
      expect(sentTypes()).toEqual([]);

      await act(async () => {
        remote.resolve();
        await pending;
      });

      expect(sentTypes()).toEqual(['answer', 'subscribe-request']);
      expect(pc1.close).toHaveBeenCalled();
      const pc2 = mockPcInstances[mockPcInstances.length - 1];
      expect(pc2).not.toBe(pc1);

      await act(async () => {
        await mockWsInstance.onmessage(offerMsg('oferta-video-audio'));
      });

      expect(pc1.setRemoteDescription).toHaveBeenCalledTimes(1);
      expect(pc2.setRemoteDescription).toHaveBeenCalledWith(expect.objectContaining({ sdp: 'oferta-video-audio' }));
      expect(sentTypes()).toEqual(['answer', 'subscribe-request', 'answer']);
    });

    it('não deve enviar answer de uma offer cuja PC foi descartada enquanto aguardava (RF-2306)', async () => {
      const { unmount } = await renderSubscriber();
      await act(async () => {
        mockWsInstance.onopen();
      });
      const pc1 = mockPcInstances[mockPcInstances.length - 1];
      const remote = deferred();
      pc1.setRemoteDescription = vi.fn(() => remote.promise);
      const ws = mockWsInstance;

      let pending!: Promise<void>;
      await act(async () => {
        pending = ws.onmessage(offerMsg('oferta-video'));
        await Promise.resolve();
      });
      unmount();
      ws.send.mockClear();

      remote.resolve();
      await pending;

      expect(pc1.createAnswer).not.toHaveBeenCalled();
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('não deve repetir o candidato ICE numa PC descartada (RF-2306)', async () => {
      const { unmount } = await renderSubscriber();
      await act(async () => {
        mockWsInstance.onopen();
      });
      const pc1 = mockPcInstances[mockPcInstances.length - 1];
      const ice = deferred();
      pc1.addIceCandidate = vi.fn(() => ice.promise);
      const ws = mockWsInstance;

      let pending!: Promise<void>;
      await act(async () => {
        pending = ws.onmessage({
          data: JSON.stringify({
            type: 'ice-candidate',
            payload: { candidate: JSON.stringify({ candidate: 'candidate:1 1 udp 1 10.0.0.2 5000 typ host' }) },
          }),
        });
        await Promise.resolve();
      });
      unmount();

      ice.reject(new Error('PC fechada'));
      await pending;

      expect(pc1.addIceCandidate).toHaveBeenCalledTimes(1);
    });
  });

  it('deve liberar o chat só com o WebSocket aberto e bloquear ao cair (005/RF-506)', async () => {
    vi.useFakeTimers();
    try {
      const { result } = await renderSubscriber();
      const firstWs = mockWsInstance;
      expect(result.current.isChatReady).toBe(false);

      await act(async () => {
        firstWs.onopen();
      });
      expect(result.current.isChatReady).toBe(true);

      // Queda inesperada: volta a bloquear durante a reconexão.
      await act(async () => {
        firstWs.readyState = 3; // CLOSED, como o navegador faz antes do onclose
        firstWs.onclose({ code: 1006, reason: '' });
      });
      expect(result.current.isChatReady).toBe(false);
      expect(result.current.connectionStatus).toBe('reconnecting');

      // Nova conexão: só libera no onopen do WS corrente.
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      const secondWs = mockWsInstance;
      expect(secondWs).not.toBe(firstWs);
      expect(result.current.isChatReady).toBe(false);
      await act(async () => {
        secondWs.onopen();
      });
      expect(result.current.isChatReady).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
