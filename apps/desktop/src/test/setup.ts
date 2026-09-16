import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock global do contextBridge electronAPI para testes de UI
window.electronAPI = {
  getScreenSources: vi.fn().mockResolvedValue([
    { id: 'screen:1', name: 'Tela Inteira 1', thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
    { id: 'window:2', name: 'Google Chrome', thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
  ]),
};

if (typeof window !== 'undefined') {
  // @ts-ignore
  globalThis.MediaStream = class MockMediaStream {
    getTracks() { return []; }
    getVideoTracks() { return []; }
    getAudioTracks() { return []; }
  };
}
