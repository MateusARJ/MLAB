import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScreenCapture } from './useScreenCapture';
import { enforceHighBitrateSDP } from './useWebRTCPublisher';

describe('useScreenCapture & Audio Feedback Suppression (Anti-Microfonia)', () => {
  let originalAudioContext: any;
  let mockSourceNode: any;
  let mockCompressorNode: any;
  let mockDestinationNode: any;
  let mockRawTrack: any;
  let mockProcessedTrack: any;
  let mockVideoTrack: any;
  let createdFilters: any[];

  beforeEach(() => {
    createdFilters = [];
    mockRawTrack = {
      kind: 'audio',
      id: 'raw-track-1',
      enabled: true,
      stop: vi.fn(),
    };
    mockProcessedTrack = {
      kind: 'audio',
      id: 'processed-track-1',
      enabled: true,
      stop: vi.fn(),
    };
    mockVideoTrack = {
      kind: 'video',
      id: 'video-track-1',
      enabled: true,
      stop: vi.fn(),
      getSettings: vi.fn().mockReturnValue({ width: 1920, height: 1080, frameRate: 30 }),
    };

    mockSourceNode = {
      connect: vi.fn(),
    };

    mockCompressorNode = {
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
    };

    mockDestinationNode = {
      stream: {
        getAudioTracks: vi.fn().mockReturnValue([mockProcessedTrack]),
      },
    };

    originalAudioContext = (window as any).AudioContext;

    class MockAudioContext {
      state = 'running';
      createMediaStreamSource = vi.fn().mockReturnValue(mockSourceNode);
      createBiquadFilter = vi.fn().mockImplementation(() => {
        const filter = {
          type: '',
          frequency: { value: 0 },
          connect: vi.fn(),
        };
        createdFilters.push(filter);
        return filter;
      });
      createDynamicsCompressor = vi.fn().mockReturnValue(mockCompressorNode);
      createMediaStreamDestination = vi.fn().mockReturnValue(mockDestinationNode);
      close = vi.fn().mockResolvedValue(undefined);
      resume = vi.fn().mockResolvedValue(undefined);
    }

    (window as any).AudioContext = MockAudioContext;

    const screenAudioTracks: any[] = [];
    const mockScreenStream = {
      id: 'mock-screen-stream',
      getTracks: vi.fn().mockImplementation(() => [mockVideoTrack, ...screenAudioTracks]),
      getVideoTracks: vi.fn().mockReturnValue([mockVideoTrack]),
      getAudioTracks: vi.fn().mockImplementation(() => screenAudioTracks),
      addTrack: vi.fn().mockImplementation((track: any) => {
        if (track && !screenAudioTracks.includes(track)) {
          screenAudioTracks.push(track);
        }
      }),
    };

    const mockMicStream = {
      id: 'mock-mic-stream',
      getTracks: vi.fn().mockReturnValue([mockRawTrack]),
      getAudioTracks: vi.fn().mockReturnValue([mockRawTrack]),
      getVideoTracks: vi.fn().mockReturnValue([]),
      addTrack: vi.fn(),
    };

    // @ts-ignore
    navigator.mediaDevices.getUserMedia = vi.fn().mockImplementation(async (constraints: any) => {
      if (constraints?.video) {
        return mockScreenStream;
      }
      if (constraints?.audio) {
        return mockMicStream;
      }
      return mockScreenStream;
    });
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
    vi.clearAllMocks();
  });

  it('deve solicitar microfone com parâmetros avançados de cancelamento de eco, ganho e ruído', async () => {
    const { result } = renderHook(() => useScreenCapture());

    await act(async () => {
      await result.current.selectSource({
        id: 'screen:1',
        name: 'Tela Principal',
        type: 'screen',
        thumbnail: '',
      });
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
        }),
      })
    );
  });

  it('deve montar o grafo Web Audio de limitação dinâmica e filtragem anti-uivo', async () => {
    const { result } = renderHook(() => useScreenCapture());

    await act(async () => {
      await result.current.selectSource({
        id: 'screen:1',
        name: 'Tela Principal',
        type: 'screen',
        thumbnail: '',
      });
    });

    // 2 filtros criados: highpass (85Hz) e lowpass (7500Hz)
    expect(createdFilters.length).toBe(2);
    expect(createdFilters[0].type).toBe('highpass');
    expect(createdFilters[0].frequency.value).toBe(85);
    expect(createdFilters[1].type).toBe('lowpass');
    expect(createdFilters[1].frequency.value).toBe(7500);

    // Hard Limiter Dinâmico (DynamicsCompressor)
    expect(mockCompressorNode.threshold.value).toBe(-6);
    expect(mockCompressorNode.ratio.value).toBe(20);
    expect(mockCompressorNode.attack.value).toBe(0.001);
    expect(mockCompressorNode.release.value).toBe(0.15);

    // Conexões: Source -> Highpass -> Lowpass -> Limiter -> Destination
    expect(mockSourceNode.connect).toHaveBeenCalledWith(createdFilters[0]);
    expect(createdFilters[0].connect).toHaveBeenCalledWith(createdFilters[1]);
    expect(createdFilters[1].connect).toHaveBeenCalledWith(mockCompressorNode);
    expect(mockCompressorNode.connect).toHaveBeenCalledWith(mockDestinationNode);
  });

  it('deve sincronizar o mute do microfone entre a faixa processada e o stream bruto', async () => {
    const { result } = renderHook(() => useScreenCapture());

    await act(async () => {
      await result.current.selectSource({
        id: 'screen:1',
        name: 'Tela Principal',
        type: 'screen',
        thumbnail: '',
      });
    });

    // Estado inicial: micMuted é true por padrão
    expect(result.current.micMuted).toBe(true);
    expect(mockProcessedTrack.enabled).toBe(false);

    // Desmuta o microfone
    act(() => {
      result.current.toggleMicMute();
    });

    expect(result.current.micMuted).toBe(false);
    expect(mockProcessedTrack.enabled).toBe(true);
    expect(mockRawTrack.enabled).toBe(true);

    // Muta o microfone novamente
    act(() => {
      result.current.toggleMicMute();
    });

    expect(result.current.micMuted).toBe(true);
    expect(mockProcessedTrack.enabled).toBe(false);
    expect(mockRawTrack.enabled).toBe(false);
  });

  it('deve encerrar o AudioContext e interromper faixas brutas ao chamar stopCapture', async () => {
    const { result } = renderHook(() => useScreenCapture());

    await act(async () => {
      await result.current.selectSource({
        id: 'screen:1',
        name: 'Tela Principal',
        type: 'screen',
        thumbnail: '',
      });
    });

    act(() => {
      result.current.stopCapture();
    });

    expect(result.current.stream).toBeNull();
    expect(mockRawTrack.stop).toHaveBeenCalled();
  });

  it('deve reconhecer abas e janelas legítimas mesmo que contenham mlab no título', async () => {
    const customSources = [
      { id: 'window:10', name: 'GitHub - mlab-project - Google Chrome', type: 'window' as const, thumbnail: 'thumb-1' },
      { id: 'window:11', name: 'MLab Student Portal - Edge', type: 'window' as const, thumbnail: 'thumb-2' },
      { id: 'window:12', name: 'Visual Studio Code', type: 'window' as const, thumbnail: 'thumb-3' },
    ];

    vi.spyOn(window.electronAPI, 'getScreenSources').mockResolvedValue(customSources);

    const { result } = renderHook(() => useScreenCapture('window'));

    await act(async () => {
      await result.current.refreshSources();
    });

    expect(result.current.sources).toHaveLength(3);
    expect(result.current.sources.map((s) => s.name)).toEqual([
      'GitHub - mlab-project - Google Chrome',
      'MLab Student Portal - Edge',
      'Visual Studio Code',
    ]);
  });
});

describe('useWebRTCPublisher SDP Transformation (Opus DTX & Anti-Microfonia)', () => {
  it('deve injetar usedtx=1 e stereo=0 em SDP contendo codec Opus com fmtp existente', () => {
    const inputSDP = [
      'v=0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1',
      'm=video 9 UDP/TLS/RTP/SAVPF 96',
      'a=rtpmap:96 VP8/90000',
      '',
    ].join('\r\n');

    const transformedSDP = enforceHighBitrateSDP(inputSDP, 4000);

    expect(transformedSDP).toContain('a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0');
    expect(transformedSDP).toContain('b=AS:4000');
    expect(transformedSDP).toContain('x-google-start-bitrate=4000');
  });

  it('deve criar linha fmtp com usedtx=1 e mono caso o SDP tenha rtpmap de Opus sem fmtp prévio', () => {
    const inputSDP = [
      'v=0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=rtpmap:111 opus/48000/2',
      'm=video 9 UDP/TLS/RTP/SAVPF 96',
      'a=rtpmap:96 VP8/90000',
      '',
    ].join('\r\n');

    const transformedSDP = enforceHighBitrateSDP(inputSDP, 4000);

    expect(transformedSDP).toContain('a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0');
  });
});
