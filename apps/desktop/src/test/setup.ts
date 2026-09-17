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
};

if (typeof window !== 'undefined') {
  // @ts-ignore
  globalThis.MediaStream = class MockMediaStream {
    getTracks() { return []; }
    getVideoTracks() { return []; }
    getAudioTracks() { return []; }
    addTrack() {}
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
  navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(new globalThis.MediaStream());
}

