import { vi } from 'vitest';
import '@testing-library/jest-dom';

const mockSources = [
  { id: 'screen:1', name: 'Tela Inteira 1', type: 'screen', thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
  { id: 'window:2', name: 'Google Chrome', type: 'window', thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
];

// Mock global do contextBridge electronAPI para testes de UI
window.electronAPI = {
  getScreenSources: vi.fn().mockImplementation((type?: 'screen' | 'window') => {
    if (type) {
      return Promise.resolve(mockSources.filter((s) => s.type === type));
    }
    return Promise.resolve(mockSources);
  }),
  saveRecordedVideo: vi.fn().mockResolvedValue({
    success: true,
    filePath: 'C:/fake/path/aula-mlab.webm',
  }),
  checkMediaPermissions: vi.fn().mockResolvedValue({
    microphone: 'granted',
    screen: 'granted',
  }),
  requestMediaPermissions: vi.fn().mockResolvedValue({
    microphone: true,
    screen: true,
  }),
  copyToClipboard: vi.fn().mockResolvedValue(true),
  setActiveRoom: vi.fn().mockResolvedValue(undefined),
  setContentProtection: vi.fn().mockResolvedValue(true),
  captureWindowToClipboard: vi.fn().mockResolvedValue(true),
  startCursorTracking: vi.fn().mockResolvedValue(true),
  stopCursorTracking: vi.fn().mockResolvedValue(undefined),
  onActiveWindowChanged: vi.fn().mockImplementation(() => () => {}),
  onActiveWindowUnauthorized: vi.fn().mockImplementation(() => () => {}),
  onCursorState: vi.fn().mockImplementation(() => () => {}),
  startAnnotationOverlay: vi.fn().mockResolvedValue(true),
  stopAnnotationOverlay: vi.fn().mockResolvedValue(undefined),
  syncAnnotationState: vi.fn().mockResolvedValue(undefined),
  setAnnotationOverlayIgnoreMouse: vi.fn().mockResolvedValue(undefined),
  onAnnotationStateSync: vi.fn().mockImplementation(() => () => {}),
  onAnnotationShortcutCommand: vi.fn().mockImplementation(() => () => {}),
};

if (typeof window !== 'undefined') {
  if (typeof window.HTMLMediaElement !== 'undefined') {
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();
  }

  // @ts-ignore
  globalThis.MediaStream = class MockMediaStream {
    private _tracks: any[] = [];
    constructor(tracks?: any[]) {
      if (Array.isArray(tracks)) {
        this._tracks = [...tracks];
        return;
      }
      const mockVideoTrack = {
        kind: 'video',
        id: 'mock-video-track',
        enabled: true,
        contentHint: '',
        stop: vi.fn(),
        getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
      };
      const mockAudioTrack = {
        kind: 'audio',
        id: 'mock-audio-track',
        enabled: true,
        stop: vi.fn(),
        getSettings: () => ({ sampleRate: 48000, channelCount: 1 }),
      };
      this._tracks = [mockVideoTrack, mockAudioTrack];
    }
    getTracks() { return this._tracks; }
    getVideoTracks() { return this._tracks.filter((t) => t.kind === 'video'); }
    getAudioTracks() { return this._tracks.filter((t) => t.kind === 'audio'); }
    addTrack(track: any) { this._tracks.push(track); }
    removeTrack(track: any) { this._tracks = this._tracks.filter((t) => t !== track && t.id !== track?.id); }
  };

  // @ts-ignore
  globalThis.MediaRecorder = class MockMediaRecorder {
    state = 'inactive';
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;
    static isTypeSupported() { return true; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      if (this.onstop) this.onstop();
    }
    pause() { this.state = 'paused'; }
    resume() { this.state = 'recording'; }
  };

  // @ts-ignore
  globalThis.RTCPeerConnection = class MockRTCPeerConnection {
    iceConnectionState = 'connected';
    addTrack = vi.fn();
    getSenders = vi.fn().mockReturnValue([]);
    createOffer = vi.fn().mockResolvedValue({ sdp: 'mock-offer-sdp' });
    setLocalDescription = vi.fn().mockResolvedValue(undefined);
    setRemoteDescription = vi.fn().mockResolvedValue(undefined);
    addIceCandidate = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
    restartIce = vi.fn();
    setConfiguration = vi.fn();
  };

  // @ts-ignore
  globalThis.WebSocket = class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    send = vi.fn();
    close = vi.fn();
    onopen: any = null;
    onmessage: any = null;
    onerror: any = null;
    onclose: any = null;
    constructor() {
      setTimeout(() => {
        if (this.onopen) this.onopen({} as any);
      }, 0);
    }
  };

  if (!navigator.mediaDevices) {
    // @ts-ignore
    navigator.mediaDevices = {};
  }
  // @ts-ignore
  navigator.mediaDevices.getUserMedia = vi.fn().mockImplementation(() => Promise.resolve(new globalThis.MediaStream()));

  // Mock global de fetch para evitar ECONNREFUSED em testes ao acessar endpoints locais
  // @ts-ignore
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
      text: () => Promise.resolve(''),
    })
  );
}


